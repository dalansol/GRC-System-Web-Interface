import { pedir } from "./cliente";

export const ROL_ADMINISTRADOR = "Administrador";

export interface Usuario {
  id: number;
  nombre: string;
  correo: string;
  rol: string;
  estado: "active" | "inactive";
  ultimoAcceso: string | null;
}

export interface UsuarioConPermisos extends Usuario {
  permisos: string[];
}

export interface Rol {
  id: number;
  nombre: string;
  permisos: string[];
}

export interface NuevoUsuario {
  nombre: string;
  correo: string;
  rol: string;
}

export const obtenerSesion = () => pedir<UsuarioConPermisos>("/api/me");

export const listarRoles = () => pedir<Rol[]>("/api/roles");

export const listarUsuarios = () => pedir<Usuario[]>("/api/usuarios");

export const crearUsuario = (datos: NuevoUsuario) =>
  pedir<Usuario>("/api/usuarios", { metodo: "POST", cuerpo: datos });

export const cambiarRol = (id: number, rol: string) =>
  pedir<UsuarioConPermisos>(`/api/usuarios/${id}/rol`, { metodo: "PATCH", cuerpo: { rol } });
