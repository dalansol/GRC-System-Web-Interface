import React, { useEffect, useState } from "react";
import { Check, X } from "lucide-react";

import { nombreCeldaActiva } from "../../domain/hoja/estadoHoja";
import { claveCelda } from "../../domain/hoja/tipos";
import type { VistaModeloHoja } from "../../domain/hoja/useHojaCalculo";

// Cuadro de nombres + barra de fórmulas, como en Excel.

interface Props {
  vm: VistaModeloHoja;
  barraRef: React.RefObject<HTMLInputElement>;
  onIrA: (texto: string) => boolean;
  enfocarCuadricula: () => void;
}

export default function BarraFormulas({ vm, barraRef, onIrA, enfocarCuadricula }: Props) {
  const { estado, despachar } = vm;
  const { edicion, sel } = estado;
  const idx = edicion?.hoja ?? estado.hojaActiva;
  const entrada = estado.libro.hojas[idx].celdas[claveCelda(sel.activa.f, sel.activa.c)]?.entrada ?? "";
  const nombre = nombreCeldaActiva(estado);
  const [cuadro, setCuadro] = useState(nombre);
  const [editandoCuadro, setEditandoCuadro] = useState(false);

  useEffect(() => {
    if (!editandoCuadro) setCuadro(nombre);
  }, [nombre, editandoCuadro]);

  const confirmar = (df: number, dc: number) => {
    despachar({ tipo: "confirmarEdicion", df, dc });
    enfocarCuadricula();
  };

  return (
    <div className="flex items-center h-10 px-2 gap-1 bg-card border-b border-border flex-shrink-0 text-[12px]">
      <input
        aria-label="Cuadro de nombres"
        value={cuadro}
        onFocus={(e) => {
          setEditandoCuadro(true);
          e.target.select();
        }}
        onBlur={() => setEditandoCuadro(false)}
        onChange={(e) => setCuadro(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (onIrA(cuadro)) {
              setEditandoCuadro(false);
              enfocarCuadricula();
            }
          } else if (e.key === "Escape") {
            setEditandoCuadro(false);
            setCuadro(nombre);
            enfocarCuadricula();
          }
        }}
        className="w-[104px] h-7 px-2 rounded-md bg-input-background border border-border font-mono text-[12px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary"
      />
      <div className="flex items-center gap-0.5 px-1 text-muted-foreground">
        <button
          type="button"
          aria-label="Cancelar"
          disabled={!edicion}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            despachar({ tipo: "cancelarEdicion" });
            enfocarCuadricula();
          }}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <X size={14} />
        </button>
        <button
          type="button"
          aria-label="Introducir"
          disabled={!edicion}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => confirmar(0, 0)}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Check size={14} />
        </button>
        <button
          type="button"
          aria-label="Insertar función"
          disabled={estado.soloLectura}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (!edicion) despachar({ tipo: "iniciarEdicion", modo: "escribir", texto: "=" });
            enfocarCuadricula();
          }}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-primary/10 hover:text-primary italic font-semibold text-[13px] transition-colors disabled:opacity-30"
        >
          fx
        </button>
      </div>
      <div className="w-px h-5 bg-border mr-1" />
      <input
        ref={barraRef}
        aria-label="Barra de fórmulas"
        value={edicion ? edicion.texto : entrada}
        readOnly={estado.soloLectura}
        spellCheck={false}
        onFocus={() => {
          if (!edicion && !estado.soloLectura) despachar({ tipo: "iniciarEdicion", modo: "editar", origen: "barra" });
        }}
        onChange={(e) => {
          if (!edicion) despachar({ tipo: "iniciarEdicion", modo: "editar", origen: "barra", texto: e.target.value });
          else despachar({ tipo: "textoEdicion", texto: e.target.value });
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (e.altKey) return;
            confirmar(e.shiftKey ? -1 : 1, 0);
          } else if (e.key === "Tab") {
            e.preventDefault();
            confirmar(0, e.shiftKey ? -1 : 1);
          } else if (e.key === "Escape") {
            e.preventDefault();
            despachar({ tipo: "cancelarEdicion" });
            enfocarCuadricula();
          }
        }}
        className="flex-1 h-7 px-2.5 rounded-md border border-transparent bg-transparent text-foreground hover:border-border focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 focus:bg-card transition-colors"
        style={{ fontFamily: "Inter, 'Plus Jakarta Sans', sans-serif", fontSize: 13, fontVariantNumeric: "tabular-nums" }}
      />
    </div>
  );
}
