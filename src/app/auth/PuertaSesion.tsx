import React, { useRef, useState } from "react";
import { ArrowRight, FlaskConical, Mail, ShieldAlert } from "lucide-react";
import { AccesoDemo } from "./AccesoDemo";
import { useSesion } from "./SesionContext";
import { BOTON_PRIMARIO, BotonMicrosoft, PantallaAcceso, Spinner } from "./componentesLogin";

// Muestra la aplicación solo cuando hay una sesión activa (SF-16).
export function PuertaSesion({ children }: { children: React.ReactNode }) {
  const { estado, modo, iniciarSesion, cerrarSesion, recargar } = useSesion();
  const [correo, setCorreo] = useState("");
  const campoCorreo = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  // Con Entra ID la página redirige a Microsoft, así que el indicador se queda hasta salir.
  async function entrar(correoDev?: string) {
    setEnviando(true);
    try {
      await iniciarSesion(correoDev);
    } finally {
      setEnviando(false);
    }
  }

  if (estado.fase === "activa") return <>{children}</>;

  let contenido: React.ReactNode;

  if (estado.fase === "cargando") {
    contenido = (
      <div role="status" className="flex items-center gap-3 text-sm text-muted-foreground">
        <Spinner />
        Verificando sesión…
      </div>
    );
  } else if (estado.fase === "denegada" || estado.fase === "error") {
    contenido = (
      <>
        <div role="alert">
          <div className="mb-6 flex size-11 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert size={22} className="text-destructive" aria-hidden />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {estado.fase === "denegada" ? "Acceso no autorizado" : "No se pudo cargar tu sesión"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{estado.mensaje}</p>
        </div>
        <div className="mt-8 space-y-3">
          {estado.fase === "error" && (
            <button className={BOTON_PRIMARIO} onClick={() => void recargar()}>
              Reintentar
            </button>
          )}
          <button
            className="cursor-pointer rounded-sm text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => void cerrarSesion()}
          >
            Entrar con otra cuenta
          </button>
        </div>
      </>
    );
  } else if (modo === "dev") {
    contenido = (
      <>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200/70">
          <FlaskConical size={13} aria-hidden />
          Desarrollo sin Entra ID
        </span>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">Inicia sesión</h1>
        <p className="mt-2 text-sm text-muted-foreground">Accede con el correo de un usuario registrado.</p>
        <form
          className="mt-8 space-y-4"
          onSubmit={(evento) => {
            evento.preventDefault();
            void entrar(correo);
          }}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="correo-dev" className="block text-sm font-medium text-foreground">
                Correo electrónico
              </label>
              <AccesoDemo onElegir={setCorreo} campo={campoCorreo} />
            </div>
            <div className="group relative">
              <Mail
                size={16}
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground transition-colors duration-150 group-focus-within:text-primary"
              />
              <input
                id="correo-dev"
                ref={campoCorreo}
                type="email"
                required
                autoComplete="email"
                value={correo}
                onChange={(evento) => setCorreo(evento.target.value)}
                placeholder="nombre@expedite.com"
                className="h-11 w-full rounded-lg border border-foreground/12 bg-card pr-3 pl-10 text-sm text-foreground shadow-[0_1px_2px_rgba(15,27,45,0.05)] transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-muted-foreground hover:border-foreground/20 focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none"
              />
            </div>
          </div>
          <button type="submit" className={BOTON_PRIMARIO} disabled={enviando} aria-busy={enviando}>
            Entrar
            {enviando ? (
              <Spinner />
            ) : (
              <ArrowRight size={16} aria-hidden className="transition-transform duration-160 ease-out group-hover:translate-x-0.5" />
            )}
          </button>
        </form>
      </>
    );
  } else {
    contenido = (
      <>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Inicia sesión</h1>
        <p className="mt-2 text-sm text-muted-foreground">Usa tu cuenta corporativa de Microsoft.</p>
        <div className="mt-8">
          <BotonMicrosoft enviando={enviando} onClick={() => void entrar()} />
        </div>
        <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
          Si no tienes acceso, contacta al administrador de Expedite.
        </p>
      </>
    );
  }

  return <PantallaAcceso fase={estado.fase}>{contenido}</PantallaAcceso>;
}
