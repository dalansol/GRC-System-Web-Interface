// Sugerencias para los formularios del catálogo organizacional (SF-03).
// Combinan el catálogo de FEMSA (data/catalogoEstructura.ts, del Consolidado) con lo que ya
// está registrado. Son sugerencias: el usuario puede escribir cualquier otro valor.

import type { UnidadNegocio } from "../../api/estructura";
import { AREAS_FRECUENTES, PAISES_FRECUENTES } from "../../data/catalogoEstructura";

/** Prefijo de los códigos anonimizados del Consolidado por nivel (UDN-0001, DIVISION-0001…). */
const PREFIJO: Record<"unidad" | "division" | "subdivision", string> = {
  unidad: "UDN",
  division: "DIVISION",
  subdivision: "SUBDIVISION",
};

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

/** Siguiente código libre con el formato del Consolidado, p. ej. "DIVISION-0013". */
export function siguienteCodigo(nivel: "unidad" | "division" | "subdivision", codigos: string[]): string {
  const patron = new RegExp(`^${PREFIJO[nivel]}-(\\d+)$`, "i");
  const mayor = codigos.reduce((max, codigo) => Math.max(max, Number(patron.exec(codigo.trim())?.[1] ?? 0)), 0);
  return `${PREFIJO[nivel]}-${String(mayor + 1).padStart(4, "0")}`;
}

/** Códigos ya usados por nivel, nombres de áreas y países registrados. */
function nombresPorNivel(unidades: UnidadNegocio[]) {
  const divisiones = unidades.flatMap((u) => u.divisiones);
  const subdivisiones = divisiones.flatMap((d) => d.subdivisiones);
  return {
    unidad: unidades.map((u) => u.codigo),
    division: divisiones.map((d) => d.codigo),
    subdivision: subdivisiones.map((s) => s.codigo),
    area: subdivisiones.flatMap((s) => s.areas.map((a) => a.nombre)),
    pais: subdivisiones.map((s) => s.pais),
  };
}

/**
 * Vista previa del código que asignará el backend al dar de alta en ese nivel. Es solo
 * informativa: el backend tampoco reutiliza los códigos de elementos borrados, así que el
 * definitivo puede ser mayor (se confirma al guardar).
 */
export function codigoProximo(nivel: "unidad" | "division" | "subdivision", unidades: UnidadNegocio[]): string {
  return siguienteCodigo(nivel, nombresPorNivel(unidades)[nivel]);
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
