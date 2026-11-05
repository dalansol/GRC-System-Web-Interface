import React, { useEffect, useState } from "react";
import { AlertCircle, CalendarClock, Loader2, Plus, Trash2, AlertTriangle, FileSearch, Type, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useSesion } from "../auth/SesionContext";
import { ErrorApi } from "../api/cliente";
import {
  actualizarPlanAccion,
  crearPlanAccion,
  ESTADOS_PLAN_ACCION,
  listarResponsables,
  MENSAJE_FECHA_ANTERIOR_AL_CIERRE,
  obtenerHallazgoParaPlan,
  type EstadoPlanAccion,
  type HallazgoResumen,
  type PlanAccion,
  type Responsable,
  type PasoPlanAccion,
} from "../api/planesAccion";

interface PasoFormState {
  id?: number;
  descripcion: string;
  usuarioAsignadoId: string;
  fechaCompromiso: string;
}

interface HallazgoSeleccionado {
  id: string;
  folio?: string | null;
  title: string;
}

interface Props {
  hallazgoId?: string; // Mantenido por retrocompatibilidad
  hallazgoTitulo?: string; // Mantenido por retrocompatibilidad
  hallazgosSeleccionados?: HallazgoSeleccionado[]; // Soporte para múltiples hallazgos seleccionados
  /** Plan existente a editar. Sin él, el formulario crea uno nuevo. */
  plan?: PlanAccion;
  onGuardado: (plan: PlanAccion) => void;
  onCerrar: () => void;
}

export default function FormularioPlanAccion({
  hallazgoId,
  hallazgoTitulo,
  hallazgosSeleccionados = [],
  plan,
  onGuardado,
  onCerrar,
}: Props) {
  const { usuario } = useSesion();
  const edicion = Boolean(plan);
  // Lo que el Jefe de Auditoría validó no cambia: solo se reasigna el responsable y la fecha se mueve con una prórroga.
  const validado = plan?.etapa === "cierre";

  // Fecha actual en formato YYYY-MM-DD para validaciones de fecha mínima
  const fechaHoy = new Date().toISOString().split("T")[0];

  // Normalizar lista de hallazgos (si viene solo uno por props individuales, agregarlo)
  const listaHallazgos: HallazgoSeleccionado[] =
    hallazgosSeleccionados.length > 0
      ? hallazgosSeleccionados
      : hallazgoId
      ? [{ id: hallazgoId, title: hallazgoTitulo ?? "Hallazgo" }]
      : [];

  const primerId = listaHallazgos[0]?.id ?? "";

  const [hallazgoPrincipal, setHallazgoPrincipal] = useState<HallazgoResumen | null>(null);
  const [responsables, setResponsables] = useState<Responsable[]>([]);
  const [cargando, setCargando] = useState(true);

  // Estados del formulario (incluyendo el nuevo campo para el título del plan)
  const [tituloPlan, setTituloPlan] = useState((plan as any)?.titulo ?? "");
  const [descripcion, setDescripcion] = useState(plan?.descripcion ?? "");
  const [responsableId, setResponsableId] = useState(plan ? String(plan.responsable.id) : "");
  const [fechaCompromiso, setFechaCompromiso] = useState(plan?.fechaCompromiso ?? "");
  const [estado, setEstado] = useState<EstadoPlanAccion>(plan?.estado ?? "Asignado");
  // Los estados del flujo de aprobación no se fijan a mano: se muestran, pero no se envían.
  const estadoEditable = ESTADOS_PLAN_ACCION.includes(plan?.estado ?? "Asignado");

  // Estado para gestionar la lista de pasos del plan
  const [pasos, setPasos] = useState<PasoFormState[]>(
    plan?.pasos?.map((p: PasoPlanAccion) => ({
      id: p.id,
      descripcion: p.descripcion ?? "",
      usuarioAsignadoId: p.usuarioAsignado ? String(p.usuarioAsignado.id) : "",
      fechaCompromiso: p.fechaCompromiso ?? "",
    })) ?? []
  );

  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let vigente = true;
    const targetId = primerId || hallazgoId;

    if (!targetId) {
      setCargando(false);
      return;
    }

    Promise.all([obtenerHallazgoParaPlan(targetId), listarResponsables()])
      .then(([h, r]) => {
        if (!vigente) return;
        setHallazgoPrincipal(h);
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
  }, [primerId, hallazgoId]);

  // Actualizar automáticamente la fecha de compromiso del plan basada en la fecha máxima de los pasos
  useEffect(() => {
    if (!validado && pasos.length > 0) {
      const fechasValidas = pasos.map((p) => p.fechaCompromiso).filter(Boolean);
      if (fechasValidas.length > 0) {
        const fechaMaxima = fechasValidas.reduce((max, actual) => (actual > max ? actual : max));
        setFechaCompromiso(fechaMaxima);
      } else {
        setFechaCompromiso("");
      }
    }
  }, [pasos, validado]);

  const fechaCierre = hallazgoPrincipal?.fechaCierreAuditoria ?? null;
  const fechaCambiada = !plan || fechaCompromiso !== plan.fechaCompromiso;
  const fechaAnteriorAlCierre = Boolean(fechaCambiada && fechaCierre && fechaCompromiso && fechaCompromiso < fechaCierre);

  // Funciones para manipular los pasos
  const agregarPaso = () => {
    setPasos((prev) => [
      ...prev,
      { descripcion: "", usuarioAsignadoId: "", fechaCompromiso: "" },
    ]);
  };

  const eliminarPaso = (index: number) => {
    setPasos((prev) => prev.filter((_, i) => i !== index));
  };

  const actualizarPaso = (index: number, campo: keyof PasoFormState, valor: string) => {
    setPasos((prev) => {
      const nuevos = [...prev];
      nuevos[index] = { ...nuevos[index], [campo]: valor };
      return nuevos;
    });
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (listaHallazgos.length === 0) return setError("Debe haber al menos un hallazgo asociado.");
    if (!responsableId) return setError("Selecciona al responsable asignado.");

    // Un plan validado no cambia de contenido
    if (!validado) {
      if (!tituloPlan.trim()) return setError("El título del plan de acción es obligatorio.");
      if (!descripcion.trim()) return setError("El análisis de causa raíz es obligatorio.");
      if (pasos.length === 0) return setError("Debe agregar al menos un paso o actividad al plan de acción.");
      if (!fechaCompromiso) return setError("La fecha de compromiso se calcula automáticamente a partir de los pasos del plan.");
      if (fechaAnteriorAlCierre) return setError(MENSAJE_FECHA_ANTERIOR_AL_CIERRE);

      // Validar que cada paso esté completo y que su fecha no sea anterior a hoy
      for (let i = 0; i < pasos.length; i++) {
        if (!pasos[i].descripcion.trim()) return setError(`El paso #${i + 1} requiere una descripción.`);
        if (!pasos[i].usuarioAsignadoId) return setError(`Selecciona un responsable para el paso #${i + 1}.`);
        if (!pasos[i].fechaCompromiso) return setError(`Indica la fecha de compromiso para el paso #${i + 1}.`);
        if (pasos[i].fechaCompromiso < fechaHoy) {
          return setError(`La fecha de compromiso del paso #${i + 1} no puede ser anterior a la fecha actual (${fechaHoy}).`);
        }
      }
    }

    setGuardando(true);
    try {
      const datos: any = {
        hallazgoId: primerId,
        hallazgoIds: listaHallazgos.map((h) => h.id),
        titulo: tituloPlan.trim(),
        causaRaiz: descripcion.trim(),
        descripcion: descripcion.trim(),
        responsableId: Number(responsableId),
        fechaCompromiso,
        pasos: pasos.map((p) => ({
          ...(p.id ? { id: p.id } : {}),
          descripcion: p.descripcion.trim(),
          usuarioAsignadoId: Number(p.usuarioAsignadoId),
          fechaCompromiso: p.fechaCompromiso,
        })),
      };

      if (plan) {
        const actualizado = await actualizarPlanAccion(plan.id, {
          ...(validado
            ? {}
            : { titulo: datos.titulo, descripcion: datos.descripcion, fechaCompromiso: datos.fechaCompromiso, pasos: datos.pasos }),
          responsableId: datos.responsableId,
          ...(estadoEditable ? { estado } : {}),
        });
        toast.success(`Plan de acción actualizado. Estado: ${actualizado.estado}.`);
        onGuardado(actualizado);
      } else {
        const creado = await crearPlanAccion(datos);
        toast.success("Plan de acción creado con éxito.");
        onGuardado(creado);
      }
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : "No se pudo guardar el plan de acción.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <form
        onSubmit={enviar}
        aria-label={edicion ? "Editar plan de acción" : "Crear plan de acción"}
        className="w-full max-w-5xl h-[88vh] max-h-[850px] flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-2xl my-auto"
      >
        <div className="flex-shrink-0 space-y-2">
          <h3 className="text-lg font-bold text-foreground">
            {edicion ? "Editar plan de acción" : "Crear plan de acción"}
          </h3>

          {/* Visualización de los hallazgos seleccionados */}
          <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <AlertTriangle size={13} className="text-primary" /> Hallazgos Asociados ({listaHallazgos.length}):
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
              {listaHallazgos.map((h) => (
                <span
                  key={h.id}
                  className="inline-flex items-center gap-1.5 text-xs font-mono bg-card border border-border px-2.5 py-1 rounded-md shadow-2xs text-foreground"
                >
                  <strong className="text-primary">{h.folio || h.id}</strong> — {h.title}
                </span>
              ))}
            </div>
          </div>
        </div>

        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground flex-1">
            <Loader2 size={16} className="animate-spin" /> Cargando información...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 my-3 pr-1">
            {validado && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Este plan ya fue validado: solo se puede cambiar su responsable, y la fecha se mueve con una prórroga.
              </p>
            )}
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <CalendarClock size={14} className="flex-shrink-0" />
              {fechaCierre ? (
                <span>
                  Cierre de la auditoría {hallazgoPrincipal?.auditoriaId}: <strong className="font-mono">{fechaCierre}</strong>. La fecha de
                  compromiso debe ser igual o posterior.
                </span>
              ) : (
                <span>La auditoría de este hallazgo no tiene fecha de cierre registrada.</span>
              )}
            </div>

            {/* Título del Plan */}
            <div>
              <label htmlFor="plan-titulo" className="mb-1 block text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Type size={14} className="text-primary" /> Título del Plan de Acción
              </label>
              <input
                id="plan-titulo"
                type="text"
                value={tituloPlan}
                onChange={(e) => setTituloPlan(e.target.value)}
                maxLength={150}
                required
                disabled={validado}
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm disabled:bg-muted disabled:opacity-80"
                placeholder="Ej. Mitigación de riesgos de acceso..."
              />
            </div>

            <div>
              <label htmlFor="plan-descripcion" className="mb-1 block text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <FileSearch size={14} className="text-primary" /> Análisis de Causa Raíz (RCA)
              </label>
              <textarea
                id="plan-descripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={4}
                maxLength={2000}
                required
                disabled={validado}
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm disabled:bg-muted disabled:opacity-80"
                placeholder="Describe el análisis de causa raíz que originó el hallazgo..."
              />
            </div>

            <div>
              <label htmlFor="plan-responsable" className="mb-1 block text-xs font-semibold text-muted-foreground">
                Responsable principal
              </label>
              <select
                id="plan-responsable"
                value={responsableId}
                onChange={(e) => setResponsableId(e.target.value)}
                required
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              >
                <option value="">Selecciona un responsable</option>
                {plan && !responsables.some((r) => r.id === plan.responsable.id) && (
                  <option value={plan.responsable.id}>{plan.responsable.nombre}</option>
                )}
                {responsables.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </div>

            {edicion && (
              <div>
                {estadoEditable ? (
                  <>
                    <label htmlFor="plan-estado" className="mb-1 block text-xs font-semibold text-muted-foreground">
                      Estado
                    </label>
                    <select
                      id="plan-estado"
                      value={estado}
                      onChange={(e) => setEstado(e.target.value as EstadoPlanAccion)}
                      className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
                    >
                      {ESTADOS_PLAN_ACCION.map((e) => (
                        <option key={e} value={e}>
                          {e}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <>
                    <div className="mb-1 text-xs font-semibold text-muted-foreground">Estado (lo controla el flujo de aprobación)</div>
                    <div className="text-sm font-semibold text-foreground">{estado}</div>
                  </>
                )}
              </div>
            )}

            {/* SECCIÓN DE PASOS / SUB-TAREAS */}
            {!validado && (
            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Pasos o Actividades del Plan</h4>
                  <p className="text-xs text-muted-foreground">Agrega pasos detallados y asigna colaboradores y fechas específicas (no anteriores a hoy).</p>
                </div>
                <button
                  type="button"
                  onClick={agregarPaso}
                  className="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
                >
                  <Plus size={14} /> Agregar paso
                </button>
              </div>

              {pasos.length === 0 ? (
                <p className="text-xs italic text-muted-foreground py-2">No hay pasos agregados a este plan todavía.</p>
              ) : (
                <div className="space-y-3">
                  {pasos.map((paso, index) => (
                    <div key={index} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2.5">
                      <span className="text-xs font-bold text-foreground w-5 text-center flex-shrink-0">{index + 1}</span>

                      <div className="flex-1">
                        <textarea
                          value={paso.descripcion}
                          onChange={(e) => actualizarPaso(index, "descripcion", e.target.value)}
                          placeholder="Descripción de la actividad..."
                          required
                          rows={1}
                          className="w-full rounded-md border border-border bg-white px-3 py-2 text-xs resize-none h-10 focus:h-24 transition-all duration-200"
                        />
                      </div>

                      <div className="w-52 flex-shrink-0 space-y-2">
                        <select
                          value={paso.usuarioAsignadoId}
                          onChange={(e) => actualizarPaso(index, "usuarioAsignadoId", e.target.value)}
                          required
                          className="w-full rounded-md border border-border bg-white px-3 py-1.5 text-xs"
                        >
                          <option value="">Selecciona responsable</option>
                          {responsables.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.nombre}
                            </option>
                          ))}
                        </select>

                        <input
                          type="date"
                          value={paso.fechaCompromiso}
                          min={fechaHoy}
                          onChange={(e) => actualizarPaso(index, "fechaCompromiso", e.target.value)}
                          required
                          className="w-full rounded-md border border-border bg-white px-3 py-1.5 text-xs"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => eliminarPaso(index)}
                        className="text-red-500 hover:text-red-700 p-2 flex-shrink-0"
                        title="Eliminar paso"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )}

            {/* FECHA DE COMPROMISO DEL PLAN (NO EDITABLE DIRECTAMENTE) */}
            {!validado && (
              <div className="border-t border-border pt-4">
                <label htmlFor="plan-fecha" className="mb-1 block text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Calendar size={14} className="text-primary" /> Fecha de compromiso global del plan
                </label>
                <input
                  id="plan-fecha"
                  type="date"
                  value={fechaCompromiso}
                  readOnly
                  disabled
                  className={`w-full rounded-md border px-3 py-2 text-sm bg-muted text-muted-foreground cursor-not-allowed opacity-90 ${
                    fechaAnteriorAlCierre ? "border-red-400" : "border-border"
                  }`}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Esta fecha se calcula automáticamente tomando la fecha más lejana de los pasos registrados arriba.
                </p>
              </div>
            )}

            {(error || fechaAnteriorAlCierre) && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                <span>{error ?? MENSAJE_FECHA_ANTERIOR_AL_CIERRE}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4 flex-shrink-0">
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
            disabled={guardando || cargando || listaHallazgos.length === 0}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {guardando && <Loader2 size={14} className="animate-spin" />}
            {edicion ? "Guardar cambios" : "Guardar plan"}
          </button>
        </div>
      </form>
    </div>
  );
}