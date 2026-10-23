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

// ─── Conversación sobre un hallazgo (con memoria) ──────────────────────────────
// El backend arma el expediente desde la base (hallazgo, responsable, plan de acción y
// evidencias en R2) y guarda la conversación, privada de cada usuario.

export interface MensajeConversacion {
  rol: "usuario" | "asistente";
  texto: string;
  estado: EstadoRespuesta | null;
  fecha: string;
}

export interface ConversacionHallazgo {
  hallazgo: { id: string; folio: string | null; titulo: string };
  mensajes: MensajeConversacion[];
}

export interface RespuestaHallazgo {
  hallazgoId: string;
  tipo: "resumen" | "respuesta";
  estado: EstadoRespuesta;
  texto: string;
  /** Evidencias largas de las que solo se analizó la parte inicial. */
  evidenciasRecortadas: string[];
}

const rutaHallazgo = (hallazgoId: string) => `/asistente/hallazgos/${encodeURIComponent(hallazgoId)}`;

export function obtenerConversacionHallazgo(hallazgoId: string): Promise<ConversacionHallazgo> {
  return pedir(`${rutaHallazgo(hallazgoId)}/conversacion`);
}

/** Sin pregunta, resume el hallazgo. */
export function consultarHallazgo(hallazgoId: string, pregunta?: string): Promise<RespuestaHallazgo> {
  return pedir(`${rutaHallazgo(hallazgoId)}/consultas`, {
    metodo: "POST",
    cuerpo: pregunta === undefined ? {} : { pregunta },
  });
}

export function borrarConversacionHallazgo(hallazgoId: string): Promise<void> {
  return pedir(`${rutaHallazgo(hallazgoId)}/conversacion`, { metodo: "DELETE" });
}

// ─── Conversación sobre una evidencia, con el contexto de su control y plan ────

export interface ConversacionEvidencia {
  evidencia: { id: string; nombre: string };
  /** A qué pertenece el archivo; solo las evidencias de control se pueden validar. */
  contexto: { tipo: "control" | "hallazgo"; etiqueta: string };
  mensajes: MensajeConversacion[];
}

export interface RespuestaEvidencia {
  evidenciaId: string;
  tipo: "resumen" | "pregunta" | "validacion";
  estado: EstadoRespuesta;
  texto: string;
  /** true si el documento era largo y solo se analizó su parte inicial. */
  recortado: boolean;
}

const rutaEvidencia = (evidenciaId: string) => `/asistente/evidencias/${encodeURIComponent(evidenciaId)}`;

export function obtenerConversacionEvidencia(evidenciaId: string): Promise<ConversacionEvidencia> {
  return pedir(`${rutaEvidencia(evidenciaId)}/conversacion`);
}

/** Sin pregunta resume el archivo; con `validar`, lo evalúa contra su control. */
export function consultarEvidencia(
  evidenciaId: string,
  consulta: { pregunta: string } | { validar: true } | Record<string, never> = {},
): Promise<RespuestaEvidencia> {
  const cuerpo = "validar" in consulta ? { accion: "validar" } : "pregunta" in consulta ? { pregunta: consulta.pregunta } : {};
  return pedir(`${rutaEvidencia(evidenciaId)}/consultas`, { metodo: "POST", cuerpo });
}

export function borrarConversacionEvidencia(evidenciaId: string): Promise<void> {
  return pedir(`${rutaEvidencia(evidenciaId)}/conversacion`, { metodo: "DELETE" });
}

// ─── Conversación sobre un control dentro de un plan (Planes de Auditoría) ─────

export interface ConversacionControl {
  control: { id: string; codigo: string; nombre: string };
  plan: { id: number; codigo: string; nombre: string };
  mensajes: MensajeConversacion[];
}

export interface RespuestaControl {
  planId: number;
  controlId: string;
  tipo: "resumen" | "respuesta";
  estado: EstadoRespuesta;
  texto: string;
  evidenciasRecortadas: string[];
}

const rutaControl = (planId: string, controlId: string) =>
  `/asistente/planes/${encodeURIComponent(planId)}/controles/${encodeURIComponent(controlId)}`;

export function obtenerConversacionControl(planId: string, controlId: string): Promise<ConversacionControl> {
  return pedir(`${rutaControl(planId, controlId)}/conversacion`);
}

/** Sin pregunta, resume el control con su plan, asignaciones y evidencias. */
export function consultarControl(planId: string, controlId: string, pregunta?: string): Promise<RespuestaControl> {
  return pedir(`${rutaControl(planId, controlId)}/consultas`, {
    metodo: "POST",
    cuerpo: pregunta === undefined ? {} : { pregunta },
  });
}

export function borrarConversacionControl(planId: string, controlId: string): Promise<void> {
  return pedir(`${rutaControl(planId, controlId)}/conversacion`, { metodo: "DELETE" });
}
