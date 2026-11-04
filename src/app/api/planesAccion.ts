import { pedir } from "./cliente";

// Planes de acción correctivos de un hallazgo (SF-10, SF-11; historia #91).

export type EstadoPlanAccion = "Asignado" | "En Progreso" | "Completado" | "En Revisión";

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

export const aprobarPlanAccion = (id: number) =>
  pedir<PlanAccion>(`/planes-accion/${id}/aprobar`, { metodo: "POST" });

export const actualizarPasoPlanAccion = (planId: number, pasoId: number, completado: boolean) =>
  pedir<PasoPlanAccion>(`/planes-accion/${planId}/pasos/${pasoId}`, {
    metodo: "PATCH",
    cuerpo: { completado },
  });
