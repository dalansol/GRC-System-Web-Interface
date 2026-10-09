import { describe, expect, it } from "vitest";
import { crearProveedorAzureOpenAI } from "../src/asistente/azureOpenAI.js";
import { crearProveedorGemini } from "../src/asistente/gemini.js";
import { crearProveedor, ErrorIA, type MensajeIA } from "../src/asistente/proveedor.js";

const MENSAJES: MensajeIA[] = [
  { rol: "sistema", contenido: "Responde en español." },
  { rol: "usuario", contenido: "Resume el documento." },
];

interface Llamada {
  url: string;
  init: RequestInit;
}

// fetch falso: registra la llamada y responde con el estado y cuerpo indicados.
function fetchFalso(status: number, cuerpo: unknown) {
  const llamadas: Llamada[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    llamadas.push({ url, init });
    return new Response(typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo), { status });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, llamadas };
}

// fetch que nunca responde; solo termina cuando se cancela la petición.
const fetchLento = ((_url: string, init: RequestInit) =>
  new Promise((_resolver, rechazar) => {
    init.signal?.addEventListener("abort", () => rechazar(init.signal?.reason));
  })) as unknown as typeof globalThis.fetch;

const fetchSinRed = (async () => {
  throw new TypeError("fetch failed");
}) as unknown as typeof globalThis.fetch;

async function errorDe(promesa: Promise<unknown>): Promise<ErrorIA> {
  const error = await promesa.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ErrorIA);
  return error as ErrorIA;
}

const GEMINI = { apiKey: "clave-gemini", modelo: "gemini-flash", tiempoEsperaMs: 1000 };
const AZURE = {
  endpoint: "https://expedite.openai.azure.com",
  apiKey: "clave-azure",
  despliegue: "expedite-chat",
  versionApi: "2024-10-21",
  tiempoEsperaMs: 1000,
};

describe("proveedor Gemini", () => {
  const respuesta = { candidates: [{ content: { parts: [{ text: "Resumen " }, { text: "del documento." }] } }] };

  it("manda las instrucciones y el mensaje y devuelve el texto", async () => {
    const { fetch, llamadas } = fetchFalso(200, respuesta);

    const texto = await crearProveedorGemini({ ...GEMINI, fetch }).completar(MENSAJES);

    expect(texto).toBe("Resumen del documento.");
    const [llamada] = llamadas;
    expect(llamada?.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash:generateContent",
    );
    expect(llamada?.init.method).toBe("POST");
    expect(new Headers(llamada?.init.headers).get("x-goog-api-key")).toBe("clave-gemini");
    expect(JSON.parse(String(llamada?.init.body))).toEqual({
      systemInstruction: { parts: [{ text: "Responde en español." }] },
      contents: [{ role: "user", parts: [{ text: "Resume el documento." }] }],
    });
  });

  it("aplica temperatura, longitud máxima y modo JSON", async () => {
    const { fetch, llamadas } = fetchFalso(200, respuesta);

    await crearProveedorGemini({ ...GEMINI, fetch }).completar(MENSAJES, { temperatura: 0.2, maxTokens: 100, json: true });

    expect(JSON.parse(String(llamadas[0]?.init.body)).generationConfig).toEqual({
      temperature: 0.2,
      maxOutputTokens: 100,
      responseMimeType: "application/json",
    });
  });

  it("no pone la clave en la URL", async () => {
    const { fetch, llamadas } = fetchFalso(200, respuesta);

    await crearProveedorGemini({ ...GEMINI, fetch }).completar(MENSAJES);

    expect(llamadas[0]?.url).not.toContain("clave-gemini");
  });

  it("falla si la respuesta no trae texto (por ejemplo, contenido bloqueado)", async () => {
    const { fetch } = fetchFalso(200, { promptFeedback: { blockReason: "SAFETY" } });

    const error = await errorDe(crearProveedorGemini({ ...GEMINI, fetch }).completar(MENSAJES));

    expect(error.codigo).toBe("IA_NO_DISPONIBLE");
  });
});

describe("proveedor Azure OpenAI", () => {
  it("llama al despliegue con la clave y devuelve el texto", async () => {
    const { fetch, llamadas } = fetchFalso(200, { choices: [{ message: { content: "Resumen." } }] });

    const texto = await crearProveedorAzureOpenAI({ ...AZURE, fetch }).completar(MENSAJES);

    expect(texto).toBe("Resumen.");
    const [llamada] = llamadas;
    expect(llamada?.url).toBe(
      "https://expedite.openai.azure.com/openai/deployments/expedite-chat/chat/completions?api-version=2024-10-21",
    );
    expect(new Headers(llamada?.init.headers).get("api-key")).toBe("clave-azure");
    expect(JSON.parse(String(llamada?.init.body))).toEqual({
      messages: [
        { role: "system", content: "Responde en español." },
        { role: "user", content: "Resume el documento." },
      ],
    });
  });

  it("aplica temperatura, longitud máxima y modo JSON", async () => {
    const { fetch, llamadas } = fetchFalso(200, { choices: [{ message: { content: "{}" } }] });

    await crearProveedorAzureOpenAI({ ...AZURE, fetch }).completar(MENSAJES, { temperatura: 0.2, maxTokens: 100, json: true });

    expect(JSON.parse(String(llamadas[0]?.init.body))).toMatchObject({
      temperature: 0.2,
      max_tokens: 100,
      response_format: { type: "json_object" },
    });
  });

  it("falla si la respuesta no trae texto", async () => {
    const { fetch } = fetchFalso(200, { choices: [] });

    const error = await errorDe(crearProveedorAzureOpenAI({ ...AZURE, fetch }).completar(MENSAJES));

    expect(error.codigo).toBe("IA_NO_DISPONIBLE");
  });
});

describe.each([
  ["Gemini", (fetch: typeof globalThis.fetch, tiempoEsperaMs = 1000) => crearProveedorGemini({ ...GEMINI, tiempoEsperaMs, fetch })],
  ["Azure OpenAI", (fetch: typeof globalThis.fetch, tiempoEsperaMs = 1000) => crearProveedorAzureOpenAI({ ...AZURE, tiempoEsperaMs, fetch })],
])("errores del proveedor %s", (_nombre, crear) => {
  it.each([
    [401, "credenciales"],
    [403, "credenciales"],
    [404, "modelo"],
    [429, "límite"],
    [500, "500"],
  ])("convierte el estado %i en IA_NO_DISPONIBLE", async (status, detalle) => {
    const { fetch } = fetchFalso(status, { error: { message: "fallo" } });

    const error = await errorDe(crear(fetch).completar(MENSAJES));

    expect(error.codigo).toBe("IA_NO_DISPONIBLE");
    expect(error.detalle).toContain(detalle);
  });

  it("corta la llamada al agotarse el tiempo de espera", async () => {
    const error = await errorDe(crear(fetchLento, 20).completar(MENSAJES));

    expect(error.codigo).toBe("IA_TIEMPO_AGOTADO");
  });

  it("avisa si no hay conexión", async () => {
    const error = await errorDe(crear(fetchSinRed).completar(MENSAJES));

    expect(error.codigo).toBe("IA_NO_DISPONIBLE");
  });

  it("avisa si la respuesta no es JSON", async () => {
    const { fetch } = fetchFalso(200, "<html>proxy</html>");

    const error = await errorDe(crear(fetch).completar(MENSAJES));

    expect(error.codigo).toBe("IA_NO_DISPONIBLE");
  });

  it("nunca incluye la clave en el error", async () => {
    const { fetch } = fetchFalso(401, { error: { message: "fallo" } });

    const error = await errorDe(crear(fetch).completar(MENSAJES));

    expect(`${error.message} ${error.detalle}`).not.toMatch(/clave-(gemini|azure)/);
  });
});

describe("crearProveedor", () => {
  it("no crea proveedor si la IA está desactivada", () => {
    expect(crearProveedor({ proveedor: "ninguno", tiempoEsperaMs: 30000 })).toBeNull();
  });

  it("elige el adaptador según la configuración", () => {
    expect(crearProveedor({ proveedor: "gemini", ...GEMINI })?.nombre).toBe("gemini");
    expect(crearProveedor({ proveedor: "azure", ...AZURE })?.nombre).toBe("azure");
  });
});
