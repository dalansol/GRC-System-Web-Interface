// Notificaciones dentro de la aplicación. Se crean junto con el cambio que avisan (ver `transicionar`).

export interface Notificacion {
  id: number;
  tipo: string;
  mensaje: string;
  entidadTipo: string;
  entidadId: string;
  leida: boolean;
  fecha: string;
}

export interface RepositorioNotificaciones {
  /** Las del usuario, de la más reciente a la más antigua, hasta 50. */
  listarNotificaciones(usuarioId: number): Promise<Notificacion[]>;
  /** False si la notificación no existe o no es del usuario. */
  marcarNotificacionLeida(id: number, usuarioId: number): Promise<boolean>;
  marcarTodasLeidas(usuarioId: number): Promise<void>;
}
