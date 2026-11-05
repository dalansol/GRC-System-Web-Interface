import { describe, expect, it } from "vitest";
import type { UnidadNegocio } from "../../api/estructura";
import { filtrarSugerencias, opcionDeCatalogo, sugerenciasArea } from "./sugerencias";

const UNIDADES: UnidadNegocio[] = [
  {
    id: 1,
    codigo: "UDN-0004",
    nombre: null,
    responsableId: 2,
    responsableNombre: "María García",
    periodoFiscalId: 1,
    periodoFiscalNombre: "2026 T4",
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

const CATALOGO = ["Compras", "Nómina", "Inventarios", "Área inventada"];

describe("sugerenciasArea", () => {
  it("ofrece solo el catálogo, sin las áreas que ya tiene la subdivisión", () => {
    expect(sugerenciasArea(CATALOGO, UNIDADES, 100)).toEqual(["Compras", "Inventarios"]);
    expect(sugerenciasArea(CATALOGO, UNIDADES, 101)).toEqual(CATALOGO);
  });

  it("no agrega áreas registradas que no estén en el catálogo", () => {
    expect(sugerenciasArea(["Compras"], UNIDADES, 101)).toEqual(["Compras"]);
  });
});

describe("opcionDeCatalogo", () => {
  it("devuelve la grafía del catálogo sin distinguir mayúsculas", () => {
    expect(opcionDeCatalogo(CATALOGO, "  NÓMINA ")).toBe("Nómina");
  });

  it("distingue acentos y rechaza lo que no está, como el backend", () => {
    expect(opcionDeCatalogo(CATALOGO, "Nomina")).toBeNull();
    expect(opcionDeCatalogo(CATALOGO, "Astrología")).toBeNull();
    expect(opcionDeCatalogo(CATALOGO, "")).toBeNull();
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
