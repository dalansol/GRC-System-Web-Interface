import { pedir } from "./cliente";

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

export const listarNotificaciones = () => pedir<BandejaNotificaciones>("/notificaciones");

export const marcarNotificacionLeida = (id: number) =>
  pedir<void>(`/notificaciones/${id}/leida`, { metodo: "POST" });

export const marcarTodasLeidas = () => pedir<void>("/notificaciones/leidas", { metodo: "POST" });
