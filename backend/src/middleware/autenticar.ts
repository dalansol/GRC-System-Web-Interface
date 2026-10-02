import type { RequestHandler, Response } from "express";
import type { VerificadorToken } from "../auth/verificador.js";
import type { UsuarioConPermisos } from "../domain/tipos.js";
import { ErrorApi } from "../errores.js";
import type { RepositorioUsuarios } from "../repos/repositorio.js";

const NO_AUTORIZADO = new ErrorApi(
  403,
  "USUARIO_NO_AUTORIZADO",
  "Tu cuenta no está registrada o está inactiva en Expedite. Contacta a un Administrador.",
);

// Valida la identidad y carga al usuario con su rol y permisos actuales.
// Los permisos se leen de la base en cada petición para que un cambio de rol
// surta efecto de inmediato (SF-17).
export function autenticar(repo: RepositorioUsuarios, verificador: VerificadorToken): RequestHandler {
  return async (req, res, next) => {
    const identidad = await verificador.verificar(req);
    if (!identidad) {
      throw new ErrorApi(401, "NO_AUTENTICADO", "Inicia sesión para continuar.");
    }

    let usuario = identidad.oid ? await repo.buscarPorOid(identidad.oid) : null;
    if (!usuario) {
      usuario = await repo.buscarPorCorreo(identidad.correo);
      // Primer acceso: se asocia la identidad de Entra. Si el usuario ya tenía
      // otra identidad asociada, el correo no basta para entrar.
      if (usuario && identidad.oid && !(await repo.vincularOid(usuario.id, identidad.oid))) {
        throw NO_AUTORIZADO;
      }
    }
    if (!usuario || usuario.estado !== "active") throw NO_AUTORIZADO;

    const rol = await repo.buscarRolPorNombre(usuario.rol);
    const sesion: UsuarioConPermisos = { ...usuario, permisos: rol?.permisos ?? [] };
    res.locals.usuario = sesion;
    next();
  };
}

export function usuarioEnSesion(res: Response): UsuarioConPermisos {
  return res.locals.usuario as UsuarioConPermisos;
}
