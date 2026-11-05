import type { Posicion, Rango } from "./tipos";

// Columnas estilo Excel: 0 → A, 25 → Z, 26 → AA.
export function letraColumna(c: number): string {
  let n = c + 1;
  let letras = "";
  while (n > 0) {
    const resto = (n - 1) % 26;
    letras = String.fromCharCode(65 + resto) + letras;
    n = Math.floor((n - 1) / 26);
  }
  return letras;
}

export function indiceColumna(letras: string): number {
  let n = 0;
  for (const ch of letras.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function nombreCelda(f: number, c: number): string {
  return `${letraColumna(c)}${f + 1}`;
}

export function nombreRango(r: Rango): string {
  const a = nombreCelda(r.f1, r.c1);
  return r.f1 === r.f2 && r.c1 === r.c2 ? a : `${a}:${nombreCelda(r.f2, r.c2)}`;
}

export interface RefCelda extends Posicion {
  colAbs: boolean;
  filaAbs: boolean;
}

const PATRON_REF = /^(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})$/;

export function parsearRef(texto: string): RefCelda | null {
  const m = PATRON_REF.exec(texto.trim());
  if (!m) return null;
  const f = Number(m[4]) - 1;
  if (f < 0) return null;
  return { c: indiceColumna(m[2]), f, colAbs: m[1] === "$", filaAbs: m[3] === "$" };
}

export function escribirRef(ref: RefCelda): string {
  return `${ref.colAbs ? "$" : ""}${letraColumna(ref.c)}${ref.filaAbs ? "$" : ""}${ref.f + 1}`;
}

/** Acepta "B3" o "A1:C5" (en cualquier orden) y devuelve el rango normalizado. */
export function parsearRango(texto: string): Rango | null {
  const partes = texto.trim().split(":");
  if (partes.length < 1 || partes.length > 2) return null;
  const a = parsearRef(partes[0]);
  const b = partes.length === 2 ? parsearRef(partes[1]) : a;
  if (!a || !b) return null;
  return { f1: Math.min(a.f, b.f), c1: Math.min(a.c, b.c), f2: Math.max(a.f, b.f), c2: Math.max(a.c, b.c) };
}
