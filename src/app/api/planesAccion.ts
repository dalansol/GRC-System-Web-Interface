import { pedir } from "./cliente";

// Planes de acción correctivos de un hallazgo (SF-10, SF-11; historia #91).

export type EstadoPlanAccion =
  | "Asignado"
  | "En Progreso"
  | "Completado"
  | "Pendiente"
  | "En Revisión"
  | "Aprobado"
  | "Rechazado";

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
}

// Roles que crean y editan planes de acción (los mismos que valida el backend).
export const ROLES_EDICION_PLAN_ACCION = ["Administrador", "Jefe de Auditoría", "Auditor Senior", "Auditor"];

export const actualizarPlanAccion = (id: number, cambios: CambiosPlanAccion) =>
  pedir<PlanAccion>(`/planes-accion/${id}`, { metodo: "PATCH", cuerpo: cambios });

// ─── Flujo de aprobación (SF-12) ─────────────────────────────────────────────

export type AccionFlujoPlan = "envio" | "apertura" | "aprobacion" | "rechazo";

export interface EventoFlujoPlan {
  id: number;
  planAccionId: number;
  accion: AccionFlujoPlan;
  estadoAnterior: EstadoPlanAccion;
  estadoNuevo: EstadoPlanAccion;
  actor: { id: number; nombre: string; rol: string };
  motivo: string | null;
  firmaHash: string | null;
  fecha: string;
}

export interface FlujoPlan {
  eventos: EventoFlujoPlan[];
  /** Null si el plan no está aprobado; false si su contenido cambió después de la firma. */
  firmaIntegra: boolean | null;
}

// Roles que revisan planes de acción (los mismos que valida el backend).
export const ROLES_REVISION_PLAN_ACCION = ["Administrador", "Jefe de Auditoría"];

type PlanConEstado = { estado?: string; status?: string };
const estadoDe = (plan: PlanConEstado) => plan.status || plan.estado;

/** El plan no admite cambios: lo que se revisa o se firmó no debe moverse. */
export const planBloqueado = (plan: PlanConEstado) =>
  ["Pendiente", "En Revisión", "Aprobado"].includes(estadoDe(plan) ?? "");

/** El plan ya no tiene trabajo pendiente: no cuenta como atrasado. */
export const planFinalizado = (plan: PlanConEstado) => ["Completado", "Aprobado"].includes(estadoDe(plan) ?? "");

/** Tiene el rol de revisor y no es responsable ni tiene pasos asignados en el plan. */
export const puedeRevisarPlan = (
  plan: Pick<PlanAccion, "responsable" | "pasos">,
  usuario: { id: number; rol: string } | null | undefined,
) =>
  Boolean(
    usuario &&
      ROLES_REVISION_PLAN_ACCION.includes(usuario.rol) &&
      plan.responsable?.id !== usuario.id &&
      !plan.pasos?.some((paso) => paso.usuarioAsignado?.id === usuario.id),
  );

export const listarBandejaRevision = () => pedir<PlanAccion[]>("/planes-accion/revision");

export const enviarPlanARevision = (id: number) =>
  pedir<PlanAccion>(`/planes-accion/${id}/enviar-revision`, { metodo: "POST" });

export const abrirRevisionPlan = (id: number) =>
  pedir<PlanAccion>(`/planes-accion/${id}/abrir-revision`, { metodo: "POST" });

export const aprobarPlanAccion = (id: number) =>
  pedir<PlanAccion>(`/planes-accion/${id}/aprobar`, { metodo: "POST" });

export const rechazarPlanAccion = (id: number, motivo: string) =>
  pedir<PlanAccion>(`/planes-accion/${id}/rechazar`, { metodo: "POST", cuerpo: { motivo } });

export const obtenerFlujoPlan = (id: number) => pedir<FlujoPlan>(`/planes-accion/${id}/flujo`);

export const actualizarPasoPlanAccion = (planId: number, pasoId: number, completado: boolean) =>
  pedir<PasoPlanAccion>(`/planes-accion/${planId}/pasos/${pasoId}`, {
    metodo: "PATCH",
    cuerpo: { completado },
  });
