import {
  ESTADOS_BANDEJA,
  ESTADOS_BLOQUEADOS,
  type EventoFlujoPlan,
  type EvidenciaPlan,
  type RechazoPlan,
  type SolicitudProrroga,
} from "../domain/flujoPlanAccion.js";
import type {
  DatosEdicionPlanAccion,
  DatosPasoPlanAccion,
  DatosPlanAccion,
  EtapaPlanAccion,
  HallazgoResumen,
  PasoPlanAccion,
  PlanAccion,
} from "../domain/planesAccion.js";
import type { Notificacion } from "./notificaciones.js";
import type {
  AvisoPlan,
  DatosSolicitudProrroga,
  DecisionProrroga,
  RepositorioPlanesAccion,
  TransicionPlan,
} from "./planesAccion.js";
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
  etapa: EtapaPlanAccion;
  pasos: FilaPaso[];
}

// Repositorio en memoria para pruebas y desarrollo sin base de datos.
// Los hallazgos y auditorías son los de prueba; el nombre del responsable se lee del repositorio de usuarios.
export class RepositorioPlanesAccionMemoria implements RepositorioPlanesAccion {
  private filas: Fila[] = [];
  private eventos: EventoFlujoPlan[] = [];
  private notificaciones: (Notificacion & { usuarioId: number })[] = [];
  private evidencias: EvidenciaPlan[] = [];
  private prorrogas: SolicitudProrroga[] = [];
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
          etapa: "cierre",
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
      evidenciasCount: this.evidencias.filter((evidencia) => evidencia.pasoId === paso.id).length,
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

  async listarPorResponsable(usuarioId: number, opciones: { soloValidados?: boolean } = {}) {
    await this.listo;
    return Promise.all(
      this.filas
        .filter((f) =>
          (f.responsableId === usuarioId || f.pasos.some((paso) => paso.usuarioAsignadoId === usuarioId)) &&
          (!opciones.soloValidados || f.etapa === "cierre"),
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
      estado: "Borrador",
      creadoEn,
      creadoPorId,
      etapa: "definicion",
      pasos: this.filasPaso(id, datos.pasos ?? [], creadoEn),
    };
    this.filas.push(fila);
    return this.aPlan(fila);
  }

  async buscarPorId(id: number) {
    await this.listo;
    const fila = this.filas.find((f) => f.id === id);
    return fila ? this.aPlan(fila) : null;
  }

  async actualizar(id: number, datos: DatosEdicionPlanAccion, pasos?: readonly DatosPasoPlanAccion[]) {
    await this.listo;
    const fila = this.filas.find((f) => f.id === id);
    if (!fila || ESTADOS_BLOQUEADOS.includes(fila.estado)) return null;
    if (pasos && fila.etapa !== "definicion") return null;
    Object.assign(fila, datos);
    if (pasos) fila.pasos = this.filasPaso(id, pasos, new Date().toISOString());
    return this.aPlan(fila);
  }

  private filasPaso(planAccionId: number, pasos: readonly DatosPasoPlanAccion[], creadoEn: string): FilaPaso[] {
    return pasos.map((paso) => ({
      id: this.siguientePasoId++,
      planAccionId,
      usuarioAsignadoId: paso.usuarioAsignadoId,
      descripcion: paso.descripcion,
      fechaCompromiso: paso.fechaCompromiso,
      completado: false,
      creadoEn,
    }));
  }

  async transicionar(id: number, t: TransicionPlan) {
    await this.listo;
    const fila = this.filas.find((f) => f.id === id);
    if (!fila || !t.desde.includes(fila.estado)) return null;
    const fecha = new Date().toISOString();
    this.eventos.push({
      id: this.siguienteEventoId++,
      planAccionId: id,
      etapa: fila.etapa,
      accion: t.accion,
      estadoAnterior: fila.estado,
      estadoNuevo: t.hacia,
      actor: t.actor,
      motivo: t.motivo ?? null,
      firmaHash: t.firmaHash ?? null,
      fecha,
      evidenciasObservadas: (t.evidenciasObservadas ?? []).map((evidencia) => ({
        evidenciaId: evidencia.id,
        pasoId: evidencia.pasoId,
        nombre: evidencia.nombre,
      })),
    });
    await this.crearNotificaciones(t.notificar?.usuarioIds ?? [], `plan_accion.${t.accion}`, t.notificar?.mensaje ?? "", id);
    fila.estado = t.hacia;
    if (t.etapaNueva) fila.etapa = t.etapaNueva;
    const pasosReabiertos = new Set((t.evidenciasObservadas ?? []).map((evidencia) => evidencia.pasoId));
    for (const paso of fila.pasos) {
      if (pasosReabiertos.has(paso.id)) paso.completado = false;
    }
    return this.aPlan(fila);
  }

  async crearNotificaciones(usuarioIds: readonly number[], tipo: string, mensaje: string, planId: number) {
    const fecha = new Date().toISOString();
    for (const usuarioId of usuarioIds) {
      this.notificaciones.push({
        id: this.siguienteNotificacionId++,
        usuarioId,
        tipo,
        mensaje,
        entidadTipo: "action_plan",
        entidadId: String(planId),
        leida: false,
        fecha,
      });
    }
  }

  async listarRevision() {
    await this.listo;
    return Promise.all(this.filas.filter((f) => ESTADOS_BANDEJA.includes(f.estado)).map((f) => this.aPlan(f)));
  }

  async listarFlujo(id: number) {
    return this.eventos.filter((evento) => evento.planAccionId === id);
  }

  async hashesEvidenciaPlan(id: number): Promise<Record<number, string[]>> {
    const porPaso: Record<number, string[]> = {};
    for (const evidencia of await this.evidenciasPlan(id)) {
      (porPaso[evidencia.pasoId] ??= []).push(evidencia.hash);
    }
    return porPaso;
  }

  async evidenciasPlan(id: number): Promise<EvidenciaPlan[]> {
    const pasos = new Set(this.filas.find((f) => f.id === id)?.pasos.map((paso) => paso.id) ?? []);
    return this.evidencias.filter((evidencia) => pasos.has(evidencia.pasoId));
  }

  /** Las rutas de evidencia no existen en este modo: las pruebas registran los archivos directamente. */
  registrarEvidencia(evidencia: EvidenciaPlan) {
    this.evidencias.push(evidencia);
  }

  async ultimoRechazo(id: number): Promise<RechazoPlan | null> {
    const evento = [...this.eventos].reverse().find((item) => item.planAccionId === id && item.accion === "rechazo");
    return evento ? { motivo: evento.motivo ?? "", fecha: evento.fecha, evidenciasObservadas: evento.evidenciasObservadas } : null;
  }

  async solicitarProrroga(datos: DatosSolicitudProrroga, notificar?: AvisoPlan) {
    await this.listo;
    const abierta = this.prorrogas.some((item) => item.planAccionId === datos.planAccionId && item.estado === "Pendiente");
    const fila = this.filas.find((f) => f.id === datos.planAccionId);
    if (abierta || !fila) return null;
    const usuario = await this.usuarios.buscarPorId(datos.solicitadaPorId);
    const solicitud: SolicitudProrroga = {
      id: this.prorrogas.length + 1,
      planAccionId: datos.planAccionId,
      folioPlan: (await this.aPlan(fila)).publicId,
      solicitadaPor: { id: datos.solicitadaPorId, nombre: usuario?.nombre ?? "" },
      fechaActual: datos.fechaActual,
      fechaPropuesta: datos.fechaPropuesta,
      justificacion: datos.justificacion,
      estado: "Pendiente",
      motivoDecision: null,
      creadaEn: new Date().toISOString(),
    };
    this.prorrogas.push(solicitud);
    await this.crearNotificaciones(notificar?.usuarioIds ?? [], "plan_accion.solicitud_prorroga", notificar?.mensaje ?? "", datos.planAccionId);
    return solicitud;
  }

  async listarProrrogasPendientes() {
    return this.prorrogas.filter((item) => item.estado === "Pendiente");
  }

  async buscarProrroga(id: number) {
    return this.prorrogas.find((item) => item.id === id) ?? null;
  }

  async ultimaProrroga(planId: number) {
    return [...this.prorrogas].reverse().find((item) => item.planAccionId === planId) ?? null;
  }

  async decidirProrroga(id: number, decision: DecisionProrroga) {
    const solicitud = this.prorrogas.find((item) => item.id === id);
    if (!solicitud || solicitud.estado !== "Pendiente") return null;
    solicitud.estado = decision.aprobar ? "Aprobada" : "Rechazada";
    solicitud.motivoDecision = decision.motivo;
    if (decision.aprobar) {
      const fila = this.filas.find((f) => f.id === solicitud.planAccionId);
      if (fila) fila.fechaCompromiso = solicitud.fechaPropuesta;
    }
    await this.crearNotificaciones(decision.notificar?.usuarioIds ?? [], "plan_accion.decision_prorroga", decision.notificar?.mensaje ?? "", solicitud.planAccionId);
    return solicitud;
  }

  async actualizarPaso(planId: number, pasoId: number, completado: boolean) {
    await this.listo;
    const fila = this.filas.find((f) => f.id === planId);
    const paso = fila?.pasos.find((item) => item.id === pasoId);
    if (!fila || !paso || fila.etapa !== "cierre" || ESTADOS_BLOQUEADOS.includes(fila.estado)) return null;
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
