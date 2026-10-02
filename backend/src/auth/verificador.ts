import type { Request } from "express";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { correoValido, normalizarCorreo } from "../domain/dominio.js";

export interface Identidad {
  /** Identificador del usuario en Entra ID; null en modo de desarrollo. */
  oid: string | null;
  correo: string;
}

export interface VerificadorToken {
  /** Devuelve la identidad de quien hace la petición, o null si no es válida. */
  verificar(req: Request): Promise<Identidad | null>;
}

export interface OpcionesEntra {
  tenantId: string;
  clientId: string;
  /** Llaves públicas para validar la firma. Por omisión, las del tenant. */
  llaves?: JWTVerifyGetKey;
}

// Valida tokens de acceso emitidos por Microsoft Entra ID para esta API.
export function crearVerificadorEntra({ tenantId, clientId, llaves }: OpcionesEntra): VerificadorToken {
  const jwks =
    llaves ??
    createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`));

  return {
    async verificar(req) {
      const cabecera = req.header("authorization") ?? "";
      const [esquema, token] = cabecera.split(" ");
      if (esquema?.toLowerCase() !== "bearer" || !token) return null;

      try {
        const { payload } = await jwtVerify(token, jwks, {
          algorithms: ["RS256"],
          audience: [clientId, `api://${clientId}`],
          issuer: [
            `https://login.microsoftonline.com/${tenantId}/v2.0`,
            `https://sts.windows.net/${tenantId}/`,
          ],
        });

        const oid = payload.oid;
        const correo = payload.preferred_username ?? payload.upn ?? payload.email;
        if (payload.tid !== tenantId) return null;
        if (typeof oid !== "string" || typeof correo !== "string" || !correoValido(correo)) return null;

        return { oid, correo: normalizarCorreo(correo) };
      } catch {
        return null;
      }
    },
  };
}

// Solo para desarrollo local: la identidad llega en el encabezado X-Dev-Usuario.
export function crearVerificadorDev(): VerificadorToken {
  return {
    async verificar(req) {
      const correo = req.header("x-dev-usuario");
      if (!correo || !correoValido(correo)) return null;
      return { oid: null, correo: normalizarCorreo(correo) };
    },
  };
}
