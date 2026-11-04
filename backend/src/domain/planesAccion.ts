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
  publicId: string;
  hallazgo: HallazgoResumen;
  titulo: string;
  causaRaiz: string | null;
  descripcion: string;
  responsable: { id: number; nombre: string };
  /** Fecha de compromiso en formato AAAA-MM-DD. */
  fechaCompromiso: string;
  status: EstadoPlanAccion;
  /** Alias histórico; el valor fuente es action_plans.status. */
  estado: EstadoPlanAccion;
  creadoEn: string;
  hallazgosRelacionados: HallazgoResumen[];
  pasos: PasoPlanAccion[];
}

export interface PasoPlanAccion {
  id: number;
  action_plan_id: number;
  /** Alias camelCase conservado para consumidores existentes. */
  planAccionId: number;
  usuarioAsignado: { id: number; nombre: string } | null;
  descripcion: string;
  fechaCompromiso: string | null;
  completado: boolean;
  creadoEn: string;
  evidenciasCount: number;
}

/** Campos que se capturan al crear un plan de acción. */
export interface DatosPlanAccion {
  hallazgoId: string;
  hallazgoIds?: string[];
  titulo?: string;
  causaRaiz?: string;
  descripcion: string;
  responsableId: number;
  fechaCompromiso: string;
  pasos?: DatosPasoPlanAccion[];
}

export interface DatosPasoPlanAccion {
  id?: number;
  descripcion: string;
  usuarioAsignadoId: number;
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
  if (texto(d.titulo ?? d.descripcion).length > 255) return "El título del plan admite hasta 255 caracteres.";
  if (!texto(d.descripcion) || texto(d.descripcion).length > 2000) {
    return "La descripción de la acción correctiva es obligatoria y admite hasta 2000 caracteres.";
  }
  if (d.pasos !== undefined && !Array.isArray(d.pasos)) return "Los pasos del plan no son válidos.";
  for (const [indice, paso] of (Array.isArray(d.pasos) ? d.pasos : []).entries()) {
    if (!paso || typeof paso !== "object") return `El paso #${indice + 1} no es válido.`;
    const datos = paso as Record<string, unknown>;
    if (!texto(datos.descripcion) || texto(datos.descripcion).length > 2000) {
      return `El paso #${indice + 1} requiere una descripción.`;
    }
    if (!Number.isInteger(datos.usuarioAsignadoId) || (datos.usuarioAsignadoId as number) <= 0) {
      return `El responsable del paso #${indice + 1} no es válido.`;
    }
    if (!fechaValida(datos.fechaCompromiso)) return `La fecha del paso #${indice + 1} no es válida.`;
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
export const CAMPOS_EDITABLES_PLAN_ACCION = ["titulo", "descripcion", "responsableId", "fechaCompromiso", "estado"] as const;
export type CampoEditablePlanAccion = (typeof CAMPOS_EDITABLES_PLAN_ACCION)[number];

export interface DatosEdicionPlanAccion {
  titulo?: string;
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
  return { titulo: texto(d.titulo ?? d.descripcion), descripcion, responsableId, fechaCompromiso, estado: d.estado as EstadoPlanAccion };
}

/** Limpia los datos ya validados. */
export function normalizarPlanAccion(d: Record<string, unknown>): DatosPlanAccion {
  const hallazgoId = texto(d.hallazgoId);
  const hallazgoIds = Array.isArray(d.hallazgoIds)
    ? d.hallazgoIds.filter((id): id is string => typeof id === "string").map((id) => id.trim()).filter(Boolean)
    : [];
  return {
    hallazgoId,
    hallazgoIds: [...new Set([hallazgoId, ...hallazgoIds])],
    titulo: texto(d.titulo ?? d.descripcion),
    causaRaiz: texto(d.causaRaiz ?? d.descripcion),
    descripcion: texto(d.descripcion),
    responsableId: d.responsableId as number,
    fechaCompromiso: d.fechaCompromiso as string,
    pasos: Array.isArray(d.pasos)
      ? d.pasos.map((paso): DatosPasoPlanAccion => {
          const datos = paso as Record<string, unknown>;
          return {
            id: typeof datos.id === "number" ? datos.id : undefined,
            descripcion: texto(datos.descripcion),
            usuarioAsignadoId: datos.usuarioAsignadoId as number,
            fechaCompromiso: datos.fechaCompromiso as string,
          };
        })
      : [],
  };
}
