import type pg from "pg";
import type { DatosPlanAccion, EstadoPlanAccion, HallazgoResumen, PlanAccion } from "../domain/planesAccion.js";
import { ErrorPlanDuplicado, type RepositorioPlanesAccion } from "./planesAccion.js";

interface FilaHallazgo {
  id: string;
  folio: string | null;
  title: string;
  severity: string | null;
  auditId: string | null;
  controlId: string | null;
  audit_end_date: string | null;
}

interface FilaPlan extends FilaHallazgo {
  plan_id: number;
  description: string;
  responsible_id: number;
  responsible_name: string;
  due_date: string;
  status: EstadoPlanAccion;
  created_at: Date;
}

// Código de PostgreSQL para violación de restricción o índice único.
const ERROR_DUPLICADO = "23505";

// Las columnas DATE se piden como texto (AAAA-MM-DD); pg las convertiría a un Date en la hora local.
const SELECT_HALLAZGO = `
  SELECT f.id, f.folio, f.title, f.severity, f."auditId", f."controlId", a.end_date::text AS audit_end_date
  FROM findings f
  LEFT JOIN audits a ON a.id = f."auditId"`;

const SELECT_PLAN = `
  SELECT p.id AS plan_id, p.description, p.responsible_id, u.name AS responsible_name, p.due_date::text AS due_date, p.status, p.created_at,
         f.id, f.folio, f.title, f.severity, f."auditId", f."controlId", a.end_date::text AS audit_end_date
  FROM action_plans p
  JOIN findings f ON f.id = p.finding_id
  JOIN users u ON u.id = p.responsible_id
  LEFT JOIN audits a ON a.id = f."auditId"`;

function aHallazgo(fila: FilaHallazgo): HallazgoResumen {
  return {
    id: fila.id,
    folio: fila.folio,
    titulo: fila.title,
    severidad: fila.severity,
    auditoriaId: fila.auditId,
    controlId: fila.controlId,
    fechaCierreAuditoria: fila.audit_end_date,
  };
}

function aPlan(fila: FilaPlan): PlanAccion {
  return {
    id: fila.plan_id,
    hallazgo: aHallazgo(fila),
    descripcion: fila.description,
    responsable: { id: fila.responsible_id, nombre: fila.responsible_name },
    fechaCompromiso: fila.due_date,
    estado: fila.status,
    creadoEn: fila.created_at.toISOString(),
  };
}

// Repositorio de planes de acción sobre PostgreSQL (Supabase). Todas las consultas usan parámetros.
export class RepositorioPlanesAccionSql implements RepositorioPlanesAccion {
  constructor(private readonly pool: pg.Pool) {}

  async buscarHallazgo(hallazgoId: string) {
    const resultado = await this.pool.query<FilaHallazgo>(`${SELECT_HALLAZGO} WHERE f.id = $1`, [hallazgoId]);
    const fila = resultado.rows[0];
    return fila ? aHallazgo(fila) : null;
  }

  async listar() {
    const resultado = await this.pool.query<FilaPlan>(`${SELECT_PLAN} ORDER BY p.due_date ASC`);
    return resultado.rows.map(aPlan);
  }

  async listarPorResponsable(usuarioId: number) {
    const resultado = await this.pool.query<FilaPlan>(
      `${SELECT_PLAN} WHERE p.responsible_id = $1 ORDER BY p.due_date ASC`,
      [usuarioId],
    );
    return resultado.rows.map(aPlan);
  }

  async buscarPorHallazgo(hallazgoId: string) {
    const resultado = await this.pool.query<FilaPlan>(`${SELECT_PLAN} WHERE p.finding_id = $1`, [hallazgoId]);
    const fila = resultado.rows[0];
    return fila ? aPlan(fila) : null;
  }

  async crear(datos: DatosPlanAccion, creadoPorId: number) {
    // El alta del plan y el cambio de estado del hallazgo van en la misma transacción.
    const cliente = await this.pool.connect();
    let id: number;
    try {
      await cliente.query("BEGIN");
      const alta = await cliente.query<{ id: number }>(
        `
        INSERT INTO action_plans (finding_id, description, responsible_id, due_date, status, created_by)
        VALUES ($1, $2, $3, $4, 'Asignado', $5)
        RETURNING id`,
        [datos.hallazgoId, datos.descripcion, datos.responsableId, datos.fechaCompromiso, creadoPorId],
      );
      await cliente.query("UPDATE findings SET status = 'Asignado' WHERE id = $1", [datos.hallazgoId]);
      await cliente.query("COMMIT");
      id = alta.rows[0]!.id;
    } catch (error) {
      await cliente.query("ROLLBACK");
      if ((error as { code?: string }).code === ERROR_DUPLICADO) throw new ErrorPlanDuplicado(datos.hallazgoId);
      throw error;
    } finally {
      cliente.release();
    }
    const resultado = await this.pool.query<FilaPlan>(`${SELECT_PLAN} WHERE p.id = $1`, [id]);
    return aPlan(resultado.rows[0]!);
  }
}
