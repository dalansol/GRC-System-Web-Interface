// Navegación del catálogo organizacional (SF-03): la selección del explorador.
// La ruta guarda solo ids: tras un alta, edición o baja la vista vuelve a resolverla contra
// los datos frescos, y si el nodo ya no existe cae al ancestro más profundo que siga vivo.

import type { Division, NivelNodo, Subdivision, UnidadNegocio } from "../../api/estructura";

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

/** Claves de los nodos que hay que expandir en el árbol para que la ruta se vea. */
export function clavesAncestros(ruta: RutaCatalogo | null): string[] {
  if (!ruta) return [];
  const claves = [`unidad-${ruta.unidadId}`];
  if (ruta.divisionId !== undefined) claves.push(`division-${ruta.divisionId}`);
  return claves;
}

/** Conteos de la rama de una unidad o división, para los indicadores del encabezado. */
export function conteosRama(nodo: UnidadNegocio | Division): { divisiones: number; subdivisiones: number; areas: number } {
  const divisiones = "divisiones" in nodo ? nodo.divisiones : [nodo];
  const subdivisiones = divisiones.flatMap((d) => d.subdivisiones);
  return {
    divisiones: divisiones.length,
    subdivisiones: subdivisiones.length,
    areas: subdivisiones.reduce((total, s) => total + s.areas.length, 0),
  };
}

/** Texto de una fila: qué contiene la división o subdivisión. */
export function resumenHijos(nodo: Division | Subdivision): string {
  if ("subdivisiones" in nodo) {
    const areas = nodo.subdivisiones.reduce((total, s) => total + s.areas.length, 0);
    return `${plural(nodo.subdivisiones.length, "subdivisión", "subdivisiones")} · ${plural(areas, "área", "áreas")}`;
  }
  return plural(nodo.areas.length, "área", "áreas");
}

/**
 * Qué impide eliminar un elemento (AC3, regla HIJOS_EXISTENTES del backend): sus hijos directos
 * y, en la subdivisión, también sus riesgos registrados. Null si no tiene dependientes (el área
 * nunca los tiene). Las auditorías activas solo las conoce el servidor.
 */
export function dependientesDe(
  unidades: UnidadNegocio[],
  entidad: { nivel: NivelNodo | "unidad"; id: number; unidadId: number },
): string | null {
  const unidad = unidades.find((u) => u.id === entidad.unidadId);
  if (!unidad) return null;
  const partes: string[] = [];
  if (entidad.nivel === "unidad") {
    if (unidad.divisiones.length) partes.push(plural(unidad.divisiones.length, "división", "divisiones"));
  } else if (entidad.nivel === "division") {
    const division = unidad.divisiones.find((d) => d.id === entidad.id);
    if (division?.subdivisiones.length) partes.push(plural(division.subdivisiones.length, "subdivisión", "subdivisiones"));
  } else if (entidad.nivel === "subdivision") {
    const subdivision = unidad.divisiones.flatMap((d) => d.subdivisiones).find((s) => s.id === entidad.id);
    if (subdivision?.areas.length) partes.push(plural(subdivision.areas.length, "área", "áreas"));
    if (subdivision?.riesgos.length) {
      partes.push(plural(subdivision.riesgos.length, "riesgo registrado", "riesgos registrados"));
    }
  }
  return partes.length ? partes.join(" y ") : null;
}
