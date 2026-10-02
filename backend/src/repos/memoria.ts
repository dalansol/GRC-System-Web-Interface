import type { EstadoUsuario, Rol, Usuario } from "../domain/tipos.js";
import { ErrorCorreoDuplicado, type NuevoUsuario, type RepositorioUsuarios } from "./repositorio.js";
import { ROLES_PERMISOS, USUARIOS_DEMO } from "./semilla.js";

interface Fila {
  id: number;
  nombre: string;
  correo: string;
  rolId: number;
  estado: EstadoUsuario;
  oid: string | null;
  ultimoAcceso: string | null;
}

// Repositorio en memoria para pruebas y desarrollo sin base de datos.
export class RepositorioMemoria implements RepositorioUsuarios {
  private roles: Rol[];
  private filas: Fila[] = [];
  private siguienteId = 1;

  constructor() {
    this.roles = Object.entries(ROLES_PERMISOS).map(([nombre, permisos], i) => ({
      id: i + 1,
      nombre,
      permisos: [...permisos],
    }));
    for (const u of USUARIOS_DEMO) {
      this.filas.push({
        id: this.siguienteId++,
        nombre: u.nombre,
        correo: u.correo,
        rolId: this.roles.find((r) => r.nombre === u.rol)!.id,
        estado: u.estado,
        oid: null,
        ultimoAcceso: null,
      });
    }
  }

  private aUsuario(fila: Fila): Usuario {
    return {
      id: fila.id,
      nombre: fila.nombre,
      correo: fila.correo,
      rol: this.roles.find((r) => r.id === fila.rolId)!.nombre,
      estado: fila.estado,
      ultimoAcceso: fila.ultimoAcceso,
    };
  }

  private buscar(condicion: (fila: Fila) => boolean): Usuario | null {
    const fila = this.filas.find(condicion);
    return fila ? this.aUsuario(fila) : null;
  }

  async listarUsuarios() {
    return this.filas.map((fila) => this.aUsuario(fila));
  }

  async buscarPorId(id: number) {
    return this.buscar((f) => f.id === id);
  }

  async buscarPorCorreo(correo: string) {
    return this.buscar((f) => f.correo === correo.toLowerCase());
  }

  async buscarPorOid(oid: string) {
    return this.buscar((f) => f.oid === oid);
  }

  async vincularOid(id: number, oid: string) {
    const fila = this.filas.find((f) => f.id === id);
    if (!fila || fila.oid !== null) return false;
    fila.oid = oid;
    return true;
  }

  async registrarAcceso(id: number) {
    const fila = this.filas.find((f) => f.id === id);
    if (fila) fila.ultimoAcceso = new Date().toISOString();
  }

  async crearUsuario(datos: NuevoUsuario) {
    if (this.filas.some((f) => f.correo === datos.correo)) {
      throw new ErrorCorreoDuplicado(datos.correo);
    }
    const fila: Fila = {
      id: this.siguienteId++,
      nombre: datos.nombre,
      correo: datos.correo,
      rolId: datos.rolId,
      estado: "active",
      oid: null,
      ultimoAcceso: null,
    };
    this.filas.push(fila);
    return this.aUsuario(fila);
  }

  async cambiarRol(id: number, rolId: number) {
    const fila = this.filas.find((f) => f.id === id);
    if (!fila) return null;
    fila.rolId = rolId;
    return this.aUsuario(fila);
  }

  async contarActivosConRol(rolId: number) {
    return this.filas.filter((f) => f.rolId === rolId && f.estado === "active").length;
  }

  async listarRoles() {
    return this.roles.map((r) => ({ ...r, permisos: [...r.permisos] }));
  }

  async buscarRolPorNombre(nombre: string) {
    const rol = this.roles.find((r) => r.nombre === nombre);
    return rol ? { ...rol, permisos: [...rol.permisos] } : null;
  }
}
