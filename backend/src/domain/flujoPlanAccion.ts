// Flujo de aprobación de planes de acción (SF-12): reglas de revisión, motivo de rechazo y firma electrónica.
import { createHash } from "node:crypto";
import type { EstadoPlanAccion, PlanAccion } from "./planesAccion.js";
import { ROL_ADMINISTRADOR } from "./tipos.js";

/** Roles que revisan, aprueban o rechazan planes de acción. Un solo nivel; el flujo multinivel sigue pendiente (TBD). */
export const ROLES_REVISION = [ROL_ADMINISTRADOR, "Jefe de Auditoría"];

/** Estados que el equipo de auditoría puede fijar a mano. Los demás solo los cambia el flujo. */
export const ESTADOS_EDICION_MANUAL: readonly EstadoPlanAccion[] = ["Asignado", "En Progreso", "Completado"];
/** El plan no admite cambios en estos estados: lo que se revisa o se firmó no debe moverse. */
export const ESTADOS_BLOQUEADOS: readonly EstadoPlanAccion[] = ["Pendiente", "En Revisión", "Aprobado"];
/** Estados desde los que el responsable puede enviar el plan a revisión. */
export const ESTADOS_ENVIABLES: readonly EstadoPlanAccion[] = ["Asignado", "En Progreso", "Completado", "Rechazado"];
/** Estados que aparecen en la bandeja de revisión. */
export const ESTADOS_BANDEJA: readonly EstadoPlanAccion[] = ["Pendiente", "En Revisión", "Aprobado", "Rechazado"];

export const LONGITUD_MAXIMA_MOTIVO = 2000;

export type AccionFlujoPlan = "envio" | "apertura" | "aprobacion" | "rechazo";

/** Evento inmutable de la bitácora del flujo. Nombre y rol se guardan como estaban al momento de la acción. */
export interface EventoFlujoPlan {
  id: number;
  planAccionId: number;
  accion: AccionFlujoPlan;
  estadoAnterior: EstadoPlanAccion;
  estadoNuevo: EstadoPlanAccion;
  actor: { id: number; nombre: string; rol: string };
  motivo: string | null;
  firmaHash: string | null;
  fecha: string;
}

/** Devuelve por qué el usuario no puede revisar el plan, o null si puede. */
export function impedimentoRevision(plan: PlanAccion, usuario: { id: number; rol: string }): string | null {
  if (!ROLES_REVISION.includes(usuario.rol)) {
    return "Solo el Jefe de Auditoría o el Administrador pueden revisar planes de acción.";
  }
  if (plan.responsable.id === usuario.id) {
    return "No puedes revisar este plan porque eres su responsable.";
  }
  if (plan.pasos.some((paso) => paso.usuarioAsignado?.id === usuario.id)) {
    return "No puedes revisar este plan porque tienes pasos asignados.";
  }
  return null;
}

/** Devuelve el error del motivo de rechazo, o null si es válido. */
export function validarMotivoRechazo(motivo: unknown): string | null {
  const texto = typeof motivo === "string" ? motivo.trim() : "";
  if (!texto) return "El motivo de rechazo es obligatorio.";
  if (texto.length > LONGITUD_MAXIMA_MOTIVO) return `El motivo de rechazo admite hasta ${LONGITUD_MAXIMA_MOTIVO} caracteres.`;
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

/** Equipo del plan al que se avisa de un cambio de estatus: responsable, asignados y quien lo creó, sin quien actuó. */
export function destinatariosCambio(plan: PlanAccion, actorId: number): number[] {
  const usuarios = new Set<number>([plan.responsable.id, plan.creadoPorId]);
  for (const paso of plan.pasos) {
    if (paso.usuarioAsignado) usuarios.add(paso.usuarioAsignado.id);
  }
  usuarios.delete(actorId);
  return [...usuarios];
}
