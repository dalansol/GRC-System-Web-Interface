import React, { useEffect } from "react";
import { Keyboard, X } from "lucide-react";

// Referencia rápida de atajos del editor; en macOS Cmd equivale a Ctrl.

const GRUPOS: { titulo: string; atajos: [string, string][] }[] = [
  {
    titulo: "Moverse y seleccionar",
    atajos: [
      ["Flechas", "Cambiar de celda"],
      ["Ctrl + Flechas", "Saltar al borde de los datos"],
      ["Mayús + Flechas", "Extender la selección"],
      ["Ctrl + Inicio / Fin", "Primera celda / última con datos"],
      ["Ctrl + Espacio", "Seleccionar la columna"],
      ["Mayús + Espacio", "Seleccionar la fila"],
      ["Ctrl + A", "Seleccionar todo"],
    ],
  },
  {
    titulo: "Escribir",
    atajos: [
      ["Enter / Tab", "Confirmar y bajar / ir a la derecha"],
      ["F2", "Editar la celda"],
      ["Esc", "Cancelar la edición"],
      ["Ctrl + Enter", "Llenar toda la selección"],
      ["Alt + Enter", "Salto de línea en la celda"],
      ["Alt + =", "Autosuma"],
      ["Ctrl + ;", "Fecha de hoy"],
      ["Supr", "Borrar contenido"],
    ],
  },
  {
    titulo: "Editar",
    atajos: [
      ["Ctrl + Z / Y", "Deshacer / rehacer"],
      ["Ctrl + C / X / V", "Copiar / cortar / pegar"],
      ["Ctrl + D / R", "Rellenar hacia abajo / derecha"],
      ["Ctrl + B / I / U", "Negrita / cursiva / subrayado"],
      ["Ctrl + F", "Buscar"],
      ["Ctrl + S", "Guardar"],
      ["Mayús + F11", "Hoja nueva"],
    ],
  },
];

export default function AyudaAtajos({ onCerrar }: { onCerrar: () => void }) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-[96] flex items-center justify-center bg-sidebar/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div role="dialog" aria-label="Atajos de teclado" className="bg-card rounded-xl shadow-2xl border border-border w-full max-w-3xl">
        <div className="flex items-center justify-between px-6 h-14 border-b border-border">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground tracking-tight">
            <Keyboard size={16} className="text-primary" /> Atajos de teclado
          </div>
          <button type="button" aria-label="Cerrar" onClick={onCerrar} className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
            <X size={15} />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
          {GRUPOS.map((g) => (
            <section key={g.titulo}>
              <h3 className="text-xs font-bold text-foreground mb-2">{g.titulo}</h3>
              <dl className="space-y-1.5">
                {g.atajos.map(([teclas, accion]) => (
                  <div key={teclas} className="flex items-center justify-between gap-3 text-xs">
                    <dt className="text-muted-foreground">{accion}</dt>
                    <dd className="font-mono text-[11px] text-foreground bg-secondary/70 border border-border rounded px-1.5 py-0.5 whitespace-nowrap">{teclas}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <div className="px-6 py-3 border-t border-border text-[11px] text-muted-foreground">En macOS, Cmd funciona igual que Ctrl.</div>
      </div>
    </div>
  );
}
