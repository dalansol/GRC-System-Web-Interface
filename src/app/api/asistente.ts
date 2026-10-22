import { pedir } from "./cliente";

// Asistente de IA sobre evidencias (SF-19; historia #105). El backend aplica las reglas de contención.

/** Roles que pueden usar el asistente; el backend lo vuelve a validar. */
export const ROLES_ASISTENTE = ["Administrador", "Jefe de Auditoría", "Auditor Senior", "Auditor"];

export const PREGUNTA_MIN = 5;
export const PREGUNTA_MAX = 500;

export type EstadoRespuesta = "respondida" | "fuera_de_tema" | "sin_informacion";

export interface RespuestaAsistente {
  evidenciaId: string;
  tipo: "resumen" | "respuesta";
  estado: EstadoRespuesta;
  texto: string;
  /** true si el documento era largo y solo se analizó su parte inicial. */
  recortado: boolean;
}

export function obtenerEstadoAsistente(): Promise<{ disponible: boolean }> {
  return pedir("/asistente/estado");
}

export function resumirEvidencia(evidenciaId: string): Promise<RespuestaAsistente> {
  return pedir(`/asistente/evidencias/${encodeURIComponent(evidenciaId)}/resumen`, { metodo: "POST" });
}

export function preguntarEvidencia(evidenciaId: string, pregunta: string): Promise<RespuestaAsistente> {
  return pedir(`/asistente/evidencias/${encodeURIComponent(evidenciaId)}/preguntas`, {
    metodo: "POST",
    cuerpo: { pregunta },
  });
}

export interface RespuestaVista {
  vista: string;
  tipo: "resumen" | "respuesta";
  estado: EstadoRespuesta;
  texto: string;
}

/** Asistente Copilot general: resume (sin pregunta) o responde con los datos de la vista actual. */
export function consultarVista(vista: string, contexto: string, pregunta?: string): Promise<RespuestaVista> {
  return pedir("/asistente/consultas", {
    metodo: "POST",
    cuerpo: pregunta === undefined ? { vista, contexto } : { vista, contexto, pregunta },
  });
}
