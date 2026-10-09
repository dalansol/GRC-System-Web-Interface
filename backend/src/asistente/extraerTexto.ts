import ExcelJS from "exceljs";
import { extractText } from "unpdf";

/** Máximo de caracteres del documento que se manda a la IA. */
export const LIMITE_CARACTERES = 60_000;

export interface TextoDocumento {
  texto: string;
  /** true si el documento pasó del límite y solo se mandó el inicio. */
  recortado: boolean;
}

async function textoPdf(contenido: Buffer): Promise<string> {
  const { text } = await extractText(new Uint8Array(contenido), { mergePages: false });
  return text
    .map((pagina, i) => (pagina.trim() ? `## Página ${i + 1}\n${pagina.trim()}` : ""))
    .filter(Boolean)
    .join("\n\n");
}

async function textoXlsx(contenido: Buffer): Promise<string> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(contenido as unknown as ArrayBuffer);
  const hojas: string[] = [];
  libro.eachSheet((hoja) => {
    const filas: string[] = [];
    hoja.eachRow((fila) => {
      const celdas: string[] = [];
      fila.eachCell((celda) => {
        const texto = celda.text.trim();
        if (texto) celdas.push(texto);
      });
      if (celdas.length > 0) filas.push(celdas.join(" | "));
    });
    if (filas.length > 0) hojas.push(`## Hoja: ${hoja.name}\n${filas.join("\n")}`);
  });
  return hojas.join("\n\n");
}

// Convierte la evidencia en texto plano. Si no se puede leer (archivo dañado o PDF escaneado), devuelve texto vacío.
export async function extraerTexto({ tipo, contenido }: { tipo: "pdf" | "xlsx"; contenido: Buffer }): Promise<TextoDocumento> {
  let texto = "";
  try {
    texto = tipo === "pdf" ? await textoPdf(contenido) : await textoXlsx(contenido);
  } catch {
    texto = "";
  }
  if (texto.length <= LIMITE_CARACTERES) return { texto, recortado: false };
  return { texto: texto.slice(0, LIMITE_CARACTERES), recortado: true };
}
