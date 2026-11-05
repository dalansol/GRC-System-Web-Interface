// Edición de Excel en la plataforma (UF-17, SF-08, historia #106): abrir el archivo de una
// evidencia y guardar versiones nuevas. Las rutas de evidencias consultan la base directo,
// así que estas pruebas corren contra un PostgreSQL real y se omiten sin SQL_TEST_*
// (mismas variables que sql.integracion.test.ts). Trabajan en un esquema propio.

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readFile } from "node:fs/promises";
import type { Server } from "node:http";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AlmacenamientoLocal, type AlmacenamientoArchivos } from "../src/almacenamiento.js";
import { crearApp } from "../src/app.js";
import { crearVerificadorDev } from "../src/auth/verificador.js";
import { registrarPool } from "../src/db.js";
import { RepositorioMemoria } from "../src/repos/memoria.js";
import { RepositorioEvidenciasMemoria } from "../src/repos/evidenciasMemoria.js";
import { RepositorioPlanesAccionMemoria } from "../src/repos/planesAccionMemoria.js";
import { RepositorioPlanesMemoria } from "../src/repos/planesMemoria.js";
import { rutasEvidencias } from "../src/routes/evidencias.js";
import { escuchar } from "./servidor.js";

const env = process.env;
const ESQUEMA = "prueba_versiones";
const SCRIPTS = [
  "001_schema.sql",
  "002_seed.sql",
  "004_findings.sql",
  "006_auditorias.sql",
  "007_action_plans.sql",
  "008_estructura_y_controles.sql",
  "010_catalogos_riesgos_y_ejecucion.sql",
  "011_audit_controls_plan.sql",
  "012_seguimiento_controles.sql",
  "013_seguimiento_asignaciones_control.sql",
  "014_quitar_seguimiento_controles_catalogo.sql",
  "015_seed_estructura.sql",
  "016_mantener_controles_al_eliminar_proceso.sql",
  "017_jerarquia_organizacional.sql",
  "019_riesgos_jerarquia.sql",
  "021_nombres_reales.sql",
  "023_codigo_y_nombre.sql",
  "025_nombres_unicos.sql",
  "026_nombres_periodos.sql",
  "027_formatos_evidencia.sql",
  "028_estado_inicial_controles_progreso.sql",
  "029_conflictos_por_plan.sql",
  "031_rls_control_horas.sql",
  "032_normalizar_entidad_evidencias_control.sql",
  "033_campos_muestra_rotacion_controles.sql",
  "034_catalogos_estructura.sql",
  "034_portal_auditado.sql",
  "035_normalizar_root_cause_plan.sql",
  "035_trimestres_periodos.sql",
  "036_permitir_varios_planes_por_hallazgo.sql",
  "037_migrar_relacion_planes_hallazgos.sql",
  "038_public_id_planes_accion.sql",
  "039_entidad_evidencias.sql",
  "040_evidencias_entidad_unica.sql",
  "041_estado_revision_planes.sql",
  "042_procesos_en_asignaciones.sql",
  "044_flujo_aprobacion_planes.sql",
  "045_etapas_planes_accion.sql",
  "048_versiones_evidencia.sql",
];
const script = (nombre: string) => readFile(new URL(`../sql/${nombre}`, import.meta.url), "utf8");

const AUDITORA = "a.rodriguez@expedite.com";
const OTRA_AUDITORA = "l.fernandez@expedite.com";
const SOLO_LECTURA = "d.torres@expedite.com";
const JEFA = "m.garcia@expedite.com";
const SENIOR = "c.morales@expedite.com";
const JEFE_AUDITADO = "j.ejemplo@expedite.com";
const EMPLEADO_AUDITADO = "c.ejemplo@expedite.com";
const EVIDENCIA = "EV-prueba-1";

// Un .xlsx mínimo para las pruebas: lo que importa es que sea un ZIP ("PK") distinto cada vez.
const libro = (marca: string) => Buffer.concat([Buffer.from("PK\u0003\u0004"), Buffer.from(marca)]);

describe.skipIf(!env.SQL_TEST_SERVER)("archivo y versiones de evidencias sobre PostgreSQL", () => {
  let pool: pg.Pool;
  let carpeta: string;
  let almacenamiento: AlmacenamientoArchivos;
  let app: Server;
  let usuarios: RepositorioMemoria;

  const como = (correo: string) => ({
    get: (ruta: string) => request(app).get(ruta).set("X-Dev-Usuario", correo),
    post: (ruta: string) => request(app).post(ruta).set("X-Dev-Usuario", correo),
  });
  const idDe = async (correo: string) => String((await usuarios.buscarPorCorreo(correo))!.id);

  beforeAll(async () => {
    pool = new pg.Pool({
      host: env.SQL_TEST_SERVER,
      port: Number(env.SQL_TEST_PORT ?? 5432),
      database: env.SQL_TEST_DATABASE,
      user: env.SQL_TEST_USER,
      password: env.SQL_TEST_PASSWORD,
      ssl: { rejectUnauthorized: env.SQL_TEST_TRUST_CERT !== "true" },
      options: `-c search_path=${ESQUEMA}`,
    });
    await pool.query(`DROP SCHEMA IF EXISTS ${ESQUEMA} CASCADE; CREATE SCHEMA ${ESQUEMA};`);
    for (const nombre of SCRIPTS) await pool.query(await script(nombre));
    registrarPool(pool);
    carpeta = await mkdtemp(path.join(tmpdir(), "expedite-versiones-"));
    almacenamiento = new AlmacenamientoLocal(carpeta);
  });

  beforeEach(async () => {
    usuarios = new RepositorioMemoria();
    app = await escuchar(
      crearApp({
        repo: usuarios,
        repoPlanes: new RepositorioPlanesMemoria(usuarios),
        repoPlanesAccion: new RepositorioPlanesAccionMemoria(usuarios),
        repoEvidencias: new RepositorioEvidenciasMemoria(),
        proveedorIA: null,
        rutasConSesion: [rutasEvidencias(almacenamiento)],
        verificador: crearVerificadorDev(),
        dominiosPermitidos: ["expedite.com"],
        corsOrigin: "http://localhost:5173",
        registrarEvento: () => {},
      }),
    );
    await pool.query("DELETE FROM evidence");
    // Una evidencia de hallazgo subida por la auditora (quien la subió puede verla y editarla).
    await almacenamiento.guardar(`${EVIDENCIA}.xlsx`, libro("original"), "application/octet-stream");
    await pool.query(
      `INSERT INTO evidence (id, entity_id, entity_type, file_name, mime_type, file_size, file_hash, storage_path, uploaded_by)
       VALUES ($1, 'HAL-1', 'hallazgo', 'Conciliacion.xlsx', 'xlsx', 12, 'hash-original', $2, $3)`,
      [EVIDENCIA, `${EVIDENCIA}.xlsx`, await idDe(AUDITORA)],
    );
  });

  afterAll(async () => {
    await pool?.query(`DROP SCHEMA IF EXISTS ${ESQUEMA} CASCADE`);
    await pool?.end();
    if (carpeta) await rm(carpeta, { recursive: true, force: true });
  });

  it("entrega el archivo vigente como binario a quien subió la evidencia", async () => {
    const res = await como(AUDITORA).get(`/api/evidencias/${EVIDENCIA}/archivo`).buffer().parse((r, cb) => {
      const partes: Buffer[] = [];
      r.on("data", (c: Buffer) => partes.push(c));
      r.on("end", () => cb(null, Buffer.concat(partes)));
    });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("spreadsheetml");
    expect(res.headers["x-evidencia-version"]).toBe("1");
    expect(Buffer.from(res.body).equals(libro("original"))).toBe(true);
  });

  it("responde 404 a quien no puede ver la evidencia y 404 si no existe", async () => {
    expect((await como(SOLO_LECTURA).get(`/api/evidencias/${EVIDENCIA}/archivo`)).status).toBe(404);
    expect((await como(AUDITORA).get("/api/evidencias/EV-nada/archivo")).status).toBe(404);
    expect((await request(app).get(`/api/evidencias/${EVIDENCIA}/archivo`)).status).toBe(401);
  });

  it("solo abre libros de Excel", async () => {
    await pool.query("UPDATE evidence SET mime_type = 'pdf' WHERE id = $1", [EVIDENCIA]);

    expect((await como(AUDITORA).get(`/api/evidencias/${EVIDENCIA}/archivo`)).status).toBe(415);
  });

  it("guardar crea la versión 2 con su hash, conserva el original y actualiza la evidencia", async () => {
    const res = await como(AUDITORA)
      .post(`/api/evidencias/${EVIDENCIA}/versiones`)
      .field("comentario", "Corrige la suma de junio")
      .attach("file", libro("editado"), { filename: "Conciliacion.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ version: 2, comentario: "Corrige la suma de junio", uploaded_by: "Ana Rodríguez" });
    expect(res.body.file_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.file_hash).not.toBe("hash-original");

    const { rows } = await pool.query("SELECT version, file_hash, storage_path FROM evidence WHERE id = $1", [EVIDENCIA]);
    expect(rows[0]).toEqual({ version: 2, file_hash: res.body.file_hash, storage_path: `${EVIDENCIA}-v2.xlsx` });
    expect((await almacenamiento.leer(`${EVIDENCIA}-v2.xlsx`))!.equals(libro("editado"))).toBe(true);
    expect((await almacenamiento.leer(`${EVIDENCIA}.xlsx`))!.equals(libro("original"))).toBe(true);

    const historial = await como(AUDITORA).get(`/api/evidencias/${EVIDENCIA}/versiones`);
    expect(historial.body.map((v: { version: number; file_hash: string }) => [v.version, v.file_hash])).toEqual([
      [2, res.body.file_hash],
      [1, "hash-original"],
    ]);

    const archivo = await como(AUDITORA).get(`/api/evidencias/${EVIDENCIA}/archivo`);
    expect(archivo.headers["x-evidencia-version"]).toBe("2");
  });

  it("guardar dos veces numera 2 y 3", async () => {
    const enviar = (marca: string) =>
      como(AUDITORA).post(`/api/evidencias/${EVIDENCIA}/versiones`).attach("file", libro(marca), { filename: "Conciliacion.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    expect((await enviar("dos")).body.version).toBe(2);
    expect((await enviar("tres")).body.version).toBe(3);
    expect((await como(AUDITORA).get(`/api/evidencias/${EVIDENCIA}/versiones`)).body).toHaveLength(3);
  });

  it("antes del primer guardado el historial solo tiene el original", async () => {
    const res = await como(AUDITORA).get(`/api/evidencias/${EVIDENCIA}/versiones`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([expect.objectContaining({ version: 1, file_hash: "hash-original" })]);
  });

  it("quien no puede modificar la evidencia recibe 403 y nada cambia", async () => {
    const res = await como(OTRA_AUDITORA)
      .post(`/api/evidencias/${EVIDENCIA}/versiones`)
      .attach("file", libro("ajeno"), { filename: "Conciliacion.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    expect(res.status).toBe(403);
    expect((await pool.query("SELECT version FROM evidence WHERE id = $1", [EVIDENCIA])).rows[0]).toEqual({ version: 1 });
  });

  describe("según la entidad de la evidencia", () => {
    const TIPO_LIBRO = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const uno = async (sql: string, valores: unknown[]) => (await pool.query(sql, valores)).rows[0].id as number;
    const guardarVersion = (correo: string, id: string) =>
      como(correo).post(`/api/evidencias/${id}/versiones`).attach("file", libro(`nuevo-${correo}`), { filename: "Libro.xlsx", contentType: TIPO_LIBRO });
    const evidenciaDe = async (id: string, entidad: number, tipo: string, subidaPor: string) => {
      await almacenamiento.guardar(`${id}.xlsx`, libro("original"), "application/octet-stream");
      await pool.query(
        `INSERT INTO evidence (id, entity_id, entity_type, file_name, mime_type, file_size, file_hash, storage_path, uploaded_by)
         VALUES ($1, $2, $3, 'Libro.xlsx', 'xlsx', 12, 'hash-original', $4, $5)`,
        [id, String(entidad), tipo, `${id}.xlsx`, await idDe(subidaPor)],
      );
    };

    beforeEach(async () => {
      for (const usuario of await usuarios.listarUsuarios()) {
        await pool.query(
          `INSERT INTO users (id, name, email, role_id) OVERRIDING SYSTEM VALUE
           SELECT $1, $2, $3, id FROM roles WHERE name = $4
           ON CONFLICT DO NOTHING`,
          [usuario.id, usuario.nombre, usuario.correo, usuario.rol],
        );
      }
    });

    it("en un control guarda el auditor asignado, lo ve quien asignó y otro auditor no lo cambia", async () => {
      const plan = await uno(
        `INSERT INTO audit_plans (code, name, type, start_date, end_date, status, estimated_hours, responsible_id, created_by)
         VALUES ($1, 'Plan de prueba', 'Anual', '2026-01-01', '2026-12-31', 'En Ejecución', 10, $2, $3) RETURNING id`,
        [`PAI-V-${Date.now()}`, await idDe(SENIOR), await idDe(JEFA)],
      );
      await pool.query(`INSERT INTO controls (id, code, name) VALUES ('CTR-V', 'V-0001', 'Control') ON CONFLICT DO NOTHING`);
      const asignacion = await uno(
        `INSERT INTO audit_controls (audit_id, control_id, auditor_id, is_lead, assigned_by)
         VALUES ($1, 'CTR-V', $2, TRUE, $3) RETURNING id`,
        [plan, await idDe(AUDITORA), await idDe(SENIOR)],
      );
      await evidenciaDe("EV-control", asignacion, "control", AUDITORA);

      expect((await guardarVersion(AUDITORA, "EV-control")).status).toBe(201);
      expect((await guardarVersion(OTRA_AUDITORA, "EV-control")).status).toBe(403);
      expect((await como(SENIOR).get("/api/evidencias/EV-control/versiones")).status).toBe(200);
      expect((await como(OTRA_AUDITORA).get("/api/evidencias/EV-control/versiones")).status).toBe(404);
    });

    it("en un paso guarda el asignado, pero no con el plan bloqueado por la revisión", async () => {
      const plan = await uno(
        `INSERT INTO action_plans (root_cause, responsible_id, due_date, created_by)
         VALUES ('Causa', $1, '2030-01-01', $2) RETURNING id`,
        [await idDe(JEFE_AUDITADO), await idDe(JEFA)],
      );
      const paso = await uno(
        `INSERT INTO action_plan_steps (action_plan_id, assigned_user_id, description, due_date)
         VALUES ($1, $2, 'Paso de prueba', '2029-12-01') RETURNING id`,
        [plan, await idDe(EMPLEADO_AUDITADO)],
      );
      await evidenciaDe("EV-paso", paso, "action_plan_step", EMPLEADO_AUDITADO);

      expect((await guardarVersion(EMPLEADO_AUDITADO, "EV-paso")).status).toBe(201);
      expect((await guardarVersion(AUDITORA, "EV-paso")).status).toBe(403);
      expect((await como(JEFE_AUDITADO).get("/api/evidencias/EV-paso/versiones")).status).toBe(200);

      await pool.query("UPDATE action_plans SET status = 'En Revisión' WHERE id = $1", [plan]);
      const bloqueado = await guardarVersion(EMPLEADO_AUDITADO, "EV-paso");

      expect(bloqueado.status).toBe(409);
      expect(bloqueado.body.error.codigo).toBe("PLAN_BLOQUEADO");
    });
  });

  it("rechaza lo que no es un libro .xlsx", async () => {
    const texto = await como(AUDITORA)
      .post(`/api/evidencias/${EVIDENCIA}/versiones`)
      .attach("file", Buffer.from("hola"), { filename: "Conciliacion.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const pdf = await como(AUDITORA)
      .post(`/api/evidencias/${EVIDENCIA}/versiones`)
      .attach("file", libro("pdf"), { filename: "Conciliacion.pdf", contentType: "application/pdf" });

    expect(texto.status).toBe(400);
    expect(pdf.status).toBe(400);
  });

  it("un libro con macros se abre y la versión guardada queda como .xlsx", async () => {
    await pool.query("UPDATE evidence SET mime_type = 'xlsm', file_name = 'Macros.xlsm' WHERE id = $1", [EVIDENCIA]);

    expect((await como(AUDITORA).get(`/api/evidencias/${EVIDENCIA}/archivo`)).status).toBe(200);
    const res = await como(AUDITORA)
      .post(`/api/evidencias/${EVIDENCIA}/versiones`)
      .attach("file", libro("sin macros"), { filename: "Macros.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    expect(res.status).toBe(201);
    const { rows } = await pool.query("SELECT mime_type, file_name FROM evidence WHERE id = $1", [EVIDENCIA]);
    expect(rows[0]).toEqual({ mime_type: "xlsx", file_name: "Macros.xlsx" });
  });
});
