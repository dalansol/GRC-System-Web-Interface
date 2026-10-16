// Implementación en memoria del repositorio de estructura organizacional (SF-03).
// Útil para modo DATA_MODE=memoria y pruebas unitarias rápidas.

import type {
  PeriodoFiscal,
  UnidadNegocio,
  Proceso,
  AltaUnidadInput,
  AltaProcesoInput,
} from "../domain/estructura.js";
import {
  ErrorNombreDuplicado,
  type RepositorioEstructura,
} from "./estructura.js";
import type { RepositorioUsuarios } from "./repositorio.js";

export class RepositorioEstructuraMemoria implements RepositorioEstructura {
  private periodos: PeriodoFiscal[] = [
    {
      id: 1,
      nombre: "Fiscal 2026",
      fechaInicio: "2026-01-01",
      fechaFin: "2026-12-31",
      activo: true,
    },
  ];

  private unidades: Array<{
    id: number;
    nombre: string;
    responsableId: number;
    periodoFiscalId: number;
    creadoPor: number;
    creadoEn: string;
  }> = [];

  private procesos: Array<{
    id: number;
    unidadNegocioId: number;
    nombre: string;
    creadoEn: string;
  }> = [];

  private unidadesConAuditoriasActivas = new Set<number>();
  private procesosConAuditoriasActivas = new Set<number>();

  private sigUnidadId = 1;
  private sigProcesoId = 1;

  constructor(private usuarios?: RepositorioUsuarios) {}

  // Helpers para pruebas
  marcarUnidadConAuditoriaActiva(unidadId: number, activa = true): void {
    if (activa) this.unidadesConAuditoriasActivas.add(unidadId);
    else this.unidadesConAuditoriasActivas.delete(unidadId);
  }

  marcarProcesoConAuditoriaActiva(procesoId: number, activa = true): void {
    if (activa) this.procesosConAuditoriasActivas.add(procesoId);
    else this.procesosConAuditoriasActivas.delete(procesoId);
  }

  limpiarPeriodos(): void {
    this.periodos = [];
  }

  agregarPeriodo(periodo: PeriodoFiscal): void {
    this.periodos.push(periodo);
  }

  async obtenerPeriodoActivo(): Promise<PeriodoFiscal | null> {
    return this.periodos.find((p) => p.activo) ?? null;
  }

  async listarPeriodos(): Promise<PeriodoFiscal[]> {
    return [...this.periodos];
  }

  private async resolverNombreUsuario(id: number): Promise<string> {
    if (this.usuarios) {
      const u = await this.usuarios.buscarPorId(id);
      if (u) return u.nombre;
    }
    return `Usuario #${id}`;
  }

  private resolverNombrePeriodo(id: number): string {
    const p = this.periodos.find((x) => x.id === id);
    return p ? p.nombre : `Periodo #${id}`;
  }

  async listarUnidades(): Promise<UnidadNegocio[]> {
    const resultado: UnidadNegocio[] = [];
    for (const u of this.unidades) {
      const procs = this.procesos
        .filter((p) => p.unidadNegocioId === u.id)
        .map((p) => ({
          id: p.id,
          nombre: p.nombre,
          unidadNegocioId: p.unidadNegocioId,
          creadoEn: p.creadoEn,
        }));

      resultado.push({
        id: u.id,
        nombre: u.nombre,
        responsableId: u.responsableId,
        responsableNombre: await this.resolverNombreUsuario(u.responsableId),
        periodoFiscalId: u.periodoFiscalId,
        periodoFiscalNombre: this.resolverNombrePeriodo(u.periodoFiscalId),
        creadoPor: u.creadoPor,
        creadoEn: u.creadoEn,
        procesos: procs,
      });
    }
    return resultado;
  }

  async buscarUnidadPorId(id: number): Promise<UnidadNegocio | null> {
    const u = this.unidades.find((x) => x.id === id);
    if (!u) return null;

    const procs = this.procesos
      .filter((p) => p.unidadNegocioId === u.id)
      .map((p) => ({
        id: p.id,
        nombre: p.nombre,
        unidadNegocioId: p.unidadNegocioId,
        creadoEn: p.creadoEn,
      }));

    return {
      id: u.id,
      nombre: u.nombre,
      responsableId: u.responsableId,
      responsableNombre: await this.resolverNombreUsuario(u.responsableId),
      periodoFiscalId: u.periodoFiscalId,
      periodoFiscalNombre: this.resolverNombrePeriodo(u.periodoFiscalId),
      creadoPor: u.creadoPor,
      creadoEn: u.creadoEn,
      procesos: procs,
    };
  }

  async crearUnidadConProceso(
    datos: AltaUnidadInput,
    periodoFiscalId: number,
    creadoPor: number,
  ): Promise<UnidadNegocio> {
    // Validar nombre duplicado de unidad
    const existeUnidad = this.unidades.some(
      (u) => u.nombre.toLowerCase() === datos.nombre.toLowerCase(),
    );
    if (existeUnidad) {
      throw new ErrorNombreDuplicado("una unidad de negocio", datos.nombre);
    }

    const unidadId = this.sigUnidadId++;
    const ahora = new Date().toISOString();

    this.unidades.push({
      id: unidadId,
      nombre: datos.nombre,
      responsableId: datos.responsableId,
      periodoFiscalId,
      creadoPor,
      creadoEn: ahora,
    });

    const procesoId = this.sigProcesoId++;
    this.procesos.push({
      id: procesoId,
      unidadNegocioId: unidadId,
      nombre: datos.proceso,
      creadoEn: ahora,
    });

    return (await this.buscarUnidadPorId(unidadId))!;
  }

  async editarUnidad(
    id: number,
    campos: { nombre?: string; responsableId?: number },
  ): Promise<UnidadNegocio | null> {
    const u = this.unidades.find((x) => x.id === id);
    if (!u) return null;

    if (campos.nombre !== undefined) {
      const duplicado = this.unidades.some(
        (x) => x.id !== id && x.nombre.toLowerCase() === campos.nombre!.toLowerCase(),
      );
      if (duplicado) {
        throw new ErrorNombreDuplicado("una unidad de negocio", campos.nombre);
      }
      u.nombre = campos.nombre;
    }

    if (campos.responsableId !== undefined) {
      u.responsableId = campos.responsableId;
    }

    return this.buscarUnidadPorId(id);
  }

  async tieneAuditoriasActivas(unidadId: number): Promise<boolean> {
    return this.unidadesConAuditoriasActivas.has(unidadId);
  }

  async eliminarUnidad(id: number): Promise<void> {
    this.procesos = this.procesos.filter((p) => p.unidadNegocioId !== id);
    this.unidades = this.unidades.filter((u) => u.id !== id);
  }

  async crearProceso(datos: AltaProcesoInput): Promise<Proceso> {
    const existeProceso = this.procesos.some(
      (p) =>
        p.unidadNegocioId === datos.unidadNegocioId &&
        p.nombre.toLowerCase() === datos.nombre.toLowerCase(),
    );
    if (existeProceso) {
      throw new ErrorNombreDuplicado("un proceso", datos.nombre);
    }

    const p = {
      id: this.sigProcesoId++,
      unidadNegocioId: datos.unidadNegocioId,
      nombre: datos.nombre,
      creadoEn: new Date().toISOString(),
    };
    this.procesos.push(p);
    return { ...p };
  }

  async editarProceso(id: number, nombre: string): Promise<Proceso | null> {
    const p = this.procesos.find((x) => x.id === id);
    if (!p) return null;

    const duplicado = this.procesos.some(
      (x) =>
        x.id !== id &&
        x.unidadNegocioId === p.unidadNegocioId &&
        x.nombre.toLowerCase() === nombre.toLowerCase(),
    );
    if (duplicado) {
      throw new ErrorNombreDuplicado("un proceso", nombre);
    }

    p.nombre = nombre;
    return { ...p };
  }

  async tieneAuditoriasActivasProceso(procesoId: number): Promise<boolean> {
    return this.procesosConAuditoriasActivas.has(procesoId);
  }

  async eliminarProceso(id: number): Promise<void> {
    this.procesos = this.procesos.filter((p) => p.id !== id);
  }
}
