// Flujo de aprobación de planes de acción (SF-12): reglas de revisión, motivo de rechazo y firma electrónica.
// Cada plan pasa por dos revisiones: la de su definición, antes de empezar, y la de su evidencia, al cierre.
import { createHash } from "node:crypto";
import {
  fechaValida,
  validarFechaCompromiso,
  type EstadoPlanAccion,
  type EtapaPlanAccion,
  type PlanAccion,
} from "./planesAccion.js";

/** Roles que revisan, aprueban o rechazan planes de acción. Un solo nivel; el flujo multinivel sigue pendiente (TBD). */
export const ROLES_REVISION = ["Jefe de Auditoría"];
/** Roles que crean planes, los editan y los envían a revisión (UF-08, SF-10). */
export const ROLES_GESTION_PLAN = ["Auditor", "Auditor Senior"];
/** Roles de las áreas auditadas: solo trabajan con lo que tienen asignado (UF-13, SF-16). */
export const ROLES_AUDITADO = ["Jefe Auditado", "Empleado Auditado"];

export function esAuditado(rol: string): boolean {
  return ROLES_AUDITADO.includes(rol);
}

/** Estados que el equipo de auditoría puede fijar a mano. Los demás solo los cambia el flujo. */
export const ESTADOS_EDICION_MANUAL: readonly EstadoPlanAccion[] = ["Asignado", "En Progreso", "Completado"];
/** El plan no admite cambios en estos estados: lo que se revisa o se firmó no debe moverse. */
export const ESTADOS_BLOQUEADOS: readonly EstadoPlanAccion[] = ["Pendiente", "En Revisión", "Aprobado"];
/** Estados que aparecen en la bandeja de revisión. */
export const ESTADOS_BANDEJA: readonly EstadoPlanAccion[] = ["Pendiente", "En Revisión", "Aprobado", "Rechazado"];

const ENVIABLES_POR_ETAPA: Record<EtapaPlanAccion, readonly EstadoPlanAccion[]> = {
  definicion: ["Borrador", "Rechazado"],
  cierre: ["Asignado", "En Progreso", "Completado", "Rechazado"],
};

/** Estados desde los que el plan se puede enviar a revisión en cada etapa. */
export function estadosEnviables(etapa: EtapaPlanAccion): readonly EstadoPlanAccion[] {
  return ENVIABLES_POR_ETAPA[etapa];
}

export const LONGITUD_MAXIMA_MOTIVO = 2000;

export type AccionFlujoPlan = "envio" | "apertura" | "aprobacion" | "rechazo";

/** Evento inmutable de la bitácora del flujo. Nombre y rol se guardan como estaban al momento de la acción. */
export interface EventoFlujoPlan {
  id: number;
  planAccionId: number;
  etapa: EtapaPlanAccion;
  accion: AccionFlujoPlan;
  estadoAnterior: EstadoPlanAccion;
  estadoNuevo: EstadoPlanAccion;
  actor: { id: number; nombre: string; rol: string };
  motivo: string | null;
  firmaHash: string | null;
  fecha: string;
  evidenciasObservadas: EvidenciaObservada[];
}

/** Archivo señalado en un rechazo. Se copia el nombre porque el archivo puede reemplazarse después. */
export interface EvidenciaObservada {
  evidenciaId: string;
  pasoId: number;
  nombre: string;
}

/** Archivo de evidencia de un paso del plan. */
export interface EvidenciaPlan {
  id: string;
  pasoId: number;
  nombre: string;
  hash: string;
}

export interface RechazoPlan {
  motivo: string;
  fecha: string;
  evidenciasObservadas: EvidenciaObservada[];
}

export type EstadoProrroga = "Pendiente" | "Aprobada" | "Rechazada";

/** Solicitud para mover la fecha de compromiso del plan (SF-11). */
export interface SolicitudProrroga {
  id: number;
  planAccionId: number;
  folioPlan: string;
  solicitadaPor: { id: number; nombre: string };
  fechaActual: string;
  fechaPropuesta: string;
  justificacion: string;
  estado: EstadoProrroga;
  motivoDecision: string | null;
  creadaEn: string;
}

/** Lo único que recibe un auditado de un plan (SF-16). Se arma campo por campo para no exponer nada nuevo por omisión. */
export interface PlanAuditado {
  id: number;
  publicId: string;
  titulo: string;
  estado: EstadoPlanAccion;
  fechaCompromiso: string;
  hallazgo: { folio: string | null; titulo: string };
  esResponsable: boolean;
  pasos: PasoAuditado[];
  rechazo: RechazoPlan | null;
  prorroga: SolicitudProrroga | null;
}

export interface PasoAuditado {
  id: number;
  descripcion: string;
  fechaCompromiso: string | null;
  completado: boolean;
  evidenciasCount: number;
  usuarioAsignado: { id: number; nombre: string } | null;
  esMio: boolean;
}

function participaEnPlan(plan: PlanAccion, usuarioId: number): "responsable" | "asignado" | null {
  if (plan.responsable.id === usuarioId) return "responsable";
  return plan.pasos.some((paso) => paso.usuarioAsignado?.id === usuarioId) ? "asignado" : null;
}

/** Devuelve por qué el usuario no puede revisar el plan, o null si puede. */
export function impedimentoRevision(plan: PlanAccion, usuario: { id: number; rol: string }): string | null {
  if (!ROLES_REVISION.includes(usuario.rol)) {
    return "Solo el Jefe de Auditoría puede revisar planes de acción.";
  }
  const participa = participaEnPlan(plan, usuario.id);
  if (participa === "responsable") return "No puedes revisar este plan porque eres su responsable.";
  if (participa === "asignado") return "No puedes revisar este plan porque tienes pasos asignados.";
  if (plan.creadoPorId === usuario.id) return "No puedes revisar este plan porque lo creaste.";
  return null;
}

/** Devuelve por qué el usuario no puede enviar el plan a revisión, o null si puede. */
export function impedimentoEnvio(plan: PlanAccion, usuario: { id: number; rol: string }): string | null {
  if (!ROLES_GESTION_PLAN.includes(usuario.rol)) {
    return "Solo un Auditor o un Auditor Senior puede enviar planes de acción a revisión.";
  }
  if (participaEnPlan(plan, usuario.id)) {
    return "No puedes enviar este plan a revisión porque eres su responsable o tienes pasos asignados.";
  }
  return null;
}

/** El auditado solo trabaja en un plan ya validado y que no esté en revisión ni aprobado. */
export function abiertoParaAuditado(plan: PlanAccion): boolean {
  return plan.etapa === "cierre" && !ESTADOS_BLOQUEADOS.includes(plan.estado);
}

/** Devuelve el error del motivo de rechazo, o null si es válido. */
export function validarMotivoRechazo(motivo: unknown): string | null {
  const texto = typeof motivo === "string" ? motivo.trim() : "";
  if (!texto) return "El motivo de rechazo es obligatorio.";
  if (texto.length > LONGITUD_MAXIMA_MOTIVO) return `El motivo de rechazo admite hasta ${LONGITUD_MAXIMA_MOTIVO} caracteres.`;
  return null;
}

/** Devuelve el primer error de una solicitud de prórroga, o null si es válida (SF-11). */
export function validarSolicitudProrroga(
  datos: Record<string, unknown>,
  fechaActual: string,
  fechaCierreAuditoria: string | null,
): string | null {
  const { fechaPropuesta, justificacion } = datos;
  if (!fechaValida(fechaPropuesta)) return "La fecha propuesta no es válida (AAAA-MM-DD).";
  if (fechaPropuesta <= fechaActual) return "La fecha propuesta debe ser posterior a la fecha de compromiso actual.";
  const errorCierre = validarFechaCompromiso(fechaPropuesta, fechaCierreAuditoria);
  if (errorCierre) return errorCierre;
  const texto = typeof justificacion === "string" ? justificacion.trim() : "";
  if (!texto) return "La justificación es obligatoria.";
  if (texto.length > LONGITUD_MAXIMA_MOTIVO) return `La justificación admite hasta ${LONGITUD_MAXIMA_MOTIVO} caracteres.`;
  return null;
}

/**
 * Huella SHA-256 del contenido firmado: el plan, sus hallazgos, sus pasos y los hashes de su evidencia.
 * Se ordena todo para que no dependa del orden de las consultas, y no incluye el estado porque cambia al firmar.
 */
export function huellaContenidoPlan(plan: PlanAccion, hashesEvidencia: Record<number, string[]>): string {
  const contenido = {
    id: plan.id,
    titulo: plan.titulo,
    causaRaiz: plan.causaRaiz,
    responsableId: plan.responsable.id,
    fechaCompromiso: plan.fechaCompromiso,
    hallazgos: plan.hallazgosRelacionados.map((hallazgo) => hallazgo.id).sort(),
    pasos: [...plan.pasos]
      .sort((a, b) => a.id - b.id)
      .map((paso) => ({
        id: paso.id,
        descripcion: paso.descripcion,
        usuarioAsignadoId: paso.usuarioAsignado?.id ?? null,
        fechaCompromiso: paso.fechaCompromiso,
        completado: paso.completado,
        evidencias: [...(hashesEvidencia[paso.id] ?? [])].sort(),
      })),
  };
  return createHash("sha256").update(JSON.stringify(contenido)).digest("hex");
}

/**
 * A quién se avisa de un cambio de estatus: responsable, asignados y quien creó el plan, sin quien actuó.
 * Un rechazo de la definición solo le llega a quien creó el plan, porque el auditado aún no lo ve.
 */
export function destinatariosCambio(plan: PlanAccion, actorId: number, accion?: AccionFlujoPlan): number[] {
  const usuarios = new Set<number>([plan.creadoPorId]);
  if (!(plan.etapa === "definicion" && accion === "rechazo")) {
    usuarios.add(plan.responsable.id);
    for (const paso of plan.pasos) {
      if (paso.usuarioAsignado) usuarios.add(paso.usuarioAsignado.id);
    }
  }
  usuarios.delete(actorId);
  return [...usuarios];
}

/**
 * Vista del plan para un auditado (SF-16): el responsable ve todos los pasos y un asignado solo los suyos.
 * No incluye la causa raíz, la severidad, el historial ni la firma.
 */
export function vistaAuditadoPlan(
  plan: PlanAccion,
  usuarioId: number,
  rechazo: RechazoPlan | null,
  prorroga: SolicitudProrroga | null,
): PlanAuditado {
  const esResponsable = plan.responsable.id === usuarioId;
  const pasos = plan.pasos
    .filter((paso) => esResponsable || paso.usuarioAsignado?.id === usuarioId)
    .map((paso): PasoAuditado => ({
      id: paso.id,
      descripcion: paso.descripcion,
      fechaCompromiso: paso.fechaCompromiso,
      completado: paso.completado,
      evidenciasCount: paso.evidenciasCount,
      usuarioAsignado: paso.usuarioAsignado,
      esMio: paso.usuarioAsignado?.id === usuarioId,
    }));
  const visibles = new Set(pasos.map((paso) => paso.id));
  return {
    id: plan.id,
    publicId: plan.publicId,
    titulo: plan.titulo,
    estado: plan.estado,
    fechaCompromiso: plan.fechaCompromiso,
    hallazgo: { folio: plan.hallazgo.folio, titulo: plan.hallazgo.titulo },
    esResponsable,
    pasos,
    rechazo:
      rechazo && plan.estado === "Rechazado"
        ? {
            motivo: rechazo.motivo,
            fecha: rechazo.fecha,
            evidenciasObservadas: rechazo.evidenciasObservadas.filter((evidencia) => visibles.has(evidencia.pasoId)),
          }
        : null,
    prorroga: esResponsable ? prorroga : null,
  };
}
