// Pruebas contra un SQL Server o Azure SQL real. Se omiten si no hay conexión configurada.
//
//   SQL_TEST_SERVER=localhost SQL_TEST_PORT=1433 SQL_TEST_DATABASE=expedite_test \
//   SQL_TEST_USER=sa SQL_TEST_PASSWORD=... pnpm test
//
// Usa una base exclusiva para pruebas: el contenido de la tabla users se borra.

import { readFile } from "node:fs/promises";
import sql from "mssql";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { crearApp } from "../src/app.js";
import { crearVerificadorDev } from "../src/auth/verificador.js";
import { RepositorioMemoria } from "../src/repos/memoria.js";
import { ErrorCodigoDuplicado } from "../src/repos/planes.js";
import { RepositorioEvidenciasMemoria } from "../src/repos/evidenciasMemoria.js";
import { RepositorioPlanesAccionMemoria } from "../src/repos/planesAccionMemoria.js";
import { RepositorioPlanesMemoria } from "../src/repos/planesMemoria.js";
import { RepositorioPlanesSql } from "../src/repos/planesSql.js";
import { ErrorCorreoDuplicado } from "../src/repos/repositorio.js";
import { RepositorioSql } from "../src/repos/sql.js";
import { escuchar } from "./servidor.js";

const env = process.env;
const conexion = {
  servidor: env.SQL_TEST_SERVER ?? "",
  puerto: Number(env.SQL_TEST_PORT ?? 1433),
  baseDatos: env.SQL_TEST_DATABASE ?? "",
  usuario: env.SQL_TEST_USER ?? "",
  contrasena: env.SQL_TEST_PASSWORD ?? "",
  confiarCertificado: env.SQL_TEST_TRUST_CERT === "true",
};

const script = (nombre: string) => readFile(new URL(`../sql/${nombre}`, import.meta.url), "utf8");

describe.skipIf(!conexion.servidor)("repositorio sobre SQL Server", () => {
  let pool: sql.ConnectionPool;
  let repo: RepositorioSql;
  let rolId: Record<string, number>;

  beforeAll(async () => {
    pool = await new sql.ConnectionPool({
      server: conexion.servidor,
      port: conexion.puerto,
      database: conexion.baseDatos,
      user: conexion.usuario,
      password: conexion.contrasena,
      options: { encrypt: true, trustServerCertificate: conexion.confiarCertificado },
    }).connect();

    // Los scripts se ejecutan como lo hace sqlcmd, que trae QUOTED_IDENTIFIER desactivado,
    // y dos veces cada uno: deben poder repetirse.
    const comoSqlcmd = await new sql.ConnectionPool({
      server: conexion.servidor,
      port: conexion.puerto,
      database: conexion.baseDatos,
      user: conexion.usuario,
      password: conexion.contrasena,
      options: { encrypt: true, trustServerCertificate: conexion.confiarCertificado, enableQuotedIdentifier: false },
    }).connect();
    try {
      await comoSqlcmd.request().batch("DROP TABLE IF EXISTS dbo.audit_plans, dbo.users, dbo.role_permissions, dbo.permissions, dbo.roles");
      for (const nombre of ["001_schema.sql", "002_seed.sql", "001_schema.sql", "002_seed.sql"]) {
        await comoSqlcmd.request().batch(await script(nombre));
      }
    } finally {
      await comoSqlcmd.close();
    }

    repo = await RepositorioSql.conectar(conexion);
    rolId = Object.fromEntries((await repo.listarRoles()).map((r) => [r.nombre, r.id]));
  });

  beforeEach(async () => {
    await pool.request().batch("DELETE FROM dbo.audit_plans; DELETE FROM dbo.users;");
    await repo.crearUsuario({ nombre: "Sofía Ramírez", correo: "s.ramirez@expedite.com", rolId: rolId["Administrador"]! });
    await repo.crearUsuario({ nombre: "Ana Rodríguez", correo: "a.rodriguez@expedite.com", rolId: rolId["Auditor"]! });
  });

  afterAll(async () => {
    await repo?.cerrar();
    await pool?.close();
  });

  it("los scripts repetidos no duplican roles ni permisos", async () => {
    const { recordset } = await pool.request().query(`
      SELECT (SELECT COUNT(*) FROM dbo.roles) AS roles,
             (SELECT COUNT(*) FROM dbo.permissions) AS permisos,
             (SELECT COUNT(*) FROM dbo.role_permissions) AS asignaciones`);

    expect(recordset[0]).toEqual({ roles: 6, permisos: 8, asignaciones: 24 });
  });

  it("crea los índices de la tabla users", async () => {
    const { recordset } = await pool.request().query<{ name: string; is_unique: boolean; has_filter: boolean }>(`
      SELECT name, is_unique, has_filter FROM sys.indexes
      WHERE object_id = OBJECT_ID('dbo.users') AND name IN ('uq_users_entra_oid', 'ix_users_role_id')
      ORDER BY name`);

    expect(recordset).toEqual([
      { name: "ix_users_role_id", is_unique: false, has_filter: false },
      { name: "uq_users_entra_oid", is_unique: true, has_filter: true },
    ]);
  });

  it("dos usuarios no pueden compartir la misma identidad de Entra", async () => {
    await pool.request().batch("UPDATE dbo.users SET entra_oid = 'oid-1' WHERE email = 's.ramirez@expedite.com'");

    await expect(
      pool.request().batch("UPDATE dbo.users SET entra_oid = 'oid-1' WHERE email = 'a.rodriguez@expedite.com'"),
    ).rejects.toThrow(/uq_users_entra_oid/);
  });

  it("los roles y permisos de la base coinciden con los del repositorio en memoria", async () => {
    const quitarId = (roles: { nombre: string; permisos: string[] }[]) =>
      roles.map(({ nombre, permisos }) => ({ nombre, permisos }));

    expect(quitarId(await repo.listarRoles())).toEqual(quitarId(await new RepositorioMemoria().listarRoles()));
  });

  it("lista usuarios con nombre, correo, rol y estado", async () => {
    expect(await repo.listarUsuarios()).toEqual([
      expect.objectContaining({ nombre: "Ana Rodríguez", correo: "a.rodriguez@expedite.com", rol: "Auditor", estado: "active", ultimoAcceso: null }),
      expect.objectContaining({ nombre: "Sofía Ramírez", correo: "s.ramirez@expedite.com", rol: "Administrador", estado: "active" }),
    ]);
  });

  it("rechaza correos duplicados sin distinguir mayúsculas", async () => {
    await expect(
      repo.crearUsuario({ nombre: "Otra Ana", correo: "A.Rodriguez@expedite.com", rolId: rolId["Auditor"]! }),
    ).rejects.toBeInstanceOf(ErrorCorreoDuplicado);
  });

  it("guarda el texto tal cual, sin interpretarlo como SQL", async () => {
    const nombre = "Robert'); DROP TABLE users;-- Ñandú 审计";
    const creado = await repo.crearUsuario({ nombre, correo: "r.tables@expedite.com", rolId: rolId["Auditor"]! });

    expect(creado.nombre).toBe(nombre);
    expect(await repo.buscarPorCorreo("x' OR '1'='1")).toBeNull();
    expect(await repo.listarUsuarios()).toHaveLength(3);
  });

  it("cambia el rol y cuenta los administradores activos", async () => {
    const ana = (await repo.buscarPorCorreo("a.rodriguez@expedite.com"))!;
    expect(await repo.contarActivosConRol(rolId["Administrador"]!)).toBe(1);

    const actualizada = await repo.cambiarRol(ana.id, rolId["Administrador"]!);

    expect(actualizada?.rol).toBe("Administrador");
    expect(await repo.contarActivosConRol(rolId["Administrador"]!)).toBe(2);
    expect(await repo.cambiarRol(999_999, rolId["Auditor"]!)).toBeNull();
  });

  it("no cuenta a los administradores inactivos", async () => {
    await pool.request().batch("UPDATE dbo.users SET status = 'inactive' WHERE email = 's.ramirez@expedite.com'");

    expect(await repo.contarActivosConRol(rolId["Administrador"]!)).toBe(0);
  });

  it("asocia la identidad de Entra una sola vez", async () => {
    const ana = (await repo.buscarPorCorreo("a.rodriguez@expedite.com"))!;

    expect(await repo.buscarPorOid("oid-ana")).toBeNull();
    expect(await repo.vincularOid(ana.id, "oid-ana")).toBe(true);
    expect(await repo.vincularOid(ana.id, "oid-impostor")).toBe(false);
    expect((await repo.buscarPorOid("oid-ana"))?.correo).toBe("a.rodriguez@expedite.com");
  });

  it("registra la fecha del último acceso", async () => {
    const ana = (await repo.buscarPorCorreo("a.rodriguez@expedite.com"))!;
    await repo.registrarAcceso(ana.id);

    const ultimoAcceso = (await repo.buscarPorId(ana.id))!.ultimoAcceso!;
    expect(Math.abs(Date.now() - Date.parse(ultimoAcceso))).toBeLessThan(60_000);
  });

  it("la base rechaza un estado de cuenta desconocido y un rol inexistente", async () => {
    await expect(
      pool.request().batch("UPDATE dbo.users SET status = 'borrado' WHERE email = 'a.rodriguez@expedite.com'"),
    ).rejects.toThrow(/ck_users_status/);
    await expect(repo.crearUsuario({ nombre: "X", correo: "x@expedite.com", rolId: 999_999 })).rejects.toThrow(
      /fk_users_role/,
    );
  });

  it("el script del primer administrador exige editar los datos", async () => {
    await expect(pool.request().batch(await script("003_primer_administrador.sql"))).rejects.toThrow(/Cambia @nombre/);
  });

  it("el script del primer administrador crea al usuario una sola vez", async () => {
    const editado = (await script("003_primer_administrador.sql"))
      .replace("CAMBIAR: nombre completo", "Primera Admin")
      .replace("cambiar@dominio-corporativo.com", "Primera.Admin@expedite.com");
    await pool.request().batch(editado);
    await pool.request().batch(editado);

    expect(await repo.buscarPorCorreo("primera.admin@expedite.com")).toMatchObject({
      nombre: "Primera Admin",
      rol: "Administrador",
    });
    expect(await repo.listarUsuarios()).toHaveLength(3);
  });

  describe("la API completa sobre la base real", () => {
    const ADMIN = "s.ramirez@expedite.com";
    const ANA = "a.rodriguez@expedite.com";
    const api = () =>
      escuchar(
        crearApp({
          repo,
          repoPlanes: new RepositorioPlanesMemoria(repo),
          repoPlanesAccion: new RepositorioPlanesAccionMemoria(repo),
          repoEvidencias: new RepositorioEvidenciasMemoria(),
          proveedorIA: null,
          verificador: crearVerificadorDev(),
          dominiosPermitidos: ["expedite.com"],
          corsOrigin: "http://localhost:5173",
          registrarEvento: () => {},
        }),
      );

    it("CA1: lista la tabla de usuarios", async () => {
      const res = await request(await api()).get("/api/usuarios").set("X-Dev-Usuario", ADMIN);

      expect(res.status).toBe(200);
      expect(res.body.map((u: { correo: string }) => u.correo)).toEqual([ANA, ADMIN]);
    });

    it("CA2: el cambio de rol se refleja en la siguiente petición del usuario", async () => {
      const app = await api();
      const ana = (await repo.buscarPorCorreo(ANA))!;

      await request(app).patch(`/api/usuarios/${ana.id}/rol`).set("X-Dev-Usuario", ADMIN).send({ rol: "Jefe de Auditoría" });
      const res = await request(app).get("/api/me").set("X-Dev-Usuario", ANA);

      expect(res.body.rol).toBe("Jefe de Auditoría");
      expect(res.body.permisos).toContain("Aprobar Riesgos");
    });

    it("CA3: rechaza el dominio ajeno y acepta el corporativo", async () => {
      const app = await api();
      const alta = (correo: string) =>
        request(app).post("/api/usuarios").set("X-Dev-Usuario", ADMIN).send({ nombre: "Luis Peña", correo, rol: "Auditor" });

      expect((await alta("l.pena@gmail.com")).status).toBe(422);
      expect((await alta("l.pena@expedite.com")).status).toBe(201);
      expect((await alta("L.Pena@expedite.com")).status).toBe(409);
      expect(await repo.listarUsuarios()).toHaveLength(3);
    });

    it("impide dejar el sistema sin Administrador activo", async () => {
      const admin = (await repo.buscarPorCorreo(ADMIN))!;
      const res = await request(await api()).patch(`/api/usuarios/${admin.id}/rol`).set("X-Dev-Usuario", ADMIN).send({ rol: "Auditor" });

      expect(res.status).toBe(409);
    });
  });

  it("guarda, edita y consulta planes de auditoría", async () => {
    const planes = new RepositorioPlanesSql(pool);
    const admin = (await repo.buscarPorCorreo("s.ramirez@expedite.com"))!;
    const datos = {
      codigo: "PAI-2026-001", nombre: "Plan Compras 2026", tipo: "Anual" as const, periodo: "Q1 2026", fechaInicio: "2026-01-10",
      fechaFin: "2026-03-31", estado: "Borrador" as const, horasEstimadas: 120, responsableId: admin.id, alcance: null,
    };

    const creado = await planes.crear(datos, admin.id);
    expect(creado).toMatchObject({ codigo: "PAI-2026-001", tipo: "Anual", fechaInicio: "2026-01-10", responsable: { nombre: "Sofía Ramírez" } });
    await expect(planes.crear(datos, admin.id)).rejects.toBeInstanceOf(ErrorCodigoDuplicado);

    expect(await planes.actualizar(creado.id, { ...datos, estado: "Aprobado" })).toMatchObject({ estado: "Aprobado" });
    expect(await planes.listar()).toHaveLength(1);
  });
});
