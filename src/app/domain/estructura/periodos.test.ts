import { describe, expect, it } from "vitest";
import type { PeriodoFiscal } from "../../api/estructura";
import { altaDePeriodo, anioInicial, compararPeriodos, periodoRegistrado, periodosDelAnio } from "./periodos";

const periodo = (id: number, nombre: string, fechaInicio: string, fechaFin: string, activo = false): PeriodoFiscal => ({
  id,
  nombre,
  fechaInicio,
  fechaFin,
  activo,
});

describe("periodosDelAnio", () => {
  it("divide el año en cuatro trimestres más el año fiscal, con el formato '2027 Q1' y '2027 Fiscal'", () => {
    expect(periodosDelAnio(2027)).toEqual([
      { clave: "Q1", nombre: "2027 Q1", fechaInicio: "2027-01-01", fechaFin: "2027-03-31" },
      { clave: "Q2", nombre: "2027 Q2", fechaInicio: "2027-04-01", fechaFin: "2027-06-30" },
      { clave: "Q3", nombre: "2027 Q3", fechaInicio: "2027-07-01", fechaFin: "2027-09-30" },
      { clave: "Q4", nombre: "2027 Q4", fechaInicio: "2027-10-01", fechaFin: "2027-12-31" },
      { clave: "Fiscal", nombre: "2027 Fiscal", fechaInicio: "2027-01-01", fechaFin: "2027-12-31" },
    ]);
  });

  it("arma los datos de alta con el nombre y las fechas del periodo", () => {
    expect(altaDePeriodo(periodosDelAnio(2028)[4]!, true)).toEqual({
      nombre: "2028 Fiscal",
      fechaInicio: "2028-01-01",
      fechaFin: "2028-12-31",
      activo: true,
    });
  });
});

describe("periodoRegistrado", () => {
  it("encuentra el periodo por fechas, aunque tenga otro nombre", () => {
    const registrados = [periodo(1, "2026Q1", "2026-01-01", "2026-03-31")];
    const [q1, q2] = periodosDelAnio(2026);
    expect(periodoRegistrado(registrados, q1!)?.id).toBe(1);
    expect(periodoRegistrado(registrados, q2!)).toBeUndefined();
  });
});

describe("anioInicial", () => {
  it("usa el año del periodo activo o, sin él, el año actual", () => {
    expect(anioInicial(periodo(1, "2026 Q4", "2026-10-01", "2026-12-31", true))).toBe(2026);
    expect(anioInicial(null, new Date(2030, 5, 1))).toBe(2030);
  });
});

describe("compararPeriodos", () => {
  it("ordena por año, los trimestres en orden y el año fiscal al final de su año", () => {
    const lista = [
      periodo(1, "2027 Q1", "2027-01-01", "2027-03-31"),
      periodo(2, "2026 Fiscal", "2026-01-01", "2026-12-31"),
      periodo(3, "2026 Q4", "2026-10-01", "2026-12-31"),
      periodo(4, "2026 Q1", "2026-01-01", "2026-03-31"),
    ];
    expect([...lista].sort(compararPeriodos).map((p) => p.nombre)).toEqual(["2026 Q1", "2026 Q4", "2026 Fiscal", "2027 Q1"]);
  });
});
