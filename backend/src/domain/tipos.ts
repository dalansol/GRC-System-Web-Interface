export type EstadoUsuario = "active" | "inactive";

export const ROL_ADMINISTRADOR = "Administrador";

export interface Rol {
  id: number;
  nombre: string;
  permisos: string[];
}

export interface Usuario {
  id: number;
  nombre: string;
  correo: string;
  rol: string;
  estado: EstadoUsuario;
  ultimoAcceso: string | null;
}

export interface UsuarioConPermisos extends Usuario {
  permisos: string[];
}
