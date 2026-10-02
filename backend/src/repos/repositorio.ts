import type { Rol, Usuario } from "../domain/tipos.js";

export interface NuevoUsuario {
  nombre: string;
  correo: string;
  rolId: number;
}

export class ErrorCorreoDuplicado extends Error {
  constructor(correo: string) {
    super(`El correo ${correo} ya está registrado`);
    this.name = "ErrorCorreoDuplicado";
  }
}

export interface RepositorioUsuarios {
  listarUsuarios(): Promise<Usuario[]>;
  buscarPorId(id: number): Promise<Usuario | null>;
  buscarPorCorreo(correo: string): Promise<Usuario | null>;
  buscarPorOid(oid: string): Promise<Usuario | null>;
  /** Asocia la identidad de Entra al usuario. Devuelve false si ya tenía otra. */
  vincularOid(id: number, oid: string): Promise<boolean>;
  registrarAcceso(id: number): Promise<void>;
  /** Lanza ErrorCorreoDuplicado si el correo ya existe. */
  crearUsuario(datos: NuevoUsuario): Promise<Usuario>;
  cambiarRol(id: number, rolId: number): Promise<Usuario | null>;
  contarActivosConRol(rolId: number): Promise<number>;
  listarRoles(): Promise<Rol[]>;
  buscarRolPorNombre(nombre: string): Promise<Rol | null>;
}
