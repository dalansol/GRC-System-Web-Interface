import { describe, expect, it } from "vitest";
import { buscarEnLibro, coincidenciaDesde } from "./buscar";
import { aplicarSugerencia, partesFirma, sugerirFormula } from "./funciones";
import { escribir } from "./operaciones";
import { hojaVacia, type Libro } from "./tipos";

describe("sugerencias de fórmula", () => {
  it("lista funciones por prefijo en español o inglés", () => {
    const s = sugerirFormula("=su", 3);
    expect(s?.tipo).toBe("funciones");
    if (s?.tipo !== "funciones") return;
    expect(s.lista.map((f) => f.nombre)).toEqual(["SUMA", "SUMAR.SI"]);
    expect(s.inicio).toBe(1);
    expect(aplicarSugerencia("=su", s, s.lista[0], 3)).toEqual({ texto: "=SUMA(", cursor: 6 });
  });

  it("muestra la firma y el argumento actual dentro de los paréntesis", () => {
    const s = sugerirFormula("=SI(A1>0;SUMA(B1:B3", 20);
    expect(s).toMatchObject({ tipo: "firma", argumento: 0 });
    if (s?.tipo !== "firma") return;
    expect(s.funcion.nombre).toBe("SUMA");
    const t = "=SI(A1>0;10;";
    expect(sugerirFormula(t, t.length)).toMatchObject({ tipo: "firma", argumento: 2 });
    expect(partesFirma("SI(prueba_lógica; [valor_si_verdadero]; [valor_si_falso])").argumentos).toHaveLength(3);
  });

  it("no sugiere en referencias, textos entre comillas ni fuera de fórmulas", () => {
    expect(sugerirFormula("=A1", 3)).toBeNull();
    expect(sugerirFormula('=CONCAT("su', 11)).toMatchObject({ tipo: "firma" });
    expect(sugerirFormula("suma", 4)).toBeNull();
    expect(sugerirFormula("=SUMA(A1:A3)+pro", 16)?.tipo).toBe("funciones");
  });
});

describe("buscar en el libro", () => {
  it("encuentra por texto visible o fórmula, sin acentos, empezando por la hoja activa", () => {
    let libro: Libro = { hojas: [hojaVacia("Uno"), hojaVacia("Dos")] };
    libro = escribir(libro, 0, 0, 0, "Nómina quincenal");
    libro = escribir(libro, 0, 2, 1, "=SUMA(A1:A2)");
    libro = escribir(libro, 1, 0, 0, "nomina");
    const mostrado = (h: number, f: number, c: number) => libro.hojas[h].celdas[`${f},${c}`]?.entrada ?? "";
    expect(buscarEnLibro(libro, 1, "nomina", mostrado)).toEqual([
      { hoja: 1, f: 0, c: 0 },
      { hoja: 0, f: 0, c: 0 },
    ]);
    const suma = buscarEnLibro(libro, 0, "suma", mostrado);
    expect(suma).toEqual([{ hoja: 0, f: 2, c: 1 }]);
    expect(coincidenciaDesde([{ hoja: 0, f: 0, c: 0 }, { hoja: 0, f: 2, c: 1 }], 0, 0, 0)).toBe(1);
    expect(coincidenciaDesde([{ hoja: 0, f: 0, c: 0 }], 0, 5, 0)).toBe(0);
  });
});
