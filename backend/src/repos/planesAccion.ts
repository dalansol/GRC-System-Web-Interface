import type {
  DatosEdicionPlanAccion,
  DatosPlanAccion,
  HallazgoResumen,
  PasoPlanAccion,
  PlanAccion,
} from "../domain/planesAccion.js";

/** Compatibilidad con consumidores antiguos; la creación ya no lanza este error. */
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
  /** Crea un plan en estado "Asignado" y deja al hallazgo en ese mismo estado. */
  crear(datos: DatosPlanAccion, creadoPorId: number): Promise<PlanAccion>;
  buscarPorId(id: number): Promise<PlanAccion | null>;
  /** Reemplaza los campos editables del plan. Null si el plan no existe. */
  actualizar(id: number, datos: DatosEdicionPlanAccion): Promise<PlanAccion | null>;
  actualizarPaso(planId: number, pasoId: number, completado: boolean): Promise<PasoPlanAccion | null>;
}
