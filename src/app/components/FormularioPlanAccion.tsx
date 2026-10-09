import React, { useEffect, useState } from "react";
import { AlertCircle, CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ErrorApi } from "../api/cliente";
import {
  crearPlanAccion,
  listarResponsables,
  MENSAJE_FECHA_ANTERIOR_AL_CIERRE,
  obtenerHallazgoParaPlan,
  type HallazgoResumen,
  type PlanAccion,
  type Responsable,
} from "../api/planesAccion";

// Formulario "Crear plan de acción" de un hallazgo (SF-10; historia #91).
// Valida en el cliente la fecha de compromiso contra el cierre de la auditoría; el backend repite la validación.

interface Props {
  hallazgoId: string;
  hallazgoTitulo: string;
  onCreado: (plan: PlanAccion) => void;
  onCerrar: () => void;
}

export default function FormularioPlanAccion({ hallazgoId, hallazgoTitulo, onCreado, onCerrar }: Props) {
  const [hallazgo, setHallazgo] = useState<HallazgoResumen | null>(null);
  const [responsables, setResponsables] = useState<Responsable[]>([]);
  const [cargando, setCargando] = useState(true);
  const [descripcion, setDescripcion] = useState("");
  const [responsableId, setResponsableId] = useState("");
  const [fechaCompromiso, setFechaCompromiso] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vigente = true;
    Promise.all([obtenerHallazgoParaPlan(hallazgoId), listarResponsables()])
      .then(([h, r]) => {
        if (!vigente) return;
        setHallazgo(h);
        setResponsables(r);
      })
      .catch((e: unknown) => {
        if (vigente) setError(e instanceof Error ? e.message : "No se pudo cargar la información del hallazgo.");
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [hallazgoId]);

  const fechaCierre = hallazgo?.fechaCierreAuditoria ?? null;
  const fechaAnteriorAlCierre = Boolean(fechaCierre && fechaCompromiso && fechaCompromiso < fechaCierre);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!descripcion.trim()) return setError("La descripción de la acción correctiva es obligatoria.");
    if (!responsableId) return setError("Selecciona al responsable auditado.");
    if (!fechaCompromiso) return setError("Indica la fecha de compromiso.");
    if (fechaAnteriorAlCierre) return setError(MENSAJE_FECHA_ANTERIOR_AL_CIERRE);

    setGuardando(true);
    try {
      const plan = await crearPlanAccion({
        hallazgoId,
        descripcion: descripcion.trim(),
        responsableId: Number(responsableId),
        fechaCompromiso,
      });
      toast.success(`Plan de acción asignado. Fecha límite: ${plan.fechaCompromiso}.`);
      onCreado(plan);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : "No se pudo guardar el plan de acción.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={enviar}
        aria-label="Crear plan de acción"
        className="w-full max-w-lg space-y-4 rounded-xl border border-border bg-card p-6 shadow-2xl"
      >
        <div>
          <h3 className="text-lg font-bold text-foreground">Crear plan de acción</h3>
          <p className="text-xs text-muted-foreground">
            Hallazgo <span className="font-mono font-semibold text-primary">{hallazgo?.folio ?? hallazgoId}</span> — {hallazgoTitulo}
          </p>
        </div>

        {cargando ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" /> Cargando información del hallazgo...
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <CalendarClock size={14} className="flex-shrink-0" />
              {fechaCierre ? (
                <span>
                  Cierre de la auditoría {hallazgo?.auditoriaId}: <strong className="font-mono">{fechaCierre}</strong>. La fecha de
                  compromiso debe ser igual o posterior.
                </span>
              ) : (
                <span>La auditoría de este hallazgo no tiene fecha de cierre registrada.</span>
              )}
            </div>

            <div>
              <label htmlFor="plan-descripcion" className="mb-1 block text-xs font-semibold text-muted-foreground">
                Descripción de la acción correctiva
              </label>
              <textarea
                id="plan-descripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={4}
                maxLength={2000}
                required
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                placeholder="Qué se va a corregir, cómo y con qué alcance."
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="plan-responsable" className="mb-1 block text-xs font-semibold text-muted-foreground">
                  Responsable auditado
                </label>
                <select
                  id="plan-responsable"
                  value={responsableId}
                  onChange={(e) => setResponsableId(e.target.value)}
                  required
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                >
                  <option value="">Selecciona un responsable</option>
                  {responsables.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="plan-fecha" className="mb-1 block text-xs font-semibold text-muted-foreground">
                  Fecha de compromiso
                </label>
                <input
                  id="plan-fecha"
                  type="date"
                  value={fechaCompromiso}
                  min={fechaCierre ?? undefined}
                  onChange={(e) => setFechaCompromiso(e.target.value)}
                  required
                  aria-invalid={fechaAnteriorAlCierre}
                  className={`w-full rounded-md border bg-white px-3 py-2 text-sm ${fechaAnteriorAlCierre ? "border-red-400" : "border-border"}`}
                />
              </div>
            </div>

            {(error || fechaAnteriorAlCierre) && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                <span>{error ?? MENSAJE_FECHA_ANTERIOR_AL_CIERRE}</span>
              </div>
            )}
          </>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={onCerrar}
            disabled={guardando}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando || cargando || !hallazgo}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {guardando && <Loader2 size={14} className="animate-spin" />}
            Guardar plan
          </button>
        </div>
      </form>
    </div>
  );
}
