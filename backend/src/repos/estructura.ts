// Interfaz del repositorio de estructura organizacional (SF-03).

import type { PeriodoFiscal, UnidadNegocio, Proceso, AltaUnidadInput, AltaProcesoInput } from "../domain/estructura.js";

export class ErrorNombreDuplicado extends Error {
  constructor(entidad: string, nombre: string) {
    super(`Ya existe ${entidad} con el nombre "${nombre}".`);
    this.name = "ErrorNombreDuplicado";
  }
}

export class ErrorAuditoriasActivas extends Error {
  constructor(entidad: string) {
    super(`No se puede eliminar ${entidad} porque tiene auditorías activas asociadas.`);
    this.name = "ErrorAuditoriasActivas";
  }
}

export interface RepositorioEstructura {
  obtenerPeriodoActivo(): Promise<PeriodoFiscal | null>;
  listarPeriodos(): Promise<PeriodoFiscal[]>;
  listarUnidades(): Promise<UnidadNegocio[]>;
  buscarUnidadPorId(id: number): Promise<UnidadNegocio | null>;

  /** Crea unidad + proceso inicial en una transacción. Lanza ErrorNombreDuplicado. */
  crearUnidadConProceso(datos: AltaUnidadInput, periodoFiscalId: number, creadoPor: number): Promise<UnidadNegocio>;

  /** Edita nombre y/o responsable de una unidad. Lanza ErrorNombreDuplicado si el nuevo nombre ya existe. */
  editarUnidad(id: number, campos: { nombre?: string; responsableId?: number }): Promise<UnidadNegocio | null>;

  /** Retorna true si la unidad (vía sus procesos → controles → audit_controls → audit_plans) tiene auditorías no cerradas. */
  tieneAuditoriasActivas(unidadId: number): Promise<boolean>;

  eliminarUnidad(id: number): Promise<void>;

  /** Crea un proceso en una unidad. Lanza ErrorNombreDuplicado. */
  crearProceso(datos: AltaProcesoInput): Promise<Proceso>;

  /** Edita el nombre de un proceso. Lanza ErrorNombreDuplicado. */
  editarProceso(id: number, nombre: string): Promise<Proceso | null>;

  /** Retorna true si el proceso (vía controles → audit_controls → audit_plans) tiene auditorías no cerradas. */
  tieneAuditoriasActivasProceso(procesoId: number): Promise<boolean>;

  eliminarProceso(id: number): Promise<void>;
}
