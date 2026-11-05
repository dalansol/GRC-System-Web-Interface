import { altoFila, anchoColumna, type Hoja } from "../../domain/hoja/tipos";

// Geometría de la cuadrícula virtualizada: posiciones acumuladas de filas y columnas,
// tramos visibles (congelado + desplazable) y medición de texto.

// Inter (ya cargada en fonts.css) con cifras tabulares: columnas de montos alineadas.
export const FUENTE_CELDAS = 'Inter, "Plus Jakarta Sans", system-ui, sans-serif';
const TAMANO_CELDA = 13;

/** pos[i] = inicio de la fila/columna i; pos[n] = tamaño total. */
export function posiciones(n: number, tam: (i: number) => number, zoom: number): number[] {
  const pos = new Array<number>(n + 1);
  pos[0] = 0;
  for (let i = 0; i < n; i++) pos[i + 1] = pos[i] + tam(i) * zoom;
  return pos;
}

export function posicionesColumnas(hoja: Hoja, n: number, zoom: number): number[] {
  return posiciones(n, (c) => anchoColumna(hoja, c), zoom);
}

export function posicionesFilas(hoja: Hoja, n: number, zoom: number): number[] {
  return posiciones(n, (f) => altoFila(hoja, f), zoom);
}

/** Índice cuya franja contiene `px` (búsqueda binaria), limitado al rango válido. */
export function indiceEn(pos: number[], px: number): number {
  const n = pos.length - 1;
  if (px <= 0) return 0;
  if (px >= pos[n]) return n - 1;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (pos[mid] <= px) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Tramo de un eje: la parte congelada o la desplazable. */
export interface Tramo {
  /** Inicio en pantalla, relativo al área de la cuadrícula. */
  pantalla: number;
  tam: number;
  /** Coordenada de contenido que queda en `pantalla`. */
  origen: number;
  desde: number;
  hasta: number;
}

export function tramos(pos: number[], congeladas: number, scroll: number, encabezado: number, vista: number): Tramo[] {
  const congelado = pos[congeladas] ?? 0;
  const lista: Tramo[] = [];
  if (congeladas > 0) {
    lista.push({ pantalla: encabezado, tam: congelado, origen: 0, desde: 0, hasta: congeladas - 1 });
  }
  const tam = Math.max(0, vista - encabezado - congelado);
  const origen = congelado + scroll;
  lista.push({
    pantalla: encabezado + congelado,
    tam,
    origen,
    desde: Math.max(congeladas, indiceEn(pos, origen)),
    hasta: indiceEn(pos, origen + tam),
  });
  return lista;
}

/** Coordenada de contenido bajo un punto de pantalla (relativo al área, sin encabezado). */
export function contenidoEn(rel: number, pos: number[], congeladas: number, scroll: number): number {
  const congelado = pos[congeladas] ?? 0;
  return rel < congelado ? rel : rel + scroll;
}

/** Posición en pantalla (relativa al área) del inicio de la fila/columna i. */
export function pantallaDe(i: number, pos: number[], congeladas: number, scroll: number, encabezado: number): number {
  return encabezado + (i < congeladas ? pos[i] : pos[i] - scroll);
}

let contexto: CanvasRenderingContext2D | null | undefined;

export function medirTexto(texto: string, fuente: string): number {
  if (contexto === undefined) {
    const enPruebas = typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent);
    contexto = enPruebas ? null : document.createElement("canvas").getContext("2d");
  }
  if (!contexto) return texto.length * 7;
  contexto.font = fuente;
  return contexto.measureText(texto).width;
}

export function fuenteCelda(negrita: boolean | undefined, cursiva: boolean | undefined, zoom: number): string {
  return `${cursiva ? "italic " : ""}${negrita ? "600 " : "400 "}${(TAMANO_CELDA * zoom).toFixed(2)}px ${FUENTE_CELDAS}`;
}

/** La misma fuente como propiedades sueltas (React no admite mezclar `font` con `lineHeight`). */
export function estiloFuente(negrita: boolean | undefined, cursiva: boolean | undefined, zoom: number) {
  return {
    fontFamily: FUENTE_CELDAS,
    fontSize: `${(TAMANO_CELDA * zoom).toFixed(2)}px`,
    fontWeight: negrita ? 600 : 400,
    fontStyle: cursiva ? "italic" : "normal",
    fontVariantNumeric: "tabular-nums",
  } as const;
}
