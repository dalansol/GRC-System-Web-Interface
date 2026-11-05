import { describe, expect, it } from "vitest";
import { estadoInicial, haySinGuardar, reducirHoja, type AccionHoja, type EstadoHoja } from "./estadoHoja";
import { escribir } from "./operaciones";
import { claveCelda, hojaVacia, type Libro } from "./tipos";

const libro = (): Libro => ({ hojas: [hojaVacia("Hoja1"), hojaVacia("Hoja2")] });
const correr = (e: EstadoHoja, ...acciones: AccionHoja[]) => acciones.reduce(reducirHoja, e);
const entrada = (e: EstadoHoja, f: number, c: number, h = 0) => e.libro.hojas[h].celdas[claveCelda(f, c)]?.entrada;

describe("estado del editor", () => {
  it("escribir y Enter confirma y baja una fila", () => {
    const e = correr(
      estadoInicial(libro()),
      { tipo: "iniciarEdicion", modo: "escribir", texto: "=suma(1,2" },
      { tipo: "confirmarEdicion", df: 1, dc: 0 },
    );
    expect(entrada(e, 0, 0)).toBe("=SUMA(1,2)");
    expect(e.sel.activa).toEqual({ f: 1, c: 0 });
    expect(haySinGuardar(e)).toBe(true);
  });

  it("deshacer y rehacer restauran el libro y la selección", () => {
    let e = correr(estadoInicial(libro()), { tipo: "iniciarEdicion", modo: "escribir", texto: "1" }, { tipo: "confirmarEdicion", df: 1, dc: 0 });
    e = reducirHoja(e, { tipo: "deshacer" });
    expect(entrada(e, 0, 0)).toBeUndefined();
    expect(e.sel.activa).toEqual({ f: 0, c: 0 });
    expect(haySinGuardar(e)).toBe(false);
    e = reducirHoja(e, { tipo: "rehacer" });
    expect(entrada(e, 0, 0)).toBe("1");
  });

  it("Escape cancela sin cambiar nada", () => {
    const e = correr(estadoInicial(libro()), { tipo: "iniciarEdicion", modo: "escribir", texto: "x" }, { tipo: "cancelarEdicion" });
    expect(entrada(e, 0, 0)).toBeUndefined();
    expect(e.pasado).toHaveLength(0);
  });

  it("modo señalar inserta referencias con flechas y Mayús+flechas", () => {
    let e = correr(estadoInicial(libro()), { tipo: "seleccionar", pos: { f: 3, c: 0 } }, { tipo: "iniciarEdicion", modo: "escribir", texto: "=SUMA(" });
    e = correr(e, { tipo: "senalarMover", df: -3, dc: 0 }, { tipo: "senalarMover", df: 2, dc: 0, extender: true });
    expect(e.edicion?.texto).toBe("=SUMA(A1:A3");
    e = reducirHoja(e, { tipo: "confirmarEdicion", df: 1, dc: 0 });
    expect(entrada(e, 3, 0)).toBe("=SUMA(A1:A3)");
  });

  it("señalar en otra hoja agrega el prefijo y vuelve a la hoja original", () => {
    let e = correr(estadoInicial(libro()), { tipo: "iniciarEdicion", modo: "escribir", texto: "=" }, { tipo: "cambiarHoja", idx: 1 });
    expect(e.hojaActiva).toBe(1);
    e = correr(e, { tipo: "senalar", pos: { f: 1, c: 1 } }, { tipo: "confirmarEdicion", df: 0, dc: 0 });
    expect(e.hojaActiva).toBe(0);
    expect(entrada(e, 0, 0)).toBe("=Hoja2!B2");
  });

  it("Ctrl+Enter llena el rango desplazando la fórmula", () => {
    const e = correr(
      estadoInicial(libro()),
      { tipo: "seleccionarRango", activa: { f: 0, c: 1 }, extremo: { f: 2, c: 1 } },
      { tipo: "iniciarEdicion", modo: "escribir", texto: "=A1*2" },
      { tipo: "confirmarEdicion", df: 0, dc: 0, enRango: true },
    );
    expect([0, 1, 2].map((f) => entrada(e, f, 1))).toEqual(["=A1*2", "=A2*2", "=A3*2"]);
  });

  it("Enter dentro de una selección recorre el rango", () => {
    const e = correr(
      estadoInicial(libro()),
      { tipo: "seleccionarRango", activa: { f: 0, c: 0 }, extremo: { f: 1, c: 1 } },
      { tipo: "confirmarEdicion", df: 1, dc: 0 },
      { tipo: "confirmarEdicion", df: 1, dc: 0 },
    );
    expect(e.sel.activa).toEqual({ f: 0, c: 1 });
    expect(e.sel.extremo).toEqual({ f: 1, c: 1 });
  });

  it("Ctrl+flecha y Mayús extienden hasta el borde de los datos", () => {
    let l = libro();
    [0, 1, 2].forEach((f) => (l = escribir(l, 0, f, 0, "x")));
    const e = reducirHoja(estadoInicial(l), { tipo: "mover", df: 1, dc: 0, salto: true, extender: true });
    expect(e.sel).toEqual({ activa: { f: 0, c: 0 }, ancla: { f: 0, c: 0 }, extremo: { f: 2, c: 0 } });
  });

  it("solo lectura no permite editar", () => {
    const e = reducirHoja(estadoInicial(libro(), true), { tipo: "iniciarEdicion", modo: "escribir", texto: "x" });
    expect(e.edicion).toBeNull();
  });
});
