import { describe, expect, it } from "vitest";
import { Calculadora, interpretarEntrada } from "./calculo";
import { escribir } from "./operaciones";
import { indiceColumna, letraColumna, parsearRango, parsearRef } from "./referencias";
import { ErrorHoja, hojaVacia, type Libro } from "./tipos";

function libroCon(celdas: Record<string, string>, otras: Record<string, Record<string, string>> = {}): Libro {
  let libro: Libro = { hojas: [hojaVacia("Hoja1"), ...Object.keys(otras).map((n) => hojaVacia(n))] };
  const poner = (idx: number, mapa: Record<string, string>) => {
    for (const [ref, v] of Object.entries(mapa)) {
      const { f, c } = parsearRef(ref)!;
      libro = escribir(libro, idx, f, c, v);
    }
  };
  poner(0, celdas);
  Object.values(otras).forEach((mapa, i) => poner(i + 1, mapa));
  return libro;
}

function valor(libro: Libro, ref: string, hoja = 0) {
  const { f, c } = parsearRef(ref)!;
  const v = new Calculadora(libro).valor(hoja, f, c);
  return v instanceof ErrorHoja ? v.codigo : v;
}

describe("referencias", () => {
  it("convierte columnas más allá de Z", () => {
    expect(letraColumna(0)).toBe("A");
    expect(letraColumna(25)).toBe("Z");
    expect(letraColumna(26)).toBe("AA");
    expect(letraColumna(701)).toBe("ZZ");
    expect(indiceColumna("AB")).toBe(27);
  });

  it("lee referencias absolutas y rangos en cualquier orden", () => {
    expect(parsearRef("$B$12")).toEqual({ f: 11, c: 1, colAbs: true, filaAbs: true });
    expect(parsearRango("C5:A1")).toEqual({ f1: 0, c1: 0, f2: 4, c2: 2 });
    expect(parsearRango("hola")).toBeNull();
  });
});

describe("interpretarEntrada", () => {
  it("reconoce números con miles, moneda, porcentaje y fechas como Excel es-MX", () => {
    expect(interpretarEntrada("1,234.50")).toEqual({ valor: 1234.5, sugerido: { formato: "numero", decimales: 2 } });
    expect(interpretarEntrada("$1,200").valor).toBe(1200);
    expect(interpretarEntrada("15%").valor).toBeCloseTo(0.15);
    expect(interpretarEntrada("-42").valor).toBe(-42);
    expect(interpretarEntrada("01/06/2025")).toEqual({ valor: 45809, sugerido: { formato: "fecha" } });
    expect(interpretarEntrada("'00123").valor).toBe("00123");
    expect(interpretarEntrada("12,34").valor).toBe("12,34");
    expect(interpretarEntrada("verdadero").valor).toBe(true);
    // Entradas raras que antes rompían el análisis.
    expect(interpretarEntrada("\n").valor).toBe("\n");
    expect(interpretarEntrada("-").valor).toBe("-");
    expect(interpretarEntrada("$").valor).toBe("$");
    expect(interpretarEntrada("%").valor).toBe("%");
  });
});

describe("fórmulas", () => {
  it("calcula aritmética con la precedencia de Excel", () => {
    const libro = libroCon({ A1: "=2+3*4", A2: "=-2^2", A3: "=(1+2)*3", A4: "=50%", A5: '="a"&"b"&1' });
    expect(valor(libro, "A1")).toBe(14);
    expect(valor(libro, "A2")).toBe(4);
    expect(valor(libro, "A3")).toBe(9);
    expect(valor(libro, "A4")).toBe(0.5);
    expect(valor(libro, "A5")).toBe("ab1");
  });

  it("acepta funciones en español e inglés y separador , o ;", () => {
    const libro = libroCon({
      A1: "10", A2: "20", A3: "texto", A4: "30",
      B1: "=SUMA(A1:A4)", B2: "=SUM(A1:A4)", B3: "=PROMEDIO(A1:A4)", B4: "=CONTAR(A1:A4)",
      B5: "=CONTARA(A1:A4)", B6: '=SI(A1>5;"alto";"bajo")', B7: "=MAX(A1:A4)-MIN(A1:A4)",
      B8: "=REDONDEAR(2.345,2)", B9: '=SUMAR.SI(A1:A4,">15")', B10: "=Y(A1>0,A2>0)",
    });
    expect(valor(libro, "B1")).toBe(60);
    expect(valor(libro, "B2")).toBe(60);
    expect(valor(libro, "B3")).toBe(20);
    expect(valor(libro, "B4")).toBe(3);
    expect(valor(libro, "B5")).toBe(4);
    expect(valor(libro, "B6")).toBe("alto");
    expect(valor(libro, "B7")).toBe(20);
    expect(valor(libro, "B8")).toBe(2.35);
    expect(valor(libro, "B9")).toBe(50);
    expect(valor(libro, "B10")).toBe(true);
  });

  it("devuelve los errores de Excel", () => {
    const libro = libroCon({ A1: "=1/0", A2: "=NOEXISTE(1)", A3: '="a"+1', A4: "=Fantasma!A1", A5: "=SUMA(A1:A2", A6: "=SI.ERROR(A1,0)" });
    expect(valor(libro, "A1")).toBe("#¡DIV/0!");
    expect(valor(libro, "A2")).toBe("#¿NOMBRE?");
    expect(valor(libro, "A3")).toBe("#¡VALOR!");
    expect(valor(libro, "A4")).toBe("#¡REF!");
    expect(valor(libro, "A5")).toBe("#¿NOMBRE?");
    expect(valor(libro, "A6")).toBe(0);
  });

  it("propaga errores y detecta referencias circulares", () => {
    const libro = libroCon({ A1: "=B1+1", B1: "=A1+1", C1: "=1/0", D1: "=C1*2" });
    const calc = new Calculadora(libro);
    expect((calc.valor(0, 0, 0) as ErrorHoja).codigo).toBe("#¡REF!");
    expect(calc.circulares.size).toBeGreaterThan(0);
    expect(valor(libro, "D1")).toBe("#¡DIV/0!");
  });

  it("lee celdas de otras hojas, también con nombre entre comillas", () => {
    const libro = libroCon({ A1: "=Datos!B2*2", A2: "='Mi hoja'!A1+1" }, { Datos: { B2: "21" }, "Mi hoja": { A1: "4" } });
    expect(valor(libro, "A1")).toBe(42);
    expect(valor(libro, "A2")).toBe(5);
  });

  it("una referencia a celda vacía vale 0", () => {
    expect(valor(libroCon({ A1: "=Z99" }), "A1")).toBe(0);
  });
});
