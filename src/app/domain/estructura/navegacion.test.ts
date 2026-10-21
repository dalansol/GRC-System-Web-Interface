import { describe, expect, it } from "vitest";
import type { UnidadNegocio } from "../../api/estructura";
import { resolverRuta, resumenHijos } from "./navegacion";

const UNIDAD: UnidadNegocio = {
  id: 1,
  nombre: "UDN-0001",
  nombreReal: null,
  responsableId: 2,
  responsableNombre: "María García",
  periodoFiscalId: 1,
  periodoFiscalNombre: "2026Q4",
  departamentoAuditoriaId: null,
  departamentoAuditoriaNombre: null,
  creadoPor: 1,
  creadoEn: "2026-10-01T00:00:00Z",
  divisiones: [
    {
      id: 10,
      nombre: "DIVISION-0001",
      nombreReal: null,
      unidadNegocioId: 1,
      subdivisiones: [
        {
          id: 100,
          nombre: "SUBDIVISION-0001",
          nombreReal: null,
          pais: "México",
          divisionId: 10,
          riesgos: [],
          areas: [
            { id: 1000, nombre: "Nómina", subdivisionId: 100 },
            { id: 1001, nombre: "Compras", subdivisionId: 100 },
          ],
        },
        { id: 101, nombre: "SUBDIVISION-0002", nombreReal: null, pais: null, divisionId: 10, riesgos: [], areas: [] },
      ],
    },
  ],
};

describe("resolverRuta", () => {
  it("resuelve cada nivel de la ruta", () => {
    expect(resolverRuta([UNIDAD], { unidadId: 1 })).toEqual({ unidad: UNIDAD });
    expect(resolverRuta([UNIDAD], { unidadId: 1, divisionId: 10 })?.division?.nombre).toBe("DIVISION-0001");
    const completa = resolverRuta([UNIDAD], { unidadId: 1, divisionId: 10, subdivisionId: 101 });
    expect(completa?.subdivision?.nombre).toBe("SUBDIVISION-0002");
  });

  it("si un nodo ya no existe, cae al ancestro más profundo que siga vivo", () => {
    const sinSubdivision = resolverRuta([UNIDAD], { unidadId: 1, divisionId: 10, subdivisionId: 999 });
    expect(sinSubdivision?.division?.id).toBe(10);
    expect(sinSubdivision?.subdivision).toBeUndefined();

    const sinDivision = resolverRuta([UNIDAD], { unidadId: 1, divisionId: 999, subdivisionId: 100 });
    expect(sinDivision).toEqual({ unidad: UNIDAD });
  });

  it("devuelve null sin ruta o si la unidad ya no existe", () => {
    expect(resolverRuta([UNIDAD], null)).toBeNull();
    expect(resolverRuta([UNIDAD], { unidadId: 2 })).toBeNull();
  });
});

describe("resumenHijos", () => {
  it("cuenta subdivisiones y áreas de una división, y áreas de una subdivisión", () => {
    const division = UNIDAD.divisiones[0]!;
    expect(resumenHijos(division)).toBe("2 subdivisiones · 2 áreas");
    expect(resumenHijos(division.subdivisiones[0]!)).toBe("2 áreas");
    expect(resumenHijos(division.subdivisiones[1]!)).toBe("0 áreas");
  });
});
