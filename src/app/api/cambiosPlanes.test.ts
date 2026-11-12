import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// El setup simula este módulo para las vistas; aquí se prueba el real.
type Modulo = typeof import("./cambiosPlanes");
let suscribir: Modulo["suscribirCambiosPlanes"];

/** Respuesta de fetch con un cuerpo que la prueba alimenta a mano. */
function flujoControlado() {
  let controlador!: ReadableStreamDefaultController<Uint8Array>;
  const cuerpo = new ReadableStream<Uint8Array>({ start: (c) => (controlador = c) });
  const codificador = new TextEncoder();
  return {
    respuesta: new Response(cuerpo, { status: 200, headers: { "Content-Type": "text/event-stream" } }),
    enviar: (texto: string) => controlador.enqueue(codificador.encode(texto)),
  };
}

let visibilidad: DocumentVisibilityState = "visible";
const llamadas: { signal: AbortSignal; headers: Record<string, string> }[] = [];
let flujos: ReturnType<typeof flujoControlado>[] = [];
const bajas: (() => void)[] = [];

beforeEach(async () => {
  vi.resetModules();
  visibilidad = "visible";
  llamadas.length = 0;
  flujos = [];
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibilidad);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, opciones: RequestInit) => {
      llamadas.push({ signal: opciones.signal!, headers: opciones.headers as Record<string, string> });
      const flujo = flujoControlado();
      flujos.push(flujo);
      opciones.signal!.addEventListener("abort", () => flujo.respuesta.body?.cancel().catch(() => {}));
      return flujo.respuesta;
    }),
  );
  const cliente = await import("./cliente");
  cliente.configurarCredenciales(async () => ({ "X-Dev-Usuario": "a.rodriguez@expedite.com" }));
  ({ suscribirCambiosPlanes: suscribir } = await vi.importActual<Modulo>("./cambiosPlanes"));
});

afterEach(() => {
  for (const baja of bajas.splice(0)) baja();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function suscribirse(oyente: () => void) {
  const baja = suscribir(oyente);
  bajas.push(baja);
  return baja;
}

function cambiarVisibilidad(estado: DocumentVisibilityState) {
  visibilidad = estado;
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("avisos en vivo de planes", () => {
  it("abre una sola conexión con la sesión, aunque se suscriban varias vistas", async () => {
    suscribirse(vi.fn());
    suscribirse(vi.fn());

    await vi.waitFor(() => expect(llamadas).toHaveLength(1));
    expect(llamadas[0]!.headers).toEqual({ "X-Dev-Usuario": "a.rodriguez@expedite.com" });
  });

  it("avisa a todas las vistas con cada evento de planes, aunque llegue en pedazos", async () => {
    const primera = vi.fn();
    const segunda = vi.fn();
    suscribirse(primera);
    suscribirse(segunda);
    await vi.waitFor(() => expect(flujos).toHaveLength(1));

    flujos[0]!.enviar(": conectado\n\nevent: pla");
    flujos[0]!.enviar("nes\ndata: {}\n\n");

    await vi.waitFor(() => expect(primera).toHaveBeenCalledTimes(1));
    expect(segunda).toHaveBeenCalledTimes(1);
  });

  it("ignora los latidos", async () => {
    const oyente = vi.fn();
    suscribirse(oyente);
    await vi.waitFor(() => expect(flujos).toHaveLength(1));

    flujos[0]!.enviar(": latido\n\n: latido\n\n");
    flujos[0]!.enviar("event: planes\ndata: {}\n\n");

    await vi.waitFor(() => expect(oyente).toHaveBeenCalledTimes(1));
  });

  it("cierra la conexión cuando la última vista se va", async () => {
    const baja = suscribirse(vi.fn());
    await vi.waitFor(() => expect(llamadas).toHaveLength(1));

    baja();

    expect(llamadas[0]!.signal.aborted).toBe(true);
  });

  it("en segundo plano cierra la conexión y, al volver, recarga las vistas y reconecta", async () => {
    const oyente = vi.fn();
    suscribirse(oyente);
    await vi.waitFor(() => expect(llamadas).toHaveLength(1));

    cambiarVisibilidad("hidden");
    expect(llamadas[0]!.signal.aborted).toBe(true);
    expect(oyente).not.toHaveBeenCalled();

    cambiarVisibilidad("visible");

    expect(oyente).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(llamadas).toHaveLength(2));
  });

  it("no se conecta si la pestaña está en segundo plano", async () => {
    visibilidad = "hidden";
    suscribirse(vi.fn());

    await new Promise((listo) => setTimeout(listo, 20));
    expect(llamadas).toHaveLength(0);
  });
});
