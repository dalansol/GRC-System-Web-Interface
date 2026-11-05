import { pedir } from "./cliente";
import { ROLES_REVISION_PLAN_ACCION, type DestinoPlan } from "./planesAccion";

// Notificaciones del usuario en sesión (dentro de la aplicación).

export interface Notificacion {
  id: number;
  tipo: string;
  mensaje: string;
  entidadTipo: string;
  entidadId: string;
  leida: boolean;
  fecha: string;
}

export interface BandejaNotificaciones {
  noLeidas: number;
  items: Notificacion[];
}

/** A dónde lleva una notificación según quién la recibe. Null si no apunta a un plan. */
export function destinoDeNotificacion(aviso: Notificacion, rol: string | null | undefined): DestinoPlan | null {
  const planId = Number(aviso.entidadId);
  if (aviso.entidadTipo !== "action_plan" || !Number.isInteger(planId) || planId <= 0) return null;
  if (ROLES_REVISION_PLAN_ACCION.includes(rol ?? "")) {
    if (aviso.tipo === "plan_accion.envio") return { planId, pestana: "revision" };
    if (aviso.tipo === "plan_accion.solicitud_prorroga") return { planId, pestana: "prorrogas" };
  }
  return { planId, pestana: "seguimiento" };
}

export const listarNotificaciones = () => pedir<BandejaNotificaciones>("/notificaciones");

export const marcarNotificacionLeida = (id: number) =>
  pedir<void>(`/notificaciones/${id}/leida`, { metodo: "POST" });

export const marcarTodasLeidas = () => pedir<void>("/notificaciones/leidas", { metodo: "POST" });
