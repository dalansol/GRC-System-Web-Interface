import type pg from "pg";
import type {
  DatosEdicionPlanAccion,
  DatosPlanAccion,
  EstadoPlanAccion,
  HallazgoResumen,
  PasoPlanAccion,
  PlanAccion,
} from "../domain/planesAccion.js";
import type { RepositorioPlanesAccion } from "./planesAccion.js";

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
  public_id: string | null;
  plan_title: string;
  root_cause: string | null;
  responsible_id: number;
  responsible_name: string;
  created_by: number;
  due_date: string;
  status: EstadoPlanAccion;
  created_at: Date;
  related_findings: HallazgoResumen[] | null;
  steps: PasoPlanAccion[];
}

// Las columnas DATE se piden como texto (AAAA-MM-DD); pg las convertiría a un Date en la hora local.
const SELECT_HALLAZGO = `
  SELECT f.id, f.folio, f.title, f.severity, f."auditId", f."controlId", a.end_date::text AS audit_end_date
  FROM findings f
  LEFT JOIN audits a ON a.id = f."auditId"`;

const SELECT_PLAN = `
  SELECT p.id AS plan_id, NULL::varchar AS public_id, p.title AS plan_title, p.root_cause, p.responsible_id,
         u.name AS responsible_name, p.due_date::text AS due_date, p.status, p.created_at, p.created_by,
         COALESCE((
           SELECT json_agg(json_build_object(
             'id', finding.id,
             'folio', finding.folio,
             'titulo', finding.title,
             'severidad', finding.severity,
             'auditoriaId', finding."auditId",
             'controlId', finding."controlId",
             'fechaCierreAuditoria', audit.end_date::text
           ) ORDER BY relation.finding_id)
           FROM action_plan_findings relation
           JOIN findings finding ON finding.id = relation.finding_id
           LEFT JOIN audits audit ON audit.id = finding."auditId"
           WHERE relation.action_plan_id = p.id
         ), '[]'::json) AS related_findings,
         f.id, f.folio, f.title, f.severity, f."auditId", f."controlId", a.end_date::text AS audit_end_date
  FROM action_plans p
  LEFT JOIN LATERAL (
    SELECT finding.id, finding.folio, finding.title, finding.severity,
           finding."auditId", finding."controlId", audit.end_date
    FROM action_plan_findings relation
    JOIN findings finding ON finding.id = relation.finding_id
    LEFT JOIN audits audit ON audit.id = finding."auditId"
    WHERE relation.action_plan_id = p.id
    ORDER BY relation.finding_id
    LIMIT 1
  ) f ON true
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
  const creadoEn = fila.created_at.toISOString();
  return {
    id: fila.plan_id,
    publicId: fila.public_id ?? `PACC-${creadoEn.slice(0, 4)}-${String(fila.plan_id).padStart(3, "0")}`,
    hallazgo: fila.id
      ? aHallazgo(fila)
      : {
          id: "",
          folio: null,
          titulo: "Sin hallazgo relacionado",
          severidad: null,
          auditoriaId: null,
          controlId: null,
          fechaCierreAuditoria: null,
        },
    titulo: fila.plan_title,
    causaRaiz: fila.root_cause,
    descripcion: fila.root_cause ?? "",
    responsable: { id: fila.responsible_id, nombre: fila.responsible_name },
    fechaCompromiso: fila.due_date,
    status: fila.status,
    estado: fila.status,
    creadoEn,
    creadoPorId: fila.created_by,
    hallazgosRelacionados: fila.related_findings ?? (fila.id ? [aHallazgo(fila)] : []),
    pasos: fila.steps ?? [],
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
    return this.listarConPasos();
  }

  async listarPorResponsable(usuarioId: number) {
    const resultado = await this.pool.query<FilaPlan>(
      `${SELECT_PLAN}
       WHERE p.responsible_id = $1
          OR EXISTS (
            SELECT 1
            FROM action_plan_steps assigned_step
            WHERE assigned_step.action_plan_id = p.id
              AND assigned_step.assigned_user_id = $1
          )
       ORDER BY p.due_date ASC`,
      [usuarioId],
    );
    return this.agregarPasos(resultado.rows);
  }

  async buscarPorHallazgo(hallazgoId: string) {
    const resultado = await this.pool.query<FilaPlan>(
      `${SELECT_PLAN}
       WHERE EXISTS (
         SELECT 1 FROM action_plan_findings relation
         WHERE relation.action_plan_id = p.id AND relation.finding_id = $1
       )`,
      [hallazgoId],
    );
    const fila = resultado.rows[0];
    return fila ? (await this.agregarPasos([fila]))[0]! : null;
  }

  async crear(datos: DatosPlanAccion, creadoPorId: number) {
    // El alta del plan y el cambio de estado del hallazgo van en la misma transacción.
    const cliente = await this.pool.connect();
    let id: number;
    try {
      await cliente.query("BEGIN");
      const alta = await cliente.query<{ id: number }>(
        `
        INSERT INTO action_plans (title, root_cause, responsible_id, due_date, status, created_by)
        VALUES ($1, $2, $3, $4, 'Asignado', $5)
        RETURNING id`,
        [
          datos.titulo ?? datos.descripcion,
          datos.causaRaiz ?? datos.descripcion,
          datos.responsableId,
          datos.fechaCompromiso,
          creadoPorId,
        ],
      );
      const hallazgoIds = datos.hallazgoIds?.length ? datos.hallazgoIds : [datos.hallazgoId];
      await cliente.query(
        `INSERT INTO action_plan_findings (action_plan_id, finding_id)
         SELECT $1, unnest($2::varchar[])
         ON CONFLICT DO NOTHING`,
        [alta.rows[0]!.id, hallazgoIds],
      );
      for (const paso of datos.pasos ?? []) {
        await cliente.query(
          `INSERT INTO action_plan_steps
             (action_plan_id, assigned_user_id, description, due_date)
           VALUES ($1, $2, $3, $4)`,
          [alta.rows[0]!.id, paso.usuarioAsignadoId, paso.descripcion, paso.fechaCompromiso],
        );
      }
      await cliente.query("UPDATE findings SET status = 'Asignado' WHERE id = ANY($1::varchar[])", [hallazgoIds]);
      await cliente.query("COMMIT");
      id = alta.rows[0]!.id;
    } catch (error) {
      await cliente.query("ROLLBACK");
      throw error;
    } finally {
      cliente.release();
    }
    return (await this.buscarPorId(id))!;
  }

  async buscarPorId(id: number) {
    const resultado = await this.pool.query<FilaPlan>(`${SELECT_PLAN} WHERE p.id = $1`, [id]);
    const fila = resultado.rows[0];
    return fila ? (await this.agregarPasos([fila]))[0]! : null;
  }

  async actualizar(id: number, datos: DatosEdicionPlanAccion) {
    const resultado = await this.pool.query(
      `
      UPDATE action_plans
      SET title = $1, root_cause = $2, responsible_id = $3, due_date = $4, status = $5
      WHERE id = $6`,
      [datos.titulo ?? datos.descripcion, datos.descripcion, datos.responsableId, datos.fechaCompromiso, datos.estado, id],
    );
    return resultado.rowCount === 1 ? this.buscarPorId(id) : null;
  }

  async aprobar(id: number) {
    const resultado = await this.pool.query(
      `UPDATE action_plans
       SET status = 'En Revisión'
       WHERE id = $1 AND status <> 'En Revisión'
       RETURNING id`,
      [id],
    );
    return resultado.rowCount === 1 ? this.buscarPorId(id) : null;
  }

  async actualizarPaso(planId: number, pasoId: number, completado: boolean) {
    const resultado = await this.pool.query<FilaPaso>(
      `UPDATE action_plan_steps
       SET is_completed = $1
       WHERE id = $2 AND action_plan_id = $3
       RETURNING id, action_plan_id, assigned_user_id, description, due_date::text AS due_date, is_completed, created_at`,
      [completado, pasoId, planId],
    );
    const fila = resultado.rows[0];
    if (!fila) return null;
    const detalle = await this.pool.query<FilaPaso>(
      `SELECT s.id, s.action_plan_id, s.assigned_user_id, s.description, s.due_date::text AS due_date,
              s.is_completed, s.created_at, u.name AS assigned_user_name,
              (SELECT COUNT(*) FROM evidence e
               WHERE e.entity_type = 'action_plan_step'
                 AND e.entity_id = s.id::text) AS evidence_count
       FROM action_plan_steps s
       LEFT JOIN users u ON u.id = s.assigned_user_id
       WHERE s.id = $1`,
      [fila.id],
    );
    return this.aPaso(detalle.rows[0]!);
  }

  private async listarConPasos() {
    const resultado = await this.pool.query<FilaPlan>(`${SELECT_PLAN} ORDER BY p.due_date ASC`);
    return this.agregarPasos(resultado.rows);
  }

  private async agregarPasos(filas: FilaPlan[]) {
    if (filas.length === 0) return [];
    const ids = filas.map((fila) => fila.plan_id);
    const pasos = await this.pool.query<FilaPaso>(
      `SELECT s.id, s.action_plan_id, s.assigned_user_id, s.description, s.due_date::text AS due_date,
              s.is_completed, s.created_at, u.name AS assigned_user_name,
              (SELECT COUNT(*) FROM evidence e
               WHERE e.entity_type = 'action_plan_step'
                 AND e.entity_id = s.id::text) AS evidence_count
       FROM action_plan_steps s
       LEFT JOIN users u ON u.id = s.assigned_user_id
       WHERE s.action_plan_id = ANY($1::int[])
       ORDER BY s.action_plan_id, s.id`,
      [ids],
    );
    const porPlan = new Map<number, PasoPlanAccion[]>();
    for (const paso of pasos.rows) {
      const lista = porPlan.get(paso.action_plan_id) ?? [];
      lista.push(this.aPaso(paso));
      porPlan.set(paso.action_plan_id, lista);
    }
    return filas.map((fila) => aPlan({ ...fila, steps: porPlan.get(fila.plan_id) ?? [] }));
  }

  private aPaso(fila: FilaPaso): PasoPlanAccion {
    return {
      id: fila.id,
      action_plan_id: fila.action_plan_id,
      planAccionId: fila.action_plan_id,
      usuarioAsignado: fila.assigned_user_id && fila.assigned_user_name
        ? { id: fila.assigned_user_id, nombre: fila.assigned_user_name }
        : null,
      descripcion: fila.description,
      fechaCompromiso: fila.due_date,
      completado: fila.is_completed,
      creadoEn: fila.created_at.toISOString(),
      evidenciasCount: Number(fila.evidence_count ?? 0),
    };
  }
}

interface FilaPaso {
  id: number;
  action_plan_id: number;
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  description: string;
  due_date: string | null;
  is_completed: boolean;
  created_at: Date;
  evidence_count: number | string | null;
}
