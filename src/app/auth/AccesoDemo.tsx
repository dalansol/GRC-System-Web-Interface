// SOLO PARA DEMOSTRACIÓN: llena el correo con un usuario de prueba según su rol.
// Para quitarlo, borra este archivo y su uso en PuertaSesion.tsx.
import React, { useRef, useState } from "react";
import { ChevronDown, UserRound } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";

// Deben coincidir con USUARIOS_DEMO de backend/src/repos/semilla.ts.
const USUARIOS_DEMO = [
  { rol: "Administrador", nombre: "Sofía Ramírez", correo: "s.ramirez@expedite.com" },
  { rol: "Jefe de Auditoría", nombre: "María García", correo: "m.garcia@expedite.com" },
  { rol: "Auditor Senior", nombre: "Carlos Morales", correo: "c.morales@expedite.com" },
  { rol: "Auditor", nombre: "Ana Rodríguez", correo: "a.rodriguez@expedite.com" },
  { rol: "Solo Lectura", nombre: "Diego Torres", correo: "d.torres@expedite.com" },
  { rol: "Consultor", nombre: "Pedro Sánchez", correo: "p.sanchez@expedite.com", inactivo: true },
];

export function AccesoDemo({ onElegir, campo }: { onElegir: (correo: string) => void; campo: React.RefObject<HTMLInputElement | null> }) {
  const [abierto, setAbierto] = useState(false);
  const eligio = useRef(false);

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger className="inline-flex cursor-pointer items-center gap-1 rounded-sm text-xs font-semibold text-primary transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Usar un rol de prueba
        <ChevronDown size={14} aria-hidden className={`transition-transform duration-200 ${abierto ? "rotate-180" : ""}`} />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-72 rounded-lg p-1.5 shadow-[0_12px_32px_-8px_rgba(15,27,45,0.25)]"
        style={{ fontFamily: "'Plus Jakarta Sans', Inter, sans-serif" }}
        onCloseAutoFocus={(evento) => {
          // Tras elegir, el foco va al campo de correo para entrar con Enter.
          if (!eligio.current) return;
          evento.preventDefault();
          eligio.current = false;
          campo.current?.focus();
        }}
      >
        <ul role="list" aria-label="Usuarios de prueba por rol">
          {USUARIOS_DEMO.map((usuario) => (
            <li key={usuario.correo}>
              <button
                type="button"
                onClick={() => {
                  eligio.current = true;
                  onElegir(usuario.correo);
                  setAbierto(false);
                }}
                className="flex w-full cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors duration-150 hover:bg-input-background focus-visible:bg-input-background focus-visible:outline-none"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <UserRound size={15} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    {usuario.rol}
                    {usuario.inactivo && (
                      <span className="rounded-full bg-muted px-1.5 py-px text-[11px] font-medium text-muted-foreground">Inactivo</span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{usuario.correo}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
