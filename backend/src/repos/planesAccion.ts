import type {
  AccionFlujoPlan,
  EventoFlujoPlan,
  EvidenciaPlan,
  RechazoPlan,
  SolicitudProrroga,
} from "../domain/flujoPlanAccion.js";
import type {
  DatosEdicionPlanAccion,
  DatosPasoPlanAccion,
  DatosPlanAccion,
  EstadoPlanAccion,
  EtapaPlanAccion,
  HallazgoResumen,
  PasoPlanAccion,
  PlanAccion,
} from "../domain/planesAccion.js";
import type { RepositorioNotificaciones } from "./notificaciones.js";

/** Compatibilidad con consumidores antiguos; la creación ya no lanza este error. */
export class ErrorPlanDuplicado extends Error {
  constructor(hallazgoId: string) {
    super(`El hallazgo ${hallazgoId} ya tiene un plan de acción`);
    this.name = "ErrorPlanDuplicado";
  }
}

/** Cambio de estado del flujo con lo que debe quedar registrado junto con él. */
export interface TransicionPlan {
  desde: readonly EstadoPlanAccion[];
  hacia: EstadoPlanAccion;
  accion: AccionFlujoPlan;
  actor: { id: number; nombre: string; rol: string };
  motivo?: string;
  firmaHash?: string;
  notificar?: AvisoPlan;
  /** Etapa a la que pasa el plan. Si se omite, sigue en la misma. */
  etapaNueva?: EtapaPlanAccion;
  /** Al validar la definición, los hallazgos del plan pasan a "Asignado". */
  asignarHallazgos?: boolean;
  /** Archivos señalados en un rechazo. Sus pasos se reabren para que el auditado los corrija y vuelva a marcarlos. */
  evidenciasObservadas?: readonly EvidenciaPlan[];
}

export interface AvisoPlan {
  usuarioIds: number[];
  mensaje: string;
}

export interface DatosSolicitudProrroga {
  planAccionId: number;
  solicitadaPorId: number;
  fechaActual: string;
  fechaPropuesta: string;
  justificacion: string;
}

export interface DecisionProrroga {
  decididaPorId: number;
  aprobar: boolean;
  motivo: string | null;
  notificar?: AvisoPlan;
}

export interface RepositorioPlanesAccion extends RepositorioNotificaciones {
  /** Datos del hallazgo con la fecha de cierre de su auditoría. Null si el hallazgo no existe. */
  buscarHallazgo(hallazgoId: string): Promise<HallazgoResumen | null>;
  listar(): Promise<PlanAccion[]>;
  /** Planes donde el usuario es responsable o tiene un paso. `soloValidados` omite los que siguen en definición. */
  listarPorResponsable(usuarioId: number, opciones?: { soloValidados?: boolean }): Promise<PlanAccion[]>;
  buscarPorHallazgo(hallazgoId: string): Promise<PlanAccion | null>;
  /** Crea un plan en "Borrador", en la etapa de definición. Sus hallazgos no cambian hasta que se valide. */
  crear(datos: DatosPlanAccion, creadoPorId: number): Promise<PlanAccion>;
  buscarPorId(id: number): Promise<PlanAccion | null>;
  /**
   * Reemplaza los campos editables del plan y, si se indican, sus pasos (solo en la etapa de definición).
   * Null si el plan no existe, está bloqueado por el flujo o ya pasó de la definición y se enviaron pasos.
   */
  actualizar(id: number, datos: DatosEdicionPlanAccion, pasos?: readonly DatosPasoPlanAccion[]): Promise<PlanAccion | null>;
  /**
   * Cambia el estado y escribe el evento y las notificaciones en una sola transacción.
   * Null si el plan no existe o su estado no está en `desde` (por ejemplo, otro revisor ya actuó).
   */
  transicionar(id: number, transicion: TransicionPlan): Promise<PlanAccion | null>;
  /** Planes en los estados de la bandeja de revisión. */
  listarRevision(): Promise<PlanAccion[]>;
  /** Eventos del flujo, del más antiguo al más reciente. */
  listarFlujo(id: number): Promise<EventoFlujoPlan[]>;
  /** Hashes de la evidencia del plan por id de paso. */
  hashesEvidenciaPlan(id: number): Promise<Record<number, string[]>>;
  /** Archivos de evidencia de todos los pasos del plan. */
  evidenciasPlan(id: number): Promise<EvidenciaPlan[]>;
  /** Motivo y archivos señalados del rechazo más reciente, o null si nunca se rechazó. */
  ultimoRechazo(id: number): Promise<RechazoPlan | null>;
  /** Null si el paso no existe, el plan está bloqueado por el flujo o sigue en definición. */
  actualizarPaso(planId: number, pasoId: number, completado: boolean): Promise<PasoPlanAccion | null>;
  crearNotificaciones(usuarioIds: readonly number[], tipo: string, mensaje: string, planId: number): Promise<void>;
  /** Registra la solicitud y su aviso juntos. Null si el plan ya tiene una solicitud abierta. */
  solicitarProrroga(datos: DatosSolicitudProrroga, notificar?: AvisoPlan): Promise<SolicitudProrroga | null>;
  listarProrrogasPendientes(): Promise<SolicitudProrroga[]>;
  buscarProrroga(id: number): Promise<SolicitudProrroga | null>;
  /** La solicitud más reciente del plan, abierta o decidida. */
  ultimaProrroga(planId: number): Promise<SolicitudProrroga | null>;
  /** Decide la solicitud y, si se aprueba, mueve la fecha del plan. Null si ya no está abierta. */
  decidirProrroga(id: number, decision: DecisionProrroga): Promise<SolicitudProrroga | null>;
}
