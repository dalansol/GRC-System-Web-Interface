export interface ArchivoEvidencia {
  id: string;
  nombre: string;
  tipo: "pdf" | "xlsx";
  contenido: Buffer;
}

// Lectura de archivos de evidencia para el asistente de IA.
export interface RepositorioEvidencias {
  leerArchivo(id: string): Promise<ArchivoEvidencia | null>;
}
