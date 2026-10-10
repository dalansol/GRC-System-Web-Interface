import type { DatosEdicionPlanAccion, DatosPlanAccion, HallazgoResumen, PlanAccion } from "../domain/planesAccion.js";

export class ErrorPlanDuplicado extends Error {
  constructor(hallazgoId: string) {
    super(`El hallazgo ${hallazgoId} ya tiene un plan de acción`);
    this.name = "ErrorPlanDuplicado";
  }
}

export interface RepositorioPlanesAccion {
  /** Datos del hallazgo con la fecha de cierre de su auditoría. Null si el hallazgo no existe. */
  buscarHallazgo(hallazgoId: string): Promise<HallazgoResumen | null>;
  listar(): Promise<PlanAccion[]>;
  listarPorResponsable(usuarioId: number): Promise<PlanAccion[]>;
  buscarPorHallazgo(hallazgoId: string): Promise<PlanAccion | null>;
  /** Crea el plan en estado "Asignado" y deja al hallazgo en ese mismo estado. Lanza ErrorPlanDuplicado si ya existe. */
  crear(datos: DatosPlanAccion, creadoPorId: number): Promise<PlanAccion>;
  buscarPorId(id: number): Promise<PlanAccion | null>;
  /** Reemplaza los campos editables del plan. Null si el plan no existe. */
  actualizar(id: number, datos: DatosEdicionPlanAccion): Promise<PlanAccion | null>;
}
