import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { Calculadora } from "./calculo";
import { libroDeEjemplo } from "./ejemplos";
import { aplicarEstilo, escribir } from "./operaciones";
import { claveCelda, hojaVacia, type Libro } from "./tipos";
import JSZip from "jszip";
import { AVISO_MACROS, contieneMacros, escribirXlsx, formatoDesdeNumFmt, leerXlsx } from "./xlsx";

async function aBuffer(blob: Blob): Promise<ArrayBuffer> {
  return blob.arrayBuffer();
}

describe("xlsx", () => {
  it("avisa que las macros no son compatibles y muestra el resto del contenido", async () => {
    // Un .xlsm es un .xlsx que además trae xl/vbaProject.bin.
    let libro: Libro = { hojas: [hojaVacia("Datos")] };
    libro = escribir(libro, 0, 0, 0, "Total");
    libro = escribir(libro, 0, 0, 1, "=SUMA(1,2)");
    const sinMacros = await aBuffer(await escribirXlsx(libro));
    const zip = await JSZip.loadAsync(sinMacros);
    zip.file("xl/vbaProject.bin", new Uint8Array([1, 2, 3, 4]));
    const conMacros = await zip.generateAsync({ type: "arraybuffer" });

    expect(contieneMacros(sinMacros)).toBe(false);
    expect(contieneMacros(conMacros)).toBe(true);
    const { libro: leido, avisos } = await leerXlsx(conMacros);
    expect(avisos).toEqual([AVISO_MACROS]);
    expect(leido.hojas[0].celdas[claveCelda(0, 0)]?.entrada).toBe("Total");
    expect(leido.hojas[0].celdas[claveCelda(0, 1)]?.entrada).toBe("=SUMA(1,2)");
  });

  it("ida y vuelta conserva valores, fórmulas, formato y paneles inmovilizados", async () => {
    let libro: Libro = { hojas: [hojaVacia("Datos"), hojaVacia("Resumen")] };
    libro = escribir(libro, 0, 0, 0, "Concepto");
    libro = escribir(libro, 0, 1, 0, "1,500.25");
    libro = escribir(libro, 0, 2, 0, "=SUMA(A2:A2)*2");
    libro = escribir(libro, 0, 3, 0, "15/08/2025");
    libro = escribir(libro, 1, 0, 0, "=Datos!A3");
    libro = aplicarEstilo(libro, 0, { f1: 0, c1: 0, f2: 0, c2: 0 }, (e) => ({ ...e, negrita: true, colorFondo: "#FFFF00", alineacion: "centro" }));
    libro = { hojas: libro.hojas.map((h, i) => (i === 0 ? { ...h, inmovilizar: { filas: 1, columnas: 0 }, anchos: { 0: 160 } } : h)) };

    const { libro: leido, avisos } = await leerXlsx(await aBuffer(await escribirXlsx(libro)));
    expect(avisos).toEqual([]);
    const datos = leido.hojas[0];
    expect(leido.hojas.map((h) => h.nombre)).toEqual(["Datos", "Resumen"]);
    expect(datos.celdas[claveCelda(0, 0)]).toEqual({
      entrada: "Concepto",
      estilo: { negrita: true, colorFondo: "#FFFF00", alineacion: "centro" },
    });
    expect(datos.celdas[claveCelda(1, 0)].estilo?.formato).toBe("numero");
    expect(datos.celdas[claveCelda(2, 0)].entrada).toBe("=SUMA(A2:A2)*2");
    expect(datos.celdas[claveCelda(3, 0)]).toMatchObject({ entrada: "15/08/2025", estilo: { formato: "fecha" } });
    expect(datos.inmovilizar).toEqual({ filas: 1, columnas: 0 });
    expect(Math.abs(datos.anchos[0] - 160)).toBeLessThanOrEqual(2);
    expect(new Calculadora(leido).valor(1, 0, 0)).toBe(3000.5);
  });

  it("guarda la fórmula en inglés con su resultado calculado", async () => {
    const libro = libroDeEjemplo("Conciliacion_Bancaria.xlsx");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await aBuffer(await escribirXlsx(libro)));
    const total = wb.getWorksheet("Conciliación")!.getCell("C15");
    expect(total.formula).toBe("SUM(C2:C14)");
    expect(total.result).toBe(123250);
  });

  it("avisa lo que no se conserva y respeta textos que parecen números", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("H");
    ws.getCell("A1").value = "00123";
    ws.getCell("B1").value = "x";
    ws.mergeCells("B1:C1");
    const { libro, avisos } = await leerXlsx((await wb.xlsx.writeBuffer()) as ArrayBuffer);
    expect(libro.hojas[0].celdas[claveCelda(0, 0)].entrada).toBe("'00123");
    expect(avisos.some((a) => a.includes("combinadas"))).toBe(true);
  });

  it("reconoce los formatos numéricos más comunes", () => {
    expect(formatoDesdeNumFmt('"$"#,##0.00')).toEqual({ formato: "moneda", decimales: 2 });
    expect(formatoDesdeNumFmt("0.0%")).toEqual({ formato: "porcentaje", decimales: 1 });
    expect(formatoDesdeNumFmt("#,##0")).toEqual({ formato: "numero", decimales: 0 });
    expect(formatoDesdeNumFmt("dd/mm/yyyy").formato).toBe("fecha");
    expect(formatoDesdeNumFmt("General")).toEqual({});
  });
});
