import type pg from "pg";
import type { DatosDeclaracion, DeclaracionConflicto, PlanResumen } from "../domain/conflictos.js";
import { ErrorDeclaracionDuplicada, type RepositorioConflictos } from "./conflictos.js";

interface FilaDeclaracion {
  id: number;
  plan_id: number;
  plan_code: string;
  plan_name: string;
  auditor_id: number;
  auditor_name: string;
  has_conflict: boolean;
  justification: string | null;
  declared_at: Date;
}

// Código de PostgreSQL para violación de restricción o índice único.
const ERROR_DUPLICADO = "23505";

// conflict_declarations.audit_id apunta a audit_plans (sql/015_conflictos_por_plan.sql),
// igual que audit_controls.audit_id (sql/011_audit_controls_plan.sql).
const SELECT_DECLARACION = `
  SELECT d.id, d.audit_id AS plan_id, p.code AS plan_code, p.name AS plan_name,
         d.auditor_id, u.name AS auditor_name, d.has_conflict, d.justification, d.declared_at
  FROM conflict_declarations d
  JOIN audit_plans p ON p.id = d.audit_id
  JOIN users u ON u.id = d.auditor_id`;

function aDeclaracion(fila: FilaDeclaracion): DeclaracionConflicto {
  return {
    id: fila.id,
    plan: { id: fila.plan_id, codigo: fila.plan_code, nombre: fila.plan_name },
    auditor: { id: fila.auditor_id, nombre: fila.auditor_name },
    tieneConflicto: fila.has_conflict,
    justificacion: fila.justification,
    declaradoEn: fila.declared_at.toISOString(),
  };
}

/**
 * True si el usuario tiene controles asignados en el plan y todavía no declara sus conflictos.
 * La usan las rutas de seguimiento de controles (auditControls.ts) para bloquear la evaluación.
 */
export async function declaracionPendiente(pool: pg.Pool, planId: number, usuarioId: number): Promise<boolean> {
  const resultado = await pool.query(
    `SELECT 1
     FROM audit_controls ac
     WHERE ac.audit_id = $1 AND ac.auditor_id = $2
       AND NOT EXISTS (
         SELECT 1 FROM conflict_declarations d WHERE d.audit_id = ac.audit_id AND d.auditor_id = ac.auditor_id
       )
     LIMIT 1`,
    [planId, usuarioId],
  );
  return (resultado.rowCount ?? 0) > 0;
}

// Repositorio de declaraciones de conflicto sobre PostgreSQL (Supabase). Todas las consultas usan parámetros.
export class RepositorioConflictosSql implements RepositorioConflictos {
  constructor(private readonly pool: pg.Pool) {}

  async buscarPlan(planId: number) {
    const resultado = await this.pool.query<{ id: number; code: string; name: string }>(
      "SELECT id, code, name FROM audit_plans WHERE id = $1",
      [planId],
    );
    const fila = resultado.rows[0];
    return fila ? { id: fila.id, codigo: fila.code, nombre: fila.name } : null;
  }

  async estaAsignado(planId: number, usuarioId: number) {
    const resultado = await this.pool.query(
      "SELECT 1 FROM audit_controls WHERE audit_id = $1 AND auditor_id = $2 LIMIT 1",
      [planId, usuarioId],
    );
    return (resultado.rowCount ?? 0) > 0;
  }

  async buscarDeclaracion(planId: number, auditorId: number) {
    const resultado = await this.pool.query<FilaDeclaracion>(
      `${SELECT_DECLARACION} WHERE d.audit_id = $1 AND d.auditor_id = $2`,
      [planId, auditorId],
    );
    const fila = resultado.rows[0];
    return fila ? aDeclaracion(fila) : null;
  }

  async listarPorPlan(planId: number) {
    const resultado = await this.pool.query<FilaDeclaracion>(
      `${SELECT_DECLARACION} WHERE d.audit_id = $1 ORDER BY d.declared_at ASC, d.id ASC`,
      [planId],
    );
    return resultado.rows.map(aDeclaracion);
  }

  async listarConConflicto() {
    const resultado = await this.pool.query<FilaDeclaracion>(
      `${SELECT_DECLARACION} WHERE d.has_conflict ORDER BY d.declared_at DESC, d.id DESC`,
    );
    return resultado.rows.map(aDeclaracion);
  }

  async listarPendientes(usuarioId: number) {
    const resultado = await this.pool.query<{ id: number; code: string; name: string }>(
      `SELECT DISTINCT p.id, p.code, p.name
       FROM audit_controls ac
       JOIN audit_plans p ON p.id = ac.audit_id
       WHERE ac.auditor_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM conflict_declarations d WHERE d.audit_id = ac.audit_id AND d.auditor_id = ac.auditor_id
         )
       ORDER BY p.code`,
      [usuarioId],
    );
    return resultado.rows.map((f): PlanResumen => ({ id: f.id, codigo: f.code, nombre: f.name }));
  }

  async crear(planId: number, auditorId: number, datos: DatosDeclaracion) {
    try {
      await this.pool.query(
        `INSERT INTO conflict_declarations (audit_id, auditor_id, has_conflict, justification)
         VALUES ($1, $2, $3, $4)`,
        [planId, auditorId, datos.tieneConflicto, datos.justificacion],
      );
    } catch (error) {
      if ((error as { code?: string }).code === ERROR_DUPLICADO) throw new ErrorDeclaracionDuplicada(planId, auditorId);
      throw error;
    }
    return (await this.buscarDeclaracion(planId, auditorId))!;
  }
}
