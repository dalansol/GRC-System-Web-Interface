import type { DatosPlan, PlanAuditoria } from "../domain/planes.js";

export class ErrorCodigoDuplicado extends Error {
  constructor(codigo: string) {
    super(`El código ${codigo} ya está registrado`);
    this.name = "ErrorCodigoDuplicado";
  }
}

export interface RepositorioPlanes {
  listar(responsableId?: number): Promise<PlanAuditoria[]>;
  buscarPorId(id: number): Promise<PlanAuditoria | null>;
  /** Calcula el siguiente código para el año o período del plan. */
  siguienteCodigo(datos: DatosPlan): Promise<string>;
  /** Lanza ErrorCodigoDuplicado si el código ya existe. */
  crear(datos: DatosPlan, creadoPorId: number): Promise<PlanAuditoria>;
  /** Lanza ErrorCodigoDuplicado si el código ya existe. Devuelve null si el plan no existe. */
  actualizar(id: number, datos: DatosPlan): Promise<PlanAuditoria | null>;
}
