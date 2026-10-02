// Cliente HTTP de la API de Expedite.

const URL_API = (import.meta.env.VITE_API_URL ?? "http://localhost:3001").replace(/\/+$/, "");

type Credenciales = () => Promise<Record<string, string>>;

let obtenerCredenciales: Credenciales = async () => ({});

// La sesión registra aquí cómo se identifica cada petición (token de Entra ID).
export function configurarCredenciales(credenciales: Credenciales): void {
  obtenerCredenciales = credenciales;
}

export class ErrorApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorApi";
  }
}

interface Opciones {
  metodo?: "GET" | "POST" | "PATCH";
  cuerpo?: unknown;
}

export async function pedir<T>(ruta: string, { metodo = "GET", cuerpo }: Opciones = {}): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`${URL_API}${ruta}`, {
      method: metodo,
      headers: {
        ...(cuerpo !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(await obtenerCredenciales()),
      },
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ErrorApi(0, "SIN_CONEXION", "No se pudo conectar con el servidor de Expedite.");
  }

  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    throw new ErrorApi(
      respuesta.status,
      datos?.error?.codigo ?? "ERROR_INTERNO",
      datos?.error?.mensaje ?? "Ocurrió un error inesperado.",
    );
  }
  return datos as T;
}
