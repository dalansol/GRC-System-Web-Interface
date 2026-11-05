import { claveCelda, dentroDeRango, normalizarRango, type Hoja, type Posicion, type Rango } from "./tipos";

// Celdas combinadas (Combinar y centrar, Combinar horizontalmente, Combinar celdas y
// Separar celdas). Como en Excel, un rango combinado se comporta como una sola celda:
// el contenido y el formato son los de la esquina superior izquierda ("celda principal").

export const AVISO_COMBINAR = "Al combinar celdas solo se conserva el valor de la celda superior izquierda; los demás se descartan.";

export function mismoRango(a: Rango, b: Rango): boolean {
  return a.f1 === b.f1 && a.c1 === b.c1 && a.f2 === b.f2 && a.c2 === b.c2;
}

export function seCruzan(a: Rango, b: Rango): boolean {
  return a.f1 <= b.f2 && a.f2 >= b.f1 && a.c1 <= b.c2 && a.c2 >= b.c1;
}

/** Rango combinado que contiene la celda, si lo hay. */
export function combinadaEn(hoja: Hoja, f: number, c: number): Rango | undefined {
  return hoja.combinadas.find((r) => dentroDeRango(r, f, c));
}

/** ¿La celda es parte de un rango combinado sin ser su esquina superior izquierda? */
export function esCeldaOculta(hoja: Hoja, f: number, c: number): boolean {
  const r = combinadaEn(hoja, f, c);
  return !!r && (r.f1 !== f || r.c1 !== c);
}

/** Celda que realmente se edita al estar sobre (f, c): la principal de su combinación. */
export function celdaPrincipal(hoja: Hoja, pos: Posicion): Posicion {
  const r = combinadaEn(hoja, pos.f, pos.c);
  return r ? { f: r.f1, c: r.c1 } : pos;
}

/** Crece el rango hasta abarcar completas todas las combinaciones que toca. */
export function expandirRango(hoja: Hoja, rango: Rango): Rango {
  let r = rango;
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const m of hoja.combinadas) {
      if (!seCruzan(r, m)) continue;
      const ampliado = { f1: Math.min(r.f1, m.f1), c1: Math.min(r.c1, m.c1), f2: Math.max(r.f2, m.f2), c2: Math.max(r.c2, m.c2) };
      if (!mismoRango(ampliado, r)) {
        r = ampliado;
        cambio = true;
      }
    }
  }
  return r;
}

/**
 * Ajusta una selección para que respete las combinaciones: el rango abarca cada
 * combinación completa y la celda activa es la principal. Conserva de qué lado está el ancla.
 */
export function ajustarSeleccion<S extends { activa: Posicion; ancla: Posicion; extremo: Posicion }>(hoja: Hoja, sel: S): S {
  if (!hoja.combinadas.length) return sel;
  const actual = normalizarRango(sel.ancla, sel.extremo);
  const r = expandirRango(hoja, actual);
  const activa = celdaPrincipal(hoja, sel.activa);
  if (mismoRango(r, actual) && activa.f === sel.activa.f && activa.c === sel.activa.c) return sel;
  const anclaArriba = sel.ancla.f <= sel.extremo.f;
  const anclaIzquierda = sel.ancla.c <= sel.extremo.c;
  return {
    ...sel,
    activa,
    ancla: { f: anclaArriba ? r.f1 : r.f2, c: anclaIzquierda ? r.c1 : r.c2 },
    extremo: { f: anclaArriba ? r.f2 : r.f1, c: anclaIzquierda ? r.c2 : r.c1 },
  };
}

/** Rangos que se combinarán: uno solo, o uno por fila (Combinar horizontalmente). */
export function rangosACombinar(r: Rango, modo: "todo" | "horizontal"): Rango[] {
  if (modo === "todo") return r.f1 === r.f2 && r.c1 === r.c2 ? [] : [r];
  if (r.c1 === r.c2) return [];
  const lista: Rango[] = [];
  for (let f = r.f1; f <= r.f2; f++) lista.push({ f1: f, f2: f, c1: r.c1, c2: r.c2 });
  return lista;
}

/** ¿Alguna celda del rango, fuera de la principal, tiene contenido que se perdería? */
export function combinarPierdeDatos(hoja: Hoja, rangos: Rango[]): boolean {
  return rangos.some((r) => {
    for (let f = r.f1; f <= r.f2; f++) {
      for (let c = r.c1; c <= r.c2; c++) {
        if (f === r.f1 && c === r.c1) continue;
        if (hoja.celdas[claveCelda(f, c)]?.entrada) return true;
      }
    }
    return false;
  });
}

/**
 * Reubica las combinaciones al insertar (`cantidad` > 0) o eliminar (`cantidad` < 0)
 * filas o columnas en `en`. Insertar dentro de una combinación la agranda; eliminar la
 * recorta, y si queda en una sola celda desaparece.
 */
export function ajustarCombinadas(combinadas: Rango[], eje: "fila" | "columna", en: number, cantidad: number): Rango[] {
  const resultado: Rango[] = [];
  for (const m of combinadas) {
    let i1 = eje === "fila" ? m.f1 : m.c1;
    let i2 = eje === "fila" ? m.f2 : m.c2;
    if (cantidad > 0) {
      if (i1 >= en) i1 += cantidad;
      if (i2 >= en) i2 += cantidad;
    } else {
      const fin = en - cantidad - 1;
      if (i1 > fin) {
        i1 += cantidad;
        i2 += cantidad;
      } else if (i2 >= en) {
        i1 = Math.min(i1, en);
        i2 = i2 > fin ? i2 + cantidad : en - 1;
      }
    }
    if (i2 < i1) continue;
    const nuevo = eje === "fila" ? { ...m, f1: i1, f2: i2 } : { ...m, c1: i1, c2: i2 };
    if (nuevo.f1 === nuevo.f2 && nuevo.c1 === nuevo.c2) continue;
    resultado.push(nuevo);
  }
  return resultado;
}
