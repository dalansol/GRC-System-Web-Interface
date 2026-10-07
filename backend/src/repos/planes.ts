import type { DatosPlan, PlanAuditoria } from "../domain/planes.js";

export class ErrorCodigoDuplicado extends Error {
  constructor(codigo: string) {
    super(`El código ${codigo} ya está registrado`);
    this.name = "ErrorCodigoDuplicado";
  }
}

export interface RepositorioPlanes {
  listar(): Promise<PlanAuditoria[]>;
  buscarPorId(id: number): Promise<PlanAuditoria | null>;
  /** Lanza ErrorCodigoDuplicado si el código ya existe. */
  crear(datos: DatosPlan, creadoPorId: number): Promise<PlanAuditoria>;
  /** Lanza ErrorCodigoDuplicado si el código ya existe. Devuelve null si el plan no existe. */
  actualizar(id: number, datos: DatosPlan): Promise<PlanAuditoria | null>;
}
