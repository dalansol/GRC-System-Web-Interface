import type { Cell, Workbook, Worksheet } from "exceljs";

import { Calculadora, esFormula, interpretarEntrada, serialAFecha } from "./calculo";
import { ERRORES_EN, ERRORES_ES } from "./formulas";
import { parsearRango } from "./referencias";
import { formulaAEspanol, formulaAIngles } from "./reescritura";
import {
  ANCHO_COLUMNA,
  claveCelda,
  COLUMNAS_INICIALES,
  ErrorHoja,
  FILAS_INICIALES,
  hojaVacia,
  type Celda,
  type EstiloCelda,
  type Hoja,
  type Libro,
  type ValorCelda,
} from "./tipos";

// Lectura y escritura de .xlsx con exceljs. La librería se importa bajo demanda para
// no cargarla hasta que alguien abre el editor.

export const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function cargarExcelJS() {
  const modulo = await import("exceljs");
  return (modulo as unknown as { default?: typeof modulo }).default ?? modulo;
}

// Excel mide el ancho en caracteres de la fuente estándar y el alto en puntos.
const pxDesdeAnchoExcel = (ancho: number) => Math.round(ancho * 7 + 5);
const anchoExcelDesdePx = (px: number) => Math.max(1, Math.round(((px - 5) / 7) * 100) / 100);
const pxDesdePuntos = (pt: number) => Math.round((pt * 4) / 3);
const puntosDesdePx = (px: number) => Math.round(px * 0.75 * 100) / 100;

const colorHex = (argb?: string) => (argb && /^[0-9A-Fa-f]{8}$/.test(argb) ? `#${argb.slice(2).toUpperCase()}` : undefined);
const colorArgb = (hex: string) => `FF${hex.replace("#", "").toUpperCase()}`;

function fechaTexto(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

/** numFmt de Excel → formato de Expedite. */
export function formatoDesdeNumFmt(numFmt: string | undefined): Pick<EstiloCelda, "formato" | "decimales" | "formatoOriginal"> {
  if (!numFmt || numFmt === "General") return {};
  const decimales = /0\.(0+)/.exec(numFmt)?.[1].length ?? 0;
  if (numFmt === "@") return { formato: "texto" };
  if (numFmt.includes("%")) return { formato: "porcentaje", decimales };
  if (/\$|\[\$/.test(numFmt)) return { formato: "moneda", decimales };
  if (/(^|[^"\\])[dmy]/i.test(numFmt.replace(/"[^"]*"/g, "")) && !/[#0]/.test(numFmt)) return { formato: "fecha", formatoOriginal: numFmt };
  if (/^#,##0(\.0+)?(;.*)?$/.test(numFmt)) return { formato: "numero", decimales };
  if (/^0(\.0+)?$/.test(numFmt)) return { formato: "general", decimales };
  return { formatoOriginal: numFmt };
}

export function numFmtDesdeEstilo(estilo: EstiloCelda | undefined): string | undefined {
  if (!estilo) return undefined;
  const dec = estilo.decimales ?? 0;
  const parteDec = dec > 0 ? `.${"0".repeat(dec)}` : "";
  switch (estilo.formato) {
    case "numero":
      return `#,##0${estilo.decimales === undefined ? ".00" : parteDec}`;
    case "moneda":
      return `"$"#,##0${estilo.decimales === undefined ? ".00" : parteDec}`;
    case "porcentaje":
      return `0${parteDec}%`;
    case "fecha":
      return estilo.formatoOriginal ?? "dd/mm/yyyy";
    case "texto":
      return "@";
    default:
      if (estilo.formatoOriginal) return estilo.formatoOriginal;
      return estilo.decimales !== undefined ? `0${parteDec}` : undefined;
  }
}

function estiloDesdeCelda(cell: Cell): EstiloCelda | undefined {
  const e: EstiloCelda = {};
  const font = cell.font;
  if (font?.bold) e.negrita = true;
  if (font?.italic) e.cursiva = true;
  if (font?.underline) e.subrayado = true;
  const colorTexto = colorHex(font?.color?.argb);
  if (colorTexto && colorTexto !== "#000000") e.colorTexto = colorTexto;
  const fill = cell.fill;
  if (fill?.type === "pattern" && fill.pattern === "solid") {
    const fondo = colorHex(fill.fgColor?.argb);
    if (fondo && fondo !== "#FFFFFF") e.colorFondo = fondo;
  }
  const h = cell.alignment?.horizontal;
  if (h === "left") e.alineacion = "izquierda";
  else if (h === "center" || h === "centerContinuous") e.alineacion = "centro";
  else if (h === "right") e.alineacion = "derecha";
  const b = cell.border;
  if (b && (b.top || b.bottom || b.left || b.right)) e.bordes = true;
  Object.assign(e, formatoDesdeNumFmt(cell.numFmt));
  return Object.keys(e).length ? e : undefined;
}

/** Valor de una celda de exceljs → texto como lo teclearía el usuario. */
function entradaDesdeValor(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "number") return String(valor);
  if (typeof valor === "boolean") return valor ? "VERDADERO" : "FALSO";
  if (valor instanceof Date) return fechaTexto(valor);
  if (typeof valor === "string") {
    // Un texto que parecería número o fórmula se conserva como texto con apóstrofo.
    return valor.startsWith("=") || interpretarEntrada(valor).valor !== valor ? `'${valor}` : valor;
  }
  if (typeof valor === "object") {
    const v = valor as { richText?: { text: string }[]; text?: unknown; error?: string; result?: unknown };
    if (v.richText) return entradaDesdeValor(v.richText.map((t) => t.text).join(""));
    if (v.error) return ERRORES_ES[v.error] ?? v.error;
    if (v.text !== undefined) return entradaDesdeValor(typeof v.text === "string" ? v.text : String(v.text));
  }
  return String(valor);
}

function hojaDesdeWorksheet(ws: Worksheet, avisos: Set<string>): Hoja {
  const hoja = hojaVacia(ws.name);
  let maxF = 0;
  let maxC = 0;

  ws.eachRow({ includeEmpty: true }, (row, numFila) => {
    const f = numFila - 1;
    if (row.height) hoja.altos[f] = pxDesdePuntos(row.height);
    row.eachCell({ includeEmpty: true }, (cell, numCol) => {
      const c = numCol - 1;
      if (cell.isMerged && cell.master !== cell) return;
      let entrada: string;
      const formula = cell.type === 6 /* ValueType.Formula */ ? cell.formula : undefined;
      if (formula) {
        entrada = formulaAEspanol(formula);
      } else if (cell.type === 6) {
        avisos.add("Hay fórmulas de matriz que se convirtieron en valores.");
        entrada = entradaDesdeValor((cell.value as { result?: unknown }).result);
      } else {
        entrada = entradaDesdeValor(cell.value);
      }
      const estilo = estiloDesdeCelda(cell);
      if (!entrada && !estilo) return;
      const celda: Celda = { entrada };
      if (estilo) celda.estilo = estilo;
      // Una fecha leída como número toma el formato de fecha aunque el numFmt sea exótico.
      if (cell.value instanceof Date) celda.estilo = { ...celda.estilo, formato: "fecha" };
      hoja.celdas[claveCelda(f, c)] = celda;
      maxF = Math.max(maxF, f);
      maxC = Math.max(maxC, c);
    });
  });

  ws.columns?.forEach((col, i) => {
    if (col.width && Math.abs(pxDesdeAnchoExcel(col.width) - ANCHO_COLUMNA) > 2) hoja.anchos[i] = pxDesdeAnchoExcel(col.width);
  });

  const vista = ws.views?.[0] as { state?: string; xSplit?: number; ySplit?: number } | undefined;
  if (vista?.state === "frozen") hoja.inmovilizar = { filas: vista.ySplit ?? 0, columnas: vista.xSplit ?? 0 };

  const merges = (ws.model as { merges?: string[] }).merges ?? [];
  for (const texto of merges) {
    const r = parsearRango(texto);
    if (r && (r.f1 !== r.f2 || r.c1 !== r.c2)) hoja.combinadas.push(r);
  }
  if (ws.getImages().length) avisos.add("Las imágenes del archivo no se muestran ni se conservan al guardar.");
  const validaciones = (ws as unknown as { dataValidations?: { model?: object } }).dataValidations?.model;
  if (validaciones && Object.keys(validaciones).length) avisos.add("Las validaciones de datos no se conservan al guardar.");
  const condicionales = (ws as unknown as { conditionalFormattings?: unknown[] }).conditionalFormattings;
  if (condicionales?.length) avisos.add("El formato condicional no se conserva al guardar.");

  hoja.filas = Math.max(FILAS_INICIALES, maxF + 51);
  hoja.columnas = Math.max(COLUMNAS_INICIALES, maxC + 6);
  return hoja;
}

export const AVISO_MACROS =
  "El archivo contiene macros, que no son compatibles con el editor: se muestra el resto del contenido y al guardar la versión nueva queda sin macros (.xlsx).";

/**
 * Un libro con macros (.xlsm) es un ZIP que incluye la entrada xl/vbaProject.bin; el nombre
 * aparece sin comprimir en el directorio del ZIP, así que basta buscarlo en los bytes.
 */
export function contieneMacros(datos: ArrayBuffer): boolean {
  const bytes = new Uint8Array(datos);
  const firma = new TextEncoder().encode("xl/vbaProject.bin");
  const fin = bytes.length - firma.length;
  for (let i = 0; i <= fin; i++) {
    if (bytes[i] !== firma[0]) continue;
    let coincide = true;
    for (let j = 1; j < firma.length; j++) {
      if (bytes[i + j] !== firma[j]) {
        coincide = false;
        break;
      }
    }
    if (coincide) return true;
  }
  return false;
}

export async function leerXlsx(datos: ArrayBuffer): Promise<{ libro: Libro; avisos: string[] }> {
  const ExcelJS = await cargarExcelJS();
  const wb: Workbook = new ExcelJS.Workbook();
  await wb.xlsx.load(datos);
  const avisos = new Set<string>();
  if (contieneMacros(datos)) avisos.add(AVISO_MACROS);
  const hojas: Hoja[] = [];
  wb.eachSheet((ws) => {
    if (ws.state === "hidden" || ws.state === "veryHidden") avisos.add("Hay hojas ocultas; se mostrarán al editar.");
    hojas.push(hojaDesdeWorksheet(ws, avisos));
  });
  if (!hojas.length) hojas.push(hojaVacia("Hoja1"));
  return { libro: { hojas }, avisos: [...avisos] };
}

function resultadoExcel(valor: ValorCelda): unknown {
  if (valor instanceof ErrorHoja) return { error: ERRORES_EN[valor.codigo] ?? valor.codigo };
  return valor ?? undefined;
}

export async function escribirXlsx(libro: Libro): Promise<Blob> {
  const ExcelJS = await cargarExcelJS();
  const wb: Workbook = new ExcelJS.Workbook();
  wb.creator = "Expedite";
  wb.modified = new Date();
  const calc = new Calculadora(libro);

  libro.hojas.forEach((hoja, idx) => {
    const { filas, columnas } = hoja.inmovilizar;
    const ws = wb.addWorksheet(hoja.nombre, {
      views: filas || columnas ? [{ state: "frozen", xSplit: columnas, ySplit: filas }] : [],
    });

    for (const [c, px] of Object.entries(hoja.anchos)) ws.getColumn(Number(c) + 1).width = anchoExcelDesdePx(px);
    for (const [f, px] of Object.entries(hoja.altos)) ws.getRow(Number(f) + 1).height = puntosDesdePx(px);

    for (const [k, celda] of Object.entries(hoja.celdas)) {
      const [f, c] = k.split(",").map(Number);
      const cell = ws.getCell(f + 1, c + 1);
      const { entrada, estilo } = celda;

      if (esFormula(entrada)) {
        cell.value = { formula: formulaAIngles(entrada), result: resultadoExcel(calc.valor(idx, f, c)) } as never;
      } else if (entrada !== "") {
        const valor = estilo?.formato === "texto" ? entrada.replace(/^'/, "") : interpretarEntrada(entrada).valor;
        if (typeof valor === "number" && estilo?.formato === "fecha") cell.value = serialAFecha(valor);
        else if (valor instanceof ErrorHoja) cell.value = { error: ERRORES_EN[valor.codigo] } as never;
        else cell.value = valor as never;
      }

      if (!estilo) continue;
      if (estilo.negrita || estilo.cursiva || estilo.subrayado || estilo.colorTexto) {
        cell.font = {
          name: "Calibri",
          size: 11,
          bold: estilo.negrita,
          italic: estilo.cursiva,
          underline: estilo.subrayado,
          color: estilo.colorTexto ? { argb: colorArgb(estilo.colorTexto) } : undefined,
        };
      }
      if (estilo.colorFondo) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colorArgb(estilo.colorFondo) } };
      if (estilo.alineacion) {
        cell.alignment = { horizontal: estilo.alineacion === "izquierda" ? "left" : estilo.alineacion === "centro" ? "center" : "right" };
      }
      if (estilo.bordes) {
        const fino = { style: "thin" as const, color: { argb: "FF000000" } };
        cell.border = { top: fino, left: fino, bottom: fino, right: fino };
      }
      const numFmt = numFmtDesdeEstilo(estilo);
      if (numFmt) cell.numFmt = numFmt;
    }

    // Después de escribir las celdas: combinar vacía las que quedan tapadas.
    for (const m of hoja.combinadas) ws.mergeCells(m.f1 + 1, m.c1 + 1, m.f2 + 1, m.c2 + 1);
  });

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer as ArrayBuffer], { type: MIME_XLSX });
}
