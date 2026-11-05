import { useEffect, useState } from "react";
import { 
  AlertTriangle, 
  ArrowLeft, 
  CalendarClock, 
  ClipboardList, 
  Loader2, 
  Pencil, 
  Plus, 
  ShieldAlert, 
  UserCheck, 
  CheckCircle2, 
  Circle,
  ChevronDown,
  ChevronRight,
  Calendar,
  Paperclip
} from "lucide-react";
import { toast } from "sonner";

import { Card, DetailField } from "./SharedComponents";
import EvidenciasSection from "./EvidenciasSection";
import { pedir } from "../api/cliente";
import { listarHallazgos, type HallazgoApi } from "../api/hallazgos";
import FormularioPlanAccion from "./FormularioPlanAccion";
import { 
  planBloqueado,
  planFinalizado,
  ROLES_EDICION_PLAN_ACCION, 
  type PlanAccion 
} from "../api/planesAccion";
import { useSesion } from "../auth/SesionContext";

interface VistaDetalladaHallazgoProps {
  hallazgoId: string;
  onBack: () => void;
  crumbs?: React.ReactNode;
}

// Helper para formatear fechas a solo YYYY-MM-DD
const formatearFecha = (fechaStr?: string | null) => {
  if (!fechaStr) return "Sin fecha";
  return fechaStr.slice(0, 10);
};

export default function VistaHallazgoDetallado({
  hallazgoId,
  onBack,
  crumbs,
}: VistaDetalladaHallazgoProps) {
  const { usuario } = useSesion();
  const [hallazgo, setHallazgo] = useState<HallazgoApi | null>(null);
  const [planesAccion, setPlanesAccion] = useState<PlanAccion[]>([]);
  const [planAccion, setPlanAccion] = useState<PlanAccion | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPlanModal, setShowPlanModal] = useState(false);

  // State for split view step evidence expansion (planId + stepId)
  const [splitStepKey, setSplitStepKey] = useState<{
    planId: string | number;
    stepId: string | number;
  } | null>(null);

  const currentUserId = usuario?.id;

  // Verificación específica para Jefe Auditado (control de creación de planes)
  const esJefeAuditado = usuario?.rol === "Jefe Auditado";

  // La evidencia del hallazgo es de solo lectura y la consulta el equipo de auditoría.
  const esEquipoAuditoria = Boolean(usuario && ROLES_EDICION_PLAN_ACCION.includes(usuario.rol));

  const puedeEditarPlan = (plan: PlanAccion) =>
    Boolean(
      usuario &&
        ROLES_EDICION_PLAN_ACCION.includes(usuario.rol) &&
        plan.responsable?.id !== usuario.id &&
        !planBloqueado(plan)
    );

  const cargarDetalle = async (active = true) => {
    let hallazgoData: HallazgoApi | null = null;

    try {
      hallazgoData = await pedir<HallazgoApi>(`/hallazgos/${hallazgoId}`);
    } catch {
      try {
        const todos = await listarHallazgos();
        hallazgoData = todos.find(
          (item) =>
            String(item.id) === String(hallazgoId) ||
            String(item.folio) === String(hallazgoId)
        ) ?? null;
      } catch {
        hallazgoData = null;
      }
    }

    let planesData: PlanAccion[] = [];
    if (hallazgoData) {
      try {
        const planes = await pedir<any[]>(
          `/hallazgos/${hallazgoData.id}/planes-accion`
        );
        if (planes && planes.length > 0) {
          planesData = planes.map((raw) => {
            const estado = raw.estado || raw.status || "Asignado";
            return {
              id: raw.id,
              publicId: raw.publicId || raw.public_id || `PACC-${raw.id}`,
              titulo: raw.titulo || raw.title || "Plan de acción",
              causaRaiz: raw.causaRaiz || raw.root_cause || null,
              hallazgo: raw.hallazgo ?? {
                id: String(hallazgoData.id),
                folio: hallazgoData.folio,
                titulo: hallazgoData.title,
                severidad: hallazgoData.severity,
                auditoriaId: hallazgoData.auditId ?? null,
                controlId: hallazgoData.controlId ?? null,
                fechaCierreAuditoria: null,
              },
              descripcion: raw.descripcion || raw.root_cause || raw.description || "",
              responsable: raw.responsable || {
                id: raw.responsible_id || 0,
                nombre: raw.responsible_name || "Responsable Asignado",
              },
              fechaCompromiso: raw.fechaCompromiso || raw.due_date || "",
              estado,
              status: estado,
              pasos: raw.pasos || raw.steps || [],
              creadoEn: raw.creadoEn || raw.created_at || new Date().toISOString(),
            };
          });
        }
      } catch {
        planesData = [];
      }
    }

    if (active) {
      setHallazgo(hallazgoData);
      setPlanesAccion(planesData);
      setPlanAccion(planesData[0] ?? null);
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);

    cargarDetalle(active).catch((error: unknown) => {
      if (!active) return;
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo cargar la información del hallazgo."
      );
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [hallazgoId]);

  if (loading) {
    return (
      <div className="flex-1 p-6">
        {crumbs}
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          <Loader2 className="mr-2 animate-spin" size={18} />
          Cargando detalle del hallazgo...
        </div>
      </div>
    );
  }

  if (!hallazgo) {
    return (
      <div className="flex-1 p-6">
        {crumbs}
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No se encontró el hallazgo solicitado.
          <div className="mt-4">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline"
            >
              <ArrowLeft size={14} /> Volver a la lista
            </button>
          </div>
        </Card>
      </div>
    );
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "Crítico":
        return "bg-red-100 text-red-800 border-red-200";
      case "Alto":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "Medio":
        return "bg-amber-100 text-amber-800 border-amber-200";
      default:
        return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex-1 overflow-auto p-6 relative" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {crumbs}

      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} /> Volver
        </button>
      </div>

      {/* Cabecera del Hallazgo */}
      <Card className="mb-5 p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-amber-100 rounded-xl flex-shrink-0">
              <AlertTriangle size={22} className="text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md">
                  {hallazgo.folio || hallazgo.id}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getSeverityBadge(hallazgo.severity)}`}>
                  Severidad: {hallazgo.severity}
                </span>
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full">
                  Estatus: {hallazgo.status}
                </span>
              </div>
              <h1 className="text-xl font-bold text-foreground leading-tight">
                {hallazgo.title}
              </h1>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
          <DetailField label="Control Asociado" value={hallazgo.controlId || "Sin control vinculado"} />
          <DetailField label="Categoría / Vulnerabilidad" value={(hallazgo as any).category ?? "Operativo"} />
          <DetailField label="Registrado Por" value={(hallazgo as any).created_by_name ?? "Auditor Responsable"} />
        </div>

        <div className="mt-4 pt-4 border-t border-border space-y-3">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Descripción del Hallazgo
            </div>
            <p className="text-sm text-foreground leading-relaxed bg-muted/30 p-3 rounded-lg border border-border">
              {hallazgo.description || "Sin descripción detallada registrada."}
            </p>
          </div>

          {(hallazgo as any).rootCause && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Causa Raíz
              </div>
              <p className="text-sm text-foreground leading-relaxed bg-muted/30 p-3 rounded-lg border border-border">
                {(hallazgo as any).rootCause}
              </p>
            </div>
          )}
        </div>
      </Card>

      {esEquipoAuditoria && (
        <div className="mb-5">
          <EvidenciasSection entityId={String(hallazgo.id)} entityType="hallazgo" puedeSubir={false} />
        </div>
      )}

      {/* Plan de Acción Correctivo */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert size={18} className="text-primary" />
            <h2 className="text-base font-bold text-foreground">Plan de Acción Correctivo</h2>
          </div>
          {esJefeAuditado && hallazgo.status !== "Cerrado" && (
            <button
              type="button"
              onClick={() => {
                setPlanAccion(null);
                setShowPlanModal(true);
              }}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors"
            >
              <Plus size={14} />
              Crear plan de acción
            </button>
          )}
        </div>

        {planesAccion.length > 0 ? (
          <div className="space-y-4">
            {planesAccion.map((plan) => (
              <div key={plan.id} className="rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <ClipboardList size={14} /> Detalle del Plan de Acción
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        planFinalizado(plan)
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-blue-50 text-blue-700 border border-blue-200"
                      }`}
                    >
                      {plan.estado}
                    </span>
                    {puedeEditarPlan(plan) && (
                      <button
                        type="button"
                        onClick={() => {
                          setPlanAccion(plan);
                          setShowPlanModal(true);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-secondary"
                      >
                        <Pencil size={12} />
                        Editar
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-sm text-foreground leading-relaxed my-3">
                  {plan.descripcion}
                </p>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border pt-3">
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                      Responsable auditado
                    </div>
                    <div className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <UserCheck size={14} className="text-primary" />
                      {plan.responsable?.nombre || "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                      Fecha límite
                    </div>
                    <div
                      className={`text-sm font-semibold font-mono ${
                        !planFinalizado(plan) && formatearFecha(plan.fechaCompromiso) < hoy
                          ? "text-red-600"
                          : "text-foreground"
                      }`}
                    >
                      {formatearFecha(plan.fechaCompromiso)}
                    </div>
                  </div>
                </div>

                {/* Sección de Pasos del Plan de Acción */}
                <div className="mt-4 pt-4 border-t border-border space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-2 gap-2 flex-wrap">
                    <div className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                      <ClipboardList size={15} className="text-primary" />
                      Cronograma de Ejecución y Actividades (Plan Completo)
                    </div>
                    <span className="text-[11px] text-muted-foreground italic">
                      Haz clic en la flecha para ver la descripción completa y gestionar evidencias
                    </span>
                  </div>

                  <div className="space-y-2.5 pl-2 max-w-full">
                    {plan.pasos && plan.pasos.length > 0 ? (
                      plan.pasos.map((paso: any) => {
                        const esAsignadoActual = paso.usuarioAsignado?.id === currentUserId || esJefeAuditado;
                        const pasoCompletado = paso.estado === "Completado" || paso.completado;
                        const isSplitActive = splitStepKey?.planId === plan.id && splitStepKey?.stepId === paso.id;

                        const pAny = paso as any;
                        const evidenciasCount = 
                          pAny.evidencias?.length ?? 
                          pAny.evidences?.length ?? 
                          pAny.evidenciasCount ?? 
                          pAny.evidenceCount ?? 
                          pAny.evidencesCount ?? 
                          pAny.totalEvidencias ?? 
                          pAny.total_evidencias ?? 
                          pAny.count ?? 
                          0;

                        return (
                          <div
                            key={paso.id}
                            className={`rounded-lg border transition-all max-w-full overflow-hidden ${
                              pasoCompletado
                                ? "bg-muted/20 border-border/60 text-muted-foreground"
                                : "bg-background border-border text-foreground"
                            }`}
                          >
                            {/* Closed Row View */}
                            <div className={`p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 ${isSplitActive ? "border-b border-border/60 bg-muted/30 rounded-t-lg" : ""}`}>
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <span className="mt-0.5 shrink-0 text-muted-foreground">
                                  {pasoCompletado ? (
                                    <CheckCircle2 size={16} className="text-emerald-600" />
                                  ) : (
                                    <Circle size={16} className="text-muted-foreground" />
                                  )}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div 
                                    className={`text-sm font-semibold truncate max-w-full transition-opacity duration-200 ${
                                      pasoCompletado ? "line-through opacity-80" : ""
                                    } ${isSplitActive ? "opacity-0" : "opacity-100"}`}
                                    title={paso.descripcion || paso.titulo}
                                  >
                                    {paso.descripcion || paso.titulo || "Actividad del plan"}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 text-[11px] text-muted-foreground shrink-0 pl-6 md:pl-0 flex-wrap">
                                <span className="flex items-center gap-1 font-mono shrink-0">
                                  <Calendar size={13} />
                                  {formatearFecha(paso.fechaLimite || paso.fechaCompromiso)}
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
                                <div className="p-3.5 rounded-lg bg-muted/40 border border-border/60 shadow-2xs">
                                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                    <ClipboardList size={12} className="text-primary" />
                                    Descripción Completa de la Actividad
                                  </div>
                                  <p className="text-xs font-medium text-foreground leading-relaxed break-words animate-in fade-in duration-500">
                                    {paso.descripcion || paso.titulo || "Sin descripción detallada"}
                                  </p>
                                </div>

                                <div className="w-full max-w-full flex flex-col overflow-y-auto pt-2 border-t border-border/60">
                                  <EvidenciasSection
                                    entityId={String(paso.id)}
                                    entityType="action_plan_step"
                                    puedeSubir={esAsignadoActual}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        No se han registrado pasos específicos para este plan de acción.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-card px-4 py-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <CalendarClock size={16} /> Este hallazgo aún no tiene un plan de acción correctivo.
            </div>
          </div>
        )}
      </Card>

      {/* Modal Integrado */}
      {showPlanModal && esJefeAuditado && (
        <FormularioPlanAccion
          hallazgoId={hallazgo.id}
          hallazgoTitulo={hallazgo.title}
          plan={planAccion ?? undefined}
          onGuardado={(nuevoPlan) => {
            setPlanesAccion((actuales) => {
              const existe = actuales.some((plan) => plan.id === nuevoPlan.id);
              return existe
                ? actuales.map((plan) => plan.id === nuevoPlan.id ? nuevoPlan : plan)
                : [...actuales, nuevoPlan];
            });
            setPlanAccion(nuevoPlan);
            setShowPlanModal(false);
            toast.success("Plan de acción guardado correctamente.");
          }}
          onCerrar={() => setShowPlanModal(false)}
        />
      )}
    </div>
  );
}