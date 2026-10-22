// Pruebas contra un PostgreSQL real. Se omiten si no hay conexión configurada.
//
//   SQL_TEST_SERVER=localhost SQL_TEST_PORT=5432 SQL_TEST_DATABASE=expedite_test \
//   SQL_TEST_USER=postgres SQL_TEST_PASSWORD=... SQL_TEST_TRUST_CERT=true pnpm test
//
// Usa una base exclusiva para pruebas, nunca la compartida: las tablas se borran.

import { readFile } from "node:fs/promises";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { crearApp } from "../src/app.js";
import { crearVerificadorDev } from "../src/auth/verificador.js";
import { RepositorioMemoria } from "../src/repos/memoria.js";
import { ErrorCodigoDuplicado } from "../src/repos/planes.js";
import { ErrorPlanDuplicado } from "../src/repos/planesAccion.js";
import { RepositorioEvidenciasMemoria } from "../src/repos/evidenciasMemoria.js";
import { RepositorioPlanesAccionMemoria } from "../src/repos/planesAccionMemoria.js";
import { RepositorioPlanesAccionSql } from "../src/repos/planesAccionSql.js";
import { RepositorioPlanesMemoria } from "../src/repos/planesMemoria.js";
import { RepositorioPlanesSql } from "../src/repos/planesSql.js";
import { ErrorCorreoDuplicado } from "../src/repos/repositorio.js";
import { RepositorioSql } from "../src/repos/sql.js";
import { escuchar } from "./servidor.js";

const env = process.env;
const conexion = {
  servidor: env.SQL_TEST_SERVER ?? "",
  puerto: Number(env.SQL_TEST_PORT ?? 5432),
  baseDatos: env.SQL_TEST_DATABASE ?? "",
  usuario: env.SQL_TEST_USER ?? "",
  contrasena: env.SQL_TEST_PASSWORD ?? "",
  confiarCertificado: env.SQL_TEST_TRUST_CERT === "true",
};

const script = (nombre: string) => readFile(new URL(`../sql/${nombre}`, import.meta.url), "utf8");

describe.skipIf(!conexion.servidor)("repositorio sobre PostgreSQL", () => {
  let pool: pg.Pool;
  let repo: RepositorioSql;
  let rolId: Record<string, number>;

  beforeAll(async () => {
    pool = new pg.Pool({
      host: conexion.servidor,
      port: conexion.puerto,
      database: conexion.baseDatos,
      user: conexion.usuario,
      password: conexion.contrasena,
      ssl: { rejectUnauthorized: !conexion.confiarCertificado },
    });

    // Los scripts se ejecutan dos veces cada uno: deben poder repetirse.
    await pool.query(`
      DROP TABLE IF EXISTS action_plans, findings, conflict_declarations, audit_controls, controls, processes, business_units, fiscal_periods,
                           audits, audit_plans, users, role_permissions, permissions, roles CASCADE`);
    const scripts = [
      "001_schema.sql", "002_seed.sql", "004_findings.sql", "006_auditorias.sql", "007_action_plans.sql",
      "008_estructura_y_controles.sql",
    ];
    for (const nombre of [...scripts, ...scripts]) {
      await pool.query(await script(nombre));
    }

    repo = await RepositorioSql.conectar(conexion);
    rolId = Object.fromEntries((await repo.listarRoles()).map((r) => [r.nombre, r.id]));
  });

  beforeEach(async () => {
    await pool.query(`
      DELETE FROM action_plans; DELETE FROM findings; DELETE FROM audit_controls; DELETE FROM controls; DELETE FROM processes; DELETE FROM business_units;
      DELETE FROM fiscal_periods; DELETE FROM audit_plans; DELETE FROM users;`);
    await repo.crearUsuario({ nombre: "Sofía Ramírez", correo: "s.ramirez@expedite.com", rolId: rolId["Administrador"]! });
    await repo.crearUsuario({ nombre: "Ana Rodríguez", correo: "a.rodriguez@expedite.com", rolId: rolId["Auditor"]! });
  });

  afterAll(async () => {
    await repo?.cerrar();
    await pool?.end();
  });

  it("los scripts repetidos no duplican roles ni permisos", async () => {
    const { rows } = await pool.query(`
      SELECT (SELECT COUNT(*)::int FROM roles) AS roles,
             (SELECT COUNT(*)::int FROM permissions) AS permisos,
             (SELECT COUNT(*)::int FROM role_permissions) AS asignaciones`);

    expect(rows[0]).toEqual({ roles: 6, permisos: 8, asignaciones: 24 });
  });

  it("crea los índices de la tabla users", async () => {
    const { rows } = await pool.query<{ name: string; is_unique: boolean; has_filter: boolean }>(`
      SELECT c.relname AS name, i.indisunique AS is_unique, i.indpred IS NOT NULL AS has_filter
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      WHERE i.indrelid = 'users'::regclass AND c.relname IN ('uq_users_entra_oid', 'ix_users_role_id')
      ORDER BY c.relname`);

    expect(rows).toEqual([
      { name: "ix_users_role_id", is_unique: false, has_filter: false },
      { name: "uq_users_entra_oid", is_unique: true, has_filter: true },
    ]);
  });

  it("dos usuarios no pueden compartir la misma identidad de Entra", async () => {
    await pool.query("UPDATE users SET entra_oid = 'oid-1' WHERE email = 's.ramirez@expedite.com'");

    await expect(
      pool.query("UPDATE users SET entra_oid = 'oid-1' WHERE email = 'a.rodriguez@expedite.com'"),
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

  it("busca por correo sin distinguir mayúsculas, pero no acepta caracteres parecidos", async () => {
    expect((await repo.buscarPorCorreo("A.Rodriguez@Expedite.com"))?.nombre).toBe("Ana Rodríguez");
    // "ａ" de ancho completo: la base la iguala con "a"; no debe identificar a Ana.
    expect(await repo.buscarPorCorreo("ａ.rodriguez@expedite.com")).toBeNull();
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
    await pool.query("UPDATE users SET status = 'inactive' WHERE email = 's.ramirez@expedite.com'");

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
      pool.query("UPDATE users SET status = 'borrado' WHERE email = 'a.rodriguez@expedite.com'"),
    ).rejects.toThrow(/ck_users_status/);
    await expect(repo.crearUsuario({ nombre: "X", correo: "x@expedite.com", rolId: 999_999 })).rejects.toThrow(
      /fk_users_role/,
    );
  });

  it("el script del primer administrador exige editar los datos", async () => {
    await expect(pool.query(await script("003_primer_administrador.sql"))).rejects.toThrow(/Cambia nombre/);
  });

  it("el script del primer administrador crea al usuario una sola vez", async () => {
    const editado = (await script("003_primer_administrador.sql"))
      .replace("CAMBIAR: nombre completo", "Primera Admin")
      .replace("cambiar@dominio-corporativo.com", "Primera.Admin@expedite.com");
    await pool.query(editado);
    await pool.query(editado);

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

  it("guarda, edita y consulta planes de acción", async () => {
    const planesAccion = new RepositorioPlanesAccionSql(pool);
    const admin = (await repo.buscarPorCorreo("s.ramirez@expedite.com"))!;
    const ana = (await repo.buscarPorCorreo("a.rodriguez@expedite.com"))!;
    await pool.query(
      `INSERT INTO findings (id, folio, title, severity, status, "auditId") VALUES ('HAL-P-1', 'HAL-P-1', 'Hallazgo de prueba', 'Alto', 'Abierto', 'AUD-001')`,
    );
    const datos = { hallazgoId: "HAL-P-1", descripcion: "Corregir accesos", responsableId: ana.id, fechaCompromiso: "2026-11-30" };

    const creado = await planesAccion.crear(datos, admin.id);
    expect(creado).toMatchObject({
      hallazgo: { id: "HAL-P-1", fechaCierreAuditoria: "2025-08-31" },
      responsable: { id: ana.id, nombre: "Ana Rodríguez" },
      fechaCompromiso: "2026-11-30",
      estado: "Asignado",
    });
    expect((await pool.query("SELECT status FROM findings WHERE id = 'HAL-P-1'")).rows[0].status).toBe("Asignado");
    await expect(planesAccion.crear(datos, admin.id)).rejects.toBeInstanceOf(ErrorPlanDuplicado);

    const editado = await planesAccion.actualizar(creado.id, {
      descripcion: "Corregir accesos y revisar roles", responsableId: admin.id, fechaCompromiso: "2026-12-15", estado: "En Progreso",
    });
    expect(editado).toMatchObject({
      descripcion: "Corregir accesos y revisar roles",
      responsable: { id: admin.id, nombre: "Sofía Ramírez" },
      fechaCompromiso: "2026-12-15",
      estado: "En Progreso",
    });
    expect(await planesAccion.buscarPorId(creado.id)).toEqual(editado);
    expect(await planesAccion.actualizar(999_999, { ...datos, estado: "Completado" })).toBeNull();
    expect(await planesAccion.listarPorResponsable(admin.id)).toHaveLength(1);
  });
});
