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
// Los modelos con razonamiento "piensan" antes de responder: eso consume el tiempo de espera y
// los tokens de salida (con expedientes largos devolvían vacío o se agotaban). El asistente solo
// lee documentos y responde en JSON, así que se pide el mínimo que cada familia permite. Mandar
// un ajuste que el modelo no admite (presupuesto 0 en Gemini 3 o en 2.5 Pro, thinkingConfig en
// 2.0 o anteriores) provoca un 400 "invalid argument".
export function configuracionRazonamiento(modelo: string): Record<string, unknown> | undefined {
  const nombre = modelo.toLowerCase();
  if (/^gemini-2\.5-flash/.test(nombre)) return { thinkingBudget: 0 };
  if (/^gemini-(3|[4-9])/.test(nombre)) return { thinkingLevel: "low" };
  return undefined;
}

export function crearProveedorGemini({ apiKey, modelo, tiempoEsperaMs, fetch }: OpcionesGemini): ProveedorIA {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`;
  const razonamiento = configuracionRazonamiento(modelo);

  return {
    nombre: "gemini",
    async completar(mensajes, { temperatura, maxTokens, json } = {}) {
      const instrucciones = mensajes.filter((m) => m.rol === "sistema").map((m) => ({ text: m.contenido }));
      const generationConfig = {
        ...(temperatura !== undefined ? { temperature: temperatura } : {}),
        ...(maxTokens !== undefined ? { maxOutputTokens: maxTokens } : {}),
        ...(json ? { responseMimeType: "application/json" } : {}),
        ...(razonamiento ? { thinkingConfig: razonamiento } : {}),
      };
      const cuerpo = {
        ...(instrucciones.length > 0 ? { systemInstruction: { parts: instrucciones } } : {}),
        contents: mensajes
          .filter((m) => m.rol !== "sistema")
          .map((m) => ({ role: m.rol === "asistente" ? "model" : "user", parts: [{ text: m.contenido }] })),
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
