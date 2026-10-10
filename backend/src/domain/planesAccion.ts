// Planes de acción correctivos de un hallazgo (SF-10, SF-11): tipos y validación.

export const ESTADOS_PLAN_ACCION = ["Asignado", "En Progreso", "Completado"] as const;
export type EstadoPlanAccion = (typeof ESTADOS_PLAN_ACCION)[number];

/** Datos del hallazgo que el plan necesita mostrar y validar. */
export interface HallazgoResumen {
  id: string;
  folio: string | null;
  titulo: string;
  severidad: string | null;
  auditoriaId: string | null;
  controlId: string | null;
  /** Fecha de cierre de la auditoría (AAAA-MM-DD) o null si la auditoría no está registrada. */
  fechaCierreAuditoria: string | null;
}

export interface PlanAccion {
  id: number;
  hallazgo: HallazgoResumen;
  descripcion: string;
  responsable: { id: number; nombre: string };
  /** Fecha de compromiso en formato AAAA-MM-DD. */
  fechaCompromiso: string;
  estado: EstadoPlanAccion;
  creadoEn: string;
}

/** Campos que se capturan al crear un plan de acción. */
export interface DatosPlanAccion {
  hallazgoId: string;
  descripcion: string;
  responsableId: number;
  fechaCompromiso: string;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function fechaValida(valor: unknown): valor is string {
  return typeof valor === "string" && FECHA.test(valor) && !Number.isNaN(Date.parse(valor));
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

export const MENSAJE_FECHA_ANTERIOR_AL_CIERRE =
  "La fecha de compromiso debe ser igual o posterior a la fecha de cierre de la auditoría.";

/** Devuelve el mensaje del primer error encontrado, o null si los datos son válidos. */
export function validarPlanAccion(d: Record<string, unknown>): string | null {
  if (!texto(d.hallazgoId) || texto(d.hallazgoId).length > 100) return "El hallazgo es obligatorio.";
  if (!texto(d.descripcion) || texto(d.descripcion).length > 2000) {
    return "La descripción de la acción correctiva es obligatoria y admite hasta 2000 caracteres.";
  }
  if (!Number.isInteger(d.responsableId) || (d.responsableId as number) <= 0) return "El responsable auditado es obligatorio.";
  if (!fechaValida(d.fechaCompromiso)) return "La fecha de compromiso no es válida (AAAA-MM-DD).";
  return null;
}

/**
 * Regla de negocio del criterio de aceptación: la fecha de compromiso no puede ser
 * anterior al cierre de la auditoría. Si la auditoría no tiene fecha registrada no se valida.
 */
export function validarFechaCompromiso(fechaCompromiso: string, fechaCierreAuditoria: string | null): string | null {
  if (fechaCierreAuditoria && fechaCompromiso < fechaCierreAuditoria) return MENSAJE_FECHA_ANTERIOR_AL_CIERRE;
  return null;
}

/** Campos que el equipo de auditoría puede modificar de un plan existente. El auditado no edita nada. */
export const CAMPOS_EDITABLES_PLAN_ACCION = ["descripcion", "responsableId", "fechaCompromiso", "estado"] as const;
export type CampoEditablePlanAccion = (typeof CAMPOS_EDITABLES_PLAN_ACCION)[number];

export interface DatosEdicionPlanAccion {
  descripcion: string;
  responsableId: number;
  fechaCompromiso: string;
  estado: EstadoPlanAccion;
}

/** Valida el plan completo ya combinado con los cambios. Devuelve el primer error o null. */
export function validarEdicionPlanAccion(d: Record<string, unknown>): string | null {
  const error = validarPlanAccion(d);
  if (error) return error;
  if (!ESTADOS_PLAN_ACCION.includes(d.estado as EstadoPlanAccion)) {
    return `El estado no es válido. Valores permitidos: ${ESTADOS_PLAN_ACCION.join(", ")}.`;
  }
  return null;
}

export function normalizarEdicionPlanAccion(d: Record<string, unknown>): DatosEdicionPlanAccion {
  const { descripcion, responsableId, fechaCompromiso } = normalizarPlanAccion(d);
  return { descripcion, responsableId, fechaCompromiso, estado: d.estado as EstadoPlanAccion };
}

/** Limpia los datos ya validados. */
export function normalizarPlanAccion(d: Record<string, unknown>): DatosPlanAccion {
  return {
    hallazgoId: texto(d.hallazgoId),
    descripcion: texto(d.descripcion),
    responsableId: d.responsableId as number,
    fechaCompromiso: d.fechaCompromiso as string,
  };
}
