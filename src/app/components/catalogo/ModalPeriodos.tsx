import { useEffect, useState } from "react";
import { AlertCircle, Calendar, CheckCircle2, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import type { AltaPeriodoInput, PeriodoFiscal } from "../../api/estructura";
import {
  altaDePeriodo,
  anioInicial,
  compararPeriodos,
  periodoRegistrado,
  periodosDelAnio,
} from "../../domain/estructura/periodos";
import { Card } from "../SharedComponents";

// Periodos de auditoría (SF-03): cada año se divide en cuatro trimestres ("2027 Q1"…) más el
// año fiscal completo ("2027 Fiscal"); se crean con un botón, sin capturar fechas. Uno activo
// a la vez: la unidad nueva toma el activo y activar uno desactiva el anterior (lo hace el
// backend). Solo para Administrador y Jefe de Auditoría.

interface ModalPeriodosProps {
  abierto: boolean;
  periodos: PeriodoFiscal[];
  periodoActivo: PeriodoFiscal | null;
  guardando: boolean;
  errorServidor: string | null;
  onGuardar: (datos: AltaPeriodoInput) => Promise<boolean>;
  onActivar: (periodo: PeriodoFiscal) => Promise<boolean>;
  onCerrar: () => void;
}

/** "2026-10-01" → "1 oct 2026", sin desfase de zona horaria. */
function fechaCorta(fecha: string, conAnio = true): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return new Date(anio!, mes! - 1, dia!).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    ...(conAnio ? { year: "numeric" } : {}),
  });
}

export function ModalPeriodos({
  abierto,
  periodos,
  periodoActivo,
  guardando,
  errorServidor,
  onGuardar,
  onActivar,
  onCerrar,
}: ModalPeriodosProps) {
  const [anio, setAnio] = useState(() => anioInicial(periodoActivo));
  const [activar, setActivar] = useState(false);

  // Cada vez que se abre, el selector vuelve al año del periodo activo.
  useEffect(() => {
    if (abierto) {
      setAnio(anioInicial(periodoActivo));
      setActivar(false);
    }
  }, [abierto]);

  if (!abierto) return null;

  const ordenados = [...periodos].sort(compararPeriodos);
  const propuestos = periodosDelAnio(anio);

  return (
    <div
      data-testid="modal-periodos"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <Card className="w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 bg-white shadow-2xl relative rounded-xl border border-border">
        <button
          onClick={onCerrar}
          disabled={guardando}
          className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
          title="Cerrar modal"
          aria-label="Cerrar modal"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2.5 mb-5 border-b border-border pb-4">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Calendar size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Periodos de Auditoría</h2>
            <p className="text-xs text-muted-foreground">
              Un solo periodo activo a la vez: las unidades nuevas quedan asignadas a él.
            </p>
          </div>
        </div>

        {errorServidor && (
          <div role="alert" className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-red-600" />
            <span>{errorServidor}</span>
          </div>
        )}

        {/* Alta: elegir el año y crear sus trimestres o el año fiscal con un botón */}
        <section className="mb-5" aria-label="Agregar periodos">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold text-foreground">Agregar periodos</h3>
            <div className="flex items-center gap-1" role="group" aria-label="Año">
              <button
                type="button"
                onClick={() => setAnio((a) => a - 1)}
                disabled={guardando}
                aria-label="Año anterior"
                className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
              >
                <ChevronLeft size={16} />
              </button>
              <span data-testid="anio-periodos" className="w-12 text-center text-sm font-bold tabular-nums text-foreground">
                {anio}
              </span>
              <button
                type="button"
                onClick={() => setAnio((a) => a + 1)}
                disabled={guardando}
                aria-label="Año siguiente"
                className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {propuestos.map((p) => {
              const registrado = periodoRegistrado(periodos, p);
              const fiscal = p.clave === "Fiscal";
              return (
                <button
                  key={p.clave}
                  type="button"
                  onClick={() => onGuardar(altaDePeriodo(p, activar))}
                  disabled={guardando || !!registrado}
                  aria-label={registrado ? `${p.nombre} (ya registrado)` : `Agregar ${p.nombre}`}
                  title={registrado ? `Ya registrado como "${registrado.nombre}"` : `Agregar ${p.nombre}`}
                  className={`flex flex-col items-center gap-0.5 px-2 py-2.5 rounded-lg border text-center transition-colors ${
                    fiscal ? "col-span-2 sm:col-span-1" : ""
                  } ${
                    registrado
                      ? "border-border bg-slate-50 text-muted-foreground cursor-default"
                      : "border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/60"
                  } disabled:opacity-100`}
                >
                  <span className="flex items-center gap-1 text-sm font-bold">
                    {registrado ? <CheckCircle2 size={13} aria-hidden /> : <Plus size={13} aria-hidden />}
                    {p.clave}
                  </span>
                  <span className="text-[10px] leading-tight">
                    {registrado ? "Registrado" : `${fechaCorta(p.fechaInicio, false)} – ${fechaCorta(p.fechaFin, false)}`}
                  </span>
                </button>
              );
            })}
          </div>

          <label className="mt-3 flex items-center gap-2 text-xs text-foreground">
            <input type="checkbox" checked={activar} onChange={(e) => setActivar(e.target.checked)} disabled={guardando} />
            Activar el periodo al agregarlo (desactiva el actual)
          </label>
        </section>

        {/* Periodos registrados */}
        <section className="pt-4 border-t border-border" aria-label="Periodos registrados">
          <h3 className="text-sm font-semibold text-foreground mb-3">Registrados</h3>
          {ordenados.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No hay periodos registrados.</p>
          ) : (
            <ul className="divide-y divide-border/60 border border-border rounded-lg" data-testid="lista-periodos">
              {ordenados.map((p) => (
                <li key={p.id} data-testid={`periodo-${p.id}`} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{p.nombre}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {fechaCorta(p.fechaInicio)} – {fechaCorta(p.fechaFin)}
                    </p>
                  </div>
                  {p.activo ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 size={12} />
                      Activo
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onActivar(p)}
                      disabled={guardando}
                      aria-label={`Activar ${p.nombre}`}
                      className="px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                    >
                      Activar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex items-center justify-end pt-4 mt-5 border-t border-border">
          <button
            type="button"
            onClick={onCerrar}
            disabled={guardando}
            className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
          >
            Cerrar
          </button>
        </div>
      </Card>
    </div>
  );
}
