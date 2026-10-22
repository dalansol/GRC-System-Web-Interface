import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type pg from "pg";
import type { ArchivoEvidencia, RepositorioEvidencias } from "./evidencias.js";

// Misma carpeta que usa routes/evidencias.ts al subir archivos.
const CARPETA_ARCHIVOS = process.env.VERCEL
  ? path.join(os.tmpdir(), "expedite-uploads")
  : path.resolve(import.meta.dirname, "../../uploads");

export class RepositorioEvidenciasSql implements RepositorioEvidencias {
  constructor(private readonly pool: pg.Pool) {}

  async leerArchivo(id: string): Promise<ArchivoEvidencia | null> {
    const resultado = await this.pool.query<{ file_name: string; mime_type: string; storage_path: string }>(
      "SELECT file_name, mime_type, storage_path FROM evidence WHERE id = $1",
      [id],
    );
    const fila = resultado.rows[0];
    if (!fila || (fila.mime_type !== "pdf" && fila.mime_type !== "xlsx")) return null;

    // basename impide salir de la carpeta aunque storage_path traiga una ruta.
    const ruta = path.join(CARPETA_ARCHIVOS, path.basename(fila.storage_path));
    try {
      return { id, nombre: fila.file_name, tipo: fila.mime_type, contenido: await fs.readFile(ruta) };
    } catch {
      return null;
    }
  }
}
