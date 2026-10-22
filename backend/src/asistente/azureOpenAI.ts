import { pedirJson } from "./http.js";
import { ErrorIA, type ProveedorIA } from "./tipos.js";

export interface OpcionesAzureOpenAI {
  endpoint: string;
  apiKey: string;
  despliegue: string;
  versionApi: string;
  tiempoEsperaMs: number;
  fetch?: typeof globalThis.fetch;
}

interface RespuestaAzure {
  choices?: { message?: { content?: unknown } }[];
}

// Azure OpenAI (Chat Completions sobre un despliegue del recurso).
export function crearProveedorAzureOpenAI({ endpoint, apiKey, despliegue, versionApi, tiempoEsperaMs, fetch }: OpcionesAzureOpenAI): ProveedorIA {
  const url =
    `${endpoint}/openai/deployments/${encodeURIComponent(despliegue)}/chat/completions` +
    `?api-version=${encodeURIComponent(versionApi)}`;

  return {
    nombre: "azure",
    async completar(mensajes, { temperatura, maxTokens, json } = {}) {
      const datos = (await pedirJson({
        url,
        encabezados: { "api-key": apiKey },
        cuerpo: {
          messages: mensajes.map((m) => ({ role: m.rol === "sistema" ? "system" : "user", content: m.contenido })),
          ...(temperatura !== undefined ? { temperature: temperatura } : {}),
          ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
          ...(json ? { response_format: { type: "json_object" } } : {}),
        },
        tiempoEsperaMs,
        secreto: apiKey,
        fetch,
      })) as RespuestaAzure;

      const texto = datos.choices?.[0]?.message?.content;
      if (typeof texto !== "string" || !texto) throw new ErrorIA("IA_NO_DISPONIBLE", "Azure OpenAI no devolvió texto.");
      return texto;
    },
  };
}
