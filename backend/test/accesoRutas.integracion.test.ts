// Permisos de rutas anteriores a la historia #98 que señaló la revisión de seguridad:
// asignar controles, consultar la revisión, leer evidencias con la IA y borrar evidencias.
// Corre contra un PostgreSQL real (variables SQL_TEST_*), en un esquema propio.

import { readFile } from "node:fs/promises";
import express, { type ErrorRequestHandler } from "express";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AlmacenamientoArchivos } from "../src/almacenamiento.js";
import { registrarPool } from "../src/db.js";
import { ErrorApi } from "../src/errores.js";
import { RepositorioEvidenciasSql } from "../src/repos/evidenciasSql.js";
import auditControls from "../src/routes/auditControls.js";
import { rutasEvidencias } from "../src/routes/evidencias.js";

const env = process.env;
const ESQUEMA = "prueba_acceso_rutas";

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

const manejarErrores: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ErrorApi) {
    res.status(error.status).json({ error: { codigo: error.codigo, mensaje: error.message } });
    return;
  }
  res.status(500).json({ error: { codigo: "ERROR_INTERNO", mensaje: String(error) } });
};

describe.skipIf(!env.SQL_TEST_SERVER)("permisos de controles y evidencias sobre PostgreSQL", () => {
  let pool: pg.Pool;
  const u = {} as Record<
    "jefe" | "seniorResponsable" | "seniorAjeno" | "auditora" | "companera" | "ajeno" | "lectura",
    number
  >;
  let plan1: number;
  let proceso: number;
  let plan2: number;
  const borrados: string[] = [];

  const almacenamiento: AlmacenamientoArchivos = {
    async guardar() {},
    async leer() {
      return Buffer.from("contenido");
    },
    async eliminar(clave) {
      borrados.push(clave);
    },
  };

  const como = (usuario: { id: number; rol: string }) => {
    const app = express();
    app.use(express.json());
    app.use((_req, res, next) => {
      res.locals.usuario = { ...usuario, correo: "prueba@expedite.com" };
      next();
    });
    app.use("/api", auditControls);
    app.use("/api", rutasEvidencias(almacenamiento));
    app.use(manejarErrores);
    return app;
  };

  const usuario = async (nombre: string, rol: string) => {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, role_id)
       SELECT $1, $2, id FROM roles WHERE name = $3 RETURNING id`,
      [nombre, `${nombre.toLowerCase().replace(/\s+/g, ".")}@expedite.com`, rol],
    );
    return rows[0].id as number;
  };

  const plan = async (codigo: string, responsable: number, creador: number) => {
    const { rows } = await pool.query(
      `INSERT INTO audit_plans (code, name, type, period, start_date, end_date, status, estimated_hours, responsible_id, scope, created_by)
       VALUES ($1, 'Plan', 'Anual', '2026', '2026-01-01', '2026-12-31', 'Aprobado', 10, $2, 'Alcance', $3)
       RETURNING id`,
      [codigo, responsable, creador],
    );
    return rows[0].id as number;
  };

  const asignar = async (planId: number, auditor: number, asignadoPor: number, status = "En Progreso", feedback: string | null = null) => {
    const { rows } = await pool.query(
      `INSERT INTO audit_controls (audit_id, control_id, auditor_id, assigned_by, status, feedback)
       VALUES ($1, 'CTR-1', $2, $3, $4, $5) RETURNING id`,
      [planId, auditor, asignadoPor, status, feedback],
    );
    return rows[0].id as number;
  };

  // En controles, entity_id es la asignación (audit_controls.id); null simula una evidencia sin vínculo.
  const evidencia = (id: string, asignacion: number | null, subidaPor: number, tipo: "control" | "hallazgo" = "control") =>
    pool.query(
      `INSERT INTO evidence (id, entity_id, entity_type, file_name, mime_type, file_size, file_hash, storage_path, uploaded_by)
       VALUES ($1, $2, $3, $4, 'pdf', 10, 'hash', $5, $6)`,
      [id, tipo === "control" ? String(asignacion ?? 0) : "HAL-1", tipo, `${id}.pdf`, `evidencias/${id}.pdf`, String(subidaPor)],
    );

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

    u.jefe = await usuario("Jefa Dueña", "Jefe de Auditoría");
    u.seniorResponsable = await usuario("Senior Responsable", "Auditor Senior");
    u.seniorAjeno = await usuario("Senior Ajeno", "Auditor Senior");
    u.auditora = await usuario("Auditora Plan Uno", "Auditor");
    u.companera = await usuario("Companera Plan Uno", "Auditor");
    u.ajeno = await usuario("Auditor Plan Dos", "Auditor");
    u.lectura = await usuario("Solo Lectura", "Solo Lectura");
    plan1 = await plan("PAI-A-001", u.seniorResponsable, u.jefe);
    plan2 = await plan("PAI-A-002", u.seniorAjeno, u.jefe);
    const { rows: unidades } = await pool.query(
      `INSERT INTO business_units (name, manager_id, fiscal_period_id, created_by)
       SELECT 'UDN-ACCESO', $1, MIN(id), $1 FROM fiscal_periods RETURNING id`,
      [u.jefe],
    );
    const { rows: procesos } = await pool.query(
      `INSERT INTO processes (business_unit_id, name, title, control_id) VALUES ($1, 'Proceso', 'Proceso', 'CTR-2') RETURNING id`,
      [unidades[0].id],
    );
    proceso = procesos[0].id;
    await pool.query("INSERT INTO controls (id, code, name) VALUES ('CTR-1', 'CP-1', 'Control uno'), ('CTR-2', 'CP-2', 'Control dos')");
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM evidence; DELETE FROM audit_controls;");
    borrados.length = 0;
  });

  afterAll(async () => {
    await pool?.query(`DROP SCHEMA IF EXISTS ${ESQUEMA} CASCADE`);
    await pool?.end();
  });

  describe("asignar un control a un plan", () => {
    const asignarComo = (senior: number, planId: number) =>
      request(como({ id: senior, rol: "Auditor Senior" }))
        .post(`/api/planes/${planId}/controles`)
        .send({ controlId: "CTR-2", processId: proceso, auditorId: u.auditora });

    it("el Auditor Senior responsable del plan asigna", async () => {
      const respuesta = await asignarComo(u.seniorResponsable, plan1);

      expect(respuesta.status).toBe(201);
      expect(respuesta.body).toMatchObject({ audit_id: plan1, control_id: "CTR-2", assigned_by: u.seniorResponsable });
    });

    it("otro Auditor Senior no asigna en un plan que no es suyo", async () => {
      const respuesta = await asignarComo(u.seniorAjeno, plan1);
      const { rowCount } = await pool.query("SELECT 1 FROM audit_controls WHERE audit_id = $1", [plan1]);

      expect(respuesta.status).toBe(403);
      expect(respuesta.body.error.codigo).toBe("ROL_NO_AUTORIZADO");
      expect(rowCount).toBe(0);
    });

    it("un plan que no existe sigue respondiendo 404", async () => {
      const respuesta = await asignarComo(u.seniorResponsable, 999999);

      expect(respuesta.status).toBe(404);
    });
  });

  describe("consultar la revisión de un control", () => {
    beforeEach(async () => {
      await asignar(plan1, u.auditora, u.seniorResponsable, "En Revision", "Falta la firma");
      await asignar(plan2, u.ajeno, u.seniorAjeno);
    });

    const revision = (usuario: { id: number; rol: string }, planId: number) =>
      request(como(usuario)).get(`/api/controles/CTR-1/revision?auditId=${planId}`).expect(200);

    it("la auditora asignada ve el estatus y la retroalimentación", async () => {
      const { body } = await revision({ id: u.auditora, rol: "Auditor" }, plan1);

      expect(body).toMatchObject({ plan_id: plan1, status: "En Revision", feedback: "Falta la firma" });
    });

    it("el Auditor Senior responsable puede revisarlo", async () => {
      const { body } = await revision({ id: u.seniorResponsable, rol: "Auditor Senior" }, plan1);

      expect(body).toMatchObject({ puede_revisar: true, feedback: "Falta la firma" });
    });

    it("la Jefa de Auditoría lo consulta", async () => {
      const { body } = await revision({ id: u.jefe, rol: "Jefe de Auditoría" }, plan1);

      expect(body.feedback).toBe("Falta la firma");
    });

    it("un auditor del mismo control en otro plan no ve la del primero", async () => {
      const { body } = await revision({ id: u.ajeno, rol: "Auditor" }, plan1);

      expect(body).toEqual({ puede_revisar: false, plan_id: null, status: null, feedback: null });
    });

    it("sin indicar el plan, el auditor solo recibe el suyo", async () => {
      const { body } = await request(como({ id: u.ajeno, rol: "Auditor" })).get("/api/controles/CTR-1/revision").expect(200);

      expect(body).toMatchObject({ plan_id: plan2, feedback: null });
    });

    it("Solo Lectura no la ve", async () => {
      const { body } = await revision({ id: u.lectura, rol: "Solo Lectura" }, plan1);

      expect(body.feedback).toBeNull();
    });

    it("el estatus sigue tomando en cuenta a todos los auditores del plan", async () => {
      await asignar(plan1, u.companera, u.seniorResponsable);

      const { body } = await revision({ id: u.auditora, rol: "Auditor" }, plan1);

      expect(body.status).toBe("En Progreso");
    });
  });

  describe("leer una evidencia para el asistente de IA", () => {
    const repo = () => new RepositorioEvidenciasSql(pool, almacenamiento);

    beforeEach(async () => {
      const asignacion = await asignar(plan1, u.auditora, u.seniorResponsable);
      await asignar(plan2, u.ajeno, u.seniorAjeno);
      await evidencia("EV-C1", asignacion, u.auditora);
      await evidencia("EV-H1", null, u.auditora, "hallazgo");
    });

    it("quien la subió la puede leer", async () => {
      expect(await repo().leerArchivo("EV-C1", { id: u.auditora, rol: "Auditor" })).toMatchObject({ id: "EV-C1" });
      expect(await repo().leerArchivo("EV-H1", { id: u.auditora, rol: "Auditor" })).toMatchObject({ id: "EV-H1" });
    });

    it("el Auditor Senior que asignó el control y la Jefa del plan la pueden leer", async () => {
      expect(await repo().leerArchivo("EV-C1", { id: u.seniorResponsable, rol: "Auditor Senior" })).not.toBeNull();
      expect(await repo().leerArchivo("EV-C1", { id: u.jefe, rol: "Jefe de Auditoría" })).not.toBeNull();
    });

    it("otro usuario no la puede leer aunque sepa el id", async () => {
      expect(await repo().leerArchivo("EV-C1", { id: u.ajeno, rol: "Auditor" })).toBeNull();
      expect(await repo().leerArchivo("EV-C1", { id: u.seniorAjeno, rol: "Auditor Senior" })).toBeNull();
      expect(await repo().leerArchivo("EV-H1", { id: u.lectura, rol: "Solo Lectura" })).toBeNull();
    });

    it("el equipo de auditoría lee la evidencia de un hallazgo", async () => {
      expect(await repo().leerArchivo("EV-H1", { id: u.ajeno, rol: "Auditor" })).not.toBeNull();
      expect(await repo().leerArchivo("EV-H1", { id: u.jefe, rol: "Jefe de Auditoría" })).not.toBeNull();
    });
  });

  describe("borrar una evidencia de control", () => {
    let asignacion: number;

    beforeEach(async () => {
      asignacion = await asignar(plan1, u.auditora, u.seniorResponsable);
      await asignar(plan2, u.ajeno, u.seniorAjeno);
    });

    const borrar = (usuario: number, id: string) =>
      request(como({ id: usuario, rol: "Auditor" })).delete(`/api/evidencias/${id}`);
    const existe = async (id: string) => (await pool.query("SELECT 1 FROM evidence WHERE id = $1", [id])).rowCount === 1;

    it("la auditora asignada en ese plan la borra", async () => {
      await evidencia("EV-C1", asignacion, u.auditora);

      const respuesta = await borrar(u.auditora, "EV-C1");

      expect(respuesta.status).toBe(200);
      expect(await existe("EV-C1")).toBe(false);
      expect(borrados).toEqual(["evidencias/EV-C1.pdf"]);
    });

    it("un auditor del mismo control en otro plan no la borra", async () => {
      await evidencia("EV-C1", asignacion, u.auditora);

      const respuesta = await borrar(u.ajeno, "EV-C1");

      expect(respuesta.status).toBe(403);
      expect(await existe("EV-C1")).toBe(true);
      expect(borrados).toEqual([]);
    });

    it("una compañera del mismo control y plan no borra lo que subió otra", async () => {
      await asignar(plan1, u.companera, u.seniorResponsable);
      await evidencia("EV-C1", asignacion, u.auditora);

      const respuesta = await borrar(u.companera, "EV-C1");

      expect(respuesta.status).toBe(403);
      expect(await existe("EV-C1")).toBe(true);
    });

    it("una evidencia de control sin asignación no se borra", async () => {
      await evidencia("EV-C0", null, u.auditora);

      const respuesta = await borrar(u.auditora, "EV-C0");

      expect(respuesta.status).toBe(403);
      expect(await existe("EV-C0")).toBe(true);
    });
  });
});
