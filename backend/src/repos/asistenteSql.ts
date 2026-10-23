import type pg from "pg";
import type { AlmacenamientoArchivos } from "../almacenamiento.js";
import type { EstadoRespuesta } from "../asistente/asistente.js";
import { contextoDeControl, contextoDeHallazgo } from "../asistente/expediente.js";
import type {
  EntidadConversacion,
  EvidenciaExpediente,
  ExpedienteControl,
  ExpedienteEvidencia,
  ExpedienteHallazgo,
  MensajeConversacion,
  RepositorioAsistente,
} from "./asistente.js";
import type { LectorEvidencia } from "./evidencias.js";
import { condicionControlVisible, condicionEvidenciaVisible, condicionHallazgoVisible } from "./evidenciasAcceso.js";

interface FilaExpediente {
  id: string;
  folio: string | null;
  title: string;
  description: string | null;
  type: string | null;
  severity: string;
  status: string;
  residualRisk: string | null;
  failedControl: string | null;
  ownerId: string | null;
  owner_name: string | null;
  created_at: Date;
  audit_id: string | null;
  audit_name: string | null;
  audit_end_date: string | null;
  control_id: string | null;
  control_code: string | null;
  control_name: string | null;
  plan_description: string | null;
  plan_responsible: string | null;
  plan_due_date: string | null;
  plan_status: string | null;
}

interface FilaEvidencia {
  id: string;
  file_name: string;
  mime_type: string;
  file_hash: string | null;
  storage_path: string;
  created_at: Date;
  uploader: string | null;
}

interface FilaControlPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: string | null;
  frequency: string | null;
  size: string | null;
  rotation: string | null;
  plan_id: number;
  plan_code: string;
  plan_name: string;
  plan_type: string;
  period: string | null;
  start_date: string;
  end_date: string;
  plan_status: string;
  scope: string | null;
  estimated_hours: number | null;
  plan_responsible: string | null;
}

interface FilaAsignacion {
  auditor: string;
  rol: string;
  is_lead: boolean;
  assigned_by_name: string | null;
  status: string;
  hours_spent: string | number | null;
  feedback: string | null;
  has_conflict: boolean | null;
}

interface FilaEvidenciaAnalizada extends FilaEvidencia {
  entity_type: string;
  entity_id: string;
  control_id: string | null;
  finding_id: string | null;
  audit_id: string | null;
}

// "ownerId" es texto y puede no ser un usuario registrado; por eso el cruce es por texto.
const SELECT_EXPEDIENTE = `
  SELECT f.id, f.folio, f.title, f.description, f.type, f.severity, f.status, f."residualRisk", f."failedControl",
         f."ownerId", ou.name AS owner_name, f.created_at,
         a.id AS audit_id, a.name AS audit_name, a.end_date::text AS audit_end_date,
         c.id AS control_id, c.code AS control_code, c.name AS control_name,
         p.description AS plan_description, pu.name AS plan_responsible, p.due_date::text AS plan_due_date,
         p.status AS plan_status
  FROM findings f
  LEFT JOIN users ou ON ou.id::text = f."ownerId"
  LEFT JOIN audits a ON a.id = f."auditId"
  LEFT JOIN controls c ON c.id = f."controlId"
  LEFT JOIN action_plans p ON p.finding_id = f.id
  LEFT JOIN users pu ON pu.id = p.responsible_id
  WHERE f.id = $1`;

// Misma regla que GET /evidencias?entityType=hallazgo.
const SELECT_EVIDENCIAS = `
  SELECT e.id, e.file_name, e.mime_type, e.file_hash, e.storage_path, e.created_at, u.name AS uploader
  FROM evidence e
  LEFT JOIN users u ON u.id::text = e.uploaded_by
  WHERE e.finding_id = $1 AND ${condicionHallazgoVisible("$2")}
  ORDER BY e.created_at ASC`;

const SELECT_CONTROL_PLAN = `
  SELECT c.id, c.code, c.name, c.description, c.type, c.frequency, c.size, c.rotation,
         p.id AS plan_id, p.code AS plan_code, p.name AS plan_name, p.type AS plan_type, p.period,
         p.start_date::text AS start_date, p.end_date::text AS end_date, p.status AS plan_status,
         p.scope, p.estimated_hours, ru.name AS plan_responsible
  FROM controls c
  CROSS JOIN audit_plans p
  LEFT JOIN users ru ON ru.id = p.responsible_id
  WHERE (c.id = $2 OR c.code = $2) AND p.id = $1
  LIMIT 1`;

// Misma regla que GET /planes/:planId/controles (routes/auditControls.ts).
const SELECT_ASIGNACIONES = `
  SELECT u.name AS auditor, r.name AS rol, ac.is_lead, ab.name AS assigned_by_name, ac.status,
         ac.hours_spent, ac.feedback, d.has_conflict
  FROM audit_controls ac
  JOIN users u ON u.id = ac.auditor_id
  JOIN roles r ON r.id = u.role_id
  LEFT JOIN users ab ON ab.id = ac.assigned_by
  LEFT JOIN conflict_declarations d ON d.audit_id = ac.audit_id AND d.auditor_id = ac.auditor_id
  WHERE ac.audit_id = $1 AND ac.control_id = $2
    AND (
      $3 IN ('Jefe de Auditoría', 'Supervisor', 'Administrador')
      OR ($3 = 'Auditor Senior' AND ac.assigned_by = $4)
      OR ($3 = 'Auditor' AND ac.auditor_id = $4)
    )
  ORDER BY ac.is_lead DESC, u.name`;

// Misma regla que GET /evidencias?entityType=control.
const SELECT_EVIDENCIAS_CONTROL = `
  SELECT e.id, e.file_name, e.mime_type, e.file_hash, e.storage_path, e.created_at, u.name AS uploader
  FROM evidence e
  LEFT JOIN users u ON u.id::text = e.uploaded_by
  WHERE e.entity_id = $1 AND e.entity_type = 'control' AND e.audit_id::text = $2
    AND ${condicionControlVisible("$3", "$4")}
  ORDER BY e.created_at ASC`;

const SELECT_EVIDENCIA = `
  SELECT e.id, e.file_name, e.mime_type, e.file_hash, e.storage_path, e.created_at, u.name AS uploader,
         e.entity_type, e.entity_id, e.control_id, e.finding_id, e.audit_id
  FROM evidence e
  LEFT JOIN users u ON u.id::text = e.uploaded_by
  WHERE e.id = $1 AND ${condicionEvidenciaVisible("$2", "$3")}`;

export class RepositorioAsistenteSql implements RepositorioAsistente {
  constructor(
    private readonly pool: pg.Pool,
    // El mismo almacenamiento donde routes/evidencias.ts guarda los archivos.
    private readonly almacenamiento: AlmacenamientoArchivos,
  ) {}

  async expedienteHallazgo(hallazgoId: string, lector: LectorEvidencia): Promise<ExpedienteHallazgo | null> {
    const fila = (await this.pool.query<FilaExpediente>(SELECT_EXPEDIENTE, [hallazgoId])).rows[0];
    if (!fila) return null;
    const evidencias = await this.pool.query<FilaEvidencia>(SELECT_EVIDENCIAS, [hallazgoId, String(lector.id)]);

    return {
      hallazgo: {
        id: fila.id,
        folio: fila.folio,
        titulo: fila.title,
        descripcion: fila.description,
        tipo: fila.type,
        severidad: fila.severity,
        estado: fila.status,
        riesgoResidual: fila.residualRisk,
        controlFallido: fila.failedControl,
        responsable: fila.owner_name ?? fila.ownerId,
        creadoEn: fila.created_at.toISOString(),
      },
      auditoria: fila.audit_id
        ? { id: fila.audit_id, nombre: fila.audit_name ?? fila.audit_id, fechaCierre: fila.audit_end_date }
        : null,
      control: fila.control_id && fila.control_name
        ? { id: fila.control_id, codigo: fila.control_code, nombre: fila.control_name }
        : null,
      planAccion: fila.plan_description
        ? {
            descripcion: fila.plan_description,
            responsable: fila.plan_responsible ?? "",
            fechaCompromiso: fila.plan_due_date ?? "",
            estado: fila.plan_status ?? "",
          }
        : null,
      evidencias: evidencias.rows.map((e) => this.aEvidencia(e)),
    };
  }

  async expedienteControl(planId: number, controlId: string, lector: LectorEvidencia): Promise<ExpedienteControl | null> {
    const fila = (await this.pool.query<FilaControlPlan>(SELECT_CONTROL_PLAN, [planId, controlId])).rows[0];
    if (!fila) return null;
    // Las consultas siguientes usan el id real aunque se haya pedido por código.
    const asignaciones = await this.pool.query<FilaAsignacion>(SELECT_ASIGNACIONES, [planId, fila.id, lector.rol, lector.id]);
    if (asignaciones.rows.length === 0) return null;
    const [hallazgos, evidencias] = await Promise.all([
      this.pool.query<{ folio: string | null; title: string; severity: string; status: string }>(
        `SELECT folio, title, severity, status FROM findings WHERE "controlId" = $1 ORDER BY created_at`,
        [fila.id],
      ),
      this.pool.query<FilaEvidencia>(SELECT_EVIDENCIAS_CONTROL, [fila.id, String(planId), lector.rol, String(lector.id)]),
    ]);

    return {
      control: {
        id: fila.id,
        codigo: fila.code,
        nombre: fila.name,
        actividad: fila.description,
        tipo: fila.type,
        frecuencia: fila.frequency,
        tamanoMuestra: fila.size,
        rotacion: fila.rotation,
      },
      plan: {
        id: fila.plan_id,
        codigo: fila.plan_code,
        nombre: fila.plan_name,
        tipo: fila.plan_type,
        periodo: fila.period,
        fechaInicio: fila.start_date,
        fechaFin: fila.end_date,
        estado: fila.plan_status,
        alcance: fila.scope,
        horasEstimadas: fila.estimated_hours,
        responsable: fila.plan_responsible,
      },
      asignaciones: asignaciones.rows.map((a) => ({
        auditor: a.auditor,
        rol: a.rol,
        lider: a.is_lead,
        asignadoPor: a.assigned_by_name,
        estado: a.status,
        // NUMERIC llega como texto.
        horas: Number(a.hours_spent ?? 0),
        retroalimentacion: a.feedback,
        conflictoDeInteres: a.has_conflict === null ? "sin_declarar" : a.has_conflict ? "con_conflicto" : "sin_conflicto",
      })),
      hallazgos: hallazgos.rows.map((h) => ({ folio: h.folio, titulo: h.title, severidad: h.severity, estado: h.status })),
      evidencias: evidencias.rows.map((e) => this.aEvidencia(e)),
    };
  }

  async expedienteEvidencia(evidenciaId: string, lector: LectorEvidencia): Promise<ExpedienteEvidencia | null> {
    const fila = (
      await this.pool.query<FilaEvidenciaAnalizada>(SELECT_EVIDENCIA, [evidenciaId, lector.rol, String(lector.id)])
    ).rows[0];
    if (!fila) return null;
    const evidencia = this.aEvidencia(fila);

    if (fila.entity_type === "control") {
      const controlId = fila.control_id ?? fila.entity_id;
      // evidence.audit_id es texto; el plan es numérico.
      const expediente = fila.audit_id && /^\d+$/.test(fila.audit_id)
        ? await this.expedienteControl(Number(fila.audit_id), controlId, lector)
        : null;
      return {
        evidencia,
        contexto: expediente
          ? contextoDeControl(expediente, fila.id)
          : { tipo: "control", etiqueta: `Control ${controlId}`, datos: { control: { id: controlId }, nota: "No se encontró la asignación del control en el plan." } },
      };
    }

    const hallazgoId = fila.finding_id ?? fila.entity_id;
    const expediente = await this.expedienteHallazgo(hallazgoId, lector);
    return {
      evidencia,
      contexto: expediente
        ? contextoDeHallazgo(expediente, fila.id)
        : { tipo: "hallazgo", etiqueta: `Hallazgo ${hallazgoId}`, datos: { hallazgo: { id: hallazgoId }, nota: "No se encontró el hallazgo." } },
    };
  }

  private aEvidencia(e: FilaEvidencia): EvidenciaExpediente {
    return {
      id: e.id,
      nombre: e.file_name,
      formato: e.mime_type,
      subidaPor: e.uploader,
      fecha: e.created_at.toISOString(),
      hash: e.file_hash,
      leer: () => this.almacenamiento.leer(e.storage_path),
    };
  }

  async historial(usuarioId: number, entidad: EntidadConversacion, entidadId: string, limite: number) {
    const resultado = await this.pool.query<{ role: "usuario" | "asistente"; content: string; estado: EstadoRespuesta | null; created_at: Date }>(
      `SELECT m.role, m.content, m.estado, m.created_at
       FROM ai_messages m
       JOIN ai_conversations c ON c.id = m.conversation_id
       WHERE c.user_id = $1 AND c.entity_type = $2 AND c.entity_id = $3
       ORDER BY m.id DESC
       LIMIT $4`,
      [usuarioId, entidad, entidadId, limite],
    );
    return resultado.rows.reverse().map(
      (m): MensajeConversacion => ({ rol: m.role, texto: m.content, estado: m.estado, fecha: m.created_at.toISOString() }),
    );
  }

  async guardarTurno(
    usuarioId: number,
    entidad: EntidadConversacion,
    entidadId: string,
    pregunta: string,
    respuesta: { estado: EstadoRespuesta; texto: string },
  ) {
    const cliente = await this.pool.connect();
    try {
      await cliente.query("BEGIN");
      const conversacion = await cliente.query<{ id: number }>(
        `INSERT INTO ai_conversations (user_id, entity_type, entity_id) VALUES ($1, $2, $3)
         ON CONFLICT ON CONSTRAINT uq_ai_conversations_entity DO UPDATE SET updated_at = now()
         RETURNING id`,
        [usuarioId, entidad, entidadId],
      );
      const id = conversacion.rows[0]!.id;
      await cliente.query(
        `INSERT INTO ai_messages (conversation_id, role, content, estado)
         VALUES ($1, 'usuario', $2, NULL), ($1, 'asistente', $3, $4)`,
        [id, pregunta, respuesta.texto, respuesta.estado],
      );
      await cliente.query("COMMIT");
    } catch (error) {
      await cliente.query("ROLLBACK");
      throw error;
    } finally {
      cliente.release();
    }
  }

  async borrarConversacion(usuarioId: number, entidad: EntidadConversacion, entidadId: string) {
    await this.pool.query("DELETE FROM ai_conversations WHERE user_id = $1 AND entity_type = $2 AND entity_id = $3", [
      usuarioId,
      entidad,
      entidadId,
    ]);
  }
}
