import React, { useState } from "react";
import { Loader2, LogIn, ShieldAlert } from "lucide-react";
import { useSesion } from "./SesionContext";

function Pantalla({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex h-screen w-full items-center justify-center bg-background p-6"
      style={{ fontFamily: "'Plus Jakarta Sans', Inter, sans-serif" }}
    >
      <div className="w-full max-w-sm bg-white rounded-xl border border-border p-8 space-y-5 text-center">
        <div>
          <div className="text-lg font-bold text-foreground">Expedite</div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">GRC v1.0</div>
        </div>
        {children}
      </div>
    </div>
  );
}

const BOTON =
  "w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60";

// Muestra la aplicación solo cuando hay una sesión activa (SF-16).
export function PuertaSesion({ children }: { children: React.ReactNode }) {
  const { estado, modo, iniciarSesion, cerrarSesion, recargar } = useSesion();
  const [correo, setCorreo] = useState("");

  if (estado.fase === "activa") return <>{children}</>;

  if (estado.fase === "cargando") {
    return (
      <Pantalla>
        <div role="status" className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" />
          Verificando sesión…
        </div>
      </Pantalla>
    );
  }

  if (estado.fase === "denegada" || estado.fase === "error") {
    return (
      <Pantalla>
        <div role="alert" className="space-y-2">
          <ShieldAlert size={22} className="mx-auto text-red-600" />
          <div className="text-sm font-semibold text-foreground">
            {estado.fase === "denegada" ? "Acceso no autorizado" : "No se pudo cargar tu sesión"}
          </div>
          <p className="text-xs text-muted-foreground">{estado.mensaje}</p>
        </div>
        {estado.fase === "error" && (
          <button className={BOTON} onClick={() => void recargar()}>
            Reintentar
          </button>
        )}
        <button className="text-xs font-medium text-primary hover:underline" onClick={() => void cerrarSesion()}>
          Entrar con otra cuenta
        </button>
      </Pantalla>
    );
  }

  if (modo === "dev") {
    return (
      <Pantalla>
        <form
          className="space-y-3 text-left"
          onSubmit={(evento) => {
            evento.preventDefault();
            void iniciarSesion(correo);
          }}
        >
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            Modo de desarrollo: sin Microsoft Entra ID.
          </p>
          <label htmlFor="correo-dev" className="block text-xs font-semibold text-foreground">
            Correo del usuario de prueba
          </label>
          <input
            id="correo-dev"
            type="email"
            required
            value={correo}
            onChange={(evento) => setCorreo(evento.target.value)}
            placeholder="s.ramirez@expedite.com"
            className="w-full text-sm border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button type="submit" className={BOTON}>
            <LogIn size={14} />
            Entrar
          </button>
        </form>
      </Pantalla>
    );
  }

  return (
    <Pantalla>
      <p className="text-sm text-muted-foreground">Inicia sesión con tu cuenta corporativa.</p>
      <button className={BOTON} onClick={() => void iniciarSesion()}>
        <LogIn size={14} />
        Iniciar sesión con Microsoft
      </button>
    </Pantalla>
  );
}
