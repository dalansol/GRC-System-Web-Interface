import React, { useEffect, useRef } from "react";

import { partesFirma, type FuncionCatalogo, type Sugerencia } from "../../domain/hoja/funciones";

// Ayuda al escribir fórmulas, como en Excel: lista de funciones que coinciden con lo
// tecleado (Tab o Enter la insertan) o la firma de la función abierta con el argumento
// actual resaltado.

interface Props {
  sugerencia: Sugerencia;
  indice: number;
  /** Posición en pantalla (fija) donde colocar la ayuda: debajo de la celda que se edita. */
  x: number;
  y: number;
  onElegir: (funcion: FuncionCatalogo) => void;
  onSenalar: (indice: number) => void;
}

export default function AutocompletadoFormula({ sugerencia, indice, x, y, onElegir, onSenalar }: Props) {
  const listaRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    listaRef.current?.children[indice]?.scrollIntoView?.({ block: "nearest" });
  }, [indice]);

  const left = Math.min(x, window.innerWidth - 340);
  const top = Math.min(y, window.innerHeight - 220);

  if (sugerencia.tipo === "firma") {
    const { nombre, argumentos } = partesFirma(sugerencia.funcion.firma);
    const actual = Math.min(sugerencia.argumento, argumentos.length - 1);
    return (
      <div
        role="tooltip"
        data-testid="hoja-firma"
        className="fixed z-[92] max-w-[420px] px-3 py-1.5 rounded-md bg-sidebar text-sidebar-foreground text-[11px] shadow-lg pointer-events-none"
        style={{ left, top }}
      >
        <span className="font-semibold text-white">{nombre}</span>(
        {argumentos.map((a, i) => (
          <React.Fragment key={i}>
            {i > 0 && "; "}
            <span className={i === actual ? "font-bold text-white underline decoration-primary decoration-2 underline-offset-2" : ""}>{a}</span>
          </React.Fragment>
        ))}
        )
      </div>
    );
  }

  return (
    <div
      className="fixed z-[92] w-[330px] bg-card border border-border rounded-lg shadow-[0_12px_32px_rgba(15,27,45,0.16)] overflow-hidden"
      style={{ left, top }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <ul ref={listaRef} role="listbox" aria-label="Funciones" data-testid="hoja-autocompletado" className="max-h-[176px] overflow-y-auto py-1">
        {sugerencia.lista.map((f, i) => {
          const activo = i === indice;
          return (
            <li
              key={f.nombre}
              role="option"
              aria-selected={activo}
              onMouseEnter={() => onSenalar(i)}
              onClick={() => onElegir(f)}
              className={`flex items-center gap-2 px-3 h-7 text-xs cursor-pointer ${activo ? "bg-primary/10" : "hover:bg-secondary/70"}`}
            >
              <span className="font-mono font-semibold text-primary">
                {f.nombre}
                {f.ingles !== f.nombre && <span className="font-normal text-muted-foreground"> · {f.ingles}</span>}
              </span>
              <span className="flex-1 truncate text-muted-foreground">{f.descripcion}</span>
            </li>
          );
        })}
      </ul>
      <div className="px-3 py-1 border-t border-border text-[10px] text-muted-foreground bg-secondary/30">
        <kbd className="font-mono">Tab</kbd> inserta · <kbd className="font-mono">↑↓</kbd> navega · <kbd className="font-mono">Esc</kbd> cierra
      </div>
    </div>
  );
}
