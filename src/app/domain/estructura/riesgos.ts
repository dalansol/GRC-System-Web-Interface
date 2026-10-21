// Lógica de riesgos del catálogo organizacional (SF-03).
// Los riesgos cuelgan de la subdivisión; la división y la unidad muestran la suma de su
// rama y se colorean con el peor nivel. Funciones puras: sin estado ni llamadas a la API.

import {
  NIVELES_RIESGO,
  type Division,
  type NivelRiesgo,
  type Riesgo,
  type Subdivision,
  type UnidadNegocio,
} from "../../api/estructura";

/** Posición en la escala: 0 = Crítico (el peor). Un riesgo sin nivel va al final. */
export const ORDEN_NIVEL: Record<NivelRiesgo, number> = Object.fromEntries(
  NIVELES_RIESGO.map((nivel, i) => [nivel, i]),
) as Record<NivelRiesgo, number>;

/** Clases de color por nivel; "sin" es para riesgos sin nivel asignado. */
export const COLOR_NIVEL_RIESGO: Record<NivelRiesgo | "sin", { punto: string; insignia: string }> = {
  Crítico: { punto: "bg-red-500", insignia: "text-red-700 bg-red-50 border border-red-200" },
  Alto: { punto: "bg-orange-500", insignia: "text-orange-700 bg-orange-50 border border-orange-200" },
  Medio: { punto: "bg-amber-400", insignia: "text-amber-700 bg-amber-50 border border-amber-200" },
  Bajo: { punto: "bg-emerald-500", insignia: "text-emerald-700 bg-emerald-50 border border-emerald-200" },
  sin: { punto: "bg-slate-300", insignia: "text-slate-500 bg-slate-50 border border-slate-200" },
};

/** El peor nivel de una lista de riesgos, o null si ninguno tiene nivel. */
export function nivelMaximo(riesgos: Riesgo[]): NivelRiesgo | null {
  let peor: NivelRiesgo | null = null;
  for (const { nivel } of riesgos) {
    if (nivel && (peor === null || ORDEN_NIVEL[nivel] < ORDEN_NIVEL[peor])) peor = nivel;
  }
  return peor;
}

/** Todos los riesgos de una rama: subdivisión, división o unidad completa. */
export function riesgosDeNodo(nodo: UnidadNegocio | Division | Subdivision): Riesgo[] {
  if ("riesgos" in nodo) return nodo.riesgos;
  if ("subdivisiones" in nodo) return nodo.subdivisiones.flatMap((s) => s.riesgos);
  return nodo.divisiones.flatMap(riesgosDeNodo);
}

/** True si algún riesgo tiene ese nivel o uno peor. */
function alcanzaNivel(riesgos: Riesgo[], nivel: NivelRiesgo): boolean {
  return riesgos.some((r) => r.nivel !== null && ORDEN_NIVEL[r.nivel] <= ORDEN_NIVEL[nivel]);
}

export interface FiltroCatalogo {
  /** Texto a buscar en los nombres de cualquier nivel (vacío = sin filtro). */
  texto: string;
  /** Mostrar solo ramas con riesgos de este nivel o peor (null = sin filtro). */
  nivel: NivelRiesgo | null;
}

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

/**
 * Poda el árbol según el filtro. Un nodo cuyo nombre coincide se conserva con toda su
 * rama; si no coincide, se conserva solo si algún descendiente lo hace. El filtro por
 * nivel se aplica a nivel de subdivisión, que es donde viven los riesgos.
 */
export function filtrarUnidades(unidades: UnidadNegocio[], { texto, nivel }: FiltroCatalogo): UnidadNegocio[] {
  const busqueda = normalizar(texto);
  const coincide = (nombre: string) => busqueda === "" || normalizar(nombre).includes(busqueda);
  if (busqueda === "" && nivel === null) return unidades;

  const filtrarSubdivision = (s: Subdivision, padreCoincide: boolean): Subdivision | null => {
    if (nivel && !alcanzaNivel(s.riesgos, nivel)) return null;
    if (padreCoincide || coincide(s.nombre)) return s;
    const areas = s.areas.filter((a) => coincide(a.nombre));
    const riesgos = s.riesgos.filter((r) => coincide(r.nombre));
    return areas.length || riesgos.length ? { ...s, areas, riesgos } : null;
  };

  const filtrarDivision = (d: Division, padreCoincide: boolean): Division | null => {
    const propia = padreCoincide || coincide(d.nombre);
    const subdivisiones = d.subdivisiones
      .map((s) => filtrarSubdivision(s, propia))
      .filter((s): s is Subdivision => s !== null);
    if (subdivisiones.length) return { ...d, subdivisiones };
    // Sin filtro de nivel, una división que coincide se muestra aunque no tenga subdivisiones.
    return propia && !nivel ? d : null;
  };

  return unidades.flatMap((u) => {
    const propia = coincide(u.nombre);
    const divisiones = u.divisiones
      .map((d) => filtrarDivision(d, propia))
      .filter((d): d is Division => d !== null);
    if (divisiones.length || (propia && !nivel)) return [{ ...u, divisiones: divisiones.length ? divisiones : u.divisiones }];
    return [];
  });
}
