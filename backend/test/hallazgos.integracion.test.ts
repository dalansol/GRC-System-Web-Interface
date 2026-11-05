// Pruebas de quién ve y modifica cada hallazgo contra un PostgreSQL real.
// Se omiten si no hay conexión configurada (variables SQL_TEST_*).
// Trabaja en un esquema propio para no chocar con los demás archivos de integración.

import { readFile } from "node:fs/promises";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearApp } from "../src/app.js";
import { crearVerificadorDev } from "../src/auth/verificador.js";
import { registrarPool } from "../src/db.js";
import { RepositorioEvidenciasMemoria } from "../src/repos/evidenciasMemoria.js";
import { RepositorioMemoria } from "../src/repos/memoria.js";
import { RepositorioPlanesAccionMemoria } from "../src/repos/planesAccionMemoria.js";
import { RepositorioPlanesMemoria } from "../src/repos/planesMemoria.js";
import rutasHallazgos from "../src/routes/hallazgos.js";
import { escuchar } from "./servidor.js";

const env = process.env;
const ESQUEMA = "prueba_hallazgos";

// Los de src/migrar.ts sin datos de prueba.
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
];

const ADMIN = "s.ramirez@expedite.com";
const JEFA = "m.garcia@expedite.com";
const SENIOR = "c.morales@expedite.com";
const AUDITORA = "l.fernandez@expedite.com";
const SOLO_LECTURA = "d.torres@expedite.com";
const JEFE_AUDITADO = "j.ejemplo@expedite.com";
const EMPLEADO_AUDITADO = "c.ejemplo@expedite.com";
const EQUIPO_AUDITORIA = [ADMIN, JEFA, SENIOR, AUDITORA];

const script = (nombre: string) => readFile(new URL(`../sql/${nombre}`, import.meta.url), "utf8");

describe.skipIf(!env.SQL_TEST_SERVER)("hallazgos sobre PostgreSQL", () => {
  let pool: pg.Pool;
  let usuarios: RepositorioMemoria;

  const idDe = async (correo: string) => (await usuarios.buscarPorCorreo(correo))!.id;
  const uno = async (sql: string, valores: unknown[] = []) => (await pool.query(sql, valores)).rows[0].id as number;

  const api = () =>
    escuchar(
      crearApp({
        repo: usuarios,
        repoPlanes: new RepositorioPlanesMemoria(usuarios),
        repoPlanesAccion: new RepositorioPlanesAccionMemoria(usuarios),
        repoEvidencias: new RepositorioEvidenciasMemoria(),
        proveedorIA: null,
        verificador: crearVerificadorDev(),
        dominiosPermitidos: ["expedite.com"],
        corsOrigin: "http://localhost:5173",
        registrarEvento: () => {},
        rutasConSesion: [rutasHallazgos],
      }),
    );

  const como = async (correo: string, metodo: "get" | "put" | "delete", ruta: string) =>
    (await request(await api())[metodo](`/api${ruta}`).set("X-Dev-Usuario", correo));

  const lista = async (correo: string) => {
    const res = await como(correo, "get", "/hallazgos");
    expect(res.status).toBe(200);
    return (res.body as { id: string }[]).map((h) => h.id).sort();
  };

  const editar = async (correo: string, id: string) =>
    request(await api())
      .put(`/api/hallazgos/${id}`)
      .set("X-Dev-Usuario", correo)
      .send({ title: "Título editado", severity: "Medio", status: "Abierto" });

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
    for (const nombre of SCRIPTS) {
      await pool.query(await script(nombre));
    }
    registrarPool(pool);

    // La sesión sale del repositorio en memoria, donde todos pertenecen a la unidad 10.
    usuarios = new RepositorioMemoria();
    for (const usuario of await usuarios.listarUsuarios()) {
      await pool.query(
        `INSERT INTO users (id, name, email, role_id) OVERRIDING SYSTEM VALUE
         SELECT $1, $2, $3, id FROM roles WHERE name = $4`,
        [usuario.id, usuario.nombre, usuario.correo, usuario.rol],
      );
    }

    const jefa = await idDe(JEFA);
    const senior = await idDe(SENIOR);
    const auditora = await idDe(AUDITORA);
    const periodo = await uno(`SELECT MIN(id) AS id FROM fiscal_periods`);

    const plan = await uno(
      `INSERT INTO audit_plans (code, name, type, start_date, end_date, status, estimated_hours, responsible_id, created_by)
       VALUES ('PAI-HA-1', 'Plan de prueba', 'Anual', '2026-01-01', '2026-12-31', 'En Ejecución', 10, $1, $2) RETURNING id`,
      [senior, jefa],
    );

    // Un control por unidad: el hallazgo se liga a la unidad por su asignación y el proceso de esta.
    for (const [unidad, control] of [[10, "CTR-U10"], [20, "CTR-U20"]] as const) {
      await pool.query(
        `INSERT INTO business_units (id, name, manager_id, fiscal_period_id, created_by) OVERRIDING SYSTEM VALUE
         VALUES ($1, $2, $3, $4, $3)`,
        [unidad, `UDN-HA-${unidad}`, jefa, periodo],
      );
      const proceso = await uno(
        `INSERT INTO processes (business_unit_id, name, title, control_id) VALUES ($1, $2, $2, $3) RETURNING id`,
        [unidad, `Proceso ${unidad}`, control],
      );
      await pool.query(`INSERT INTO controls (id, code, name) VALUES ($1, $1, $1)`, [control]);
      await pool.query(
        `INSERT INTO audit_controls (audit_id, control_id, process_id, auditor_id, is_lead, assigned_by)
         VALUES ($1, $2, $3, $4, TRUE, $5)`,
        [plan, control, proceso, auditora, senior],
      );
    }

    await pool.query(
      `INSERT INTO findings (id, title, severity, "auditId", "controlId", "ownerId") VALUES
         ('HAL-U10', 'De la unidad 10', 'Medio', $1, 'CTR-U10', NULL),
         ('HAL-U20', 'De la unidad 20', 'Medio', $1, 'CTR-U20', NULL),
         ('HAL-SUELTO', 'Sin unidad', 'Medio', 'AUD-001', 'CTR-X', NULL),
         ('HAL-PROPIO', 'Del empleado', 'Medio', 'AUD-001', 'CTR-X', $2)`,
      [String(plan), String(await idDe(EMPLEADO_AUDITADO))],
    );

    const planAccion = await uno(
      `INSERT INTO action_plans (root_cause, responsible_id, due_date, created_by)
       VALUES ('Causa', $1, '2030-01-01', $2) RETURNING id`,
      [auditora, jefa],
    );
    await pool.query(`INSERT INTO action_plan_findings (action_plan_id, finding_id) VALUES ($1, 'HAL-SUELTO')`, [planAccion]);
  });

  afterAll(async () => {
    await pool?.query(`DROP SCHEMA IF EXISTS ${ESQUEMA} CASCADE`);
    await pool?.end();
  });

  it("el equipo de auditoría ve todos los hallazgos, sean o no de su unidad", async () => {
    for (const correo of EQUIPO_AUDITORIA) {
      expect(await lista(correo)).toEqual(["HAL-PROPIO", "HAL-SUELTO", "HAL-U10", "HAL-U20"]);
      expect((await como(correo, "get", "/hallazgos/HAL-U20")).status).toBe(200);
      expect((await como(correo, "get", "/hallazgos/HAL-SUELTO/planes-accion")).body).toHaveLength(1);
    }
  });

  const registrar = async (id: string, correo: string | null) => {
    const dueno = correo ? String(await idDe(correo)) : null;
    await pool.query(
      `INSERT INTO findings (id, title, severity, "auditId", "controlId", "ownerId") VALUES ($1, 'Temporal', 'Medio', 'AUD-001', 'CTR-X', $2)`,
      [id, dueno],
    );
  };

  it("Administrador y Jefe de Auditoría editan y eliminan cualquier hallazgo", async () => {
    for (const [indice, correo] of [ADMIN, JEFA].entries()) {
      const id = `HAL-TMP-${indice}`;
      await registrar(id, AUDITORA);
      expect((await editar(correo, id)).status).toBe(200);
      expect((await como(correo, "delete", `/hallazgos/${id}`)).status).toBe(200);
    }
  });

  it("Auditor Senior y Auditor editan y eliminan solo los que registraron", async () => {
    for (const [indice, correo] of [SENIOR, AUDITORA].entries()) {
      const propio = `HAL-MIO-${indice}`;
      await registrar(propio, correo);
      expect((await editar(correo, propio)).status).toBe(200);
      expect((await como(correo, "delete", `/hallazgos/${propio}`)).status).toBe(200);

      // De otra persona o sin registrante: lo ven, pero no lo modifican, aunque sea de su unidad.
      for (const ajeno of ["HAL-PROPIO", "HAL-U10", "HAL-SUELTO"]) {
        const edicion = await editar(correo, ajeno);
        expect(edicion.status).toBe(403);
        expect(edicion.body.error.codigo).toBe("ROL_NO_AUTORIZADO");
        expect((await como(correo, "delete", `/hallazgos/${ajeno}`)).status).toBe(403);
        expect((await como(correo, "get", `/hallazgos/${ajeno}`)).status).toBe(200);
      }

      expect((await editar(correo, "HAL-NO-EXISTE")).status).toBe(404);
    }
    expect((await pool.query(`SELECT title FROM findings WHERE id = 'HAL-U10'`)).rows[0].title).toBe("De la unidad 10");
  });

  it("registrar un hallazgo guarda como registrante al usuario en sesión, no al que se envía", async () => {
    const res = await request(await api())
      .post("/api/hallazgos")
      .set("X-Dev-Usuario", AUDITORA)
      .send({ id: "HAL-NUEVO", title: "Nuevo", severity: "Medio", ownerId: String(await idDe(JEFA)) });
    expect(res.status).toBe(201);
    expect(res.body.ownerId).toBe(String(await idDe(AUDITORA)));

    expect((await editar(AUDITORA, "HAL-NUEVO")).status).toBe(200);
    expect((await como(SENIOR, "delete", "/hallazgos/HAL-NUEVO")).status).toBe(403);
    expect((await como(AUDITORA, "delete", "/hallazgos/HAL-NUEVO")).status).toBe(200);
  });

  it("los auditados solo ven los de su unidad y los propios", async () => {
    expect(await lista(JEFE_AUDITADO)).toEqual(["HAL-U10"]);
    expect(await lista(EMPLEADO_AUDITADO)).toEqual(["HAL-PROPIO", "HAL-U10"]);

    for (const correo of [JEFE_AUDITADO, EMPLEADO_AUDITADO]) {
      expect((await como(correo, "get", "/hallazgos/HAL-U10")).status).toBe(200);
      expect((await como(correo, "get", "/hallazgos/HAL-U20")).status).toBe(404);
      expect((await como(correo, "get", "/hallazgos/HAL-SUELTO")).status).toBe(404);
    }
  });

  it("los auditados no consultan los planes desde un hallazgo, ni siquiera de su unidad", async () => {
    for (const correo of [JEFE_AUDITADO, EMPLEADO_AUDITADO]) {
      for (const hallazgo of ["HAL-SUELTO", "HAL-U10"]) {
        const res = await como(correo, "get", `/hallazgos/${hallazgo}/planes-accion`);
        expect(res.status).toBe(403);
        expect(res.body.error.codigo).toBe("ROL_NO_AUTORIZADO");
      }
    }
  });

  it("quien no es del equipo de auditoría no modifica hallazgos fuera de su alcance", async () => {
    for (const correo of [JEFE_AUDITADO, EMPLEADO_AUDITADO, SOLO_LECTURA]) {
      expect((await editar(correo, "HAL-SUELTO")).status).toBe(404);
      expect((await como(correo, "delete", "/hallazgos/HAL-SUELTO")).status).toBe(404);
    }
  });

  it("los demás roles conservan el filtro por unidad", async () => {
    expect(await lista(SOLO_LECTURA)).toEqual(["HAL-U10"]);
  });
});
