import { pedir } from "./cliente";

// Cliente de API para los catálogos de la estructura organizacional (SF-03).
// Opciones de nombre de área y de país o región: las leen los formularios del Catálogo y
// solo el Administrador las edita (Ajustes).

export type TipoCatalogo = "area" | "pais";

export interface OpcionCatalogo {
  id: number;
  valor: string;
  /** Áreas o subdivisiones que la usan; con usos no se puede eliminar. */
  usos: number;
}

export const ETIQUETA_CATALOGO: Record<TipoCatalogo, { plural: string; singular: string }> = {
  area: { plural: "Áreas", singular: "área" },
  pais: { plural: "Países o regiones", singular: "país o región" },
};

export const listarOpciones = (tipo: TipoCatalogo) => pedir<OpcionCatalogo[]>(`/catalogos/${tipo}`);

export const crearOpcion = (tipo: TipoCatalogo, valor: string) =>
  pedir<OpcionCatalogo>(`/catalogos/${tipo}`, { metodo: "POST", cuerpo: { valor } });

/** Renombrar también cambia las áreas o subdivisiones que usan la opción. */
export const renombrarOpcion = (tipo: TipoCatalogo, id: number, valor: string) =>
  pedir<OpcionCatalogo>(`/catalogos/${tipo}/${id}`, { metodo: "PATCH", cuerpo: { valor } });

export const eliminarOpcion = (tipo: TipoCatalogo, id: number) =>
  pedir<void>(`/catalogos/${tipo}/${id}`, { metodo: "DELETE" });
