import type { DatosDeclaracion, DeclaracionConflicto, PlanResumen } from "../domain/conflictos.js";

export class ErrorDeclaracionDuplicada extends Error {
  constructor(planId: number, auditorId: number) {
    super(`El auditor ${auditorId} ya declaró sus conflictos en el plan ${planId}`);
    this.name = "ErrorDeclaracionDuplicada";
  }
}

export interface RepositorioConflictos {
  /** Null si el plan no existe. */
  buscarPlan(planId: number): Promise<PlanResumen | null>;
  /** True si el usuario tiene al menos un control asignado en el plan (tabla audit_controls). */
  estaAsignado(planId: number, usuarioId: number): Promise<boolean>;
  buscarDeclaracion(planId: number, auditorId: number): Promise<DeclaracionConflicto | null>;
  listarPorPlan(planId: number): Promise<DeclaracionConflicto[]>;
  /** Declaraciones con conflicto de todos los planes, la más reciente primero (aviso a la jefatura). */
  listarConConflicto(): Promise<DeclaracionConflicto[]>;
  /** Planes donde el usuario tiene controles asignados y aún no declara. */
  listarPendientes(usuarioId: number): Promise<PlanResumen[]>;
  /** Lanza ErrorDeclaracionDuplicada si el auditor ya declaró en ese plan. */
  crear(planId: number, auditorId: number, datos: DatosDeclaracion): Promise<DeclaracionConflicto>;
}
