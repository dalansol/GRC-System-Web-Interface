// Pruebas de la evaluación de controles (036) contra un PostgreSQL real. Se omiten si no hay
// conexión configurada (variables SQL_TEST_*). Trabaja en un esquema propio para no chocar
// con los demás archivos de integración.

import { readFile } from "node:fs/promises";
import express from "express";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { registrarPool } from "../src/db.js";
import { calcularEvaluacion, type Criterio } from "../src/domain/evaluaciones.js";
import { RepositorioEvaluacionesSql } from "../src/repos/evaluacionesSql.js";
import auditControls from "../src/routes/auditControls.js";

const env = process.env;
const ESQUEMA = "prueba_evaluaciones";

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
  "028_estado_inicial_controles_progreso.sql",
  "029_conflictos_por_plan.sql",
  "036_evaluacion_controles.sql",
];

const script = (nombre: string) => readFile(new URL(`../sql/${nombre}`, import.meta.url), "utf8");

describe.skipIf(!env.SQL_TEST_SERVER)("evaluación de controles sobre PostgreSQL", () => {
  let pool: pg.Pool;
  let repo: RepositorioEvaluacionesSql;
  let auditorId: number;
  let planId: number;
  let criterios: Criterio[];

  const id = async (sql: string, valores: unknown[] = []) => (await pool.query(sql, valores)).rows[0].id as number;

  const guardar = (valor: number, control = "CTR-1") => {
    const respuestas = criterios.map((c) => ({ criterioId: c.id, valor }));
    return repo.guardar({
      ...calcularEvaluacion(criterios, respuestas),
      planId,
      controlId: control,
      respuestas,
      evaluadorId: auditorId,
    });
  };

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
    // Dos veces cada script: deben poder repetirse.
    for (const nombre of [...SCRIPTS, ...SCRIPTS]) {
      await pool.query(await script(nombre));
    }
    auditorId = await id(
      `INSERT INTO users (name, email, role_id)
       SELECT 'Auditora Pruebas', 'auditora.pruebas@expedite.com', id FROM roles WHERE name = 'Auditor' RETURNING id`,
    );
    planId = await id(
      `INSERT INTO audit_plans (code, name, type, period, start_date, end_date, status, estimated_hours, responsible_id, scope, created_by)
       VALUES ('PAI-T-001', 'Plan', 'Anual', '2026', '2026-01-01', '2026-12-31', 'Borrador', 10, $1, 'Alcance', $1)
       RETURNING id`,
      [auditorId],
    );
    await pool.query("INSERT INTO controls (id, code, name) VALUES ('CTR-1', 'CP-1', 'Control uno'), ('CTR-2', 'CP-2', 'Control dos')");
    await pool.query(
      `INSERT INTO audit_controls (audit_id, control_id, auditor_id, assigned_by) VALUES ($1, 'CTR-1', $2, $2)`,
      [planId, auditorId],
    );
    repo = new RepositorioEvaluacionesSql(pool);
    criterios = await repo.listarCriterios();
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM control_evaluations");
  });

  afterAll(async () => {
    await pool?.query(`DROP SCHEMA IF EXISTS ${ESQUEMA} CASCADE`);
    await pool?.end();
  });

  it("los scripts repetidos dejan 8 criterios, primero los de diseño", () => {
    expect(criterios.map((c) => c.codigo)).toEqual(["D1", "D2", "D3", "D4", "E1", "E2", "E3", "E4"]);
    expect(criterios.every((c) => c.obligatorio)).toBe(true);
  });

  it("no lista un criterio desactivado", async () => {
    await pool.query("UPDATE evaluation_criteria SET active = FALSE WHERE code = 'D4'");

    const activos = await repo.listarCriterios();
    await pool.query("UPDATE evaluation_criteria SET active = TRUE WHERE code = 'D4'");

    expect(activos.map((c) => c.codigo)).not.toContain("D4");
  });

  it("encuentra las asignaciones por id y por código del control", async () => {
    const porId = await repo.listarAsignaciones(planId, "CTR-1");
    const porCodigo = await repo.listarAsignaciones(planId, "CP-1");

    expect(porId).toEqual([
      { planId, controlId: "CTR-1", codigo: "CP-1", auditorId, asignadoPor: auditorId, status: "En Progreso" },
    ]);
    expect(porCodigo).toEqual(porId);
  });

  it("guarda y recupera la evaluación completa", async () => {
    await guardar(2);

    const evaluacion = await repo.buscar(planId, "CTR-1");

    expect(evaluacion).toMatchObject({
      planId,
      controlId: "CTR-1",
      promedioDiseno: 2,
      promedioEfectividad: 2,
      calificacion: 2,
      resultado: "Deficiente",
      deficiencia: true,
      evaluadoPor: { id: auditorId, nombre: "Auditora Pruebas" },
    });
    expect(evaluacion!.respuestas).toHaveLength(8);
  });

  it("guardar de nuevo reemplaza la evaluación y sus respuestas", async () => {
    await guardar(2);
    await guardar(5);

    const { rows } = await pool.query("SELECT COUNT(*)::int AS total FROM control_evaluations");
    const evaluacion = await repo.buscar(planId, "CTR-1");

    expect(rows[0].total).toBe(1);
    expect(evaluacion!.calificacion).toBe(5);
    expect(evaluacion!.deficiencia).toBe(false);
    expect(evaluacion!.respuestas.every((r) => r.valor === 5)).toBe(true);
  });

  it("si falla una respuesta no queda una evaluación a medias", async () => {
    const respuestas = criterios.map((c) => ({ criterioId: c.id, valor: 9 }));

    await expect(
      repo.guardar({
        ...calcularEvaluacion(criterios, criterios.map((c) => ({ criterioId: c.id, valor: 3 }))),
        planId,
        controlId: "CTR-1",
        respuestas,
        evaluadorId: auditorId,
      }),
    ).rejects.toThrow();

    expect(await repo.buscar(planId, "CTR-1")).toBeNull();
  });

  it("la base rechaza un valor fuera de la escala", async () => {
    await guardar(3);
    const { rows } = await pool.query("SELECT id FROM control_evaluations");

    await expect(
      pool.query("UPDATE control_evaluation_answers SET value = 6 WHERE evaluation_id = $1", [rows[0].id]),
    ).rejects.toThrow(/ck_control_evaluation_answers_value/);
  });

  it("la lista de controles indica cuáles tienen deficiencia", async () => {
    registrarPool(pool);
    const app = express();
    app.use((_req, res, next) => {
      res.locals.usuario = { id: auditorId, rol: "Auditor" };
      next();
    });
    app.use("/api", auditControls);

    const antes = await request(app).get("/api/controles").expect(200);
    await guardar(1);
    const despues = await request(app).get("/api/controles").expect(200);
    await guardar(5);
    const corregido = await request(app).get("/api/controles").expect(200);

    expect(antes.body[0].tiene_deficiencia).toBe(false);
    expect(despues.body[0].tiene_deficiencia).toBe(true);
    expect(corregido.body[0].tiene_deficiencia).toBe(false);
  });

  it("no busca una evaluación de otro control", async () => {
    await guardar(3);

    expect(await repo.buscar(planId, "CTR-2")).toBeNull();
  });
});
