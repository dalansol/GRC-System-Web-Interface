import type { RequestHandler } from "express";
import { ErrorApi } from "../errores.js";
import { usuarioEnSesion } from "./autenticar.js";

// Exige que el usuario en sesión tenga uno de los roles indicados (SNF-05).
export function autorizar(...roles: string[]): RequestHandler {
  return (_req, res, next) => {
    if (!roles.includes(usuarioEnSesion(res).rol)) {
      throw new ErrorApi(403, "ROL_NO_AUTORIZADO", "Tu rol no tiene acceso a esta función.");
    }
    next();
  };
}
