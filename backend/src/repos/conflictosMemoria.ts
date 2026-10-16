import type { DatosDeclaracion, DeclaracionConflicto, PlanResumen } from "../domain/conflictos.js";
import { ErrorDeclaracionDuplicada, type RepositorioConflictos } from "./conflictos.js";
import type { RepositorioPlanes } from "./planes.js";
import type { RepositorioUsuarios } from "./repositorio.js";
import { ASIGNACIONES_DEMO } from "./semilla.js";

interface Fila extends DatosDeclaracion {
  id: number;
  planId: number;
  auditorId: number;
  declaradoEn: string;
}

// Repositorio en memoria para pruebas y desarrollo sin base de datos.
// Los planes salen del repositorio de planes; las asignaciones son las de prueba (ASIGNACIONES_DEMO).
export class RepositorioConflictosMemoria implements RepositorioConflictos {
  private filas: Fila[] = [];
  private asignaciones: { planId: number; auditorId: number }[] = [];
  private siguienteId = 1;
  private readonly listo: Promise<void>;

  constructor(
    private readonly usuarios: RepositorioUsuarios,
    private readonly planes: RepositorioPlanes,
  ) {
    this.listo = this.sembrar();
  }

  private async sembrar() {
    const planes = await this.planes.listar();
    for (const { plan: codigo, auditor } of ASIGNACIONES_DEMO) {
      const plan = planes.find((p) => p.codigo === codigo);
      const usuario = await this.usuarios.buscarPorCorreo(auditor);
      if (plan && usuario) this.asignaciones.push({ planId: plan.id, auditorId: usuario.id });
    }
  }

  private async aDeclaracion(fila: Fila): Promise<DeclaracionConflicto> {
    const usuario = await this.usuarios.buscarPorId(fila.auditorId);
    return {
      id: fila.id,
      plan: (await this.buscarPlan(fila.planId))!,
      auditor: { id: fila.auditorId, nombre: usuario?.nombre ?? "" },
      tieneConflicto: fila.tieneConflicto,
      justificacion: fila.justificacion,
      declaradoEn: fila.declaradoEn,
    };
  }

  async buscarPlan(planId: number) {
    const plan = await this.planes.buscarPorId(planId);
    return plan ? { id: plan.id, codigo: plan.codigo, nombre: plan.nombre } : null;
  }

  async estaAsignado(planId: number, usuarioId: number) {
    await this.listo;
    return this.asignaciones.some((a) => a.planId === planId && a.auditorId === usuarioId);
  }

  async buscarDeclaracion(planId: number, auditorId: number) {
    const fila = this.filas.find((f) => f.planId === planId && f.auditorId === auditorId);
    return fila ? this.aDeclaracion(fila) : null;
  }

  async listarPorPlan(planId: number) {
    return Promise.all(this.filas.filter((f) => f.planId === planId).map((f) => this.aDeclaracion(f)));
  }

  async listarConConflicto() {
    const conConflicto = this.filas.filter((f) => f.tieneConflicto).reverse();
    return Promise.all(conConflicto.map((f) => this.aDeclaracion(f)));
  }

  async listarPendientes(usuarioId: number) {
    await this.listo;
    const ids = [...new Set(this.asignaciones.filter((a) => a.auditorId === usuarioId).map((a) => a.planId))];
    const pendientes = ids.filter((id) => !this.filas.some((f) => f.planId === id && f.auditorId === usuarioId));
    const planes = await Promise.all(pendientes.map((id) => this.buscarPlan(id)));
    return planes.filter((p): p is PlanResumen => p !== null).sort((a, b) => a.codigo.localeCompare(b.codigo));
  }

  async crear(planId: number, auditorId: number, datos: DatosDeclaracion) {
    if (this.filas.some((f) => f.planId === planId && f.auditorId === auditorId)) {
      throw new ErrorDeclaracionDuplicada(planId, auditorId);
    }
    const fila: Fila = { ...datos, id: this.siguienteId++, planId, auditorId, declaradoEn: new Date().toISOString() };
    this.filas.push(fila);
    return this.aDeclaracion(fila);
  }
}
