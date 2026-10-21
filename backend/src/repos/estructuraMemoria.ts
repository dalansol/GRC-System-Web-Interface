// Implementación en memoria del repositorio de estructura organizacional (SF-03).
// Útil para modo DATA_MODE=memoria y pruebas unitarias rápidas.

import {
  claveNombre,
  ESTADOS_PLAN_ACTIVOS,
  type AltaNodoInput,
  type AltaPeriodoInput,
  type AltaUnidadInput,
  type DepartamentoAuditoria,
  type Division,
  type EdicionNodoInput,
  type EdicionPeriodoInput,
  type EdicionUnidadInput,
  type NivelEstructura,
  type NivelNodo,
  type NodoPlano,
  type PeriodoFiscal,
  type Riesgo,
  type UnidadNegocio,
} from "../domain/estructura.js";
import { ErrorNombreDuplicado, type RepositorioEstructura } from "./estructura.js";
import type { RepositorioUsuarios } from "./repositorio.js";

interface FilaNodo extends NodoPlano {
  pais: string | null;
}

export class RepositorioEstructuraMemoria implements RepositorioEstructura {
  private periodos: PeriodoFiscal[] = [
    { id: 1, nombre: "2026Q3", fechaInicio: "2026-07-01", fechaFin: "2026-09-30", activo: false },
    { id: 2, nombre: "2026Q4", fechaInicio: "2026-10-01", fechaFin: "2026-12-31", activo: true },
  ];

  private departamentos: DepartamentoAuditoria[] = [
    { id: 1, nombre: "Retail & Spin" },
    { id: 2, nombre: "Beverage" },
  ];

  private unidades: Array<{
    id: number;
    nombre: string;
    responsableId: number;
    periodoFiscalId: number;
    departamentoAuditoriaId: number | null;
    creadoPor: number;
    creadoEn: string;
  }> = [];

  private nodos: Record<NivelNodo, FilaNodo[]> = { division: [], subdivision: [], area: [] };

  /** Auditorías (engagements) sembradas por las pruebas: subdivisión y estado de su plan. */
  private auditorias: Array<{ subdivisionId: number; estadoPlan: string }> = [];

  /** Riesgos registrados por subdivisión (sembrados por las pruebas). */
  private riesgos: Array<Riesgo & { subdivisionId: number }> = [];

  private sigId = { periodo: 3, unidad: 1, division: 1, subdivision: 1, area: 1, riesgo: 1 };

  constructor(private usuarios?: RepositorioUsuarios) {}

  // Helpers para pruebas
  registrarAuditoria(subdivisionId: number, estadoPlan: string): void {
    this.auditorias.push({ subdivisionId, estadoPlan });
  }

  registrarRiesgo(subdivisionId: number, riesgo: Omit<Riesgo, "id">): Riesgo {
    const registrado = { id: this.sigId.riesgo++, ...riesgo };
    this.riesgos.push({ ...registrado, subdivisionId });
    return registrado;
  }

  limpiarPeriodos(): void {
    this.periodos = [];
  }

  // ── Periodos ───────────────────────────────────────────────────────────────

  async obtenerPeriodoActivo(): Promise<PeriodoFiscal | null> {
    return this.periodos.find((p) => p.activo) ?? null;
  }

  async listarPeriodos(): Promise<PeriodoFiscal[]> {
    return [...this.periodos].sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio)).map((p) => ({ ...p }));
  }

  async buscarPeriodoPorId(id: number): Promise<PeriodoFiscal | null> {
    const periodo = this.periodos.find((p) => p.id === id);
    return periodo ? { ...periodo } : null;
  }

  async crearPeriodo(datos: AltaPeriodoInput): Promise<PeriodoFiscal> {
    this.validarNombrePeriodo(datos.nombre);
    if (datos.activo) this.periodos.forEach((p) => (p.activo = false));
    const periodo = { id: this.sigId.periodo++, ...datos };
    this.periodos.push(periodo);
    return { ...periodo };
  }

  async editarPeriodo(id: number, campos: EdicionPeriodoInput): Promise<PeriodoFiscal | null> {
    const periodo = this.periodos.find((p) => p.id === id);
    if (!periodo) return null;
    if (campos.nombre !== undefined) this.validarNombrePeriodo(campos.nombre, id);
    if (campos.activo) this.periodos.forEach((p) => (p.activo = false));
    Object.assign(periodo, campos);
    return { ...periodo };
  }

  private validarNombrePeriodo(nombre: string, exceptoId?: number): void {
    if (this.periodos.some((p) => p.id !== exceptoId && claveNombre(p.nombre) === claveNombre(nombre))) {
      throw new ErrorNombreDuplicado("un periodo", nombre);
    }
  }

  async listarDepartamentos(): Promise<DepartamentoAuditoria[]> {
    return this.departamentos.map((d) => ({ ...d }));
  }

  // ── Unidades ───────────────────────────────────────────────────────────────

  private async resolverNombreUsuario(id: number): Promise<string> {
    const usuario = this.usuarios ? await this.usuarios.buscarPorId(id) : null;
    return usuario?.nombre ?? `Usuario #${id}`;
  }

  private divisionesDe(unidadId: number): Division[] {
    return this.nodos.division
      .filter((d) => d.padreId === unidadId)
      .map((d) => ({
        id: d.id,
        nombre: d.nombre,
        unidadNegocioId: unidadId,
        subdivisiones: this.nodos.subdivision
          .filter((s) => s.padreId === d.id)
          .map((s) => ({
            id: s.id,
            nombre: s.nombre,
            pais: s.pais,
            divisionId: d.id,
            areas: this.nodos.area
              .filter((a) => a.padreId === s.id)
              .map((a) => ({ id: a.id, nombre: a.nombre, subdivisionId: s.id })),
            riesgos: this.riesgos
              .filter((r) => r.subdivisionId === s.id)
              .map(({ subdivisionId: _, ...riesgo }) => riesgo),
          })),
      }));
  }

  async listarUnidades(): Promise<UnidadNegocio[]> {
    const unidades = [...this.unidades].sort((a, b) => a.nombre.localeCompare(b.nombre));
    return Promise.all(unidades.map((u) => this.buscarUnidadPorId(u.id) as Promise<UnidadNegocio>));
  }

  async buscarUnidadPorId(id: number): Promise<UnidadNegocio | null> {
    const u = this.unidades.find((x) => x.id === id);
    if (!u) return null;
    const periodo = this.periodos.find((p) => p.id === u.periodoFiscalId);
    const departamento = this.departamentos.find((d) => d.id === u.departamentoAuditoriaId);
    return {
      id: u.id,
      nombre: u.nombre,
      responsableId: u.responsableId,
      responsableNombre: await this.resolverNombreUsuario(u.responsableId),
      periodoFiscalId: u.periodoFiscalId,
      periodoFiscalNombre: periodo?.nombre ?? `Periodo #${u.periodoFiscalId}`,
      departamentoAuditoriaId: u.departamentoAuditoriaId,
      departamentoAuditoriaNombre: departamento?.nombre ?? null,
      creadoPor: u.creadoPor,
      creadoEn: u.creadoEn,
      divisiones: this.divisionesDe(u.id),
    };
  }

  private validarNombreUnidad(nombre: string, exceptoId?: number): void {
    if (this.unidades.some((u) => u.id !== exceptoId && claveNombre(u.nombre) === claveNombre(nombre))) {
      throw new ErrorNombreDuplicado("una unidad de negocio", nombre);
    }
  }

  async crearUnidad(datos: AltaUnidadInput, periodoFiscalId: number, creadoPor: number): Promise<UnidadNegocio> {
    this.validarNombreUnidad(datos.nombre);
    const id = this.sigId.unidad++;
    this.unidades.push({ id, ...datos, periodoFiscalId, creadoPor, creadoEn: new Date().toISOString() });
    return (await this.buscarUnidadPorId(id))!;
  }

  async editarUnidad(id: number, campos: EdicionUnidadInput): Promise<UnidadNegocio | null> {
    const u = this.unidades.find((x) => x.id === id);
    if (!u) return null;
    if (campos.nombre !== undefined) this.validarNombreUnidad(campos.nombre, id);
    Object.assign(u, campos);
    return this.buscarUnidadPorId(id);
  }

  async eliminarUnidad(id: number): Promise<void> {
    this.unidades = this.unidades.filter((u) => u.id !== id);
  }

  // ── División, subdivisión y área ───────────────────────────────────────────

  async buscarNodo(nivel: NivelNodo, id: number): Promise<NodoPlano | null> {
    const nodo = this.nodos[nivel].find((n) => n.id === id);
    return nodo ? { id: nodo.id, nombre: nodo.nombre, padreId: nodo.padreId } : null;
  }

  async crearNodo(nivel: NivelNodo, datos: AltaNodoInput): Promise<NodoPlano> {
    const nodo = { id: this.sigId[nivel]++, nombre: datos.nombre, padreId: datos.padreId, pais: datos.pais };
    this.nodos[nivel].push(nodo);
    return { id: nodo.id, nombre: nodo.nombre, padreId: nodo.padreId };
  }

  async editarNodo(nivel: NivelNodo, id: number, campos: EdicionNodoInput): Promise<NodoPlano | null> {
    const nodo = this.nodos[nivel].find((n) => n.id === id);
    if (!nodo) return null;
    Object.assign(nodo, campos);
    return { id: nodo.id, nombre: nodo.nombre, padreId: nodo.padreId };
  }

  async eliminarNodo(nivel: NivelNodo, id: number): Promise<void> {
    this.nodos[nivel] = this.nodos[nivel].filter((n) => n.id !== id);
  }

  // ── Reglas de borrado ──────────────────────────────────────────────────────

  /** Subdivisiones de la rama del nodo (para un área, la subdivisión a la que pertenece). */
  private subdivisionesDeRama(nivel: NivelEstructura, id: number): number[] {
    switch (nivel) {
      case "unidad": {
        const divisiones = this.nodos.division.filter((d) => d.padreId === id).map((d) => d.id);
        return this.nodos.subdivision.filter((s) => divisiones.includes(s.padreId)).map((s) => s.id);
      }
      case "division":
        return this.nodos.subdivision.filter((s) => s.padreId === id).map((s) => s.id);
      case "subdivision":
        return [id];
      case "area": {
        const area = this.nodos.area.find((a) => a.id === id);
        return area ? [area.padreId] : [];
      }
    }
  }

  async tieneAuditoriasActivas(nivel: NivelEstructura, id: number): Promise<boolean> {
    const subdivisiones = this.subdivisionesDeRama(nivel, id);
    return this.auditorias.some(
      (a) =>
        subdivisiones.includes(a.subdivisionId) &&
        (ESTADOS_PLAN_ACTIVOS as readonly string[]).includes(a.estadoPlan),
    );
  }

  async tieneHijos(nivel: NivelEstructura, id: number): Promise<boolean> {
    const hijos: Record<NivelEstructura, FilaNodo[] | null> = {
      unidad: this.nodos.division,
      division: this.nodos.subdivision,
      subdivision: this.nodos.area,
      area: null,
    };
    if (nivel === "subdivision" && this.riesgos.some((r) => r.subdivisionId === id)) return true;
    return hijos[nivel]?.some((n) => n.padreId === id) ?? false;
  }
}
