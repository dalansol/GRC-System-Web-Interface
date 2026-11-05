import { Fragment, useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileSearch,
  ListTodo,
  Loader2,
  Paperclip,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  AlertTriangle,
  X,
  CheckCheck,
  User
} from "lucide-react";
import { toast } from "sonner";

import { Card, Breadcrumbs, PageHeader } from "./SharedComponents";
import EvidenciasSection from "./EvidenciasSection";
import { useSesion } from "../auth/SesionContext";
import {
  actualizarPasoPlanAccion,
  aprobarPlanAccion,
  listarMisPlanesAccion,
  type HallazgoResumen,
  type PlanAccion
} from "../api/planesAccion";
import { type HallazgoPortal } from "../api/portalAuditado";

interface PlanAccionConDetalles extends Omit<PlanAccion, "estado" | "status"> {
  finding?: HallazgoPortal;
  estado?: string;
  status?: string;
}

const PLAN_ESTADO_CFG: Record<string, { label: string; cls: string }> = {
  "Asignado": { label: "Asignado", cls: "bg-amber-50 text-amber-700 border border-amber-200" },
  "En Proceso": { label: "En Proceso", cls: "bg-blue-50 text-blue-700 border border-blue-200" },
  "En Revisión": { label: "En Revisión", cls: "bg-purple-50 text-purple-700 border border-purple-200" },
  "Cerrado": { label: "Cerrado", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
};

export default function VistaPlanesAccion() {
  const { usuario } = useSesion();

  const [planes, setPlanes] = useState<PlanAccionConDetalles[]>([]);
  const [loading, setLoading] = useState(true);

  // Dropdown table expansion state
  const [expandedPlanId, setExpandedPlanId] = useState<number | null>(null);

  // Split view state for step evidence (planId + stepId)
  const [splitStepKey, setSplitStepKey] = useState<{
    planId: number;
    stepId: number;
  } | null>(null);

  const currentUserId = usuario?.id;

  const cargarPlanes = async () => {
    setLoading(true);
    try {
      const planesRemotos = await listarMisPlanesAccion();
      setPlanes(planesRemotos);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudieron cargar los planes de acción.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarPlanes();
  }, [usuario?.id, (usuario as any)?.business_unit_id, usuario?.businessUnitId]);

  // Toggle step completion status with evidence validation
  const togglePasoCompletado = async (plan: PlanAccionConDetalles, pasoId: number, completadoDeseado: boolean) => {
    if ((plan.status || plan.estado) === "En Revisión") {
      toast.error("El plan de acción está en revisión y ya no puede modificarse.");
      return;
    }
    const paso = plan.pasos?.find((p) => p.id === pasoId);
    if (!paso) return;

    // Si se quiere marcar como completado, validar que tenga evidencias
    if (completadoDeseado) {
      if (paso.evidenciasCount === 0) {
        toast.error("No se puede aprobar/completar el paso porque no cuenta con evidencias adjuntas.");
        return;
      }
    }

    try {
      const pasoActualizado = await actualizarPasoPlanAccion(plan.id, pasoId, completadoDeseado);
      setPlanes((prev) => prev.map((p) => p.id !== plan.id ? p : {
        ...p,
        pasos: p.pasos.map((item) => item.id === pasoId ? pasoActualizado : item),
      }));
      toast.success("Estatus de la actividad actualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la actividad.");
    }
  };

  const aprobarPlanCompleto = async (planId: number) => {
    try {
      const planActualizado = await aprobarPlanAccion(planId);
      setPlanes((prev) => prev.map((plan) => plan.id === planId ? {
        ...plan,
        ...planActualizado,
      } : plan));
      toast.success("Plan de acción enviado a revisión.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo enviar el plan a revisión.");
    }
  };

  const buIdDisplay = (usuario as any)?.business_unit_id ?? usuario?.businessUnitId ?? 10;

  return (
    <div className="flex-1 w-full max-w-full overflow-x-hidden p-6 space-y-6 box-border" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Breadcrumbs items={["Inicio", "Auditoría", "Planes de Acción"]} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Gestión de Planes de Acción"
          subtitle={`${planes.length} planes registrados · ID Unidad de Negocio: ${buIdDisplay}`}
        />

        <button
          type="button"
          onClick={cargarPlanes}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {/* Main Table Section */}
      <Card>
        <div className="w-full overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
              <Loader2 className="mr-2 animate-spin" size={20} />
              Cargando planes de acción...
            </div>
          ) : planes.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-xs text-muted-foreground gap-2">
              <ShieldAlert size={28} className="text-muted-foreground/50" />
              <p>No tienes planes de acción asignados o pendientes de atención.</p>
            </div>
          ) : (
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left">
                  <th className="py-3 px-4 font-semibold text-muted-foreground w-1/6">Folio / ID</th>
                  <th className="py-3 px-4 font-semibold text-muted-foreground w-1/3">Título del Plan</th>
                  <th className="py-3 px-4 font-semibold text-muted-foreground w-1/5">Responsable</th>
                  <th className="py-3 px-4 font-semibold text-muted-foreground w-1/6">Fecha Límite</th>
                  <th className="py-3 px-4 font-semibold text-muted-foreground w-1/6">Estado</th>
                  <th className="py-3 px-4 text-right font-semibold text-muted-foreground w-1/6">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {planes.map((plan) => {
                  const estadoStr = plan.status || plan.estado || "Asignado";
                  const statusCfg = PLAN_ESTADO_CFG[estadoStr] || { label: estadoStr, cls: "bg-slate-50 text-slate-600 border border-slate-200" };
                  const isExpanded = expandedPlanId === plan.id;
                  const folioDisplay = plan.publicId;
                  
                  const tituloDisplay = plan.titulo || plan.hallazgo?.titulo || plan.finding?.title || "Plan de Acción Correctivo";
                  const responsableNombre = plan.responsable?.nombre || "No asignado";

                  // Calcular si todos los pasos están completados
                  const todosPasosCompletados = plan.pasos && plan.pasos.length > 0 && plan.pasos.every((p) => p.completado);
                  const planEnRevision = (plan.status || plan.estado) === "En Revisión";

                  return (
                    <Fragment key={plan.id}>
                      <tr className="border-b border-border hover:bg-muted/20">
                        <td className="py-3 px-4 font-mono font-medium text-xs text-primary truncate">{folioDisplay}</td>
                        <td className="py-3 px-4 font-medium text-foreground truncate" title={tituloDisplay}>{tituloDisplay}</td>
                        <td className="py-3 px-4 text-muted-foreground text-xs truncate" title={responsableNombre}>{responsableNombre}</td>
                        <td className="py-3 px-4 text-xs font-mono text-muted-foreground truncate">{plan.fechaCompromiso}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium truncate max-w-full ${statusCfg.cls}`}>
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                            onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)}
                          >
                            <ChevronDown size={14} className={isExpanded ? "rotate-180 transition-transform" : "transition-transform"} />
                            {isExpanded ? "Ocultar detalles" : "Ver detalles"}
                          </button>
                        </td>
                      </tr>

                      {/* Dropdown Detail Drawer */}
                      {isExpanded && (
                        <tr key={`${plan.id}-details`} className="border-b border-border bg-muted/10">
                          <td colSpan={6} className="px-6 py-5 max-w-full overflow-hidden">
                            <div className="space-y-4 max-w-full">
                              
                              {/* Metadata Grid (Responsable y Fecha Límite a la izquierda) */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-border bg-card p-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                    <UserCheck size={16} />
                                  </div>
                                  <div>
                                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Responsable Auditado</div>
                                    <div className="text-xs font-bold text-foreground">{responsableNombre}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2.5">
                                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                    <Calendar size={16} />
                                  </div>
                                  <div>
                                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Fecha Límite del Plan</div>
                                    <div className="text-xs font-mono font-bold text-foreground">{plan.fechaCompromiso || "Sin fecha"}</div>
                                  </div>
                                </div>
                              </div>

                              {/* Root Cause Analysis (RCA) */}
                              <div className="rounded-lg border border-border bg-card p-3.5 space-y-1.5 shadow-2xs max-w-full overflow-hidden">
                                <div className="text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                  <FileSearch size={14} className="text-primary" />
                                  Análisis de Causa Raíz (RCA - Root Cause Analysis)
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed font-normal break-words">
                                  {plan.causaRaiz || plan.descripcion || "Causa raíz o descripción no documentada."}
                                </p>
                              </div>

                              {/* Related Findings Section */}
                              <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                                <div className="text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                  <AlertTriangle size={14} className="text-amber-600" />
                                  Hallazgos Relacionados
                                </div>
                                {plan.hallazgosRelacionados && plan.hallazgosRelacionados.length > 0 ? (
                                  <div className="grid grid-cols-1 gap-2">
                                    {plan.hallazgosRelacionados.map((hallazgo) => (
                                      <div key={hallazgo.id} className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 border border-border/60 text-xs">
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono font-bold text-primary">{hallazgo.folio || hallazgo.id}</span>
                                          <span className="font-medium text-foreground">{hallazgo.titulo}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                            {hallazgo.severidad || "General"}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : plan.hallazgo || plan.finding ? (
                                  <div className="flex items-center justify-between p-2.5 rounded-md bg-muted/30 border border-border/60 text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-bold text-primary">{(plan.hallazgo as any)?.folio || plan.finding?.id || "N/A"}</span>
                                      <span className="font-medium text-foreground">{(plan.hallazgo as any)?.titulo || plan.finding?.title || "Hallazgo vinculado"}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                        {(plan.hallazgo as any)?.severidad || plan.finding?.severity || "General"}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-muted-foreground italic">No hay hallazgos asociados explícitamente a este plan.</p>
                                )}
                              </div>

                              {/* Timeline Steps Breakdown */}
                              <div className="space-y-3 pt-1 max-w-full overflow-hidden">
                                <div className="flex items-center justify-between border-b border-border pb-2 gap-2 flex-wrap">
                                  <div className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                                    <ListTodo size={15} className="text-primary" />
                                    Cronograma de Ejecución y Actividades (Plan Completo)
                                  </div>
                                  <span className="text-[11px] text-muted-foreground italic">
                                    Haz clic en la flecha para ver la descripción completa y gestionar evidencias
                                  </span>
                                </div>

                                <div className="space-y-2.5 pl-2 max-w-full">
                                  {plan.pasos && plan.pasos.length > 0 ? (
                                    plan.pasos.map((paso) => {
                                      const esAsignadoActual = paso.usuarioAsignado?.id === currentUserId;
                                      const isDone = paso.completado;
                                      const isSplitActive = splitStepKey?.planId === plan.id && splitStepKey?.stepId === paso.id;

                                      const evidenciasCount = paso.evidenciasCount;
                                      const nombreResponsablePaso = 
                                        paso.usuarioAsignado?.nombre || 
                                        (paso as any).responsible_name || 
                                        (paso as any).responsableNombre || 
                                        "Sin asignar";

                                      return (
                                        <div
                                          key={paso.id}
                                          className={`rounded-lg border transition-all max-w-full overflow-hidden ${
                                            isDone
                                              ? "bg-muted/20 border-border/60 text-muted-foreground"
                                              : esAsignadoActual
                                              ? "bg-primary/5 border-primary/30 text-foreground shadow-2xs"
                                              : "bg-background border-border text-foreground"
                                          }`}
                                        >
                                          {/* Closed View */}
                                          <div className={`p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 ${isSplitActive ? "border-b border-border/60 bg-muted/30 rounded-t-lg" : ""}`}>
                                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (esAsignadoActual) {
                                                    void togglePasoCompletado(plan, paso.id, !isDone);
                                                  } else {
                                                    toast.error("Solo puedes modificar el estatus de tus propios pasos asignados.");
                                                  }
                                                }}
                                                className="focus:outline-none shrink-0"
                                                title={esAsignadoActual ? (isDone ? "Marcar como pendiente" : "Marcar como completado") : "Solo el responsable asignado puede cambiar este estatus"}
                                              >
                                                {isDone ? (
                                                  <CheckCircle2 size={16} className="text-green-600 fill-green-100" />
                                                ) : (
                                                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
                                                )}
                                              </button>
                                              <div className="min-w-0 flex-1">
                                                {/* Text disappears (opacity-0) when dropdown is clicked/active */}
                                                <div 
                                                  className={`text-sm font-semibold truncate max-w-full transition-opacity duration-200 ${
                                                    isDone ? "line-through opacity-80" : ""
                                                  } ${isSplitActive ? "opacity-0" : "opacity-100"}`} 
                                                  title={paso.descripcion}
                                                >
                                                  {paso.descripcion}
                                                </div>
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-4 text-[11px] text-muted-foreground shrink-0 pl-6 md:pl-0 flex-wrap">
                                              {/* Nombre del usuario asignado al paso a la izquierda de la fecha límite */}
                                              <span className="flex items-center gap-1 font-medium text-foreground bg-muted/60 px-2 py-0.5 rounded truncate max-w-[140px]" title={nombreResponsablePaso}>
                                                <User size={12} className="text-primary shrink-0" />
                                                <span className="truncate">{nombreResponsablePaso}</span>
                                              </span>

                                              <span className="flex items-center gap-1 font-mono shrink-0">
                                                <Calendar size={13} />
                                                {paso.fechaCompromiso || "Sin fecha"}
                                              </span>
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted/50 text-foreground font-medium">
                                                <Paperclip size={12} className="text-primary" />
                                                Evidencias: {evidenciasCount}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (isSplitActive) {
                                                    setSplitStepKey(null);
                                                  } else {
                                                    setSplitStepKey({ planId: plan.id, stepId: paso.id });
                                                  }
                                                }}
                                                className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-border bg-card text-foreground hover:bg-secondary transition-colors shrink-0"
                                                title={isSplitActive ? "Cerrar detalles y evidencias" : "Ver detalles y evidencias"}
                                              >
                                                {isSplitActive ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                              </button>
                                            </div>
                                          </div>

                                          {/* Full-width Dropdown Box with Description in Upper Half & Evidence Below */}
                                          {isSplitActive && (
                                            <div className="bg-card rounded-b-lg p-4 space-y-4 max-w-full overflow-hidden transition-all duration-300 ease-in-out animate-in fade-in slide-in-from-left-2">
                                              {/* Upper half: Full description text container */}
                                              <div className="p-3.5 rounded-lg bg-muted/40 border border-border/60 shadow-2xs">
                                                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                                  <ListTodo size={12} className="text-primary" />
                                                  Descripción Completa de la Actividad
                                                </div>
                                                <p className="text-xs font-medium text-foreground leading-relaxed break-words animate-in fade-in duration-500">
                                                  {paso.descripcion}
                                                </p>
                                              </div>

                                              {/* Lower half / full width: Evidence submission section */}
                                              <div className="w-full max-w-full flex flex-col overflow-y-auto pt-2 border-t border-border/60">
                                                <EvidenciasSection
                                                  entityId={String(paso.id)}
                                                  entityType="action_plan_step"
                                                  puedeSubir={esAsignadoActual && !planEnRevision}
                                                  onEvidenceCountChange={(count) => {
                                                    setPlanes((prev) => prev.map((item) => item.id !== plan.id ? item : {
                                                      ...item,
                                                      pasos: item.pasos.map((itemPaso) => itemPaso.id === paso.id
                                                        ? { ...itemPaso, evidenciasCount: count }
                                                        : itemPaso),
                                                    }));
                                                  }}
                                                />
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <div className="text-xs text-muted-foreground italic">
                                      No hay pasos detallados registrados para este plan.
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Botón para marcar el plan como aprobado (Solo aparece cuando todos los pasos están completados) */}
                              {todosPasosCompletados && !planEnRevision && (
                                <div className="pt-4 flex justify-end border-t border-border mt-4">
                                  <button
                                    type="button"
                                    onClick={() => aprobarPlanCompleto(plan.id)}
                                    className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm"
                                  >
                                    <CheckCheck size={15} />
                                    Aprobar Plan de Acción
                                  </button>
                                </div>
                              )}

                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}