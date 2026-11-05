import { pedir, pedirBinario, pedirFormData } from "./cliente";

// Archivo y versiones de una evidencia editable en Expedite (UF-17, SF-08).
// Contrato acordado con el backend en docs/diseno/edicion-excel.md: guardar crea una
// versión nueva con su propio hash; el archivo original no se sobrescribe.

export interface VersionEvidencia {
  version: number;
  hash: string;
  fecha: string;
  autor: string;
  comentario: string;
}

interface FilaVersion {
  version: number;
  file_hash: string;
  created_at: string;
  uploaded_by?: string | null;
  comentario?: string | null;
}

function aVersion(fila: FilaVersion): VersionEvidencia {
  return {
    version: Number(fila.version),
    hash: fila.file_hash,
    fecha: fila.created_at,
    autor: fila.uploaded_by ?? "",
    comentario: fila.comentario ?? "",
  };
}

export function descargarArchivoEvidencia(evidenciaId: string): Promise<ArrayBuffer> {
  return pedirBinario(`/evidencias/${encodeURIComponent(evidenciaId)}/archivo`);
}

export async function guardarVersionEvidencia(
  evidenciaId: string,
  archivo: Blob,
  nombre: string,
  comentario: string,
): Promise<VersionEvidencia> {
  const datos = new FormData();
  datos.append("file", archivo, nombre);
  datos.append("comentario", comentario);
  return aVersion(await pedirFormData<FilaVersion>(`/evidencias/${encodeURIComponent(evidenciaId)}/versiones`, datos));
}

export async function listarVersionesEvidencia(evidenciaId: string): Promise<VersionEvidencia[]> {
  const filas = await pedir<FilaVersion[]>(`/evidencias/${encodeURIComponent(evidenciaId)}/versiones`);
  return filas.map(aVersion);
}

/** SHA-256 calculado en el navegador, solo como referencia (el oficial lo calcula el backend). */
export async function hashSha256(archivo: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await archivo.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
