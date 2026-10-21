// Tipos y validaciones de la estructura organizacional (SF-03).
// Jerarquía: unidad de negocio → división → subdivisión → área.
// El `nombre` es el código del Consolidado (UDN-0003, DIVISION-0002…) y es el que se
// valida y busca; `nombreReal` (KOF, Brasil…) es opcional y solo se muestra. No existe
// en el área: su nombre ya es el real.
// Solo el nombre de la
// unidad es único; los demás niveles repiten nombres legítimamente (el id los distingue).

// ── Tipos ────────────────────────────────────────────────────────────────────

export type NivelNodo = "division" | "subdivision" | "area";
export type NivelEstructura = "unidad" | NivelNodo;

/** El nivel padre de cada nodo. */
export const NIVEL_PADRE: Record<NivelNodo, NivelEstructura> = {
  division: "unidad",
  subdivision: "division",
  area: "subdivision",
};

/** Estados de `audit_plans.status` que cuentan como auditoría activa (bloquean el borrado). */
export const ESTADOS_PLAN_ACTIVOS = ["Aprobado", "En Ejecución"] as const;

/** Escala del nivel de riesgo (`risk_library.level`), de mayor a menor. Pendiente de confirmar con FEMSA. */
export const NIVELES_RIESGO = ["Crítico", "Alto", "Medio", "Bajo"] as const;
export type NivelRiesgo = (typeof NIVELES_RIESGO)[number];

/** Riesgo registrado en una subdivisión (`risk_register`). Solo lectura en esta vista. */
export interface Riesgo {
  id: number;
  nombre: string;
  nivel: NivelRiesgo | null;
  procedimientoControl: string | null;
}

export interface PeriodoFiscal {
  id: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  activo: boolean;
}

export interface DepartamentoAuditoria {
  id: number;
  nombre: string;
}

export interface Area {
  id: number;
  nombre: string;
  subdivisionId: number;
}

export interface Subdivision {
  id: number;
  nombre: string;
  nombreReal: string | null;
  pais: string | null;
  divisionId: number;
  areas: Area[];
  riesgos: Riesgo[];
}

export interface Division {
  id: number;
  nombre: string;
  nombreReal: string | null;
  unidadNegocioId: number;
  subdivisiones: Subdivision[];
}

export interface UnidadNegocio {
  id: number;
  nombre: string;
  nombreReal: string | null;
  responsableId: number;
  responsableNombre: string;
  periodoFiscalId: number;
  periodoFiscalNombre: string;
  departamentoAuditoriaId: number | null;
  departamentoAuditoriaNombre: string | null;
  creadoPor: number;
  creadoEn: string;
  divisiones: Division[];
}

/** Datos mínimos de un nodo para ubicarlo en su rama. */
export interface NodoPlano {
  id: number;
  nombre: string;
  /** Siempre null en el área. */
  nombreReal: string | null;
  padreId: number;
}

// ── Entrada ──────────────────────────────────────────────────────────────────

export interface AltaUnidadInput {
  nombre: string;
  nombreReal: string | null;
  responsableId: number;
  departamentoAuditoriaId: number | null;
}

export interface EdicionUnidadInput {
  nombre?: string;
  nombreReal?: string | null;
  responsableId?: number;
  departamentoAuditoriaId?: number | null;
}

export interface AltaNodoInput {
  nombre: string;
  /** Solo para división y subdivisión. */
  nombreReal: string | null;
  padreId: number;
  /** Solo para subdivisión. */
  pais: string | null;
}

export interface EdicionNodoInput {
  nombre?: string;
  nombreReal?: string | null;
  pais?: string | null;
}

export interface AltaPeriodoInput {
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  activo: boolean;
}

export type EdicionPeriodoInput = Partial<AltaPeriodoInput>;

// ── Validaciones ─────────────────────────────────────────────────────────────

const MAX_NOMBRE = 150;
const MAX_PAIS = 100;
const MAX_NOMBRE_PERIODO = 50;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

const ETIQUETA: Record<NivelEstructura, string> = {
  unidad: "la unidad de negocio",
  division: "la división",
  subdivision: "la subdivisión",
  area: "el área",
};

function textoValido(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim().length > 0;
}

function idValido(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isInteger(valor) && valor > 0;
}

function fechaValida(valor: unknown): valor is string {
  return typeof valor === "string" && FECHA.test(valor) && !Number.isNaN(Date.parse(valor));
}

function validarNombre(valor: unknown, nivel: NivelEstructura): string | null {
  if (!textoValido(valor)) return `El nombre de ${ETIQUETA[nivel]} es obligatorio.`;
  if (valor.trim().length > MAX_NOMBRE) return `El nombre no puede superar los ${MAX_NOMBRE} caracteres.`;
  return null;
}

/** El nombre real es opcional: vacío o null lo quita. */
function validarNombreReal(valor: unknown): string | null {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== "string") return "El nombre real no es válido.";
  if (valor.trim().length > MAX_NOMBRE) return `El nombre real no puede superar los ${MAX_NOMBRE} caracteres.`;
  return null;
}

function textoOpcional(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim().length > 0 ? valor.trim() : null;
}

function validarDepartamento(valor: unknown): string | null {
  if (valor !== undefined && valor !== null && !idValido(valor)) return "El departamento de auditoría no es válido.";
  return null;
}

function validarPais(valor: unknown): string | null {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== "string") return "El país no es válido.";
  if (valor.trim().length > MAX_PAIS) return `El país no puede superar los ${MAX_PAIS} caracteres.`;
  return null;
}

function paisNormalizado(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim().length > 0 ? valor.trim() : null;
}

/** Valida los campos de alta de unidad de negocio. Devuelve mensaje de error o null si todo bien. */
export function validarAltaUnidad(datos: Record<string, unknown>): string | null {
  return (
    validarNombre(datos.nombre, "unidad") ??
    validarNombreReal(datos.nombreReal) ??
    (idValido(datos.responsableId) ? null : "El gerente responsable es obligatorio.") ??
    validarDepartamento(datos.departamentoAuditoriaId)
  );
}

/** Valida los campos de edición de unidad de negocio. */
export function validarEdicionUnidad(datos: Record<string, unknown>): string | null {
  const llaves = ["nombre", "nombreReal", "responsableId", "departamentoAuditoriaId"];
  if (!llaves.some((llave) => datos[llave] !== undefined)) return "Debes enviar al menos un campo a editar.";
  if (datos.nombre !== undefined) {
    const error = validarNombre(datos.nombre, "unidad");
    if (error) return error;
  }
  const errorNombreReal = validarNombreReal(datos.nombreReal);
  if (errorNombreReal) return errorNombreReal;
  if (datos.responsableId !== undefined && !idValido(datos.responsableId)) {
    return "El gerente responsable no es válido.";
  }
  return validarDepartamento(datos.departamentoAuditoriaId);
}

/** Valida el alta de división, subdivisión o área. */
export function validarAltaNodo(nivel: NivelNodo, datos: Record<string, unknown>): string | null {
  return (
    validarNombre(datos.nombre, nivel) ??
    (nivel !== "area" ? validarNombreReal(datos.nombreReal) : null) ??
    (idValido(datos.padreId) ? null : `Debes indicar ${ETIQUETA[NIVEL_PADRE[nivel]]} a la que pertenece.`) ??
    (nivel === "subdivision" ? validarPais(datos.pais) : null)
  );
}

/** Valida la edición de división, subdivisión o área. */
export function validarEdicionNodo(nivel: NivelNodo, datos: Record<string, unknown>): string | null {
  const editaPais = nivel === "subdivision" && datos.pais !== undefined;
  const editaNombreReal = nivel !== "area" && datos.nombreReal !== undefined;
  if (datos.nombre === undefined && !editaPais && !editaNombreReal) return "Debes enviar al menos un campo a editar.";
  if (datos.nombre !== undefined) {
    const error = validarNombre(datos.nombre, nivel);
    if (error) return error;
  }
  if (editaNombreReal) {
    const error = validarNombreReal(datos.nombreReal);
    if (error) return error;
  }
  return editaPais ? validarPais(datos.pais) : null;
}

/** Valida el alta de un periodo de auditoría. */
export function validarAltaPeriodo(datos: Record<string, unknown>): string | null {
  if (!textoValido(datos.nombre)) return "El nombre del periodo es obligatorio.";
  if (datos.nombre.trim().length > MAX_NOMBRE_PERIODO) {
    return `El nombre del periodo no puede superar los ${MAX_NOMBRE_PERIODO} caracteres.`;
  }
  if (!fechaValida(datos.fechaInicio) || !fechaValida(datos.fechaFin)) {
    return "Las fechas de inicio y fin son obligatorias (AAAA-MM-DD).";
  }
  if (datos.fechaFin <= datos.fechaInicio) return "La fecha de fin debe ser posterior a la de inicio.";
  if (datos.activo !== undefined && typeof datos.activo !== "boolean") return "El campo activo no es válido.";
  return null;
}

/** Valida la edición de un periodo; las fechas se comparan contra las actuales si solo llega una. */
export function validarEdicionPeriodo(datos: Record<string, unknown>, actual: PeriodoFiscal): string | null {
  const llaves = ["nombre", "fechaInicio", "fechaFin", "activo"];
  if (!llaves.some((llave) => datos[llave] !== undefined)) return "Debes enviar al menos un campo a editar.";
  return validarAltaPeriodo({
    nombre: datos.nombre ?? actual.nombre,
    fechaInicio: datos.fechaInicio ?? actual.fechaInicio,
    fechaFin: datos.fechaFin ?? actual.fechaFin,
    activo: datos.activo,
  });
}

export function normalizarAltaUnidad(datos: Record<string, unknown>): AltaUnidadInput {
  return {
    nombre: (datos.nombre as string).trim(),
    nombreReal: textoOpcional(datos.nombreReal),
    responsableId: datos.responsableId as number,
    departamentoAuditoriaId: (datos.departamentoAuditoriaId as number | null | undefined) ?? null,
  };
}

export function normalizarEdicionUnidad(datos: Record<string, unknown>): EdicionUnidadInput {
  const edicion: EdicionUnidadInput = {};
  if (datos.nombre !== undefined) edicion.nombre = (datos.nombre as string).trim();
  if (datos.nombreReal !== undefined) edicion.nombreReal = textoOpcional(datos.nombreReal);
  if (datos.responsableId !== undefined) edicion.responsableId = datos.responsableId as number;
  if (datos.departamentoAuditoriaId !== undefined) {
    edicion.departamentoAuditoriaId = datos.departamentoAuditoriaId as number | null;
  }
  return edicion;
}

export function normalizarAltaNodo(nivel: NivelNodo, datos: Record<string, unknown>): AltaNodoInput {
  return {
    nombre: (datos.nombre as string).trim(),
    nombreReal: nivel !== "area" ? textoOpcional(datos.nombreReal) : null,
    padreId: datos.padreId as number,
    pais: nivel === "subdivision" ? paisNormalizado(datos.pais) : null,
  };
}

export function normalizarEdicionNodo(nivel: NivelNodo, datos: Record<string, unknown>): EdicionNodoInput {
  const edicion: EdicionNodoInput = {};
  if (datos.nombre !== undefined) edicion.nombre = (datos.nombre as string).trim();
  if (nivel !== "area" && datos.nombreReal !== undefined) edicion.nombreReal = textoOpcional(datos.nombreReal);
  if (nivel === "subdivision" && datos.pais !== undefined) edicion.pais = paisNormalizado(datos.pais);
  return edicion;
}

export function normalizarPeriodo(datos: Record<string, unknown>): EdicionPeriodoInput {
  const periodo: EdicionPeriodoInput = {};
  if (datos.nombre !== undefined) periodo.nombre = (datos.nombre as string).trim();
  if (datos.fechaInicio !== undefined) periodo.fechaInicio = datos.fechaInicio as string;
  if (datos.fechaFin !== undefined) periodo.fechaFin = datos.fechaFin as string;
  if (datos.activo !== undefined) periodo.activo = datos.activo as boolean;
  return periodo;
}

/**
 * Compara nombres como la intercalación `sin_mayusculas` (ICU nivel 2): sin distinguir
 * mayúsculas, pero sí acentos ("Salud" y "Sálud" son distintos).
 */
export function claveNombre(nombre: string): string {
  return nombre.normalize("NFC").toLocaleLowerCase("es");
}
