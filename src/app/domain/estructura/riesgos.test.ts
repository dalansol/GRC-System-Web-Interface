import { describe, expect, it } from "vitest";
import type { Riesgo, UnidadNegocio } from "../../api/estructura";
import { filtrarUnidades, nivelMaximo, riesgosDeNodo } from "./riesgos";

const riesgo = (id: number, nombre: string, nivel: Riesgo["nivel"]): Riesgo => ({
  id,
  nombre,
  nivel,
  procedimientoControl: null,
});

const unidad = (id: number, nombre: string, subdivisiones: Array<[string, Riesgo[], string[]]>): UnidadNegocio => ({
  id,
  nombre,
  responsableId: 1,
  responsableNombre: "María García",
  periodoFiscalId: 1,
  periodoFiscalNombre: "2026Q4",
  departamentoAuditoriaId: null,
  departamentoAuditoriaNombre: null,
  creadoPor: 1,
  creadoEn: "2026-10-01T00:00:00Z",
  divisiones: [
    {
      id: id * 10,
      nombre: `DIVISION-${id}`,
      unidadNegocioId: id,
      subdivisiones: subdivisiones.map(([nombreSub, riesgos, areas], i) => ({
        id: id * 100 + i,
        nombre: nombreSub,
        pais: null,
        divisionId: id * 10,
        riesgos,
        areas: areas.map((a, j) => ({ id: id * 1000 + i * 10 + j, nombre: a, subdivisionId: id * 100 + i })),
      })),
    },
  ],
});

const RETAIL = unidad(1, "UDN-0001", [
  ["SUBDIVISION-A", [riesgo(1, "Nómina sin doble aprobación", "Alto"), riesgo(2, "Proveedores", "Bajo")], ["Nómina"]],
  ["SUBDIVISION-B", [], ["Compras"]],
]);
const BEBIDAS = unidad(2, "UDN-0003", [["SUBDIVISION-C", [riesgo(3, "Inventario en CEDIS", "Crítico")], ["Inventarios"]]]);

describe("nivelMaximo", () => {
  it("devuelve el peor nivel e ignora los riesgos sin nivel", () => {
    expect(nivelMaximo([riesgo(1, "a", "Bajo"), riesgo(2, "b", null), riesgo(3, "c", "Alto")])).toBe("Alto");
    expect(nivelMaximo([riesgo(1, "a", null)])).toBeNull();
    expect(nivelMaximo([])).toBeNull();
  });
});

describe("riesgosDeNodo", () => {
  it("suma los riesgos de toda la rama", () => {
    expect(riesgosDeNodo(RETAIL)).toHaveLength(2);
    expect(riesgosDeNodo(RETAIL.divisiones[0]!)).toHaveLength(2);
    expect(riesgosDeNodo(RETAIL.divisiones[0]!.subdivisiones[1]!)).toHaveLength(0);
  });
});

describe("filtrarUnidades", () => {
  const UNIDADES = [RETAIL, BEBIDAS];

  it("sin filtro devuelve el árbol intacto", () => {
    expect(filtrarUnidades(UNIDADES, { texto: "", nivel: null })).toBe(UNIDADES);
  });

  it("por nivel conserva solo las subdivisiones con un riesgo de ese nivel o peor", () => {
    const criticas = filtrarUnidades(UNIDADES, { texto: "", nivel: "Crítico" });
    expect(criticas.map((u) => u.nombre)).toEqual(["UDN-0003"]);

    const altas = filtrarUnidades(UNIDADES, { texto: "", nivel: "Alto" });
    expect(altas.map((u) => u.nombre)).toEqual(["UDN-0001", "UDN-0003"]);
    expect(altas[0]!.divisiones[0]!.subdivisiones.map((s) => s.nombre)).toEqual(["SUBDIVISION-A"]);
  });

  it("por texto busca en áreas y riesgos sin importar acentos ni mayúsculas", () => {
    const porArea = filtrarUnidades(UNIDADES, { texto: "nomina", nivel: null });
    expect(porArea.map((u) => u.nombre)).toEqual(["UDN-0001"]);
    expect(porArea[0]!.divisiones[0]!.subdivisiones[0]!.areas.map((a) => a.nombre)).toEqual(["Nómina"]);

    const porRiesgo = filtrarUnidades(UNIDADES, { texto: "CEDIS", nivel: null });
    expect(porRiesgo.map((u) => u.nombre)).toEqual(["UDN-0003"]);
  });

  it("si coincide la unidad, conserva toda su rama", () => {
    const res = filtrarUnidades(UNIDADES, { texto: "udn-0001", nivel: null });
    expect(res).toHaveLength(1);
    expect(res[0]!.divisiones[0]!.subdivisiones).toHaveLength(2);
  });
});
