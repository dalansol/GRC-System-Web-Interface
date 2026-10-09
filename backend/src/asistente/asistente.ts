import {
  type DocumentoParaIA,
  MENSAJE_FUERA_DE_TEMA,
  MENSAJE_SIN_INFORMACION,
  mensajesPregunta,
  mensajesResumen,
} from "./instrucciones.js";
import { ErrorIA, type MensajeIA, type ProveedorIA } from "./tipos.js";

export type EstadoRespuesta = "respondida" | "fuera_de_tema" | "sin_informacion";

export interface ResultadoAsistente {
  estado: EstadoRespuesta;
  texto: string;
}

// Temperatura baja y salida JSON para respuestas predecibles; el tope evita textos interminables.
const OPCIONES = { temperatura: 0.2, maxTokens: 2048, json: true } as const;
const LIMITE_RESPUESTA = 4000;
const ESTADOS: readonly EstadoRespuesta[] = ["respondida", "fuera_de_tema", "sin_informacion"];

// Solo se muestra el texto del modelo si dice "respondida"; en los demás casos se usa un mensaje fijo.
export function interpretarRespuesta(crudo: string): ResultadoAsistente {
  let datos: { estado?: unknown; respuesta?: unknown };
  try {
    datos = JSON.parse(crudo.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new ErrorIA("IA_NO_DISPONIBLE", "La IA no respondió con el formato JSON acordado.");
  }
  const estado = datos?.estado as EstadoRespuesta;
  if (!ESTADOS.includes(estado)) throw new ErrorIA("IA_NO_DISPONIBLE", `Estado desconocido en la respuesta de la IA: ${String(datos?.estado)}`);
  if (estado === "fuera_de_tema") return { estado, texto: MENSAJE_FUERA_DE_TEMA };
  if (estado === "sin_informacion") return { estado, texto: MENSAJE_SIN_INFORMACION };

  const texto = typeof datos.respuesta === "string" ? datos.respuesta.trim() : "";
  if (!texto) throw new ErrorIA("IA_NO_DISPONIBLE", "La IA devolvió una respuesta vacía.");
  return { estado, texto: texto.slice(0, LIMITE_RESPUESTA) };
}

export function crearAsistente(proveedor: ProveedorIA) {
  const consultar = async (mensajes: MensajeIA[]) => interpretarRespuesta(await proveedor.completar(mensajes, OPCIONES));
  return {
    resumir: (documento: DocumentoParaIA) => consultar(mensajesResumen(documento)),
    preguntar: (documento: DocumentoParaIA, pregunta: string) => consultar(mensajesPregunta(documento, pregunta)),
  };
}
