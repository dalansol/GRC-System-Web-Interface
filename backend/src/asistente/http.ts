import { ErrorIA } from "./tipos.js";

export interface OpcionesLlamada {
  url: string;
  encabezados: Record<string, string>;
  cuerpo: unknown;
  tiempoEsperaMs: number;
  /** Se borra de cualquier texto del proveedor que llegue al detalle del error. */
  secreto: string;
  fetch?: typeof globalThis.fetch;
}

function descripcionEstado(status: number): string {
  if (status === 401 || status === 403) return `Las credenciales no son válidas o no tienen permisos (estado ${status}).`;
  if (status === 404) return `El modelo o despliegue no existe (estado ${status}).`;
  if (status === 429) return `Se alcanzó el límite de uso del proveedor (estado ${status}).`;
  return `El proveedor respondió con estado ${status}.`;
}

// Hace la petición sin reintentos: ante cualquier falla se avisa de inmediato para desactivar la función.
export async function pedirJson({ url, encabezados, cuerpo, tiempoEsperaMs, secreto, fetch = globalThis.fetch }: OpcionesLlamada): Promise<unknown> {
  const limpiar = (texto: string) => texto.replaceAll(secreto, "***").slice(0, 300);

  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...encabezados },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(tiempoEsperaMs),
    });
  } catch (error) {
    if ((error as Error)?.name === "TimeoutError") {
      throw new ErrorIA("IA_TIEMPO_AGOTADO", `Sin respuesta después de ${tiempoEsperaMs} ms.`);
    }
    throw new ErrorIA("IA_NO_DISPONIBLE", `No se pudo conectar con el proveedor: ${limpiar(String((error as Error)?.message ?? error))}`);
  }

  const texto = await respuesta.text();
  if (!respuesta.ok) {
    let mensaje = "";
    try {
      const datos = JSON.parse(texto) as { error?: { message?: unknown } };
      if (typeof datos.error?.message === "string") mensaje = ` ${limpiar(datos.error.message)}`;
    } catch {
      // El cuerpo no era JSON; basta con el estado.
    }
    throw new ErrorIA("IA_NO_DISPONIBLE", descripcionEstado(respuesta.status) + mensaje);
  }

  try {
    return JSON.parse(texto);
  } catch {
    throw new ErrorIA("IA_NO_DISPONIBLE", "La respuesta del proveedor no es JSON.");
  }
}
