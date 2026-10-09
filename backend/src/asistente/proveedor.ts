import type { ConfigIA } from "../config.js";
import { crearProveedorAzureOpenAI } from "./azureOpenAI.js";
import { crearProveedorGemini } from "./gemini.js";
import type { ProveedorIA } from "./tipos.js";

export { ErrorIA, type CodigoErrorIA, type MensajeIA, type OpcionesCompletar, type ProveedorIA } from "./tipos.js";

// Elige el adaptador según IA_PROVEEDOR. Devuelve null si la IA está desactivada.
export function crearProveedor(config: ConfigIA, fetch?: typeof globalThis.fetch): ProveedorIA | null {
  switch (config.proveedor) {
    case "gemini":
      return crearProveedorGemini({ ...config, fetch });
    case "azure":
      return crearProveedorAzureOpenAI({ ...config, fetch });
    case "ninguno":
      return null;
  }
}
