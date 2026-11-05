export interface ArchivoEvidencia {
  id: string;
  nombre: string;
  tipo: "pdf" | "xlsx";
  contenido: Buffer;
}

/** Quien pide el archivo; decide qué evidencias puede leer (ver evidenciasAcceso.ts). */
export interface LectorEvidencia {
  id: number;
  rol: string;
}

// Lectura de archivos de evidencia para el asistente de IA.
export interface RepositorioEvidencias {
  /** null si no existe, no es PDF/XLSX o el usuario no puede verla. */
  leerArchivo(id: string, lector: LectorEvidencia): Promise<ArchivoEvidencia | null>;
}
