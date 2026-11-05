import { ESTADOS_BANDEJA, ESTADOS_BLOQUEADOS, type EventoFlujoPlan } from "../domain/flujoPlanAccion.js";
import type {
  DatosEdicionPlanAccion,
  DatosPlanAccion,
  HallazgoResumen,
  PasoPlanAccion,
  PlanAccion,
} from "../domain/planesAccion.js";
import type { Notificacion } from "./notificaciones.js";
import type { RepositorioPlanesAccion, TransicionPlan } from "./planesAccion.js";
import type { RepositorioUsuarios } from "./repositorio.js";
import { AUDITORIAS_DEMO, HALLAZGOS_DEMO, PLANES_ACCION_DEMO } from "./semilla.js";

interface FilaPaso {
  id: number;
  planAccionId: number;
  usuarioAsignadoId: number;
  descripcion: string;
  fechaCompromiso: string;
  completado: boolean;
  creadoEn: string;
}

interface Fila extends Omit<DatosPlanAccion, "pasos"> {
  id: number;
  estado: PlanAccion["estado"];
  creadoEn: string;
  creadoPorId: number;
  pasos: FilaPaso[];
}

// Repositorio en memoria para pruebas y desarrollo sin base de datos.
// Los hallazgos y auditorías son los de prueba; el nombre del responsable se lee del repositorio de usuarios.
export class RepositorioPlanesAccionMemoria implements RepositorioPlanesAccion {
  private filas: Fila[] = [];
  private eventos: EventoFlujoPlan[] = [];
  private notificaciones: (Notificacion & { usuarioId: number })[] = [];
  private siguienteId = 1;
  private siguientePasoId = 1;
  private siguienteEventoId = 1;
  private siguienteNotificacionId = 1;
  private readonly listo: Promise<void>;

  constructor(private readonly usuarios: RepositorioUsuarios) {
    this.listo = this.sembrar();
  }

  private async sembrar() {
    for (const { responsable, ...plan } of PLANES_ACCION_DEMO) {
      const usuario = await this.usuarios.buscarPorCorreo(responsable);
      if (usuario) {
        this.filas.push({
          ...plan,
          titulo: "Plan de acción",
          causaRaiz: plan.descripcion,
          pasos: [],
          responsableId: usuario.id,
          id: this.siguienteId++,
          estado: "Asignado",
          creadoEn: "2025-07-12T10:00:00.000Z",
          creadoPorId: usuario.id,
        });
      }
    }
  }

  private async aPaso(paso: FilaPaso): Promise<PasoPlanAccion> {
    const usuario = await this.usuarios.buscarPorId(paso.usuarioAsignadoId);
    return {
      id: paso.id,
      action_plan_id: paso.planAccionId,
      planAccionId: paso.planAccionId,
      usuarioAsignado: { id: paso.usuarioAsignadoId, nombre: usuario?.nombre ?? "" },
      descripcion: paso.descripcion,
      fechaCompromiso: paso.fechaCompromiso,
      completado: paso.completado,
      creadoEn: paso.creadoEn,
      evidenciasCount: 0,
    };
  }

  private async aPlan({ responsableId, hallazgoId, pasos, ...fila }: Fila): Promise<PlanAccion> {
    const usuario = await this.usuarios.buscarPorId(responsableId);
    const hallazgo = await this.buscarHallazgo(hallazgoId);
    return {
      ...fila,
      publicId: `PACC-${new Date(fila.creadoEn).getUTCFullYear()}-${String(fila.id).padStart(3, "0")}`,
      hallazgo: hallazgo!,
      responsable: { id: responsableId, nombre: usuario?.nombre ?? "" },
      titulo: fila.titulo ?? fila.descripcion,
      causaRaiz: fila.causaRaiz ?? fila.descripcion,
      status: fila.estado,
      hallazgosRelacionados: hallazgo ? [hallazgo] : [],
      pasos: await Promise.all(pasos.map((paso) => this.aPaso(paso))),
    };
  }

  async buscarHallazgo(hallazgoId: string): Promise<HallazgoResumen | null> {
    const hallazgo = HALLAZGOS_DEMO.find((h) => h.id === hallazgoId);
    if (!hallazgo) return null;
    const auditoria = AUDITORIAS_DEMO.find((a) => a.id === hallazgo.auditoriaId);
    return { ...hallazgo, fechaCierreAuditoria: auditoria?.fechaCierre ?? null };
  }

  async listar() {
    await this.listo;
    return Promise.all(this.filas.map((f) => this.aPlan(f)));
  }

  async listarPorResponsable(usuarioId: number) {
    await this.listo;
    return Promise.all(
      this.filas
        .filter((f) =>
          f.responsableId === usuarioId ||
          f.pasos.some((paso) => paso.usuarioAsignadoId === usuarioId),
        )
        .map((f) => this.aPlan(f)),
    );
  }

  async buscarPorHallazgo(hallazgoId: string) {
    await this.listo;
    const fila = this.filas.find((f) => f.hallazgoId === hallazgoId);
    return fila ? this.aPlan(fila) : null;
  }

  async crear(datos: DatosPlanAccion, creadoPorId: number) {
    await this.listo;
    const creadoEn = new Date().toISOString();
    const id = this.siguienteId++;
    const fila: Fila = {
      ...datos,
      id,
      estado: "Asignado",
      creadoEn,
      creadoPorId,
      pasos: (datos.pasos ?? []).map((paso) => ({
        id: this.siguientePasoId++,
        planAccionId: id,
        usuarioAsignadoId: paso.usuarioAsignadoId,
        descripcion: paso.descripcion,
        fechaCompromiso: paso.fechaCompromiso,
        completado: false,
        creadoEn,
      })),
    };
    this.filas.push(fila);
    return this.aPlan(fila);
  }

  async buscarPorId(id: number) {
    await this.listo;
    const fila = this.filas.find((f) => f.id === id);
    return fila ? this.aPlan(fila) : null;
  }

  async actualizar(id: number, datos: DatosEdicionPlanAccion) {
    await this.listo;
    const fila = this.filas.find((f) => f.id === id);
    if (!fila || ESTADOS_BLOQUEADOS.includes(fila.estado)) return null;
    Object.assign(fila, datos);
    return this.aPlan(fila);
  }

  async transicionar(id: number, t: TransicionPlan) {
    await this.listo;
    const fila = this.filas.find((f) => f.id === id);
    if (!fila || !t.desde.includes(fila.estado)) return null;
    const fecha = new Date().toISOString();
    this.eventos.push({
      id: this.siguienteEventoId++,
      planAccionId: id,
      accion: t.accion,
      estadoAnterior: fila.estado,
      estadoNuevo: t.hacia,
      actor: t.actor,
      motivo: t.motivo ?? null,
      firmaHash: t.firmaHash ?? null,
      fecha,
    });
    for (const usuarioId of t.notificar?.usuarioIds ?? []) {
      this.notificaciones.push({
        id: this.siguienteNotificacionId++,
        usuarioId,
        tipo: `plan_accion.${t.accion}`,
        mensaje: t.notificar!.mensaje,
        entidadTipo: "action_plan",
        entidadId: String(id),
        leida: false,
        fecha,
      });
    }
    fila.estado = t.hacia;
    return this.aPlan(fila);
  }

  async listarRevision() {
    await this.listo;
    return Promise.all(this.filas.filter((f) => ESTADOS_BANDEJA.includes(f.estado)).map((f) => this.aPlan(f)));
  }

  async listarFlujo(id: number) {
    return this.eventos.filter((evento) => evento.planAccionId === id);
  }

  // La evidencia en memoria no se liga a los pasos de un plan.
  async hashesEvidenciaPlan(_id: number): Promise<Record<number, string[]>> {
    return {};
  }

  async actualizarPaso(planId: number, pasoId: number, completado: boolean) {
    await this.listo;
    const fila = this.filas.find((f) => f.id === planId);
    const paso = fila?.pasos.find((item) => item.id === pasoId);
    if (!fila || !paso || ESTADOS_BLOQUEADOS.includes(fila.estado)) return null;
    paso.completado = completado;
    return this.aPaso(paso);
  }

  async listarNotificaciones(usuarioId: number) {
    return this.notificaciones
      .filter((aviso) => aviso.usuarioId === usuarioId)
      .reverse()
      .slice(0, 50)
      .map(({ usuarioId: _usuarioId, ...aviso }) => aviso);
  }

  async marcarNotificacionLeida(id: number, usuarioId: number) {
    const aviso = this.notificaciones.find((item) => item.id === id && item.usuarioId === usuarioId);
    if (!aviso) return false;
    aviso.leida = true;
    return true;
  }

  async marcarTodasLeidas(usuarioId: number) {
    for (const aviso of this.notificaciones) {
      if (aviso.usuarioId === usuarioId) aviso.leida = true;
    }
  }
}
