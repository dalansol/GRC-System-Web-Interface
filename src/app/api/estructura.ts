import { pedir } from "./cliente";

// Cliente de API para parametrización de la estructura organizacional (SF-03).
// Periodos de auditoría, departamentos y la jerarquía
// unidad de negocio → división → subdivisión → área.

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

/** Escala del nivel de riesgo, de mayor a menor (pendiente de confirmar con FEMSA). */
export const NIVELES_RIESGO = ["Crítico", "Alto", "Medio", "Bajo"] as const;
export type NivelRiesgo = (typeof NIVELES_RIESGO)[number];

/** Riesgo registrado en una subdivisión. Solo lectura en el catálogo. */
export interface Riesgo {
  id: number;
  nombre: string;
  nivel: NivelRiesgo | null;
  procedimientoControl: string | null;
}

export interface Area {
  id: number;
  nombre: string;
  subdivisionId: number;
}

export interface Subdivision {
  id: number;
  nombre: string;
  pais: string | null;
  divisionId: number;
  areas: Area[];
  riesgos: Riesgo[];
}

export interface Division {
  id: number;
  nombre: string;
  unidadNegocioId: number;
  subdivisiones: Subdivision[];
}

export interface UnidadNegocio {
  id: number;
  nombre: string;
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

/** Jefe de Auditoría activo que puede ser gerente responsable de una unidad. */
export interface Responsable {
  id: number;
  nombre: string;
  correo: string;
  rol: string;
}

export type NivelNodo = "division" | "subdivision" | "area";

export interface NodoPlano {
  id: number;
  nombre: string;
  padreId: number;
}

export interface AltaUnidadInput {
  nombre: string;
  responsableId: number;
  departamentoAuditoriaId: number | null;
}

export interface EdicionUnidadInput {
  nombre?: string;
  responsableId?: number;
  departamentoAuditoriaId?: number | null;
}

export interface AltaNodoInput {
  nombre: string;
  padreId: number;
  pais?: string | null;
}

export interface EdicionNodoInput {
  nombre?: string;
  pais?: string | null;
}

export const ROLES_GESTION_ESTRUCTURA = ["Administrador", "Jefe de Auditoría"] as const;

/** Nombre visible de cada nivel. El área es lo más parecido al "proceso" de la historia. */
export const ETIQUETA_NIVEL: Record<NivelNodo | "unidad", string> = {
  unidad: "Unidad de negocio",
  division: "División",
  subdivision: "Subdivisión",
  area: "Área (proceso)",
};

/** Nivel hijo de cada nivel (el área no tiene hijos). */
export const NIVEL_HIJO: Record<NivelNodo | "unidad", NivelNodo | null> = {
  unidad: "division",
  division: "subdivision",
  subdivision: "area",
  area: null,
};

const RUTA_NIVEL: Record<NivelNodo, string> = {
  division: "/divisiones",
  subdivision: "/subdivisiones",
  area: "/areas",
};

export const obtenerPeriodoActivo = () => pedir<PeriodoFiscal>("/periodos/activo");

export const listarPeriodos = () => pedir<PeriodoFiscal[]>("/periodos");

export const listarDepartamentos = () => pedir<DepartamentoAuditoria[]>("/departamentos-auditoria");

export const listarUnidades = () => pedir<UnidadNegocio[]>("/unidades-negocio");

export const listarResponsables = () => pedir<Responsable[]>("/unidades-negocio/responsables");

export const obtenerUnidadPorId = (id: number) => pedir<UnidadNegocio>(`/unidades-negocio/${id}`);

export const crearUnidadNegocio = (datos: AltaUnidadInput) =>
  pedir<UnidadNegocio>("/unidades-negocio", { metodo: "POST", cuerpo: datos });

export const editarUnidadNegocio = (id: number, cambios: EdicionUnidadInput) =>
  pedir<UnidadNegocio>(`/unidades-negocio/${id}`, { metodo: "PATCH", cuerpo: cambios });

export const eliminarUnidadNegocio = (id: number) =>
  pedir<void>(`/unidades-negocio/${id}`, { metodo: "DELETE" });

export const crearNodo = (nivel: NivelNodo, datos: AltaNodoInput) =>
  pedir<NodoPlano>(RUTA_NIVEL[nivel], { metodo: "POST", cuerpo: datos });

export const editarNodo = (nivel: NivelNodo, id: number, cambios: EdicionNodoInput) =>
  pedir<NodoPlano>(`${RUTA_NIVEL[nivel]}/${id}`, { metodo: "PATCH", cuerpo: cambios });

export const eliminarNodo = (nivel: NivelNodo, id: number) =>
  pedir<void>(`${RUTA_NIVEL[nivel]}/${id}`, { metodo: "DELETE" });
