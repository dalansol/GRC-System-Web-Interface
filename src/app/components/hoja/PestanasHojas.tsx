import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";

import { agregarHoja, eliminarHoja, moverHoja, renombrarHoja, validarNombreHoja } from "../../domain/hoja/operaciones";
import type { VistaModeloHoja } from "../../domain/hoja/useHojaCalculo";
import MenuContextual, { type OpcionMenu } from "./MenuContextual";

// Pestañas de hojas: agregar, renombrar (doble clic), mover y eliminar, como en Excel.

export default function PestanasHojas({ vm, enfocarCuadricula }: { vm: VistaModeloHoja; enfocarCuadricula: () => void }) {
  const { estado, despachar, aplicar } = vm;
  const { libro, hojaActiva, soloLectura } = estado;
  const [renombrando, setRenombrando] = useState<number | null>(null);
  const [nombre, setNombre] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number; idx: number } | null>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listaRef.current?.querySelector<HTMLElement>(`[data-hoja="${hojaActiva}"]`)?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [hojaActiva]);

  const agregar = (despuesDe: number) => {
    aplicar((l) => agregarHoja(l, despuesDe), { activa: { f: 0, c: 0 }, ancla: { f: 0, c: 0 }, extremo: { f: 0, c: 0 } }, despuesDe + 1);
    enfocarCuadricula();
  };

  const empezarRenombrar = (idx: number) => {
    if (soloLectura) return;
    setRenombrando(idx);
    setNombre(libro.hojas[idx].nombre);
  };

  const terminarRenombrar = () => {
    if (renombrando === null) return;
    const idx = renombrando;
    setRenombrando(null);
    if (nombre.trim() === libro.hojas[idx].nombre) return enfocarCuadricula();
    const error = validarNombreHoja(libro, idx, nombre);
    if (error) {
      toast.error(error);
    } else {
      aplicar((l) => renombrarHoja(l, idx, nombre));
    }
    enfocarCuadricula();
  };

  const opciones = (idx: number): OpcionMenu[] => [
    { etiqueta: "Insertar hoja", accion: () => agregar(idx), deshabilitada: soloLectura },
    {
      etiqueta: "Eliminar",
      accion: () => aplicar((l) => eliminarHoja(l, idx), undefined, Math.max(0, Math.min(idx, libro.hojas.length - 2))),
      deshabilitada: soloLectura || libro.hojas.length <= 1,
      peligro: true,
    },
    { etiqueta: "Cambiar nombre", accion: () => empezarRenombrar(idx), deshabilitada: soloLectura },
    null,
    { etiqueta: "Mover a la izquierda", accion: () => aplicar((l) => moverHoja(l, idx, idx - 1), undefined, idx - 1), deshabilitada: soloLectura || idx === 0 },
    {
      etiqueta: "Mover a la derecha",
      accion: () => aplicar((l) => moverHoja(l, idx, idx + 1), undefined, idx + 1),
      deshabilitada: soloLectura || idx === libro.hojas.length - 1,
    },
  ];

  return (
    <div className="flex items-center h-10 px-1 gap-1 bg-[var(--hoja-encabezado)] border-t border-border flex-shrink-0 text-xs select-none">
      <div className="flex items-center text-muted-foreground">
        <button type="button" aria-label="Hoja anterior" onMouseDown={(e) => e.preventDefault()} onClick={() => despachar({ tipo: "cambiarHoja", idx: hojaActiva - 1 })} className="w-7 h-7 flex items-center justify-center hover:bg-secondary hover:text-foreground rounded-md transition-colors">
          <ChevronLeft size={14} />
        </button>
        <button type="button" aria-label="Hoja siguiente" onMouseDown={(e) => e.preventDefault()} onClick={() => despachar({ tipo: "cambiarHoja", idx: hojaActiva + 1 })} className="w-7 h-7 flex items-center justify-center hover:bg-secondary hover:text-foreground rounded-md transition-colors">
          <ChevronRight size={14} />
        </button>
      </div>
      <div ref={listaRef} role="tablist" aria-label="Hojas" className="flex items-center gap-1 overflow-x-auto min-w-0" style={{ scrollbarWidth: "none" }}>
        {libro.hojas.map((h, i) => {
          const activa = i === hojaActiva;
          return (
            <div
              key={i}
              data-hoja={i}
              role="tab"
              aria-selected={activa}
              onMouseDown={(e) => {
                if (renombrando === i) return;
                e.preventDefault();
                despachar({ tipo: "cambiarHoja", idx: i });
              }}
              onDoubleClick={() => empezarRenombrar(i)}
              onContextMenu={(e) => {
                e.preventDefault();
                despachar({ tipo: "cambiarHoja", idx: i });
                setMenu({ x: e.clientX, y: e.clientY, idx: i });
              }}
              className={`relative flex items-center h-7 px-3.5 rounded-md cursor-pointer whitespace-nowrap transition-colors duration-150 ${
                activa ? "bg-card text-primary font-semibold border border-border shadow-sm" : "text-muted-foreground font-medium border border-transparent hover:bg-secondary hover:text-foreground"
              }`}
            >
              {renombrando === i ? (
                <input
                  autoFocus
                  aria-label="Nombre de la hoja"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  onBlur={terminarRenombrar}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") terminarRenombrar();
                    if (e.key === "Escape") {
                      setRenombrando(null);
                      enfocarCuadricula();
                    }
                  }}
                  className="w-28 h-6 px-1.5 rounded border border-primary bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 font-[inherit]"
                />
              ) : (
                h.nombre
              )}
            </div>
          );
        })}
      </div>
      {!soloLectura && (
        <button
          type="button"
          aria-label="Nueva hoja"
          title="Nueva hoja (Mayús+F11)"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => agregar(libro.hojas.length - 1)}
          className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
        >
          <Plus size={15} />
        </button>
      )}
      <div className="flex-1" />
      {menu && <MenuContextual x={menu.x} y={menu.y} opciones={opciones(menu.idx)} onCerrar={() => setMenu(null)} />}
    </div>
  );
}
