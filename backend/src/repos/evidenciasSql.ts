import fs from "node:fs/promises";
import path from "node:path";
import sql from "mssql";
import type { ArchivoEvidencia, RepositorioEvidencias } from "./evidencias.js";

// Misma carpeta que usa routes/evidencias.ts al subir archivos.
const CARPETA_ARCHIVOS = path.resolve(import.meta.dirname, "../../uploads");

export class RepositorioEvidenciasSql implements RepositorioEvidencias {
  constructor(private readonly pool: sql.ConnectionPool) {}

  async leerArchivo(id: string): Promise<ArchivoEvidencia | null> {
    const resultado = await this.pool
      .request()
      .input("id", sql.NVarChar(50), id)
      .query<{ file_name: string; mime_type: string; storage_path: string }>(
        "SELECT file_name, mime_type, storage_path FROM dbo.evidence WHERE CAST(id AS NVARCHAR(50)) = @id",
      );
    const fila = resultado.recordset[0];
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
