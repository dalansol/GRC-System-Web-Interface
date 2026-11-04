// Opciones de los formularios del catálogo organizacional (SF-03).
// Salen de los catálogos de área y país que edita el Administrador en Ajustes (api/catalogos.ts):
// solo se aceptan esos valores.

import type { UnidadNegocio } from "../../api/estructura";

/** Áreas que se pueden agregar a una subdivisión: las del catálogo menos las que ya tiene. */
export function sugerenciasArea(opciones: readonly string[], unidades: UnidadNegocio[], subdivisionId: number): string[] {
  const subdivision = unidades
    .flatMap((u) => u.divisiones)
    .flatMap((d) => d.subdivisiones)
    .find((s) => s.id === subdivisionId);
  const yaUsadas = new Set(subdivision?.areas.map((a) => a.nombre.toLowerCase()) ?? []);
  return opciones.filter((a) => !yaUsadas.has(a.toLowerCase()));
}

/**
 * La opción que coincide con lo escrito, con su grafía del catálogo; null si no está.
 * Como el backend, ignora mayúsculas pero no acentos.
 */
export function opcionDeCatalogo(opciones: readonly string[], texto: string): string | null {
  const clave = texto.trim().toLocaleLowerCase("es");
  if (clave === "") return null;
  return opciones.find((o) => o.toLocaleLowerCase("es") === clave) ?? null;
}

function sinAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

/** Sugerencias que contienen el texto escrito (sin distinguir mayúsculas ni acentos); sin texto, todas. */
export function filtrarSugerencias(opciones: readonly string[], texto: string): string[] {
  const busqueda = sinAcentos(texto);
  return busqueda === "" ? [...opciones] : opciones.filter((o) => sinAcentos(o).includes(busqueda));
}
