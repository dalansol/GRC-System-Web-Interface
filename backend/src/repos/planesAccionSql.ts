import type pg from "pg";
import {
  ESTADOS_BANDEJA,
  ESTADOS_BLOQUEADOS,
  type AccionFlujoPlan,
  type EstadoProrroga,
  type EventoFlujoPlan,
  type EvidenciaObservada,
  type EvidenciaPlan,
  type RechazoPlan,
  type SolicitudProrroga,
} from "../domain/flujoPlanAccion.js";
import type {
  DatosEdicionPlanAccion,
  DatosPasoPlanAccion,
  DatosPlanAccion,
  EstadoPlanAccion,
  EtapaPlanAccion,
  HallazgoResumen,
  PasoPlanAccion,
  PlanAccion,
} from "../domain/planesAccion.js";
import type { Notificacion } from "./notificaciones.js";
import type {
  AvisoPlan,
  DatosSolicitudProrroga,
  DecisionProrroga,
  RepositorioPlanesAccion,
  TransicionPlan,
} from "./planesAccion.js";

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
  review_stage: EtapaPlanAccion;
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
         u.name AS responsible_name, p.due_date::text AS due_date, p.status, p.review_stage, p.created_at, p.created_by,
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

function folioPlan(creadoEn: Date, id: number): string {
  return `PACC-${creadoEn.toISOString().slice(0, 4)}-${String(id).padStart(3, "0")}`;
}

function aPlan(fila: FilaPlan): PlanAccion {
  const creadoEn = fila.created_at.toISOString();
  return {
    id: fila.plan_id,
    publicId: fila.public_id ?? folioPlan(fila.created_at, fila.plan_id),
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
    etapa: fila.review_stage,
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

  async listarPorResponsable(usuarioId: number, opciones: { soloValidados?: boolean } = {}) {
    const resultado = await this.pool.query<FilaPlan>(
      `${SELECT_PLAN}
       WHERE (p.responsible_id = $1
          OR EXISTS (
            SELECT 1
            FROM action_plan_steps assigned_step
            WHERE assigned_step.action_plan_id = p.id
              AND assigned_step.assigned_user_id = $1
          ))
         AND (NOT $2::boolean OR p.review_stage = 'cierre')
       ORDER BY p.due_date ASC`,
      [usuarioId, opciones.soloValidados ?? false],
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
    const cliente = await this.pool.connect();
    let id: number;
    try {
      await cliente.query("BEGIN");
      const alta = await cliente.query<{ id: number }>(
        `
        INSERT INTO action_plans (title, root_cause, responsible_id, due_date, status, review_stage, created_by)
        VALUES ($1, $2, $3, $4, 'Borrador', 'definicion', $5)
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
      await insertarPasos(cliente, alta.rows[0]!.id, datos.pasos ?? []);
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

  async actualizar(id: number, datos: DatosEdicionPlanAccion, pasos?: readonly DatosPasoPlanAccion[]) {
    const cliente = await this.pool.connect();
    try {
      await cliente.query("BEGIN");
      const resultado = await cliente.query(
        `
        UPDATE action_plans
        SET title = $1, root_cause = $2, responsible_id = $3, due_date = $4, status = $5
        WHERE id = $6 AND status <> ALL($7::varchar[])
          AND (NOT $8::boolean OR review_stage = 'definicion')`,
        [
          datos.titulo ?? datos.descripcion,
          datos.descripcion,
          datos.responsableId,
          datos.fechaCompromiso,
          datos.estado,
          id,
          [...ESTADOS_BLOQUEADOS],
          pasos !== undefined,
        ],
      );
      if (resultado.rowCount !== 1) {
        await cliente.query("ROLLBACK");
        return null;
      }
      if (pasos) {
        await cliente.query("DELETE FROM action_plan_steps WHERE action_plan_id = $1", [id]);
        await insertarPasos(cliente, id, pasos);
      }
      await cliente.query("COMMIT");
    } catch (error) {
      await cliente.query("ROLLBACK");
      throw error;
    } finally {
      cliente.release();
    }
    return this.buscarPorId(id);
  }

  async transicionar(id: number, t: TransicionPlan) {
    const cliente = await this.pool.connect();
    try {
      await cliente.query("BEGIN");
      // El bloqueo de la fila hace que, de dos revisores simultáneos, el segundo vea ya el estado nuevo.
      const actual = await cliente.query<{ status: EstadoPlanAccion; review_stage: EtapaPlanAccion }>(
        "SELECT status, review_stage FROM action_plans WHERE id = $1 FOR UPDATE",
        [id],
      );
      const estadoAnterior = actual.rows[0]?.status;
      if (!estadoAnterior || !t.desde.includes(estadoAnterior)) {
        await cliente.query("ROLLBACK");
        return null;
      }
      await cliente.query("UPDATE action_plans SET status = $1, review_stage = COALESCE($2, review_stage) WHERE id = $3", [
        t.hacia,
        t.etapaNueva ?? null,
        id,
      ]);
      const evento = await cliente.query<{ id: number }>(
        `INSERT INTO action_plan_approval_events
           (action_plan_id, stage, action, from_status, to_status, actor_id, actor_name, actor_role, reason, signature_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          id,
          actual.rows[0]!.review_stage,
          t.accion,
          estadoAnterior,
          t.hacia,
          t.actor.id,
          t.actor.nombre,
          t.actor.rol,
          t.motivo ?? null,
          t.firmaHash ?? null,
        ],
      );
      for (const evidencia of t.evidenciasObservadas ?? []) {
        await cliente.query(
          `INSERT INTO action_plan_event_evidence (event_id, evidence_id, step_id, file_name, file_hash)
           VALUES ($1, $2, $3, $4, $5)`,
          [evento.rows[0]!.id, evidencia.id, evidencia.pasoId, evidencia.nombre, evidencia.hash],
        );
      }
      if (t.evidenciasObservadas?.length) {
        await cliente.query(
          "UPDATE action_plan_steps SET is_completed = false WHERE action_plan_id = $1 AND id = ANY($2::int[])",
          [id, t.evidenciasObservadas.map((evidencia) => evidencia.pasoId)],
        );
      }
      if (t.asignarHallazgos) {
        await cliente.query(
          `UPDATE findings SET status = 'Asignado'
           WHERE id IN (SELECT finding_id FROM action_plan_findings WHERE action_plan_id = $1)`,
          [id],
        );
      }
      await insertarNotificaciones(cliente, t.notificar?.usuarioIds ?? [], `plan_accion.${t.accion}`, t.notificar?.mensaje ?? "", id);
      await cliente.query("COMMIT");
    } catch (error) {
      await cliente.query("ROLLBACK");
      throw error;
    } finally {
      cliente.release();
    }
    return this.buscarPorId(id);
  }

  async listarRevision() {
    const resultado = await this.pool.query<FilaPlan>(
      `${SELECT_PLAN} WHERE p.status = ANY($1::varchar[]) ORDER BY p.due_date ASC`,
      [[...ESTADOS_BANDEJA]],
    );
    return this.agregarPasos(resultado.rows);
  }

  async listarFlujo(id: number) {
    const resultado = await this.pool.query<FilaEvento>(
      `SELECT id, action_plan_id, stage, action, from_status, to_status, actor_id, actor_name, actor_role,
              reason, signature_hash, created_at, ${EVIDENCIAS_DEL_EVENTO} AS observed_evidence
       FROM action_plan_approval_events evento
       WHERE action_plan_id = $1
       ORDER BY id`,
      [id],
    );
    return resultado.rows.map(aEvento);
  }

  async ultimoRechazo(id: number): Promise<RechazoPlan | null> {
    const resultado = await this.pool.query<Pick<FilaEvento, "reason" | "created_at" | "observed_evidence">>(
      `SELECT reason, created_at, ${EVIDENCIAS_DEL_EVENTO} AS observed_evidence
       FROM action_plan_approval_events evento
       WHERE action_plan_id = $1 AND action = 'rechazo'
       ORDER BY id DESC
       LIMIT 1`,
      [id],
    );
    const fila = resultado.rows[0];
    return fila
      ? { motivo: fila.reason ?? "", fecha: fila.created_at.toISOString(), evidenciasObservadas: fila.observed_evidence }
      : null;
  }

  async evidenciasPlan(id: number): Promise<EvidenciaPlan[]> {
    const resultado = await this.pool.query<{ id: string; step_id: number; file_name: string; file_hash: string }>(
      `SELECT e.id, s.id AS step_id, e.file_name, e.file_hash
       FROM action_plan_steps s
       JOIN evidence e ON e.entity_type = 'action_plan_step' AND e.entity_id = s.id::text
       WHERE s.action_plan_id = $1
       ORDER BY s.id, e.file_name, e.id`,
      [id],
    );
    return resultado.rows.map((fila) => ({ id: fila.id, pasoId: fila.step_id, nombre: fila.file_name, hash: fila.file_hash }));
  }

  async crearNotificaciones(usuarioIds: readonly number[], tipo: string, mensaje: string, planId: number) {
    await insertarNotificaciones(this.pool, usuarioIds, tipo, mensaje, planId);
  }

  async solicitarProrroga(datos: DatosSolicitudProrroga, notificar?: AvisoPlan) {
    const cliente = await this.pool.connect();
    let id: number;
    try {
      await cliente.query("BEGIN");
      const alta = await cliente.query<{ id: number }>(
        `INSERT INTO action_plan_extension_requests
           (action_plan_id, requested_by, previous_due_date, proposed_due_date, justification)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (action_plan_id) WHERE status = 'Pendiente' DO NOTHING
         RETURNING id`,
        [datos.planAccionId, datos.solicitadaPorId, datos.fechaActual, datos.fechaPropuesta, datos.justificacion],
      );
      if (alta.rowCount !== 1) {
        await cliente.query("ROLLBACK");
        return null;
      }
      id = alta.rows[0]!.id;
      await insertarNotificaciones(cliente, notificar?.usuarioIds ?? [], "plan_accion.solicitud_prorroga", notificar?.mensaje ?? "", datos.planAccionId);
      await cliente.query("COMMIT");
    } catch (error) {
      await cliente.query("ROLLBACK");
      throw error;
    } finally {
      cliente.release();
    }
    return this.buscarProrroga(id);
  }

  async listarProrrogasPendientes() {
    const resultado = await this.pool.query<FilaProrroga>(`${SELECT_PRORROGA} WHERE r.status = 'Pendiente' ORDER BY r.id`);
    return resultado.rows.map(aProrroga);
  }

  async buscarProrroga(id: number) {
    const resultado = await this.pool.query<FilaProrroga>(`${SELECT_PRORROGA} WHERE r.id = $1`, [id]);
    const fila = resultado.rows[0];
    return fila ? aProrroga(fila) : null;
  }

  async ultimaProrroga(planId: number) {
    const resultado = await this.pool.query<FilaProrroga>(
      `${SELECT_PRORROGA} WHERE r.action_plan_id = $1 ORDER BY r.id DESC LIMIT 1`,
      [planId],
    );
    const fila = resultado.rows[0];
    return fila ? aProrroga(fila) : null;
  }

  async decidirProrroga(id: number, decision: DecisionProrroga) {
    const cliente = await this.pool.connect();
    try {
      await cliente.query("BEGIN");
      // El bloqueo hace que, de dos decisiones simultáneas, la segunda ya no encuentre la solicitud abierta.
      const actual = await cliente.query<{ action_plan_id: number; proposed_due_date: string }>(
        `SELECT action_plan_id, proposed_due_date::text AS proposed_due_date
         FROM action_plan_extension_requests
         WHERE id = $1 AND status = 'Pendiente'
         FOR UPDATE`,
        [id],
      );
      const solicitud = actual.rows[0];
      if (!solicitud) {
        await cliente.query("ROLLBACK");
        return null;
      }
      await cliente.query(
        `UPDATE action_plan_extension_requests
         SET status = $1, decided_by = $2, decision_reason = $3, decided_at = now()
         WHERE id = $4`,
        [decision.aprobar ? "Aprobada" : "Rechazada", decision.decididaPorId, decision.motivo, id],
      );
      if (decision.aprobar) {
        await cliente.query("UPDATE action_plans SET due_date = $1 WHERE id = $2", [solicitud.proposed_due_date, solicitud.action_plan_id]);
      }
      await insertarNotificaciones(
        cliente,
        decision.notificar?.usuarioIds ?? [],
        "plan_accion.decision_prorroga",
        decision.notificar?.mensaje ?? "",
        solicitud.action_plan_id,
      );
      await cliente.query("COMMIT");
    } catch (error) {
      await cliente.query("ROLLBACK");
      throw error;
    } finally {
      cliente.release();
    }
    return this.buscarProrroga(id);
  }

  async hashesEvidenciaPlan(id: number) {
    const resultado = await this.pool.query<{ step_id: number; file_hash: string }>(
      `SELECT s.id AS step_id, e.file_hash
       FROM action_plan_steps s
       JOIN evidence e ON e.entity_type = 'action_plan_step' AND e.entity_id = s.id::text
       WHERE s.action_plan_id = $1`,
      [id],
    );
    const porPaso: Record<number, string[]> = {};
    for (const fila of resultado.rows) {
      (porPaso[fila.step_id] ??= []).push(fila.file_hash);
    }
    return porPaso;
  }

  async listarNotificaciones(usuarioId: number) {
    const resultado = await this.pool.query<FilaNotificacion>(
      `SELECT id, type, message, entity_type, entity_id, read_at, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY id DESC
       LIMIT 50`,
      [usuarioId],
    );
    return resultado.rows.map(aNotificacion);
  }

  async marcarNotificacionLeida(id: number, usuarioId: number) {
    const resultado = await this.pool.query(
      "UPDATE notifications SET read_at = COALESCE(read_at, now()) WHERE id = $1 AND user_id = $2",
      [id, usuarioId],
    );
    return resultado.rowCount === 1;
  }

  async marcarTodasLeidas(usuarioId: number) {
    await this.pool.query("UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL", [usuarioId]);
  }

  async actualizarPaso(planId: number, pasoId: number, completado: boolean) {
    const resultado = await this.pool.query<FilaPaso>(
      `UPDATE action_plan_steps
       SET is_completed = $1
       WHERE id = $2 AND action_plan_id = $3
         AND NOT EXISTS (
           SELECT 1 FROM action_plans plan
           WHERE plan.id = $3 AND (plan.status = ANY($4::varchar[]) OR plan.review_stage = 'definicion')
         )
       RETURNING id, action_plan_id, assigned_user_id, description, due_date::text AS due_date, is_completed, created_at`,
      [completado, pasoId, planId, [...ESTADOS_BLOQUEADOS]],
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

interface FilaEvento {
  id: number;
  action_plan_id: number;
  stage: EtapaPlanAccion;
  action: AccionFlujoPlan;
  from_status: EstadoPlanAccion;
  to_status: EstadoPlanAccion;
  actor_id: number;
  actor_name: string;
  actor_role: string;
  reason: string | null;
  signature_hash: string | null;
  created_at: Date;
  observed_evidence: EvidenciaObservada[];
}

// Archivos señalados en un evento, ya con la forma que usa el dominio.
const EVIDENCIAS_DEL_EVENTO = `COALESCE((
  SELECT json_agg(json_build_object('evidenciaId', o.evidence_id, 'pasoId', o.step_id, 'nombre', o.file_name) ORDER BY o.step_id, o.file_name)
  FROM action_plan_event_evidence o
  WHERE o.event_id = evento.id
), '[]'::json)`;

async function insertarPasos(cliente: pg.PoolClient, planId: number, pasos: readonly DatosPasoPlanAccion[]) {
  for (const paso of pasos) {
    await cliente.query(
      `INSERT INTO action_plan_steps
         (action_plan_id, assigned_user_id, description, due_date)
       VALUES ($1, $2, $3, $4)`,
      [planId, paso.usuarioAsignadoId, paso.descripcion, paso.fechaCompromiso],
    );
  }
}

async function insertarNotificaciones(
  cliente: Pick<pg.Pool, "query">,
  usuarioIds: readonly number[],
  tipo: string,
  mensaje: string,
  planId: number,
) {
  if (usuarioIds.length === 0) return;
  await cliente.query(
    `INSERT INTO notifications (user_id, type, message, entity_type, entity_id)
     SELECT unnest($1::int[]), $2, $3, 'action_plan', $4`,
    [[...usuarioIds], tipo, mensaje, String(planId)],
  );
}

const SELECT_PRORROGA = `
  SELECT r.id, r.action_plan_id, r.requested_by, u.name AS requested_by_name,
         r.previous_due_date::text AS previous_due_date, r.proposed_due_date::text AS proposed_due_date,
         r.justification, r.status, r.decision_reason, r.created_at, p.created_at AS plan_created_at
  FROM action_plan_extension_requests r
  JOIN users u ON u.id = r.requested_by
  JOIN action_plans p ON p.id = r.action_plan_id`;

interface FilaProrroga {
  id: number;
  action_plan_id: number;
  requested_by: number;
  requested_by_name: string;
  previous_due_date: string;
  proposed_due_date: string;
  justification: string;
  status: EstadoProrroga;
  decision_reason: string | null;
  created_at: Date;
  plan_created_at: Date;
}

function aProrroga(fila: FilaProrroga): SolicitudProrroga {
  return {
    id: fila.id,
    planAccionId: fila.action_plan_id,
    folioPlan: folioPlan(fila.plan_created_at, fila.action_plan_id),
    solicitadaPor: { id: fila.requested_by, nombre: fila.requested_by_name },
    fechaActual: fila.previous_due_date,
    fechaPropuesta: fila.proposed_due_date,
    justificacion: fila.justification,
    estado: fila.status,
    motivoDecision: fila.decision_reason,
    creadaEn: fila.created_at.toISOString(),
  };
}

function aEvento(fila: FilaEvento): EventoFlujoPlan {
  return {
    id: fila.id,
    planAccionId: fila.action_plan_id,
    etapa: fila.stage,
    accion: fila.action,
    estadoAnterior: fila.from_status,
    estadoNuevo: fila.to_status,
    actor: { id: fila.actor_id, nombre: fila.actor_name, rol: fila.actor_role },
    motivo: fila.reason,
    firmaHash: fila.signature_hash,
    fecha: fila.created_at.toISOString(),
    evidenciasObservadas: fila.observed_evidence,
  };
}

interface FilaNotificacion {
  id: number;
  type: string;
  message: string;
  entity_type: string;
  entity_id: string;
  read_at: Date | null;
  created_at: Date;
}

function aNotificacion(fila: FilaNotificacion): Notificacion {
  return {
    id: fila.id,
    tipo: fila.type,
    mensaje: fila.message,
    entidadTipo: fila.entity_type,
    entidadId: fila.entity_id,
    leida: fila.read_at !== null,
    fecha: fila.created_at.toISOString(),
  };
}
