// Interfaz del repositorio de catálogos de la estructura (SF-03).

import type { OpcionCatalogo, TipoCatalogo } from "../domain/catalogos.js";

export class ErrorOpcionEnUso extends Error {
  constructor(
    valor: string,
    readonly usos: number,
  ) {
    super(`No se puede eliminar "${valor}" porque lo usan ${usos} registro${usos === 1 ? "" : "s"} de la estructura.`);
    this.name = "ErrorOpcionEnUso";
  }
}

export interface RepositorioCatalogos {
  /** Opciones en orden alfabético, con cuántos registros de la estructura las usan. */
  listar(tipo: TipoCatalogo): Promise<OpcionCatalogo[]>;
  buscarPorId(tipo: TipoCatalogo, id: number): Promise<OpcionCatalogo | null>;
  /** Opción que coincide sin distinguir mayúsculas (sí acentos); null si no está en el catálogo. */
  buscarPorValor(tipo: TipoCatalogo, valor: string): Promise<OpcionCatalogo | null>;
  /** Lanza ErrorNombreDuplicado. */
  crear(tipo: TipoCatalogo, valor: string): Promise<OpcionCatalogo>;
  /**
   * Cambia el valor y lo propaga a las áreas o subdivisiones que lo usan, en una sola
   * operación. Lanza ErrorNombreDuplicado. Devuelve null si no existe.
   */
  renombrar(tipo: TipoCatalogo, id: number, valor: string): Promise<{ opcion: OpcionCatalogo; anterior: string } | null>;
  /** Lanza ErrorOpcionEnUso si algún registro la usa. */
  eliminar(tipo: TipoCatalogo, id: number): Promise<void>;
}

/** Lo que el repositorio en memoria necesita de la estructura para contar usos y propagar cambios. */
export interface UsosCatalogo {
  /** Valores que usa la estructura (uno por registro). */
  valoresEnUso(tipo: TipoCatalogo): string[];
  /** Sustituye `anterior` por `nuevo` (sin distinguir mayúsculas) y devuelve cuántos registros cambió. */
  renombrarValor(tipo: TipoCatalogo, anterior: string, nuevo: string): number;
}
