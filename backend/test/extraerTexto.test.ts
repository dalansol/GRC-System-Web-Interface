import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { extraerTexto, LIMITE_CARACTERES } from "../src/asistente/extraerTexto.js";
import { crearPdfSencillo } from "../src/repos/evidenciasEjemplo.js";

async function xlsx(hojas: Record<string, (string | number)[][]>): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  for (const [nombre, filas] of Object.entries(hojas)) libro.addWorksheet(nombre).addRows(filas);
  return Buffer.from(await libro.xlsx.writeBuffer());
}

describe("extraerTexto", () => {
  it("lee el texto de un PDF por página", async () => {
    const contenido = crearPdfSencillo([["Reporte de accesos", "Usuarios revisados: 42"], ["Conclusion: sin excepciones"]]);

    const { texto, recortado } = await extraerTexto({ tipo: "pdf", contenido });

    expect(texto).toContain("Página 1");
    expect(texto).toContain("Usuarios revisados: 42");
    expect(texto).toContain("Página 2");
    expect(texto).toContain("Conclusion: sin excepciones");
    expect(recortado).toBe(false);
  });

  it("lee las hojas y filas de un Excel", async () => {
    const contenido = await xlsx({ Junio: [["Cuenta", "Saldo"], ["Bancomer", 1500]], Notas: [["Conciliado por M. García"]] });

    const { texto } = await extraerTexto({ tipo: "xlsx", contenido });

    expect(texto).toContain("Hoja: Junio");
    expect(texto).toContain("Cuenta | Saldo");
    expect(texto).toContain("Bancomer | 1500");
    expect(texto).toContain("Hoja: Notas");
  });

  it("recorta los documentos muy largos y lo avisa", async () => {
    const filas = Array.from({ length: 4000 }, (_, i) => [`Movimiento ${i}`, "Descripción larga del movimiento contable"]);
    const contenido = await xlsx({ Datos: filas });

    const { texto, recortado } = await extraerTexto({ tipo: "xlsx", contenido });

    expect(recortado).toBe(true);
    expect(texto.length).toBeLessThanOrEqual(LIMITE_CARACTERES);
  });

  it("devuelve texto vacío si el archivo no se puede leer", async () => {
    expect((await extraerTexto({ tipo: "pdf", contenido: Buffer.from("no es un pdf") })).texto).toBe("");
    expect((await extraerTexto({ tipo: "xlsx", contenido: Buffer.from("no es un excel") })).texto).toBe("");
  });
});
