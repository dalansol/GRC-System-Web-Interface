// Sugerencias para los formularios del catálogo organizacional (SF-03).
// Combinan el catálogo de FEMSA (data/catalogoEstructura.ts, del Consolidado) con lo que ya
// está registrado. Son sugerencias: el usuario puede escribir cualquier otro valor.

import type { UnidadNegocio } from "../../api/estructura";
import { AREAS_FRECUENTES, PAISES_FRECUENTES } from "../../data/catalogoEstructura";

/** Une listas sin repetir (sin distinguir mayúsculas), conservando el orden de aparición. */
function unir(...listas: Array<readonly (string | null | undefined)[]>): string[] {
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const valor of listas.flat()) {
    const limpio = valor?.trim();
    if (limpio && !vistos.has(limpio.toLowerCase())) {
      vistos.add(limpio.toLowerCase());
      salida.push(limpio);
    }
  }
  return salida;
}

/** Nombres de áreas y países registrados. */
function nombresPorNivel(unidades: UnidadNegocio[]) {
  const subdivisiones = unidades.flatMap((u) => u.divisiones).flatMap((d) => d.subdivisiones);
  return {
    area: subdivisiones.flatMap((s) => s.areas.map((a) => a.nombre)),
    pais: subdivisiones.map((s) => s.pais),
  };
}

/** Áreas sugeridas para una subdivisión: las de FEMSA más frecuentes y las ya registradas, sin las que ya tiene. */
export function sugerenciasArea(unidades: UnidadNegocio[], subdivisionId: number): string[] {
  const subdivision = unidades
    .flatMap((u) => u.divisiones)
    .flatMap((d) => d.subdivisiones)
    .find((s) => s.id === subdivisionId);
  const yaUsadas = new Set(subdivision?.areas.map((a) => a.nombre.toLowerCase()) ?? []);
  return unir(AREAS_FRECUENTES, nombresPorNivel(unidades).area).filter((a) => !yaUsadas.has(a.toLowerCase()));
}

/** Países o regiones sugeridos para una subdivisión. */
export function sugerenciasPais(unidades: UnidadNegocio[]): string[] {
  return unir(PAISES_FRECUENTES, nombresPorNivel(unidades).pais);
}

function sinAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

/** Sugerencias que contienen el texto escrito (sin distinguir mayúsculas ni acentos); sin texto, todas. */
export function filtrarSugerencias(opciones: readonly string[], texto: string): string[] {
  const busqueda = sinAcentos(texto);
  return busqueda === "" ? [...opciones] : opciones.filter((o) => sinAcentos(o).includes(busqueda));
}
