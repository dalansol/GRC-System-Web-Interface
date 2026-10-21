// Sugerencias para los formularios del catálogo organizacional (SF-03).
// Combinan el catálogo de FEMSA (data/catalogoEstructura.ts, del Consolidado) con lo que ya
// está registrado. Son sugerencias: el usuario puede escribir cualquier otro valor.

import type { NivelNodo, UnidadNegocio } from "../../api/estructura";
import { AREAS_FRECUENTES, PAISES_FRECUENTES } from "../../data/catalogoEstructura";

/** Prefijo de los nombres anonimizados del Consolidado por nivel (UDN-0001, DIVISION-0001…). */
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
export function siguienteCodigo(nivel: "unidad" | "division" | "subdivision", nombres: string[]): string {
  const patron = new RegExp(`^${PREFIJO[nivel]}-(\\d+)$`, "i");
  const mayor = nombres.reduce((max, nombre) => Math.max(max, Number(patron.exec(nombre.trim())?.[1] ?? 0)), 0);
  return `${PREFIJO[nivel]}-${String(mayor + 1).padStart(4, "0")}`;
}

function nombresPorNivel(unidades: UnidadNegocio[]) {
  const divisiones = unidades.flatMap((u) => u.divisiones);
  const subdivisiones = divisiones.flatMap((d) => d.subdivisiones);
  return {
    unidad: unidades.map((u) => u.nombre),
    division: divisiones.map((d) => d.nombre),
    subdivision: subdivisiones.map((s) => s.nombre),
    area: subdivisiones.flatMap((s) => s.areas.map((a) => a.nombre)),
    pais: subdivisiones.map((s) => s.pais),
  };
}

/** Nombre sugerido para una unidad nueva: el siguiente UDN libre. */
export function sugerenciasUnidad(unidades: UnidadNegocio[]): string[] {
  return [siguienteCodigo("unidad", nombresPorNivel(unidades).unidad)];
}

/**
 * Nombres sugeridos al dar de alta un nodo dentro de `padreId`:
 * - división y subdivisión: el siguiente código libre (los nombres del Consolidado son códigos);
 * - área: las áreas de FEMSA más frecuentes y las ya registradas, sin las que ya tiene esa subdivisión.
 */
export function sugerenciasNodo(nivel: NivelNodo, unidades: UnidadNegocio[], padreId: number): string[] {
  const nombres = nombresPorNivel(unidades);
  if (nivel !== "area") return [siguienteCodigo(nivel, nombres[nivel])];

  const subdivision = unidades
    .flatMap((u) => u.divisiones)
    .flatMap((d) => d.subdivisiones)
    .find((s) => s.id === padreId);
  const yaUsadas = new Set(subdivision?.areas.map((a) => a.nombre.toLowerCase()) ?? []);
  return unir(AREAS_FRECUENTES, nombres.area).filter((a) => !yaUsadas.has(a.toLowerCase()));
}

/** Países o regiones sugeridos para una subdivisión. */
export function sugerenciasPais(unidades: UnidadNegocio[]): string[] {
  return unir(PAISES_FRECUENTES, nombresPorNivel(unidades).pais);
}
