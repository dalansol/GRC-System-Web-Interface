import { pedir } from "./cliente";

// Planes de acción correctivos de un hallazgo (SF-10, SF-11; historia #91).

export type EstadoPlanAccion =
  | "Borrador"
  | "Asignado"
  | "En Progreso"
  | "Completado"
  | "Pendiente"
  | "En Revisión"
  | "Aprobado"
  | "Rechazado";

/** `definicion`: el plan aún no se valida y el auditado no lo ve. `cierre`: se trabaja y se revisa su evidencia. */
export type EtapaPlanAccion = "definicion" | "cierre";

export interface HallazgoResumen {
  id: string;
  folio: string | null;
  titulo: string;
  severidad: string | null;
  auditoriaId: string | null;
  controlId: string | null;
  /** Fecha de cierre de la auditoría (AAAA-MM-DD) o null si no está registrada. */
  fechaCierreAuditoria: string | null;
}

export interface PlanAccion {
  id: number;
  publicId: string;
  titulo: string;
  causaRaiz: string | null;
  hallazgo: HallazgoResumen;
  descripcion: string;
  responsable: { id: number; nombre: string };
  /** AAAA-MM-DD */
  fechaCompromiso: string;
  status: EstadoPlanAccion;
  estado: EstadoPlanAccion;
  etapa: EtapaPlanAccion;
  creadoEn: string;
  creadoPorId?: number;
  hallazgosRelacionados: HallazgoResumen[];
  pasos: PasoPlanAccion[];
}

export interface PasoPlanAccion {
  id: number;
  action_plan_id: number;
  planAccionId: number;
  usuarioAsignado: { id: number; nombre: string } | null;
  descripcion: string;
  fechaCompromiso: string | null;
  completado: boolean;
  creadoEn: string;
  evidenciasCount: number;
}

export interface NuevoPlanAccion {
  hallazgoId: string;
  titulo: string;
  causaRaiz: string;
  descripcion: string;
  responsableId: number;
  fechaCompromiso: string;
  pasos: NuevoPasoPlanAccion[];
}

export interface NuevoPasoPlanAccion {
  id?: number;
  descripcion: string;
  usuarioAsignadoId: number;
  fechaCompromiso: string;
}

export interface Responsable {
  id: number;
  nombre: string;
  correo: string;
}

export const MENSAJE_FECHA_ANTERIOR_AL_CIERRE =
  "La fecha de compromiso debe ser igual o posterior a la fecha de cierre de la auditoría.";

export const listarPlanesAccion = () => pedir<PlanAccion[]>("/planes-accion");

export const listarMisPlanesAccion = () => pedir<PlanAccion[]>("/planes-accion/mios");

export const listarResponsables = () => pedir<Responsable[]>("/planes-accion/responsables");

export const obtenerHallazgoParaPlan = (hallazgoId: string) =>
  pedir<HallazgoResumen>(`/planes-accion/hallazgos/${encodeURIComponent(hallazgoId)}`);

export const crearPlanAccion = (datos: NuevoPlanAccion) =>
  pedir<PlanAccion>("/planes-accion", { metodo: "POST", cuerpo: datos });

/** Estados que el equipo de auditoría fija a mano. Los demás solo los cambia el flujo de aprobación. */
export const ESTADOS_PLAN_ACCION: EstadoPlanAccion[] = ["Asignado", "En Progreso", "Completado"];

/** Campos que el equipo de auditoría puede modificar. El responsable auditado no edita su plan. */
export interface CambiosPlanAccion {
  titulo?: string;
  descripcion?: string;
  responsableId?: number;
  fechaCompromiso?: string;
  estado?: EstadoPlanAccion;
  pasos?: NuevoPasoPlanAccion[];
}

// Equipo de auditoría: consulta la evidencia y el historial de cualquier plan.
export const ROLES_EDICION_PLAN_ACCION = ["Administrador", "Jefe de Auditoría", "Auditor Senior", "Auditor"];
// Roles que crean planes, los editan y los envían a revisión (los mismos que valida el backend).
export const ROLES_GESTION_PLAN_ACCION = ["Auditor", "Auditor Senior"];
// Roles de las áreas auditadas: solo trabajan con lo que tienen asignado.
export const ROLES_AUDITADO = ["Jefe Auditado", "Empleado Auditado"];

export const esAuditado = (rol: string | null | undefined) => ROLES_AUDITADO.includes(rol ?? "");
export const puedeGestionarPlanes = (rol: string | null | undefined) => ROLES_GESTION_PLAN_ACCION.includes(rol ?? "");

export type PestanaPlanes = "seguimiento" | "revision" | "prorrogas";

/** Plan al que hay que llevar al usuario, por ejemplo desde una notificación. */
export interface DestinoPlan {
  planId: number;
  pestana: PestanaPlanes;
}

/** `solicitud` cambia con cada clic, para volver al mismo plan aunque la vista ya esté abierta. */
export interface SolicitudDestinoPlan extends DestinoPlan {
  solicitud: number;
}

export const ETIQUETA_ETAPA: Record<EtapaPlanAccion, string> = {
  definicion: "Validación del plan",
  cierre: "Cierre y evidencia",
};

export const actualizarPlanAccion = (id: number, cambios: CambiosPlanAccion) =>
  pedir<PlanAccion>(`/planes-accion/${id}`, { metodo: "PATCH", cuerpo: cambios });

// ─── Flujo de aprobación (SF-12) ─────────────────────────────────────────────

export type AccionFlujoPlan = "envio" | "apertura" | "aprobacion" | "rechazo";

/** Archivo señalado en un rechazo. */
export interface EvidenciaObservada {
  evidenciaId: string;
  pasoId: number;
  nombre: string;
}

/** Archivo de evidencia de un paso del plan. */
export interface EvidenciaPlan {
  id: string;
  pasoId: number;
  nombre: string;
  hash: string;
}

export interface EventoFlujoPlan {
  id: number;
  planAccionId: number;
  etapa?: EtapaPlanAccion;
  accion: AccionFlujoPlan;
  estadoAnterior: EstadoPlanAccion;
  estadoNuevo: EstadoPlanAccion;
  actor: { id: number; nombre: string; rol: string };
  motivo: string | null;
  firmaHash: string | null;
  fecha: string;
  evidenciasObservadas?: EvidenciaObservada[];
}

export interface FlujoPlan {
  eventos: EventoFlujoPlan[];
  /** Null si el plan no está aprobado; false si su contenido cambió después de la firma. */
  firmaIntegra: boolean | null;
}

// Roles que revisan planes de acción (los mismos que valida el backend).
export const ROLES_REVISION_PLAN_ACCION = ["Jefe de Auditoría"];

type PlanConEstado = { estado?: string; status?: string };
const estadoDe = (plan: PlanConEstado) => plan.status || plan.estado;

/** El plan no admite cambios: lo que se revisa o se firmó no debe moverse. */
export const planBloqueado = (plan: PlanConEstado) =>
  ["Pendiente", "En Revisión", "Aprobado"].includes(estadoDe(plan) ?? "");

/** El plan ya no tiene trabajo pendiente: no cuenta como atrasado. */
export const planFinalizado = (plan: PlanConEstado) => ["Completado", "Aprobado"].includes(estadoDe(plan) ?? "");

const participaEnPlan = (plan: Pick<PlanAccion, "responsable" | "pasos">, usuarioId: number) =>
  plan.responsable?.id === usuarioId || Boolean(plan.pasos?.some((paso) => paso.usuarioAsignado?.id === usuarioId));

/** Tiene el rol de revisor y no es responsable, no creó el plan ni tiene pasos asignados. */
export const puedeRevisarPlan = (
  plan: Pick<PlanAccion, "responsable" | "pasos" | "creadoPorId">,
  usuario: { id: number; rol: string } | null | undefined,
) =>
  Boolean(
    usuario &&
      ROLES_REVISION_PLAN_ACCION.includes(usuario.rol) &&
      plan.creadoPorId !== usuario.id &&
      !participaEnPlan(plan, usuario.id),
  );

/** Un Auditor o Auditor Senior ajeno al plan, con el plan listo para la revisión que le toca. */
export const puedeEnviarPlan = (
  plan: Pick<PlanAccion, "responsable" | "pasos" | "etapa"> & PlanConEstado,
  usuario: { id: number; rol: string } | null | undefined,
) => {
  if (!usuario || !puedeGestionarPlanes(usuario.rol) || participaEnPlan(plan, usuario.id)) return false;
  if (!plan.pasos?.length) return false;
  const estado = estadoDe(plan) ?? "";
  if (plan.etapa === "definicion") return ["Borrador", "Rechazado"].includes(estado);
  return (
    ["Asignado", "En Progreso", "Completado", "Rechazado"].includes(estado) &&
    plan.pasos.every((paso) => paso.completado && paso.evidenciasCount > 0)
  );
};

/** El auditor puede editarlo: no está en revisión ni aprobado, y no es responsable de un plan anterior. */
export const puedeEditarPlan = (
  plan: Pick<PlanAccion, "responsable"> & PlanConEstado,
  usuario: { id: number; rol: string } | null | undefined,
) => Boolean(usuario && puedeGestionarPlanes(usuario.rol) && plan.responsable?.id !== usuario.id && !planBloqueado(plan));

export const listarBandejaRevision = () => pedir<PlanAccion[]>("/planes-accion/revision");

export const enviarPlanARevision = (id: number) =>
  pedir<PlanAccion>(`/planes-accion/${id}/enviar-revision`, { metodo: "POST" });

export const abrirRevisionPlan = (id: number) =>
  pedir<PlanAccion>(`/planes-accion/${id}/abrir-revision`, { metodo: "POST" });

export const aprobarPlanAccion = (id: number) =>
  pedir<PlanAccion>(`/planes-accion/${id}/aprobar`, { metodo: "POST" });

export const rechazarPlanAccion = (id: number, motivo: string, evidenciasObservadas: string[] = []) =>
  pedir<PlanAccion>(`/planes-accion/${id}/rechazar`, { metodo: "POST", cuerpo: { motivo, evidenciasObservadas } });

export const listarEvidenciasPlan = (id: number) => pedir<EvidenciaPlan[]>(`/planes-accion/${id}/evidencias`);

export const obtenerFlujoPlan = (id: number) => pedir<FlujoPlan>(`/planes-accion/${id}/flujo`);

export const actualizarPasoPlanAccion = (planId: number, pasoId: number, completado: boolean) =>
  pedir<PasoPlanAccion>(`/planes-accion/${planId}/pasos/${pasoId}`, {
    metodo: "PATCH",
    cuerpo: { completado },
  });

// ─── Portal del auditado (UF-13, SF-16) ───────────────────

/** Lo único que el backend le entrega a un auditado de un plan. */
export interface PlanAuditado {
  id: number;
  publicId: string;
  titulo: string;
  estado: EstadoPlanAccion;
  fechaCompromiso: string;
  hallazgo: { folio: string | null; titulo: string };
  esResponsable: boolean;
  pasos: PasoAuditado[];
  rechazo: { motivo: string; fecha: string; evidenciasObservadas: EvidenciaObservada[] } | null;
  prorroga: SolicitudProrroga | null;
}

export interface PasoAuditado {
  id: number;
  descripcion: string;
  fechaCompromiso: string | null;
  completado: boolean;
  evidenciasCount: number;
  usuarioAsignado: { id: number; nombre: string } | null;
  esMio: boolean;
}

export const listarPlanesAuditado = () => pedir<PlanAuditado[]>("/planes-accion/mios");

// ─── Prórrogas (SF-11) ────────────────────────────────────

export interface SolicitudProrroga {
  id: number;
  planAccionId: number;
  folioPlan: string;
  solicitadaPor: { id: number; nombre: string };
  fechaActual: string;
  fechaPropuesta: string;
  justificacion: string;
  estado: "Pendiente" | "Aprobada" | "Rechazada";
  motivoDecision: string | null;
  creadaEn: string;
}

export const solicitarProrroga = (planId: number, datos: { fechaPropuesta: string; justificacion: string }) =>
  pedir<SolicitudProrroga>(`/planes-accion/${planId}/prorrogas`, { metodo: "POST", cuerpo: datos });

export const listarProrrogasPendientes = () => pedir<SolicitudProrroga[]>("/planes-accion/prorrogas");

export const aprobarProrroga = (id: number) =>
  pedir<SolicitudProrroga>(`/planes-accion/prorrogas/${id}/aprobar`, { metodo: "POST" });

export const rechazarProrroga = (id: number, motivo: string) =>
  pedir<SolicitudProrroga>(`/planes-accion/prorrogas/${id}/rechazar`, { metodo: "POST", cuerpo: { motivo } });
