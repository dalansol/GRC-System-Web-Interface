// Declaración de conflictos de interés de un auditor en un plan de auditoría (historia #96, SF-04).
// Módulo de Ejecución: antes de evaluar los controles que tiene asignados en un plan (registrar horas
// o enviarlos a revisión), el auditor declara si tiene un conflicto de interés; si lo tiene, la
// justificación es obligatoria y la jefatura debe enterarse.

export interface PlanResumen {
  id: number;
  codigo: string;
  nombre: string;
}

export interface DeclaracionConflicto {
  id: number;
  plan: PlanResumen;
  auditor: { id: number; nombre: string };
  tieneConflicto: boolean;
  /** Obligatoria cuando hay conflicto; null si no se capturó. */
  justificacion: string | null;
  declaradoEn: string;
}

/** Campos que captura el auditor al declarar. */
export interface DatosDeclaracion {
  tieneConflicto: boolean;
  justificacion: string | null;
}

export const LIMITE_JUSTIFICACION = 2000;

export const MENSAJE_JUSTIFICACION_OBLIGATORIA =
  "La justificación es obligatoria cuando declaras un conflicto de interés.";

export const MENSAJE_DECLARACION_PENDIENTE =
  "Debes declarar tus conflictos de interés en este plan de auditoría antes de evaluar sus controles.";

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/** Devuelve el mensaje del primer error encontrado, o null si los datos son válidos. */
export function validarDeclaracion(d: Record<string, unknown>): string | null {
  if (typeof d.tieneConflicto !== "boolean") return "Indica si tienes o no un conflicto de interés.";
  if (d.justificacion !== undefined && d.justificacion !== null && typeof d.justificacion !== "string") {
    return "La justificación debe ser texto.";
  }
  const justificacion = texto(d.justificacion);
  if (d.tieneConflicto && !justificacion) return MENSAJE_JUSTIFICACION_OBLIGATORIA;
  if (justificacion.length > LIMITE_JUSTIFICACION) {
    return `La justificación admite hasta ${LIMITE_JUSTIFICACION} caracteres.`;
  }
  return null;
}

/** Limpia los datos ya validados. Una justificación vacía se guarda como null. */
export function normalizarDeclaracion(d: Record<string, unknown>): DatosDeclaracion {
  const justificacion = texto(d.justificacion);
  return { tieneConflicto: d.tieneConflicto as boolean, justificacion: justificacion || null };
}

/**
 * Regla del criterio de aceptación: un auditor asignado no evalúa los controles de un plan
 * mientras no haya presentado su declaración (con o sin conflicto). Quien no está asignado
 * al plan no tiene nada que declarar, así que no se le bloquea.
 */
export function evaluacionBloqueada(asignado: boolean, declaracion: DeclaracionConflicto | null): boolean {
  return asignado && declaracion === null;
}
