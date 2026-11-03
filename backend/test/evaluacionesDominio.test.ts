import { describe, expect, it } from "vitest";
import {
  calcularEvaluacion,
  criteriosFaltantes,
  type Criterio,
  type RespuestaCriterio,
  validarRespuestas,
} from "../src/domain/evaluaciones.js";

const criterio = (id: number, tipo: Criterio["tipo"], obligatorio = true): Criterio => ({
  id,
  codigo: `${tipo === "diseno" ? "D" : "E"}${id}`,
  tipo,
  nombre: `Criterio ${id}`,
  obligatorio,
  orden: id,
});

const CRITERIOS = [criterio(1, "diseno"), criterio(2, "diseno"), criterio(3, "efectividad"), criterio(4, "efectividad")];

const respuestas = (...valores: number[]): RespuestaCriterio[] =>
  valores.map((valor, i) => ({ criterioId: i + 1, valor }));

describe("calcularEvaluacion", () => {
  it("promedia cada grupo y toma el menor como calificación", () => {
    const resultado = calcularEvaluacion(CRITERIOS, respuestas(5, 5, 4, 3));

    expect(resultado).toEqual({
      promedioDiseno: 5,
      promedioEfectividad: 3.5,
      calificacion: 3.5,
      resultado: "Parcialmente efectivo",
      deficiencia: false,
    });
  });

  it("un control bien diseñado que no opera queda Deficiente", () => {
    const resultado = calcularEvaluacion(CRITERIOS, respuestas(5, 5, 1, 1));

    expect(resultado.calificacion).toBe(1);
    expect(resultado.resultado).toBe("Deficiente");
    expect(resultado.deficiencia).toBe(true);
  });

  it.each([
    [[4, 4, 4, 4], 4, "Efectivo", false],
    [[3, 3, 3, 3], 3, "Parcialmente efectivo", false],
    [[3, 2, 5, 5], 2.5, "Deficiente", true],
  ])("con %j la calificación %d es %s", (valores, calificacion, estatus, deficiencia) => {
    const resultado = calcularEvaluacion(CRITERIOS, respuestas(...valores));

    expect(resultado.calificacion).toBe(calificacion);
    expect(resultado.resultado).toBe(estatus);
    expect(resultado.deficiencia).toBe(deficiencia);
  });

  it("redondea los promedios a dos decimales", () => {
    const tres = [criterio(1, "diseno"), criterio(2, "diseno"), criterio(3, "diseno"), criterio(4, "efectividad")];

    const resultado = calcularEvaluacion(tres, respuestas(5, 5, 4, 5));

    expect(resultado.promedioDiseno).toBe(4.67);
  });

  it("un criterio opcional sin responder no cuenta en el promedio", () => {
    const conOpcional = [...CRITERIOS, criterio(5, "diseno", false)];

    const resultado = calcularEvaluacion(conOpcional, respuestas(4, 4, 4, 4));

    expect(resultado.promedioDiseno).toBe(4);
  });
});

describe("criteriosFaltantes", () => {
  it("no devuelve nada si están todos los obligatorios", () => {
    expect(criteriosFaltantes(CRITERIOS, respuestas(1, 2, 3, 4))).toEqual([]);
  });

  it("señala el criterio obligatorio que falta", () => {
    const faltantes = criteriosFaltantes(CRITERIOS, respuestas(1, 2, 3));

    expect(faltantes.map((c) => c.id)).toEqual([4]);
  });

  it("no exige los criterios opcionales", () => {
    expect(criteriosFaltantes([...CRITERIOS, criterio(5, "diseno", false)], respuestas(1, 2, 3, 4))).toEqual([]);
  });

  it("si un grupo solo tiene opcionales, exige responder al menos uno para poder promediarlo", () => {
    const soloOpcionales = [criterio(1, "diseno"), criterio(2, "efectividad", false)];

    const faltantes = criteriosFaltantes(soloOpcionales, [{ criterioId: 1, valor: 3 }]);

    expect(faltantes.map((c) => c.id)).toEqual([2]);
  });
});

describe("validarRespuestas", () => {
  it("acepta respuestas enteras de 1 a 5", () => {
    expect(validarRespuestas(CRITERIOS, respuestas(1, 2, 4, 5))).toBeNull();
  });

  it.each([[0], [6], [2.5], ["3"], [null]])("rechaza el valor %j", (valor) => {
    expect(validarRespuestas(CRITERIOS, [{ criterioId: 1, valor }])).toMatch(/1 a 5/);
  });

  it("rechaza un cuerpo que no es una lista", () => {
    expect(validarRespuestas(CRITERIOS, "hola")).toMatch(/lista/);
  });

  it("rechaza un criterio que no existe", () => {
    expect(validarRespuestas(CRITERIOS, [{ criterioId: 99, valor: 3 }])).toMatch(/no existe/);
  });

  it("rechaza dos respuestas al mismo criterio", () => {
    const duplicadas = [
      { criterioId: 1, valor: 3 },
      { criterioId: 1, valor: 4 },
    ];

    expect(validarRespuestas(CRITERIOS, duplicadas)).toMatch(/más de una vez/);
  });
});
