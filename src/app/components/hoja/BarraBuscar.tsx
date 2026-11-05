import React, { useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";

// Barra de búsqueda (Ctrl+F): Enter va a la siguiente coincidencia, Mayús+Enter a la
// anterior y Esc cierra; el editor resalta las coincidencias de la hoja visible.

interface Props {
  texto: string;
  total: number;
  /** Índice (base 0) de la coincidencia activa, o -1 si no hay. */
  actual: number;
  onTexto: (texto: string) => void;
  onSiguiente: () => void;
  onAnterior: () => void;
  onCerrar: () => void;
}

export default function BarraBuscar({ texto, total, actual, onTexto, onSiguiente, onAnterior, onCerrar }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const sinResultados = texto.trim() !== "" && total === 0;

  return (
    <div
      role="search"
      aria-label="Buscar en el libro"
      className="absolute top-2 right-5 z-[60] flex items-center gap-1 pl-3 pr-1.5 h-10 bg-card border border-border rounded-lg shadow-[0_8px_24px_rgba(15,27,45,0.14)]"
    >
      <Search size={14} className="text-muted-foreground flex-shrink-0" />
      <input
        ref={inputRef}
        value={texto}
        placeholder="Buscar en el libro…"
        aria-label="Texto a buscar"
        aria-invalid={sinResultados || undefined}
        onChange={(e) => onTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (e.shiftKey) onAnterior();
            else onSiguiente();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCerrar();
          }
        }}
        className="w-56 h-7 px-1 text-xs bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
      <span className={`min-w-[88px] text-right text-[11px] tabular-nums ${sinResultados ? "text-red-600 font-medium" : "text-muted-foreground"}`} aria-live="polite" data-testid="hoja-buscar-conteo">
        {texto.trim() === "" ? "" : sinResultados ? "Sin resultados" : actual < 0 ? `${total} coincidencia${total === 1 ? "" : "s"}` : `${actual + 1} de ${total}`}
      </span>
      <div className="w-px h-5 bg-border mx-1" />
      <button type="button" aria-label="Coincidencia anterior" title="Anterior (Mayús+Enter)" disabled={!total} onClick={onAnterior} className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40 transition-colors">
        <ChevronUp size={15} />
      </button>
      <button type="button" aria-label="Coincidencia siguiente" title="Siguiente (Enter)" disabled={!total} onClick={onSiguiente} className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40 transition-colors">
        <ChevronDown size={15} />
      </button>
      <button type="button" aria-label="Cerrar búsqueda" title="Cerrar (Esc)" onClick={onCerrar} className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
        <X size={15} />
      </button>
    </div>
  );
}
