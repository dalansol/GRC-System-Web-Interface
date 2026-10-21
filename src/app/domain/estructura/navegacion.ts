// Navegación por tarjetas del catálogo organizacional (SF-03).
// La ruta guarda solo ids: tras un alta, edición o baja la vista vuelve a resolverla contra
// los datos frescos, y si el nodo ya no existe cae al ancestro más profundo que siga vivo.

import type { Division, Subdivision, UnidadNegocio } from "../../api/estructura";

/** Dónde está el usuario dentro de una unidad: unidad › división › subdivisión. */
export interface RutaCatalogo {
  unidadId: number;
  divisionId?: number;
  subdivisionId?: number;
}

export interface RutaResuelta {
  unidad: UnidadNegocio;
  division?: Division;
  subdivision?: Subdivision;
}

/** Resuelve la ruta contra las unidades cargadas; null si la unidad ya no existe. */
export function resolverRuta(unidades: UnidadNegocio[], ruta: RutaCatalogo | null): RutaResuelta | null {
  if (!ruta) return null;
  const unidad = unidades.find((u) => u.id === ruta.unidadId);
  if (!unidad) return null;

  const division = unidad.divisiones.find((d) => d.id === ruta.divisionId);
  if (!division) return { unidad };

  const subdivision = division.subdivisiones.find((s) => s.id === ruta.subdivisionId);
  return subdivision ? { unidad, division, subdivision } : { unidad, division };
}

function plural(cantidad: number, singular: string, varios: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : varios}`;
}

/** Texto del pie de una tarjeta: qué contiene la división o subdivisión. */
export function resumenHijos(nodo: Division | Subdivision): string {
  if ("subdivisiones" in nodo) {
    const areas = nodo.subdivisiones.reduce((total, s) => total + s.areas.length, 0);
    return `${plural(nodo.subdivisiones.length, "subdivisión", "subdivisiones")} · ${plural(areas, "área", "áreas")}`;
  }
  return plural(nodo.areas.length, "área", "áreas");
}
