import type pg from "pg";
import type { AlmacenamientoArchivos } from "../almacenamiento.js";
import type { ArchivoEvidencia, LectorEvidencia, RepositorioEvidencias } from "./evidencias.js";
import { condicionEvidenciaVisible } from "./evidenciasAcceso.js";

export class RepositorioEvidenciasSql implements RepositorioEvidencias {
  constructor(
    private readonly pool: pg.Pool,
    // El mismo almacenamiento que usa routes/evidencias.ts al subir archivos.
    private readonly almacenamiento: AlmacenamientoArchivos,
  ) {}

  async leerArchivo(id: string, lector: LectorEvidencia): Promise<ArchivoEvidencia | null> {
    const resultado = await this.pool.query<{ file_name: string; mime_type: string; storage_path: string }>(
      `SELECT e.file_name, e.mime_type, e.storage_path FROM evidence e
       WHERE e.id = $1 AND ${condicionEvidenciaVisible("$2", "$3")}`,
      [id, lector.rol, String(lector.id)],
    );
    const fila = resultado.rows[0];
    if (!fila || (fila.mime_type !== "pdf" && fila.mime_type !== "xlsx")) return null;

    const contenido = await this.almacenamiento.leer(fila.storage_path);
    return contenido ? { id, nombre: fila.file_name, tipo: fila.mime_type, contenido } : null;
  }
}
