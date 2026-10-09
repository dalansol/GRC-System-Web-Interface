import type { ArchivoEvidencia, RepositorioEvidencias } from "./evidencias.js";
import { EVIDENCIAS_EJEMPLO } from "./evidenciasEjemplo.js";

// Modo en memoria: documentos de ejemplo para probar el asistente sin base de datos.
export class RepositorioEvidenciasMemoria implements RepositorioEvidencias {
  async leerArchivo(id: string): Promise<ArchivoEvidencia | null> {
    const ejemplo = EVIDENCIAS_EJEMPLO.find((e) => e.id === id);
    if (!ejemplo) return null;
    return { id, nombre: ejemplo.nombre, tipo: ejemplo.tipo, contenido: await ejemplo.crearContenido() };
  }
}
