import { pedir } from "./cliente";

// Cliente de API para parametrización de la estructura organizacional (SF-03).
// Periodos fiscales, unidades de negocio y procesos operativos.

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

export interface AltaUnidadInput {
  nombre: string;
  proceso: string;
  responsableId: number;
}

export interface EdicionUnidadInput {
  nombre?: string;
  responsableId?: number;
}

export interface AltaProcesoInput {
  nombre: string;
  unidadNegocioId: number;
}

export interface EdicionProcesoInput {
  nombre: string;
}

export const ROLES_GESTION_ESTRUCTURA = ["Administrador", "Jefe de Auditoría"] as const;

export const obtenerPeriodoActivo = () => pedir<PeriodoFiscal>("/periodos/activo");

export const listarPeriodos = () => pedir<PeriodoFiscal[]>("/periodos");

export const listarUnidades = () => pedir<UnidadNegocio[]>("/unidades-negocio");

export const listarResponsables = () =>
  pedir<Array<{ id: number; nombre: string; correo: string; rol: string }>>(
    "/unidades-negocio/responsables",
  );

export const obtenerUnidadPorId = (id: number) => pedir<UnidadNegocio>(`/unidades-negocio/${id}`);

export const crearUnidadNegocio = (datos: AltaUnidadInput) =>
  pedir<UnidadNegocio>("/unidades-negocio", { metodo: "POST", cuerpo: datos });

export const editarUnidadNegocio = (id: number, cambios: EdicionUnidadInput) =>
  pedir<UnidadNegocio>(`/unidades-negocio/${id}`, { metodo: "PATCH", cuerpo: cambios });

export const eliminarUnidadNegocio = (id: number) =>
  pedir<void>(`/unidades-negocio/${id}`, { metodo: "DELETE" });

export const crearProceso = (datos: AltaProcesoInput) =>
  pedir<Proceso>("/procesos", { metodo: "POST", cuerpo: datos });

export const editarProceso = (id: number, cambios: EdicionProcesoInput) =>
  pedir<Proceso>(`/procesos/${id}`, { metodo: "PATCH", cuerpo: cambios });

export const eliminarProceso = (id: number) =>
  pedir<void>(`/procesos/${id}`, { metodo: "DELETE" });
