import { describe, expect, it } from "vitest";
import { ajustarCombinadas, ajustarSeleccion, combinarPierdeDatos, expandirRango } from "./combinadas";
import { estadoInicial, reducirHoja, type AccionHoja, type EstadoHoja } from "./estadoHoja";
import { cambiarEstructura, combinarCeldas, escribir, limpiarRango, separarCeldas } from "./operaciones";
import { claveCelda, hojaVacia, type Libro } from "./tipos";

const base = (): Libro => {
  let l: Libro = { hojas: [hojaVacia("Hoja1")] };
  l = escribir(l, 0, 0, 0, "Título");
  l = escribir(l, 0, 0, 1, "se pierde");
  l = escribir(l, 0, 1, 0, "a");
  l = escribir(l, 0, 1, 1, "b");
  return l;
};
const correr = (e: EstadoHoja, ...acciones: AccionHoja[]) => acciones.reduce(reducirHoja, e);

describe("celdas combinadas", () => {
  it("combinar conserva solo la celda superior izquierda y puede centrarla", () => {
    const r = { f1: 0, c1: 0, f2: 0, c2: 2 };
    expect(combinarPierdeDatos(base().hojas[0], [r])).toBe(true);
    const l = combinarCeldas(base(), 0, r, "todo", true);
    const h = l.hojas[0];
    expect(h.combinadas).toEqual([r]);
    expect(h.celdas[claveCelda(0, 0)]).toEqual({ entrada: "Título", estilo: { alineacion: "centro" } });
    expect(h.celdas[claveCelda(0, 1)]).toBeUndefined();
    expect(h.celdas[claveCelda(1, 0)]?.entrada).toBe("a");
  });

  it("combinar horizontalmente crea una combinación por fila y sustituye las que toca", () => {
    let l = combinarCeldas(base(), 0, { f1: 0, c1: 0, f2: 1, c2: 1 }, "todo");
    l = combinarCeldas(l, 0, { f1: 0, c1: 0, f2: 1, c2: 2 }, "horizontal");
    expect(l.hojas[0].combinadas).toEqual([
      { f1: 0, f2: 0, c1: 0, c2: 2 },
      { f1: 1, f2: 1, c1: 0, c2: 2 },
    ]);
    // Una sola celda o una sola columna en horizontal no combinan nada.
    const l0 = base();
    expect(combinarCeldas(l0, 0, { f1: 0, c1: 0, f2: 0, c2: 0 }, "todo")).toBe(l0);
    expect(combinarCeldas(l0, 0, { f1: 0, c1: 0, f2: 3, c2: 0 }, "horizontal")).toBe(l0);
  });

  it("separar quita las combinaciones que toca y Borrar todo también", () => {
    const l = combinarCeldas(base(), 0, { f1: 0, c1: 0, f2: 0, c2: 2 }, "todo");
    expect(separarCeldas(l, 0, { f1: 0, c1: 2, f2: 0, c2: 2 }).hojas[0].combinadas).toEqual([]);
    expect(separarCeldas(l, 0, { f1: 5, c1: 5, f2: 5, c2: 5 }).hojas[0]).toBe(l.hojas[0]);
    expect(limpiarRango(l, 0, { f1: 0, c1: 1, f2: 0, c2: 1 }, true).hojas[0].combinadas).toEqual([]);
    expect(limpiarRango(l, 0, { f1: 0, c1: 1, f2: 0, c2: 1 }).hojas[0].combinadas).toHaveLength(1);
  });

  it("la selección abarca la combinación completa y la activa es la principal", () => {
    const l = combinarCeldas(base(), 0, { f1: 0, c1: 1, f2: 1, c2: 2 }, "todo");
    const h = l.hojas[0];
    expect(expandirRango(h, { f1: 1, c1: 2, f2: 3, c2: 2 })).toEqual({ f1: 0, c1: 1, f2: 3, c2: 2 });
    const sel = ajustarSeleccion(h, { activa: { f: 1, c: 2 }, ancla: { f: 1, c: 2 }, extremo: { f: 1, c: 2 } });
    expect(sel).toEqual({ activa: { f: 0, c: 1 }, ancla: { f: 0, c: 1 }, extremo: { f: 1, c: 2 } });

    // Flechas: desde A1, derecha entra a la combinación (B1:C2) y otra vez derecha sale a D1.
    let e = correr(estadoInicial(l), { tipo: "mover", df: 0, dc: 1 });
    expect(e.sel).toEqual({ activa: { f: 0, c: 1 }, ancla: { f: 0, c: 1 }, extremo: { f: 1, c: 2 } });
    e = reducirHoja(e, { tipo: "mover", df: 0, dc: 1 });
    expect(e.sel.activa).toEqual({ f: 0, c: 3 });
    // Enter dentro de un rango salta las celdas tapadas.
    e = correr(estadoInicial(l), { tipo: "seleccionarRango", activa: { f: 0, c: 0 }, extremo: { f: 1, c: 2 } }, { tipo: "confirmarEdicion", df: 1, dc: 0 }, { tipo: "confirmarEdicion", df: 1, dc: 0 });
    expect(e.sel.activa).toEqual({ f: 0, c: 1 });
    e = reducirHoja(e, { tipo: "confirmarEdicion", df: 1, dc: 0 });
    expect(e.sel.activa).toEqual({ f: 0, c: 0 });
  });

  it("insertar y eliminar filas o columnas reubican las combinaciones", () => {
    const m = [{ f1: 2, c1: 1, f2: 4, c2: 3 }];
    expect(ajustarCombinadas(m, "fila", 0, 2)).toEqual([{ f1: 4, c1: 1, f2: 6, c2: 3 }]);
    expect(ajustarCombinadas(m, "fila", 3, 1)).toEqual([{ f1: 2, c1: 1, f2: 5, c2: 3 }]);
    expect(ajustarCombinadas(m, "columna", 2, -1)).toEqual([{ f1: 2, c1: 1, f2: 4, c2: 2 }]);
    expect(ajustarCombinadas(m, "fila", 0, -1)).toEqual([{ f1: 1, c1: 1, f2: 3, c2: 3 }]);
    expect(ajustarCombinadas(m, "fila", 1, -5)).toEqual([]);
    expect(ajustarCombinadas([{ f1: 0, c1: 0, f2: 0, c2: 1 }], "columna", 1, -1)).toEqual([]);
    const l = cambiarEstructura(combinarCeldas(base(), 0, { f1: 0, c1: 0, f2: 0, c2: 2 }, "todo"), 0, "fila", 0, 1);
    expect(l.hojas[0].combinadas).toEqual([{ f1: 1, c1: 0, f2: 1, c2: 2 }]);
  });
});
