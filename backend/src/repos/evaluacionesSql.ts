import type pg from "pg";
import type { Criterio, Evaluacion, ResultadoEvaluacion } from "../domain/evaluaciones.js";
import type {
  AsignacionEvaluable,
  DatosEvaluacion,
  RepositorioEvaluaciones,
  StatusAsignacion,
} from "./evaluaciones.js";

interface FilaEvaluacion {
  id: number;
  audit_id: number;
  control_id: string;
  design_score: string;
  effectiveness_score: string;
  score: string;
  result: ResultadoEvaluacion;
  has_deficiency: boolean;
  evaluated_by: number;
  evaluated_name: string;
  evaluated_at: Date;
}

// Repositorio de evaluaciones de controles sobre PostgreSQL (sql/036_evaluacion_controles.sql).
export class RepositorioEvaluacionesSql implements RepositorioEvaluaciones {
  constructor(private readonly pool: pg.Pool) {}

  async listarCriterios() {
    const resultado = await this.pool.query<{
      id: number;
      code: string;
      type: Criterio["tipo"];
      name: string;
      required: boolean;
      sort_order: number;
    }>(
      `SELECT id, code, type, name, required, sort_order
       FROM evaluation_criteria
       WHERE active
       ORDER BY type, sort_order`,
    );
    return resultado.rows.map(
      (fila): Criterio => ({
        id: fila.id,
        codigo: fila.code,
        tipo: fila.type,
        nombre: fila.name,
        obligatorio: fila.required,
        orden: fila.sort_order,
      }),
    );
  }

  async listarAsignaciones(planId: number, control: string) {
    const resultado = await this.pool.query<{
      audit_id: number;
      control_id: string;
      code: string;
      auditor_id: number;
      assigned_by: number;
      status: StatusAsignacion;
    }>(
      `SELECT ac.audit_id, ac.control_id, c.code, ac.auditor_id, ac.assigned_by, ac.status
       FROM audit_controls ac
       JOIN controls c ON c.id = ac.control_id
       WHERE ac.audit_id = $1 AND (c.id = $2 OR c.code = $2)`,
      [planId, control],
    );
    return resultado.rows.map(
      (fila): AsignacionEvaluable => ({
        planId: fila.audit_id,
        controlId: fila.control_id,
        codigo: fila.code,
        auditorId: fila.auditor_id,
        asignadoPor: fila.assigned_by,
        status: fila.status,
      }),
    );
  }

  async buscar(planId: number, controlId: string): Promise<Evaluacion | null> {
    const resultado = await this.pool.query<FilaEvaluacion>(
      `SELECT e.id, e.audit_id, e.control_id, e.design_score, e.effectiveness_score, e.score, e.result,
              e.has_deficiency, e.evaluated_by, u.name AS evaluated_name, e.evaluated_at
       FROM control_evaluations e
       JOIN users u ON u.id = e.evaluated_by
       WHERE e.audit_id = $1 AND e.control_id = $2`,
      [planId, controlId],
    );
    const fila = resultado.rows[0];
    if (!fila) return null;
    const respuestas = await this.pool.query<{ criterion_id: number; value: number }>(
      "SELECT criterion_id, value FROM control_evaluation_answers WHERE evaluation_id = $1 ORDER BY criterion_id",
      [fila.id],
    );
    return {
      planId: fila.audit_id,
      controlId: fila.control_id,
      promedioDiseno: Number(fila.design_score),
      promedioEfectividad: Number(fila.effectiveness_score),
      calificacion: Number(fila.score),
      resultado: fila.result,
      deficiencia: fila.has_deficiency,
      respuestas: respuestas.rows.map((r) => ({ criterioId: r.criterion_id, valor: r.value })),
      evaluadoPor: { id: fila.evaluated_by, nombre: fila.evaluated_name },
      evaluadoEn: fila.evaluated_at.toISOString(),
    };
  }

  async guardar(datos: DatosEvaluacion) {
    // Evaluación y respuestas se guardan juntas: nunca debe quedar una sin las otras.
    const cliente = await this.pool.connect();
    try {
      await cliente.query("BEGIN");
      const evaluacion = await cliente.query<{ id: number }>(
        `INSERT INTO control_evaluations
           (audit_id, control_id, design_score, effectiveness_score, score, result, has_deficiency, evaluated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT ON CONSTRAINT uq_control_evaluations_control DO UPDATE
         SET design_score = EXCLUDED.design_score,
             effectiveness_score = EXCLUDED.effectiveness_score,
             score = EXCLUDED.score,
             result = EXCLUDED.result,
             has_deficiency = EXCLUDED.has_deficiency,
             evaluated_by = EXCLUDED.evaluated_by,
             evaluated_at = now()
         RETURNING id`,
        [
          datos.planId,
          datos.controlId,
          datos.promedioDiseno,
          datos.promedioEfectividad,
          datos.calificacion,
          datos.resultado,
          datos.deficiencia,
          datos.evaluadorId,
        ],
      );
      const id = evaluacion.rows[0]!.id;
      await cliente.query("DELETE FROM control_evaluation_answers WHERE evaluation_id = $1", [id]);
      await cliente.query(
        `INSERT INTO control_evaluation_answers (evaluation_id, criterion_id, value)
         SELECT $1, * FROM unnest($2::int[], $3::smallint[])`,
        [id, datos.respuestas.map((r) => r.criterioId), datos.respuestas.map((r) => r.valor)],
      );
      await cliente.query("COMMIT");
    } catch (error) {
      await cliente.query("ROLLBACK");
      throw error;
    } finally {
      cliente.release();
    }
    return (await this.buscar(datos.planId, datos.controlId))!;
  }
}
