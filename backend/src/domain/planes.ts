// Planes de auditoría (SF-01, SF-02): tipos y validación.

export const ESTADOS_PLAN = ["Borrador", "Aprobado", "En Ejecución", "Cerrado"] as const;
export type EstadoPlan = (typeof ESTADOS_PLAN)[number];

export const TIPOS_PLAN = ["Anual", "Trimestral"] as const;
export type TipoPlan = (typeof TIPOS_PLAN)[number];

export interface PlanAuditoria {
  id: number;
  codigo: string;
  nombre: string;
  tipo: TipoPlan;
  periodo: string | null;
  /** Fecha en formato AAAA-MM-DD. */
  fechaInicio: string;
  fechaFin: string;
  estado: EstadoPlan;
  horasEstimadas: number;
  responsable: { id: number; nombre: string };
  alcance: string | null;
}

/** Campos que se capturan al crear o editar un plan. */
export interface DatosPlan {
  codigo: string;
  nombre: string;
  tipo: TipoPlan;
  periodo: string | null;
  fechaInicio: string;
  fechaFin: string;
  estado: EstadoPlan;
  horasEstimadas: number;
  responsableId: number;
  alcance: string | null;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function fechaValida(valor: unknown): valor is string {
  return typeof valor === "string" && FECHA.test(valor) && !Number.isNaN(Date.parse(valor));
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

/** Devuelve el mensaje del primer error encontrado, o null si los datos son válidos. */
export function validarPlan(d: Record<string, unknown>): string | null {
  if (!texto(d.codigo) || texto(d.codigo).length > 30) return "El código es obligatorio y admite hasta 30 caracteres.";
  if (!texto(d.nombre) || texto(d.nombre).length > 200) return "El nombre es obligatorio y admite hasta 200 caracteres.";
  if (!TIPOS_PLAN.includes(d.tipo as TipoPlan)) return "El tipo de plan debe ser Anual o Trimestral.";
  if (!fechaValida(d.fechaInicio)) return "La fecha de inicio no es válida (AAAA-MM-DD).";
  if (!fechaValida(d.fechaFin)) return "La fecha de fin no es válida (AAAA-MM-DD).";
  if (d.fechaFin <= d.fechaInicio) return "La fecha de fin debe ser posterior a la fecha de inicio.";
  if (!ESTADOS_PLAN.includes(d.estado as EstadoPlan)) return "El estado indicado no existe.";
  if (!Number.isInteger(d.horasEstimadas) || (d.horasEstimadas as number) <= 0) {
    return "Las horas estimadas deben ser un número entero mayor a 0.";
  }
  if (!Number.isInteger(d.responsableId) || (d.responsableId as number) <= 0) return "El responsable es obligatorio.";
  return null;
}

/** Limpia los datos ya validados. */
export function normalizarPlan(d: Record<string, unknown>): DatosPlan {
  return {
    codigo: texto(d.codigo).toUpperCase(),
    nombre: texto(d.nombre),
    tipo: d.tipo as TipoPlan,
    periodo: texto(d.periodo) || null,
    fechaInicio: d.fechaInicio as string,
    fechaFin: d.fechaFin as string,
    estado: d.estado as EstadoPlan,
    horasEstimadas: d.horasEstimadas as number,
    responsableId: d.responsableId as number,
    alcance: texto(d.alcance) || null,
  };
}
