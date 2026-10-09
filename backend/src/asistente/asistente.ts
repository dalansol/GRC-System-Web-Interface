import {
  type ConsultaVista,
  type DocumentoParaIA,
  MENSAJE_FUERA_DE_TEMA,
  MENSAJE_FUERA_DE_TEMA_VISTA,
  MENSAJE_SIN_INFORMACION,
  MENSAJE_SIN_INFORMACION_VISTA,
  mensajesConsultaVista,
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

interface MensajesFijos {
  fueraDeTema: string;
  sinInformacion: string;
}

const MENSAJES_DOCUMENTO: MensajesFijos = { fueraDeTema: MENSAJE_FUERA_DE_TEMA, sinInformacion: MENSAJE_SIN_INFORMACION };
const MENSAJES_VISTA: MensajesFijos = { fueraDeTema: MENSAJE_FUERA_DE_TEMA_VISTA, sinInformacion: MENSAJE_SIN_INFORMACION_VISTA };

// Solo se muestra el texto del modelo si dice "respondida"; en los demás casos se usa un mensaje fijo.
export function interpretarRespuesta(crudo: string, mensajes: MensajesFijos = MENSAJES_DOCUMENTO): ResultadoAsistente {
  let datos: { estado?: unknown; respuesta?: unknown };
  try {
    datos = JSON.parse(crudo.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new ErrorIA("IA_NO_DISPONIBLE", "La IA no respondió con el formato JSON acordado.");
  }
  const estado = datos?.estado as EstadoRespuesta;
  if (!ESTADOS.includes(estado)) throw new ErrorIA("IA_NO_DISPONIBLE", `Estado desconocido en la respuesta de la IA: ${String(datos?.estado)}`);
  if (estado === "fuera_de_tema") return { estado, texto: mensajes.fueraDeTema };
  if (estado === "sin_informacion") return { estado, texto: mensajes.sinInformacion };

  const texto = typeof datos.respuesta === "string" ? datos.respuesta.trim() : "";
  if (!texto) throw new ErrorIA("IA_NO_DISPONIBLE", "La IA devolvió una respuesta vacía.");
  return { estado, texto: texto.slice(0, LIMITE_RESPUESTA) };
}

export function crearAsistente(proveedor: ProveedorIA) {
  const consultar = async (mensajes: MensajeIA[], fijos?: MensajesFijos) =>
    interpretarRespuesta(await proveedor.completar(mensajes, OPCIONES), fijos);
  return {
    resumir: (documento: DocumentoParaIA) => consultar(mensajesResumen(documento)),
    preguntar: (documento: DocumentoParaIA, pregunta: string) => consultar(mensajesPregunta(documento, pregunta)),
    consultarVista: (consulta: ConsultaVista) => consultar(mensajesConsultaVista(consulta), MENSAJES_VISTA),
  };
}
