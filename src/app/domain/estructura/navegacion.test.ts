import { describe, expect, it } from "vitest";
import type { UnidadNegocio } from "../../api/estructura";
import { clavesAncestros, conteosRama, dependientesDe, resolverRuta, resumenHijos } from "./navegacion";

const UNIDAD: UnidadNegocio = {
  id: 1,
  codigo: "UDN-0001",
  nombre: null,
  responsableId: 2,
  responsableNombre: "María García",
  periodoFiscalId: 1,
  periodoFiscalNombre: "2026 Q4",
  departamentoAuditoriaId: null,
  departamentoAuditoriaNombre: null,
  creadoPor: 1,
  creadoEn: "2026-10-01T00:00:00Z",
  divisiones: [
    {
      id: 10,
      codigo: "DIVISION-0001",
      nombre: null,
      unidadNegocioId: 1,
      subdivisiones: [
        {
          id: 100,
          codigo: "SUBDIVISION-0001",
          nombre: null,
          pais: "México",
          divisionId: 10,
          riesgos: [],
          areas: [
            { id: 1000, nombre: "Nómina", subdivisionId: 100 },
            { id: 1001, nombre: "Compras", subdivisionId: 100 },
          ],
        },
        { id: 101, codigo: "SUBDIVISION-0002", nombre: null, pais: null, divisionId: 10, riesgos: [], areas: [] },
      ],
    },
  ],
};

describe("resolverRuta", () => {
  it("resuelve cada nivel de la ruta", () => {
    expect(resolverRuta([UNIDAD], { unidadId: 1 })).toEqual({ unidad: UNIDAD });
    expect(resolverRuta([UNIDAD], { unidadId: 1, divisionId: 10 })?.division?.codigo).toBe("DIVISION-0001");
    const completa = resolverRuta([UNIDAD], { unidadId: 1, divisionId: 10, subdivisionId: 101 });
    expect(completa?.subdivision?.codigo).toBe("SUBDIVISION-0002");
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

describe("explorador del catálogo", () => {
  it("clavesAncestros: abre la unidad y la división de la ruta, no la subdivisión", () => {
    expect(clavesAncestros(null)).toEqual([]);
    expect(clavesAncestros({ unidadId: 1 })).toEqual(["unidad-1"]);
    expect(clavesAncestros({ unidadId: 1, divisionId: 10, subdivisionId: 20 })).toEqual(["unidad-1", "division-10"]);
  });

  it("conteosRama: suma divisiones, subdivisiones y áreas de la rama", () => {
    const division = UNIDAD.divisiones[0]!;
    const areas = division.subdivisiones.reduce((t, s) => t + s.areas.length, 0);
    expect(conteosRama(UNIDAD).divisiones).toBe(UNIDAD.divisiones.length);
    expect(conteosRama(division)).toEqual({ divisiones: 1, subdivisiones: division.subdivisiones.length, areas });
  });
});

describe("dependientesDe (aviso antes de eliminar)", () => {
  const riesgo = { id: 1, nombre: "Riesgo", nivel: null, procedimientoControl: null };
  const conRiesgos: UnidadNegocio = {
    ...UNIDAD,
    divisiones: [
      {
        ...UNIDAD.divisiones[0]!,
        subdivisiones: [{ ...UNIDAD.divisiones[0]!.subdivisiones[0]!, riesgos: [riesgo, { ...riesgo, id: 2 }] }],
      },
    ],
  };

  it("describe los hijos directos de cada nivel (y los riesgos de la subdivisión)", () => {
    expect(dependientesDe([UNIDAD], { nivel: "unidad", id: 1, unidadId: 1 })).toBe("1 división");
    expect(dependientesDe([UNIDAD], { nivel: "division", id: 10, unidadId: 1 })).toBe("2 subdivisiones");
    expect(dependientesDe([conRiesgos], { nivel: "subdivision", id: 100, unidadId: 1 })).toBe(
      "2 áreas y 2 riesgos registrados",
    );
  });

  it("es null sin dependientes, para un área o si el nodo no existe", () => {
    expect(dependientesDe([UNIDAD], { nivel: "subdivision", id: 101, unidadId: 1 })).toBeNull();
    expect(dependientesDe([UNIDAD], { nivel: "area", id: 1000, unidadId: 1 })).toBeNull();
    expect(dependientesDe([UNIDAD], { nivel: "division", id: 99, unidadId: 1 })).toBeNull();
  });
});
