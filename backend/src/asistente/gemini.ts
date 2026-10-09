import { pedirJson } from "./http.js";
import { ErrorIA, type ProveedorIA } from "./tipos.js";

export interface OpcionesGemini {
  apiKey: string;
  modelo: string;
  tiempoEsperaMs: number;
  fetch?: typeof globalThis.fetch;
}

interface RespuestaGemini {
  candidates?: { content?: { parts?: { text?: unknown }[] } }[];
}

// Google Gemini (API de AI Studio). La clave va en un encabezado, nunca en la URL.
export function crearProveedorGemini({ apiKey, modelo, tiempoEsperaMs, fetch }: OpcionesGemini): ProveedorIA {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`;

  return {
    nombre: "gemini",
    async completar(mensajes, { temperatura, maxTokens, json } = {}) {
      const instrucciones = mensajes.filter((m) => m.rol === "sistema").map((m) => ({ text: m.contenido }));
      const generationConfig = {
        ...(temperatura !== undefined ? { temperature: temperatura } : {}),
        ...(maxTokens !== undefined ? { maxOutputTokens: maxTokens } : {}),
        ...(json ? { responseMimeType: "application/json" } : {}),
      };
      const cuerpo = {
        ...(instrucciones.length > 0 ? { systemInstruction: { parts: instrucciones } } : {}),
        contents: mensajes
          .filter((m) => m.rol === "usuario")
          .map((m) => ({ role: "user", parts: [{ text: m.contenido }] })),
        ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
      };

      const datos = (await pedirJson({
        url,
        encabezados: { "x-goog-api-key": apiKey },
        cuerpo,
        tiempoEsperaMs,
        secreto: apiKey,
        fetch,
      })) as RespuestaGemini;

      const texto = (datos.candidates?.[0]?.content?.parts ?? [])
        .map((parte) => (typeof parte.text === "string" ? parte.text : ""))
        .join("");
      if (!texto) throw new ErrorIA("IA_NO_DISPONIBLE", "Gemini no devolvió texto (posible contenido bloqueado).");
      return texto;
    },
  };
}
