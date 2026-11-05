import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

// Menú contextual (clic derecho) con el aspecto de Office.

export type OpcionMenu = {
  etiqueta: string;
  accion: () => void;
  atajo?: string;
  icono?: React.ReactNode;
  deshabilitada?: boolean;
  peligro?: boolean;
} | null;

export default function MenuContextual({ x, y, opciones, onCerrar }: { x: number; y: number; opciones: OpcionMenu[]; onCerrar: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // Lo mantiene dentro de la ventana.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({ x: Math.min(x, window.innerWidth - width - 4), y: Math.min(y, window.innerHeight - height - 4) });
  }, [x, y]);

  useEffect(() => {
    const cerrar = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onCerrar();
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("mousedown", cerrar);
    window.addEventListener("keydown", tecla);
    window.addEventListener("blur", onCerrar);
    return () => {
      window.removeEventListener("mousedown", cerrar);
      window.removeEventListener("keydown", tecla);
      window.removeEventListener("blur", onCerrar);
    };
  }, [onCerrar]);

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-[95] min-w-[228px] bg-card border border-border rounded-lg shadow-[0_12px_32px_rgba(15,27,45,0.16)] p-1 text-xs text-foreground"
      style={{ left: pos.x, top: pos.y, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {opciones.map((o, i) =>
        o ? (
          <button
            key={i}
            type="button"
            role="menuitem"
            disabled={o.deshabilitada}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onCerrar();
              o.accion();
            }}
            className={`w-full flex items-center gap-2.5 pl-2.5 pr-3 h-8 rounded-md text-left font-medium transition-colors duration-100 disabled:opacity-40 disabled:hover:bg-transparent ${o.peligro ? "text-red-600 hover:bg-red-50" : "hover:bg-secondary"}`}
          >
            <span className="w-4 flex justify-center text-muted-foreground">{o.icono}</span>
            <span className="flex-1">{o.etiqueta}</span>
            {o.atajo && <kbd className="font-mono text-[10px] text-muted-foreground">{o.atajo}</kbd>}
          </button>
        ) : (
          <div key={i} className="h-px bg-border my-1 mx-1.5" />
        ),
      )}
    </div>
  );
}
