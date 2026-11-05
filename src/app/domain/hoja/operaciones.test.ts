import { describe, expect, it } from "vitest";
import { Calculadora } from "./calculo";
import { formatearValor } from "./formato";
import {
  cambiarEstructura,
  copiarBloque,
  escribir,
  ordenarRango,
  pegarBloque,
  pegarTexto,
  rellenar,
  renombrarHoja,
  saltoCtrl,
  validarNombreHoja,
} from "./operaciones";
import { aTsv, desdeTsv } from "./portapapeles";
import { ajustarPorEstructura, desplazarFormula, formulaAEspanol, formulaAIngles } from "./reescritura";
import { claveCelda, hojaVacia, type Libro } from "./tipos";

const entrada = (libro: Libro, f: number, c: number, h = 0) => libro.hojas[h].celdas[claveCelda(f, c)]?.entrada;

describe("reescritura de fórmulas", () => {
  it("desplaza referencias relativas y respeta las absolutas", () => {
    expect(desplazarFormula("=A1+$B$1+C$2+$D3", 2, 1)).toBe("=B3+$B$1+D$2+$D5");
    expect(desplazarFormula("=SUMA(A1:A3)", 0, 1)).toBe("=SUMA(B1:B3)");
    expect(desplazarFormula("=A1", -1, 0)).toBe("=#¡REF!");
  });

  it("traduce entre español e inglés", () => {
    expect(formulaAIngles('=SI(SUMA(A1:A2)>0;"sí";FALSO)')).toBe('IF(SUM(A1:A2)>0,"sí",FALSE)');
    expect(formulaAEspanol("IFERROR(AVERAGE(B2:B9),#DIV/0!)")).toBe("=SI.ERROR(PROMEDIO(B2:B9),#¡DIV/0!)");
    expect(formulaAEspanol("_xlfn.CONCAT(A1,B1)")).toBe("=CONCAT(A1,B1)");
  });

  it("ajusta referencias al insertar y eliminar filas", () => {
    const ins = { hoja: "Hoja1", eje: "fila" as const, en: 2, cantidad: 1 };
    expect(ajustarPorEstructura("=A1+A3+SUMA(A2:A5)", "Hoja1", ins)).toBe("=A1+A4+SUMA(A2:A6)");
    const del = { hoja: "Hoja1", eje: "fila" as const, en: 2, cantidad: -1 };
    expect(ajustarPorEstructura("=A3+A4+SUMA(A1:A5)", "Hoja1", del)).toBe("=#¡REF!+A3+SUMA(A1:A4)");
    // Otra hoja no se toca, salvo que la fórmula la nombre.
    expect(ajustarPorEstructura("=A5", "Otra", ins)).toBe("=A5");
    expect(ajustarPorEstructura("=Hoja1!A5", "Otra", ins)).toBe("=Hoja1!A6");
  });
});

describe("operaciones del libro", () => {
  const base = (): Libro => {
    let l: Libro = { hojas: [hojaVacia("Hoja1"), hojaVacia("Hoja2")] };
    l = escribir(l, 0, 0, 0, "1");
    l = escribir(l, 0, 1, 0, "2");
    l = escribir(l, 0, 0, 1, "=A1*10");
    return l;
  };

  it("pegar un bloque desplaza fórmulas y lo repite si el destino es múltiplo", () => {
    const l = base();
    const bloque = copiarBloque(l.hojas[0], { f1: 0, c1: 1, f2: 0, c2: 1 });
    const { libro, rango } = pegarBloque(l, 0, { f1: 1, c1: 1, f2: 3, c2: 1 }, bloque);
    expect(rango).toEqual({ f1: 1, c1: 1, f2: 3, c2: 1 });
    expect(entrada(libro, 1, 1)).toBe("=A2*10");
    expect(entrada(libro, 3, 1)).toBe("=A4*10");
  });

  it("pegar texto de Excel escribe valores", () => {
    const { libro } = pegarTexto(base(), 0, 5, 0, desdeTsv("a\tb\r\n1\t2\r\n"));
    expect(entrada(libro, 5, 1)).toBe("b");
    expect(entrada(libro, 6, 0)).toBe("1");
  });

  it("el controlador de relleno continúa series y copia fórmulas", () => {
    let l = rellenar(base(), 0, { f1: 0, c1: 0, f2: 1, c2: 0 }, { f1: 0, c1: 0, f2: 4, c2: 0 });
    expect([2, 3, 4].map((f) => entrada(l, f, 0))).toEqual(["3", "4", "5"]);
    l = rellenar(l, 0, { f1: 0, c1: 1, f2: 0, c2: 1 }, { f1: 0, c1: 1, f2: 2, c2: 1 });
    expect(entrada(l, 2, 1)).toBe("=A3*10");
    l = escribir(l, 0, 0, 3, "Activo");
    l = rellenar(l, 0, { f1: 0, c1: 3, f2: 0, c2: 3 }, { f1: 0, c1: 3, f2: 1, c2: 3 });
    expect(entrada(l, 1, 3)).toBe("Activo");
  });

  it("insertar una fila mueve celdas y fórmulas", () => {
    const l = cambiarEstructura(base(), 0, "fila", 0, 1);
    expect(entrada(l, 1, 0)).toBe("1");
    expect(entrada(l, 1, 1)).toBe("=A2*10");
    expect(new Calculadora(l).valor(0, 1, 1)).toBe(10);
  });

  it("renombrar hoja actualiza las fórmulas que la nombran", () => {
    let l = escribir(base(), 1, 0, 0, "=Hoja1!A2");
    l = renombrarHoja(l, 0, "Datos 2025");
    expect(entrada(l, 0, 0, 1)).toBe("='Datos 2025'!A2");
    expect(new Calculadora(l).valor(1, 0, 0)).toBe(2);
    expect(validarNombreHoja(l, 1, "datos 2025")).toMatch(/Ya existe/);
    expect(validarNombreHoja(l, 1, "a/b")).not.toBeNull();
  });

  it("ordenar deja vacíos al final", () => {
    let l: Libro = { hojas: [hojaVacia("Hoja1")] };
    ["b", "", "a", "c"].forEach((v, f) => (l = escribir(l, 0, f, 0, v)));
    l = ordenarRango(l, 0, { f1: 0, c1: 0, f2: 3, c2: 0 }, 0, true);
    expect([0, 1, 2, 3].map((f) => entrada(l, f, 0))).toEqual(["a", "b", "c", undefined]);
  });

  it("Ctrl+flecha salta al borde de los datos", () => {
    let l: Libro = { hojas: [hojaVacia("Hoja1")] };
    [0, 1, 2, 6].forEach((f) => (l = escribir(l, 0, f, 0, "x")));
    const h = l.hojas[0];
    expect(saltoCtrl(h, 0, 0, 1, 0)).toEqual({ f: 2, c: 0 });
    expect(saltoCtrl(h, 2, 0, 1, 0)).toEqual({ f: 6, c: 0 });
    expect(saltoCtrl(h, 6, 0, 1, 0)).toEqual({ f: h.filas - 1, c: 0 });
  });
});

describe("portapapeles y formato", () => {
  it("TSV conserva tabulaciones, saltos y comillas", () => {
    const m = [["a\tb", 'di "hola"'], ["línea\n2", ""]];
    expect(desdeTsv(aTsv(m))).toEqual(m);
  });

  it("formatea como Excel es-MX", () => {
    expect(formatearValor(1234.5, { formato: "moneda" })).toBe("$1,234.50");
    expect(formatearValor(-5, { formato: "moneda", decimales: 0 })).toBe("-$5");
    expect(formatearValor(0.256, { formato: "porcentaje", decimales: 1 })).toBe("25.6%");
    expect(formatearValor(45809, { formato: "fecha" })).toBe("01/06/2025");
    expect(formatearValor(1 / 3, undefined)).toBe("0.3333333333");
    expect(formatearValor(true, undefined)).toBe("VERDADERO");
  });
});
