// Modelo de un libro de Excel editable en Expedite (UF-17, SF-08).
// Las hojas son dispersas: solo se guardan las celdas con contenido o formato.

export type FormatoNumero = "general" | "numero" | "moneda" | "porcentaje" | "fecha" | "texto";
export type AlineacionH = "izquierda" | "centro" | "derecha";

export interface EstiloCelda {
  negrita?: boolean;
  cursiva?: boolean;
  subrayado?: boolean;
  alineacion?: AlineacionH;
  colorTexto?: string;
  colorFondo?: string;
  formato?: FormatoNumero;
  decimales?: number;
  bordes?: boolean;
  /** numFmt original del archivo cuando no corresponde a uno de los formatos conocidos. */
  formatoOriginal?: string;
}

export interface Celda {
  /** Lo que escribió el usuario: un valor ("125", "Pago") o una fórmula ("=SUMA(A1:A3)"). */
  entrada: string;
  estilo?: EstiloCelda;
}

export interface Hoja {
  nombre: string;
  /** Clave "fila,columna" (base 0). */
  celdas: Record<string, Celda>;
  filas: number;
  columnas: number;
  /** Anchos en píxeles por columna (sin entrada = ancho por omisión). */
  anchos: Record<number, number>;
  altos: Record<number, number>;
  inmovilizar: { filas: number; columnas: number };
}

export interface Libro {
  hojas: Hoja[];
}

export interface Posicion {
  f: number;
  c: number;
}

/** Rango normalizado: inicio ≤ fin en ambos ejes. */
export interface Rango {
  f1: number;
  c1: number;
  f2: number;
  c2: number;
}

export type ValorCelda = number | string | boolean | ErrorHoja | null;

export class ErrorHoja {
  constructor(readonly codigo: CodigoError) {}
  toString(): string {
    return this.codigo;
  }
}

export type CodigoError = "#¡DIV/0!" | "#¡REF!" | "#¿NOMBRE?" | "#¡VALOR!" | "#¡NUM!" | "#N/D";

export const ANCHO_COLUMNA = 64;
export const ALTO_FILA = 20;
export const FILAS_INICIALES = 100;
export const COLUMNAS_INICIALES = 26;

export function claveCelda(f: number, c: number): string {
  return `${f},${c}`;
}

export function hojaVacia(nombre: string, filas = FILAS_INICIALES, columnas = COLUMNAS_INICIALES): Hoja {
  return { nombre, celdas: {}, filas, columnas, anchos: {}, altos: {}, inmovilizar: { filas: 0, columnas: 0 } };
}

export function obtenerCelda(hoja: Hoja, f: number, c: number): Celda | undefined {
  return hoja.celdas[claveCelda(f, c)];
}

export function normalizarRango(a: Posicion, b: Posicion): Rango {
  return { f1: Math.min(a.f, b.f), c1: Math.min(a.c, b.c), f2: Math.max(a.f, b.f), c2: Math.max(a.c, b.c) };
}

export function dentroDeRango(r: Rango, f: number, c: number): boolean {
  return f >= r.f1 && f <= r.f2 && c >= r.c1 && c <= r.c2;
}

export function anchoColumna(hoja: Hoja, c: number): number {
  return hoja.anchos[c] ?? ANCHO_COLUMNA;
}

export function altoFila(hoja: Hoja, f: number): number {
  return hoja.altos[f] ?? ALTO_FILA;
}
