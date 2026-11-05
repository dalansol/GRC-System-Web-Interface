import type { AccionFlujoPlan, EventoFlujoPlan } from "../domain/flujoPlanAccion.js";
import type {
  DatosEdicionPlanAccion,
  DatosPlanAccion,
  EstadoPlanAccion,
  HallazgoResumen,
  PasoPlanAccion,
  PlanAccion,
} from "../domain/planesAccion.js";
import type { RepositorioNotificaciones } from "./notificaciones.js";

/** Compatibilidad con consumidores antiguos; la creación ya no lanza este error. */
export class ErrorPlanDuplicado extends Error {
  constructor(hallazgoId: string) {
    super(`El hallazgo ${hallazgoId} ya tiene un plan de acción`);
    this.name = "ErrorPlanDuplicado";
  }
}

/** Cambio de estado del flujo con lo que debe quedar registrado junto con él. */
export interface TransicionPlan {
  desde: readonly EstadoPlanAccion[];
  hacia: EstadoPlanAccion;
  accion: AccionFlujoPlan;
  actor: { id: number; nombre: string; rol: string };
  motivo?: string;
  firmaHash?: string;
  notificar?: { usuarioIds: number[]; mensaje: string };
}

export interface RepositorioPlanesAccion extends RepositorioNotificaciones {
  /** Datos del hallazgo con la fecha de cierre de su auditoría. Null si el hallazgo no existe. */
  buscarHallazgo(hallazgoId: string): Promise<HallazgoResumen | null>;
  listar(): Promise<PlanAccion[]>;
  listarPorResponsable(usuarioId: number): Promise<PlanAccion[]>;
  buscarPorHallazgo(hallazgoId: string): Promise<PlanAccion | null>;
  /** Crea un plan en estado "Asignado" y deja al hallazgo en ese mismo estado. */
  crear(datos: DatosPlanAccion, creadoPorId: number): Promise<PlanAccion>;
  buscarPorId(id: number): Promise<PlanAccion | null>;
  /** Reemplaza los campos editables del plan. Null si el plan no existe o está bloqueado por el flujo. */
  actualizar(id: number, datos: DatosEdicionPlanAccion): Promise<PlanAccion | null>;
  /**
   * Cambia el estado y escribe el evento y las notificaciones en una sola transacción.
   * Null si el plan no existe o su estado no está en `desde` (por ejemplo, otro revisor ya actuó).
   */
  transicionar(id: number, transicion: TransicionPlan): Promise<PlanAccion | null>;
  /** Planes en los estados de la bandeja de revisión. */
  listarRevision(): Promise<PlanAccion[]>;
  /** Eventos del flujo, del más antiguo al más reciente. */
  listarFlujo(id: number): Promise<EventoFlujoPlan[]>;
  /** Hashes de la evidencia del plan por id de paso. */
  hashesEvidenciaPlan(id: number): Promise<Record<number, string[]>>;
  /** Null si el paso no existe o el plan está bloqueado por el flujo. */
  actualizarPaso(planId: number, pasoId: number, completado: boolean): Promise<PasoPlanAccion | null>;
}
