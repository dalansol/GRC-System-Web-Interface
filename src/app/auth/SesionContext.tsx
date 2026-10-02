import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { configurarCredenciales, ErrorApi } from "../api/cliente";
import { obtenerSesion, ROL_ADMINISTRADOR, type UsuarioConPermisos } from "../api/usuarios";
import type { ProveedorAuth } from "./proveedores";

export type EstadoSesion =
  | { fase: "cargando" }
  | { fase: "sin-sesion" }
  | { fase: "activa"; usuario: UsuarioConPermisos }
  | { fase: "denegada"; mensaje: string }
  | { fase: "error"; mensaje: string };

interface Sesion {
  estado: EstadoSesion;
  usuario: UsuarioConPermisos | null;
  esAdministrador: boolean;
  modo: ProveedorAuth["modo"];
  iniciarSesion: (correo?: string) => Promise<void>;
  cerrarSesion: () => Promise<void>;
  /** Vuelve a leer del servidor el rol y los permisos del usuario. */
  recargar: () => Promise<void>;
}

const ContextoSesion = createContext<Sesion | null>(null);

export function ProveedorSesion({ proveedor, children }: { proveedor: ProveedorAuth; children: React.ReactNode }) {
  const [estado, setEstado] = useState<EstadoSesion>({ fase: "cargando" });
  const activa = useRef(false);
  activa.current = estado.fase === "activa";

  const recargar = useCallback(async () => {
    try {
      setEstado({ fase: "activa", usuario: await obtenerSesion() });
    } catch (error) {
      if (error instanceof ErrorApi && error.status === 401) setEstado({ fase: "sin-sesion" });
      else if (error instanceof ErrorApi && error.status === 403) setEstado({ fase: "denegada", mensaje: error.message });
      // Un fallo de red al revalidar no debe sacar al usuario de una sesión activa.
      else if (!activa.current) {
        setEstado({ fase: "error", mensaje: error instanceof Error ? error.message : "Ocurrió un error inesperado." });
      }
    }
  }, []);

  useEffect(() => {
    let vigente = true;
    configurarCredenciales(() => proveedor.credenciales());
    proveedor
      .iniciar()
      .then((hayIdentidad) => {
        if (!vigente) return;
        if (hayIdentidad) return recargar();
        setEstado({ fase: "sin-sesion" });
      })
      .catch((error: unknown) => {
        if (!vigente) return;
        setEstado({ fase: "error", mensaje: error instanceof Error ? error.message : "No se pudo iniciar la sesión." });
      });
    return () => {
      vigente = false;
    };
  }, [proveedor, recargar]);

  // Al volver a la pestaña se revalidan rol y permisos, por si un Administrador los cambió.
  useEffect(() => {
    const alEnfocar = () => {
      if (activa.current) void recargar();
    };
    window.addEventListener("focus", alEnfocar);
    return () => window.removeEventListener("focus", alEnfocar);
  }, [recargar]);

  const valor = useMemo<Sesion>(() => {
    const usuario = estado.fase === "activa" ? estado.usuario : null;
    return {
      estado,
      usuario,
      esAdministrador: usuario?.rol === ROL_ADMINISTRADOR,
      modo: proveedor.modo,
      recargar,
      async iniciarSesion(correo) {
        await proveedor.iniciarSesion(correo);
        if (await proveedor.iniciar()) {
          setEstado({ fase: "cargando" });
          await recargar();
        }
      },
      async cerrarSesion() {
        await proveedor.cerrarSesion();
        setEstado({ fase: "sin-sesion" });
      },
    };
  }, [estado, proveedor, recargar]);

  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}

export function useSesion(): Sesion {
  const sesion = useContext(ContextoSesion);
  if (!sesion) throw new Error("useSesion debe usarse dentro de ProveedorSesion.");
  return sesion;
}
