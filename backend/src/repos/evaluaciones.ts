import type { Calculo, Criterio, Evaluacion, RespuestaCriterio } from "../domain/evaluaciones.js";

export type StatusAsignacion = "En Progreso" | "En Revision" | "Completado";

/** Una fila de audit_controls: un auditor con un control dentro de un plan. */
export interface AsignacionEvaluable {
  planId: number;
  controlId: string;
  codigo: string;
  auditorId: number;
  asignadoPor: number;
  status: StatusAsignacion;
}

export interface DatosEvaluacion extends Calculo {
  planId: number;
  controlId: string;
  respuestas: RespuestaCriterio[];
  evaluadorId: number;
}

export interface RepositorioEvaluaciones {
  /** Criterios activos, primero los de diseño, en su orden. */
  listarCriterios(): Promise<Criterio[]>;
  /** Asignaciones de un control en un plan; `control` es su id o su código. */
  listarAsignaciones(planId: number, control: string): Promise<AsignacionEvaluable[]>;
  buscar(planId: number, controlId: string): Promise<Evaluacion | null>;
  /** Crea la evaluación del control en el plan o reemplaza la anterior, respuestas incluidas. */
  guardar(datos: DatosEvaluacion): Promise<Evaluacion>;
}
