// Catálogos de la estructura en memoria (DATA_MODE=memoria y pruebas).
// Arranca con las opciones del Consolidado; con la estructura en memoria cuenta usos y propaga
// los cambios de nombre (sin ella, nada se considera en uso).

import type { OpcionCatalogo, TipoCatalogo } from "../domain/catalogos.js";
import { claveNombre } from "../domain/estructura.js";
import { ErrorOpcionEnUso, type RepositorioCatalogos, type UsosCatalogo } from "./catalogos.js";
import { ErrorNombreDuplicado } from "./estructura.js";
import { AREAS_INICIALES, PAISES_INICIALES } from "./semillaCatalogos.js";

interface FilaOpcion {
  id: number;
  tipo: TipoCatalogo;
  valor: string;
}

export class RepositorioCatalogosMemoria implements RepositorioCatalogos {
  private opciones: FilaOpcion[] = [];
  private sigId = 1;

  constructor(private estructura?: UsosCatalogo) {
    this.sembrar("area", AREAS_INICIALES);
    this.sembrar("pais", PAISES_INICIALES);
    // Igual que 034: lo que ya usa la estructura también queda en el catálogo.
    if (estructura) {
      this.sembrar("area", estructura.valoresEnUso("area"));
      this.sembrar("pais", estructura.valoresEnUso("pais"));
    }
  }

  private sembrar(tipo: TipoCatalogo, valores: readonly string[]): void {
    for (const valor of valores) {
      if (!this.fila(tipo, valor)) this.opciones.push({ id: this.sigId++, tipo, valor: valor.trim() });
    }
  }

  private fila(tipo: TipoCatalogo, valor: string, exceptoId?: number): FilaOpcion | undefined {
    const clave = claveNombre(valor.trim());
    return this.opciones.find((o) => o.tipo === tipo && o.id !== exceptoId && claveNombre(o.valor) === clave);
  }

  private conUsos(fila: FilaOpcion): OpcionCatalogo {
    const clave = claveNombre(fila.valor);
    const usos = (this.estructura?.valoresEnUso(fila.tipo) ?? []).filter((v) => claveNombre(v) === clave).length;
    return { id: fila.id, valor: fila.valor, usos };
  }

  async listar(tipo: TipoCatalogo): Promise<OpcionCatalogo[]> {
    return this.opciones
      .filter((o) => o.tipo === tipo)
      .sort((a, b) => a.valor.localeCompare(b.valor, "es"))
      .map((o) => this.conUsos(o));
  }

  async buscarPorId(tipo: TipoCatalogo, id: number): Promise<OpcionCatalogo | null> {
    const fila = this.opciones.find((o) => o.tipo === tipo && o.id === id);
    return fila ? this.conUsos(fila) : null;
  }

  async buscarPorValor(tipo: TipoCatalogo, valor: string): Promise<OpcionCatalogo | null> {
    const fila = this.fila(tipo, valor);
    return fila ? this.conUsos(fila) : null;
  }

  async crear(tipo: TipoCatalogo, valor: string): Promise<OpcionCatalogo> {
    if (this.fila(tipo, valor)) throw new ErrorNombreDuplicado("una opción", valor.trim());
    const fila = { id: this.sigId++, tipo, valor: valor.trim() };
    this.opciones.push(fila);
    return this.conUsos(fila);
  }

  async renombrar(tipo: TipoCatalogo, id: number, valor: string) {
    const fila = this.opciones.find((o) => o.tipo === tipo && o.id === id);
    if (!fila) return null;
    if (this.fila(tipo, valor, id)) throw new ErrorNombreDuplicado("una opción", valor.trim());
    const anterior = fila.valor;
    fila.valor = valor.trim();
    this.estructura?.renombrarValor(tipo, anterior, fila.valor);
    return { opcion: this.conUsos(fila), anterior };
  }

  async eliminar(tipo: TipoCatalogo, id: number): Promise<void> {
    const fila = this.opciones.find((o) => o.tipo === tipo && o.id === id);
    if (!fila) return;
    const { usos } = this.conUsos(fila);
    if (usos > 0) throw new ErrorOpcionEnUso(fila.valor, usos);
    this.opciones = this.opciones.filter((o) => o !== fila);
  }
}
