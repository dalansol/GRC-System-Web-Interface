import type { Libro } from "./tipos";

// Búsqueda de texto en el libro (Ctrl+F): compara con lo que se ve en la celda y con lo
// que se escribió (así se encuentran fórmulas por su texto), sin distinguir mayúsculas
// ni acentos.

export interface Coincidencia {
  hoja: number;
  f: number;
  c: number;
}

export function normalizarBusqueda(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Coincidencias en orden de lectura (fila a fila) empezando por la hoja activa y
 * siguiendo con las demás.
 */
export function buscarEnLibro(libro: Libro, hojaActiva: number, texto: string, mostrado: (hoja: number, f: number, c: number) => string): Coincidencia[] {
  const aguja = normalizarBusqueda(texto.trim());
  if (!aguja) return [];
  const resultado: Coincidencia[] = [];
  const orden = libro.hojas.map((_, i) => (i + hojaActiva) % libro.hojas.length);
  for (const idx of orden) {
    const hoja = libro.hojas[idx];
    const celdas = Object.entries(hoja.celdas)
      .filter(([, celda]) => celda.entrada !== "")
      .map(([k]) => k.split(",").map(Number) as [number, number])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    for (const [f, c] of celdas) {
      const entrada = hoja.celdas[`${f},${c}`].entrada;
      if (normalizarBusqueda(entrada).includes(aguja) || normalizarBusqueda(mostrado(idx, f, c)).includes(aguja)) {
        resultado.push({ hoja: idx, f, c });
      }
    }
  }
  return resultado;
}

/** Índice de la primera coincidencia en o después de la celda activa (para Enter). */
export function coincidenciaDesde(lista: Coincidencia[], hoja: number, f: number, c: number): number {
  const i = lista.findIndex((m) => m.hoja === hoja && (m.f > f || (m.f === f && m.c > c)));
  return i === -1 ? 0 : i;
}
