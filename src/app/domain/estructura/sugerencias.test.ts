import { describe, expect, it } from "vitest";
import type { UnidadNegocio } from "../../api/estructura";
import { AREAS_FRECUENTES } from "../../data/catalogoEstructura";
import { filtrarSugerencias, sugerenciasArea, sugerenciasPais } from "./sugerencias";

const UNIDADES: UnidadNegocio[] = [
  {
    id: 1,
    codigo: "UDN-0004",
    nombre: null,
    responsableId: 2,
    responsableNombre: "María García",
    periodoFiscalId: 1,
    periodoFiscalNombre: "2026 Q4",
    departamentoAuditoriaId: 1,
    departamentoAuditoriaNombre: "Retail & Spin",
    creadoPor: 1,
    creadoEn: "2026-10-01T00:00:00Z",
    divisiones: [
      {
        id: 10,
        codigo: "DIVISION-0009",
        nombre: null,
        unidadNegocioId: 1,
        subdivisiones: [
          {
            id: 100,
            codigo: "SUBDIVISION-0007",
            nombre: null,
            pais: "Región Andina",
            divisionId: 10,
            riesgos: [],
            areas: [
              { id: 1000, nombre: "Nómina", subdivisionId: 100 },
              { id: 1001, nombre: "Área inventada", subdivisionId: 100 },
            ],
          },
          { id: 101, codigo: "SUBDIVISION-0032", nombre: null, pais: "México", divisionId: 10, riesgos: [], areas: [] },
        ],
      },
    ],
  },
];

describe("sugerencias", () => {
  it("para un área ofrece el catálogo de FEMSA y las ya registradas, sin las que ya tiene la subdivisión", () => {
    const enLaMisma = sugerenciasArea(UNIDADES, 100);
    expect(enLaMisma).not.toContain("Nómina");
    expect(enLaMisma).not.toContain("Área inventada");
    expect(enLaMisma[0]).toBe(AREAS_FRECUENTES[0]);

    const enOtra = sugerenciasArea(UNIDADES, 101);
    expect(enOtra).toContain("Nómina");
    expect(enOtra).toContain("Área inventada");
  });

  it("los países combinan el catálogo con los ya registrados, sin repetir", () => {
    const paises = sugerenciasPais(UNIDADES);
    expect(paises[0]).toBe("México");
    expect(paises).toContain("KFS RTR");
    expect(paises).toContain("Región Andina");
    expect(paises.filter((p) => p === "México")).toHaveLength(1);
  });
});

describe("filtrarSugerencias", () => {
  const opciones = ["México", "Brasil", "Centroamérica Sur", "KFS RTR"];

  it("sin texto devuelve todas, en su orden", () => {
    expect(filtrarSugerencias(opciones, "")).toEqual(opciones);
    expect(filtrarSugerencias(opciones, "   ")).toEqual(opciones);
  });

  it("filtra por contenido sin distinguir mayúsculas ni acentos", () => {
    expect(filtrarSugerencias(opciones, "mexi")).toEqual(["México"]);
    expect(filtrarSugerencias(opciones, "AMERICA")).toEqual(["Centroamérica Sur"]);
    expect(filtrarSugerencias(opciones, "zzz")).toEqual([]);
  });
});
