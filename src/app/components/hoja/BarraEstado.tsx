import React from "react";
import { AlertTriangle, Keyboard, Minus, Plus } from "lucide-react";

import { puedeSenalar } from "../../domain/hoja/estadoHoja";
import { nombreCelda } from "../../domain/hoja/referencias";
import type { VistaModeloHoja } from "../../domain/hoja/useHojaCalculo";

// Barra de estado: modo (Listo/Escribir/Modificar/Señalar), Promedio/Recuento/Suma y zoom.

const numero = (n: number) => n.toLocaleString("es-MX", { maximumFractionDigits: 10 });

export default function BarraEstado({ vm, aviso, onAtajos }: { vm: VistaModeloHoja; aviso?: string; onAtajos?: () => void }) {
  const { estado, resumen, despachar, calc } = vm;
  const { edicion, zoom } = estado;
  const modo = !edicion ? "Listo" : puedeSenalar(edicion) ? "Señalar" : edicion.modo === "editar" ? "Modificar" : "Escribir";

  const circular = [...calc.circulares].find((k) => k.startsWith(`${estado.hojaActiva}:`));
  const textoCircular = circular
    ? (() => {
        const [f, c] = circular.split(":")[1].split(",").map(Number);
        return `Referencias circulares: ${nombreCelda(f, c)}`;
      })()
    : null;

  return (
    <div
      className="flex items-center h-8 px-3 gap-3 bg-card border-t border-border text-[11px] text-muted-foreground flex-shrink-0 select-none"
      role="status"
    >
      <span
        data-testid="hoja-modo"
        className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold ${modo === "Listo" ? "bg-secondary/70 text-muted-foreground" : "bg-primary/10 text-primary"}`}
      >
        {modo}
      </span>
      {textoCircular && (
        <span className="inline-flex items-center gap-1 text-red-700 font-medium">
          <AlertTriangle size={12} /> {textoCircular}
        </span>
      )}
      {aviso && <span className="text-muted-foreground truncate">{aviso}</span>}
      <div className="flex-1" />
      {onAtajos && (
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onAtajos} className="inline-flex items-center gap-1 px-2 h-6 rounded-md font-medium hover:bg-secondary hover:text-foreground transition-colors" title="Atajos de teclado">
          <Keyboard size={12} /> Atajos
        </button>
      )}
      {resumen && (
        <div className="flex items-center gap-4 tabular-nums" data-testid="hoja-resumen">
          {resumen.promedio !== null && <span>Promedio: <strong className="font-semibold text-foreground">{numero(resumen.promedio)}</strong></span>}
          <span>Recuento: <strong className="font-semibold text-foreground">{resumen.recuento}</strong></span>
          {resumen.numericos > 0 && <span>Suma: <strong className="font-semibold text-foreground">{numero(resumen.suma)}</strong></span>}
        </div>
      )}
      <div className="flex items-center gap-1.5 pl-3 border-l border-border">
        <button type="button" aria-label="Reducir" onMouseDown={(e) => e.preventDefault()} onClick={() => despachar({ tipo: "zoom", valor: zoom - 0.1 })} className="w-6 h-6 flex items-center justify-center hover:bg-secondary hover:text-foreground rounded-md transition-colors">
          <Minus size={12} />
        </button>
        <input
          type="range"
          aria-label="Zoom"
          min={50}
          max={200}
          step={10}
          value={Math.round(zoom * 100)}
          onChange={(e) => despachar({ tipo: "zoom", valor: Number(e.target.value) / 100 })}
          onMouseUp={(e) => e.currentTarget.blur()}
          className="w-24 h-1 accent-[var(--primary)]"
        />
        <button type="button" aria-label="Ampliar" onMouseDown={(e) => e.preventDefault()} onClick={() => despachar({ tipo: "zoom", valor: zoom + 0.1 })} className="w-6 h-6 flex items-center justify-center hover:bg-secondary hover:text-foreground rounded-md transition-colors">
          <Plus size={12} />
        </button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => despachar({ tipo: "zoom", valor: 1 })} className="w-11 text-right font-semibold text-foreground tabular-nums hover:text-primary transition-colors" title="Restablecer al 100%">
          {Math.round(zoom * 100)}%
        </button>
      </div>
    </div>
  );
}
