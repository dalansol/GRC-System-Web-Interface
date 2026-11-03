import { pedir } from "./cliente";

export interface Criterio {
  id: number;
  codigo: string;
  tipo: "diseno" | "efectividad";
  nombre: string;
  obligatorio: boolean;
  orden: number;
}

export interface RespuestaCriterio {
  criterioId: number;
  valor: number;
}

export interface Evaluacion {
  planId: number;
  controlId: string;
  promedioDiseno: number;
  promedioEfectividad: number;
  calificacion: number;
  resultado: "Efectivo" | "Parcialmente efectivo" | "Deficiente";
  deficiencia: boolean;
  respuestas: RespuestaCriterio[];
  evaluadoPor: { id: number; nombre: string };
  evaluadoEn: string;
}

export interface EstadoEvaluacion {
  criterios: Criterio[];
  evaluacion: Evaluacion | null;
  puedeEvaluar: boolean;
  motivoBloqueo: string | null;
}

const ruta = (planId: string, controlId: string) =>
  `/planes/${encodeURIComponent(planId)}/controles/${encodeURIComponent(controlId)}/evaluacion`;

export const consultarEvaluacion = (planId: string, controlId: string) =>
  pedir<EstadoEvaluacion>(ruta(planId, controlId));

export const guardarEvaluacion = (planId: string, controlId: string, respuestas: RespuestaCriterio[]) =>
  pedir<Evaluacion>(ruta(planId, controlId), { metodo: "PUT", cuerpo: { respuestas } });
