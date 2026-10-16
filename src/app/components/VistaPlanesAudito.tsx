import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, ChevronDown, Plus, Loader2, RefreshCw, Users, X } from "lucide-react";

import { Breadcrumbs, Card, PageHeader, PrimaryBtn } from "./SharedComponents";
import type { Navigate } from "./SharedComponents";
import type { AuditPlan } from "./SharedComponents";
import { useAuditPlansViewModel } from "../domain/planes-auditoria/useAuditPlansViewModel";
import { useSesion } from "../auth/SesionContext";
import { pedir } from "../api/cliente";
import FormularioPlanAudito from "./FormularioPlanAudito";
import type { DatosFormularioPlanAudito } from "./FormularioPlanAudito";
import FormularioAsignarControl from "./FormularioAsignarControl";
import { listarAsignacionesControl, type AsignacionControl } from "../api/auditControls";
import { EtiquetaConflictoPlan, SeccionConflictosPlan } from "./ConflictosPlan";

const PLAN_STATUS_CFG: Record<AuditPlan["status"], { label: string; cls: string }> = {
  "Borrador": { label: "Borrador", cls: "bg-slate-50 text-slate-600 border border-slate-200" },
  "Aprobado": { label: "Aprobado", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  "En Ejecución": { label: "En Ejecución", cls: "bg-amber-50 text-amber-700 border border-amber-200" },
  "Cerrado": { label: "Cerrado", cls: "bg-blue-50 text-blue-700 border border-blue-200" },
};

export default function VistaPlanesAudito({ canCreate, navigate }: { canCreate: boolean; navigate: Navigate }) {
  const { plans, loading, isCreating, USE_REAL_BACKEND, fetchPlans, createPlan } = useAuditPlansViewModel();
  const { usuario } = useSesion();
  const esAuditorSenior = usuario?.rol === "Auditor Senior";
  const esJefatura = usuario?.rol === "Jefe de Auditoría";

  const [showForm, setShowForm] = useState(false);
  const [expandedPlanCode, setExpandedPlanCode] = useState<string | null>(null);
  const [controlAssignments, setControlAssignments] = useState<Record<string, AsignacionControl[]>>({});
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assigningPlanId, setAssigningPlanId] = useState<string | null>(null);
  const [selectedAuditors, setSelectedAuditors] = useState<AsignacionControl[] | null>(null);
  const [empleadosAsignados, setEmpleadosAsignados] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!canCreate || !["Administrador", "Jefe de Auditoría"].includes(usuario?.rol ?? "")) return;
    pedir<{ id: number; nombre: string }[]>("/usuarios/responsables-plan")
      .then((usuarios) => {
        setEmpleadosAsignados(
          usuarios
            .map((usuario) => ({ id: String(usuario.id), name: usuario.nombre }))
            .sort((left, right) => left.name.localeCompare(right.name, "es")),
        );
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "No se pudieron cargar los responsables.");
      });
  }, [canCreate, usuario?.rol]);
  
  const responsableInicial = empleadosAsignados[0]?.name ?? "";

  useEffect(() => {
    if (!expandedPlanCode) return;
    const plan = plans.find((item) => item.code === expandedPlanCode);
    if (!plan) return;

    setAssignmentsLoading(true);
    listarAsignacionesControl(plan.id)
      .then((assignments) => {
        setControlAssignments((current) => ({ ...current, [plan.id]: assignments }));
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "No se pudieron cargar las asignaciones.");
      })
      .finally(() => setAssignmentsLoading(false));
  }, [expandedPlanCode, plans]);

  const handleCreatePlan = async (formData: DatosFormularioPlanAudito) => {
    const success = await createPlan(formData);
    if (success) {
      setShowForm(false);
    }
    return success;
  };

  return (
    <div className="flex-1 overflow-auto p-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Breadcrumbs items={["Inicio", "Auditoría", "Planes de Auditoría"]} />

      <div className="flex items-center justify-between mb-4">
        <PageHeader
          title="Planes de Auditoría"
          subtitle={`${plans.length} planes registrados · Ciclo 2024–2025`}
        />
        <div className="flex items-center gap-4">
          <p className="text-xs text-muted-foreground text-right mr-4">
            Modo actual:<br />
            <span className="font-semibold text-primary">
              {USE_REAL_BACKEND ? "Backend Supabase" : "Mock Data Local"}
            </span>
          </p>
          <button
            onClick={fetchPlans}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Recargar
          </button>
          {canCreate && (
            <PrimaryBtn icon={<Plus size={14} />} onClick={() => setShowForm(true)}>
              Nuevo plan
            </PrimaryBtn>
          )}
        </div>
      </div>

      {showForm && (
        <FormularioPlanAudito
          isCreating={isCreating}
          empleadosAsignados={empleadosAsignados}
          responsableInicial={responsableInicial}
          onSubmit={handleCreatePlan}
          onCancel={() => setShowForm(false)}
        />
      )}
      {assigningPlanId && (
        <FormularioAsignarControl
          planId={assigningPlanId}
          onCreated={() => {
            setControlAssignments((current) => {
              const next = { ...current };
              delete next[assigningPlanId];
              return next;
            });
            setAssigningPlanId(null);
            fetchPlans();
          }}
          onCancel={() => setAssigningPlanId(null)}
        />
      )}

      {/* Table Section */}
      <Card>
        <div className="overflow-x-auto">
          {/* Table content remains exactly the same */}
          {loading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
              <Loader2 className="mr-2 animate-spin" size={20} />
              Cargando planes...
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left">
                  <th className="py-3 px-4 font-semibold text-muted-foreground">Código</th>
                  <th className="py-3 px-4 font-semibold text-muted-foreground">Nombre del Plan</th>
                  <th className="py-3 px-4 font-semibold text-muted-foreground">Tipo</th>
                  <th className="py-3 px-4 font-semibold text-muted-foreground">Periodo</th>
                  <th className="py-3 px-4 font-semibold text-muted-foreground">Responsable</th>
                  <th className="py-3 px-4 font-semibold text-muted-foreground">Estado</th>
                  <th className="py-3 px-4 text-right font-semibold text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {plans.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No hay planes de auditoría registrados.
                    </td>
                  </tr>
                ) : (
                  plans.map((plan) => {
                    const statusCfg = PLAN_STATUS_CFG[plan.status as keyof typeof PLAN_STATUS_CFG] || { label: plan.status, cls: "bg-gray-50 text-gray-700" };
                    const isExpanded = expandedPlanCode === plan.code;
                    const assignedControls = controlAssignments[plan.id] ?? [];
                    const groupedControls = Array.from(
                      assignedControls.reduce((groups, assignment) => {
                        const current = groups.get(String(assignment.control_id)) ?? [];
                        current.push(assignment);
                        groups.set(String(assignment.control_id), current);
                        return groups;
                      }, new Map<string, AsignacionControl[]>()),
                    ).map(([, assignments]) => assignments);
                    const horasTotales = assignedControls.reduce(
                      (total, assignment) => total + Number(assignment.hours_spent ?? 0),
                      0,
                    );
                    const horasEstimadas = Number(plan.estimatedHours ?? 0);
                      
                    return (
                      <Fragment key={plan.id}>
                        <tr className="border-b border-border hover:bg-muted/20">
                          <td className="py-3 px-4 font-medium">{plan.code}</td>
                          <td className="py-3 px-4">
                            {plan.name}
                            {USE_REAL_BACKEND && <EtiquetaConflictoPlan planId={plan.id} />}
                          </td>
                          <td className="py-3 px-4">{plan.type}</td>
                          <td className="py-3 px-4">{plan.period}</td>
                          <td className="py-3 px-4">{plan.responsible}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.cls}`}>
                              {statusCfg.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                              onClick={() => setExpandedPlanCode(isExpanded ? null : plan.code)}
                            >
                              <ChevronDown size={14} className={isExpanded ? "rotate-180 transition-transform" : "transition-transform"} />
                              {isExpanded ? "Ocultar detalles" : "Ver detalles"}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${plan.id}-details`} className="border-b border-border bg-muted/10">
                            <td colSpan={7} className="px-6 py-4">
                              {USE_REAL_BACKEND && <SeccionConflictosPlan planId={plan.id} />}
                              <div className="mb-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <h3 className="text-sm font-semibold text-foreground">Controles asignados</h3>
                                    <p className="text-xs text-muted-foreground">Responsable del seguimiento durante este plan de auditoría.</p>
                                  </div>
                                  <span className="text-xs font-semibold text-primary">
                                    {horasTotales} / {horasEstimadas} horas invertidas
                                  </span>
                                  {esAuditorSenior && (
                                    <PrimaryBtn
                                      icon={<Plus size={14} />}
                                      onClick={() => setAssigningPlanId(String(plan.id))}
                                    >
                                      Asignar control
                                    </PrimaryBtn>
                                  )}
                                </div>
                              </div>
                              {assignmentsLoading && expandedPlanCode === plan.code ? (
                                <p className="text-sm text-muted-foreground">Cargando asignaciones...</p>
                              ) : assignedControls.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Este plan no tiene controles asignados.</p>
                              ) : (
                                <div className="space-y-2">
                                  {groupedControls.map((assignments) => {
                                    const assignment = assignments[0];
                                    const variosAuditores = assignments.length > 1;
                                    const status = assignments.every((item) => item.status === "En Revision")
                                      ? "En Revision"
                                      : assignments.some((item) => item.status === "En Progreso")
                                        ? "En Progreso"
                                        : assignment.status;
                                    const tieneAuditor = assignments.some((item) => item.auditor_role === "Auditor");
                                    const tieneSenior = assignments.some((item) => item.auditor_role === "Auditor Senior");
                                    const puedeAprobar =
                                      status === "En Revision" &&
                                      (tieneSenior
                                        ? esJefatura && assignments.every((item) => item.plan_created_by === Number(usuario?.id))
                                        : tieneAuditor &&
                                          esAuditorSenior &&
                                          assignments.every((item) => item.plan_responsible_id === Number(usuario?.id)));
                                    return (
                                    <div key={assignment.control_id} className="flex items-center justify-between gap-4 rounded-md border border-border bg-card px-3 py-2">
                                      <button
                                        type="button"
                                        onClick={() => navigate("control", assignment.control_id)}
                                        aria-label={`Abrir detalle del control ${assignment.control_code}`}
                                        title="Abrir detalle del control"
                                        className="group flex min-w-0 items-center gap-3 rounded-md px-2 py-1 text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                      >
                                        <div className="min-w-0">
                                          <div className="text-sm font-medium text-foreground group-hover:text-primary">
                                            {assignment.control_code} · {assignment.control_name}
                                          </div>
                                          <div className="text-xs text-muted-foreground">
                                              {variosAuditores ? "Varios auditores asignados" : assignment.is_lead ? "Auditor líder" : "Auditor asignado"} · {assignments.reduce((total, item) => total + Number(item.hours_spent ?? 0), 0)} horas · {status}
                                          </div>
                                        </div>
                                        <ArrowRight size={15} className="shrink-0 text-primary opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100" />
                                      </button>
                                        <div className="flex items-center gap-3">
                                          {puedeAprobar && (
                                            <button
                                              type="button"
                                              onClick={() => navigate("control", assignment.control_id)}
                                              className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-white"
                                            >
                                              Revisar
                                            </button>
                                          )}
                                          {variosAuditores ? (
                                            <button
                                              type="button"
                                              onClick={() => setSelectedAuditors(assignments)}
                                              className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                                            >
                                              <Users size={14} /> Auditores involucrados
                                            </button>
                                          ) : (
                                            <span className="text-sm font-medium text-foreground">{assignment.auditor_name}</span>
                                          )}
                                        </div>
                                    </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </Card>
      {selectedAuditors && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="presentation" onClick={() => setSelectedAuditors(null)}>
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="auditores-involucrados" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 id="auditores-involucrados" className="text-base font-semibold">Auditores involucrados</h2>
              <button type="button" onClick={() => setSelectedAuditors(null)} aria-label="Cerrar">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2">
              {selectedAuditors.map((auditor) => (
                <div key={auditor.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                  <div>
                    <div className="text-sm font-medium">{auditor.auditor_name}</div>
                    <div className="text-xs text-muted-foreground">{auditor.auditor_role}{auditor.is_lead ? " · Líder" : ""}</div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${
                      auditor.status === "En Revision"
                        ? "bg-emerald-100 text-emerald-700"
                        : auditor.status === "Completado"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {auditor.status === "En Revision"
                      ? "En revisión"
                      : auditor.status === "Completado"
                        ? "Completado"
                        : "Pendiente"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}