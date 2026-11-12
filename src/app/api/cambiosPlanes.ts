import { credencialesActuales, URL_API } from "./cliente";

// Avisos en vivo de cambios en los planes de acción (GET /planes-accion/eventos, Server-Sent Events).
// Una sola conexión por pestaña, compartida por todas las vistas, y abierta solo mientras la pestaña está
// visible y alguna vista la necesita. El aviso no trae datos: cada vista vuelve a pedir lo suyo.
// Se lee con fetch y no con EventSource porque EventSource no puede mandar el token de la sesión.

type Oyente = () => void;

const ESPERA_INICIAL_MS = 1000;
const ESPERA_MAXIMA_MS = 30_000;

const oyentes = new Set<Oyente>();
let conexion: AbortController | null = null;
let temporizadorReconexion: ReturnType<typeof setTimeout> | undefined;
let espera = ESPERA_INICIAL_MS;
/** Hubo un tiempo sin conexión en el que pudo perderse un aviso: al reconectar se recarga por si acaso. */
let posibleAvisoPerdido = false;

const visible = () => typeof document === "undefined" || document.visibilityState === "visible";

function avisar() {
  for (const oyente of [...oyentes]) oyente();
}

/** Separa los eventos completos (terminan en una línea vacía) y avisa si alguno es de planes. */
function procesar(texto: string): string {
  const bloques = texto.split(/\r?\n\r?\n/);
  const pendiente = bloques.pop() ?? "";
  if (bloques.some((bloque) => bloque.split(/\r?\n/).includes("event: planes"))) avisar();
  return pendiente;
}

async function conectar() {
  clearTimeout(temporizadorReconexion);
  if (conexion || oyentes.size === 0 || !visible()) return;
  const actual = new AbortController();
  conexion = actual;
  try {
    const respuesta = await fetch(`${URL_API}/planes-accion/eventos`, {
      headers: await credencialesActuales(),
      signal: actual.signal,
    });
    if (!respuesta.ok || !respuesta.body) throw new Error(`Estado ${respuesta.status}`);
    espera = ESPERA_INICIAL_MS;
    if (posibleAvisoPerdido) {
      posibleAvisoPerdido = false;
      avisar();
    }
    const lector = respuesta.body.getReader();
    const decodificador = new TextDecoder();
    let pendiente = "";
    for (;;) {
      const { value, done } = await lector.read();
      if (done) break;
      pendiente = procesar(pendiente + decodificador.decode(value, { stream: true }));
    }
  } catch {
    // Red caída, sesión vencida o conexión cancelada: se decide abajo si se reintenta.
  }
  if (conexion !== actual) return;
  conexion = null;
  posibleAvisoPerdido = true;
  if (oyentes.size > 0 && visible()) {
    temporizadorReconexion = setTimeout(() => void conectar(), espera);
    espera = Math.min(espera * 2, ESPERA_MAXIMA_MS);
  }
}

function desconectar() {
  clearTimeout(temporizadorReconexion);
  conexion?.abort();
  conexion = null;
}

// En segundo plano la pestaña no mantiene la conexión. Al volver se reconecta y las vistas se recargan,
// porque mientras tanto pudo cambiar algo (por ejemplo, otro usuario en otra pestaña).
function alCambiarVisibilidad() {
  if (visible()) {
    espera = ESPERA_INICIAL_MS;
    posibleAvisoPerdido = false;
    avisar();
    void conectar();
  } else {
    desconectar();
  }
}

/** Llama a `oyente` cada vez que cambia algún plan o la pestaña vuelve a estar visible. Devuelve la baja. */
export function suscribirCambiosPlanes(oyente: Oyente): () => void {
  oyentes.add(oyente);
  if (oyentes.size === 1) document.addEventListener("visibilitychange", alCambiarVisibilidad);
  void conectar();
  return () => {
    oyentes.delete(oyente);
    if (oyentes.size === 0) {
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      desconectar();
      posibleAvisoPerdido = false;
    }
  };
}
