// Tipos y validaciones de la estructura organizacional (SF-03).
// Periodos fiscales, unidades de negocio y procesos.

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface PeriodoFiscal {
  id: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  activo: boolean;
}

export interface Proceso {
  id: number;
  nombre: string;
  unidadNegocioId: number;
  creadoEn: string;
}

export interface UnidadNegocio {
  id: number;
  nombre: string;
  responsableId: number;
  responsableNombre: string;
  periodoFiscalId: number;
  periodoFiscalNombre: string;
  creadoPor: number;
  creadoEn: string;
  procesos: Proceso[];
}

// ── Entrada para alta ────────────────────────────────────────────────────────

export interface AltaUnidadInput {
  nombre: string;
  proceso: string;
  responsableId: number;
}

export interface AltaProcesoInput {
  nombre: string;
  unidadNegocioId: number;
}

export interface EdicionUnidadInput {
  nombre?: string;
  responsableId?: number;
}

export interface EdicionProcesoInput {
  nombre?: string;
}

// ── Validaciones ─────────────────────────────────────────────────────────────

const MAX_NOMBRE = 150;

function textoValido(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim().length > 0;
}

function idValido(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isInteger(valor) && valor > 0;
}

/** Valida los campos de alta de unidad de negocio. Devuelve mensaje de error o null si todo bien. */
export function validarAltaUnidad(datos: Record<string, unknown>): string | null {
  if (!textoValido(datos.nombre)) return "El nombre de la unidad de negocio es obligatorio.";
  if ((datos.nombre as string).trim().length > MAX_NOMBRE) return `El nombre no puede superar los ${MAX_NOMBRE} caracteres.`;
  if (!textoValido(datos.proceso)) return "El nombre del proceso inicial es obligatorio.";
  if ((datos.proceso as string).trim().length > MAX_NOMBRE) return `El nombre del proceso no puede superar los ${MAX_NOMBRE} caracteres.`;
  if (!idValido(datos.responsableId)) return "El gerente responsable es obligatorio.";
  return null;
}

/** Valida los campos de alta de un proceso. */
export function validarAltaProceso(datos: Record<string, unknown>): string | null {
  if (!textoValido(datos.nombre)) return "El nombre del proceso es obligatorio.";
  if ((datos.nombre as string).trim().length > MAX_NOMBRE) return `El nombre no puede superar los ${MAX_NOMBRE} caracteres.`;
  if (!idValido(datos.unidadNegocioId)) return "La unidad de negocio es obligatoria.";
  return null;
}

/** Valida los campos de edición de unidad de negocio. */
export function validarEdicionUnidad(datos: Record<string, unknown>): string | null {
  if (datos.nombre !== undefined) {
    if (!textoValido(datos.nombre)) return "El nombre de la unidad de negocio no puede quedar vacío.";
    if ((datos.nombre as string).trim().length > MAX_NOMBRE) return `El nombre no puede superar los ${MAX_NOMBRE} caracteres.`;
  }
  if (datos.responsableId !== undefined && !idValido(datos.responsableId)) {
    return "El gerente responsable no es válido.";
  }
  if (datos.nombre === undefined && datos.responsableId === undefined) {
    return "Debes enviar al menos un campo a editar (nombre o responsableId).";
  }
  return null;
}

/** Valida los campos de edición de un proceso. */
export function validarEdicionProceso(datos: Record<string, unknown>): string | null {
  if (datos.nombre === undefined) return "Debes enviar el campo nombre.";
  if (!textoValido(datos.nombre)) return "El nombre del proceso no puede quedar vacío.";
  if ((datos.nombre as string).trim().length > MAX_NOMBRE) return `El nombre no puede superar los ${MAX_NOMBRE} caracteres.`;
  return null;
}

/** Normaliza los campos de alta de unidad. */
export function normalizarAltaUnidad(datos: Record<string, unknown>): AltaUnidadInput {
  return {
    nombre: (datos.nombre as string).trim(),
    proceso: (datos.proceso as string).trim(),
    responsableId: datos.responsableId as number,
  };
}

/** Normaliza los campos de alta de proceso. */
export function normalizarAltaProceso(datos: Record<string, unknown>): AltaProcesoInput {
  return {
    nombre: (datos.nombre as string).trim(),
    unidadNegocioId: datos.unidadNegocioId as number,
  };
}
