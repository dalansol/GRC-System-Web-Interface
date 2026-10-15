import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Plus, Loader2, RefreshCw } from "lucide-react";

import { Breadcrumbs, Card, PageHeader, PrimaryBtn } from "./SharedComponents";
import type { AuditPlan } from "./SharedComponents";
import { useAuditPlansViewModel } from "../domain/planes-auditoria/useAuditPlansViewModel";
import { CONTROLS, INITIAL_USERS, PLAN_CONTROL_ASSIGNMENTS } from "../data/mock_data";
import { useSesion } from "../auth/SesionContext";
import FormularioPlanAudito from "./FormularioPlanAudito";
import type { DatosFormularioPlanAudito } from "./FormularioPlanAudito";

const PLAN_STATUS_CFG: Record<AuditPlan["status"], { label: string; cls: string }> = {
  "Borrador": { label: "Borrador", cls: "bg-slate-50 text-slate-600 border border-slate-200" },
  "Aprobado": { label: "Aprobado", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  "En Ejecución": { label: "En Ejecución", cls: "bg-amber-50 text-amber-700 border border-amber-200" },
  "Cerrado": { label: "Cerrado", cls: "bg-blue-50 text-blue-700 border border-blue-200" },
};

export default function VistaPlanesAudito({ canCreate }: { canCreate: boolean }) {
  const { plans, loading, isCreating, USE_REAL_BACKEND, fetchPlans, createPlan } = useAuditPlansViewModel();
  const { usuario } = useSesion();
  const esAuditorSenior = usuario?.rol === "Auditor Senior";

  const [showForm, setShowForm] = useState(false);
  const [expandedPlanCode, setExpandedPlanCode] = useState<string | null>(null);
  const [controlAssignments, setControlAssignments] = useState(PLAN_CONTROL_ASSIGNMENTS);

  const empleadosAsignados = useMemo(() => {
    const jefe = INITIAL_USERS.find((user) => user.name === usuario?.nombre && user.role === "Jefe de Auditoría");
    const managerId = jefe?.id ?? "USR-001";

    return INITIAL_USERS
      .filter((user) => user.manager === managerId && user.status === "active")
      .sort((left, right) => left.name.localeCompare(right.name, "es"));
  }, [usuario?.nombre]);
  
  const responsableInicial = empleadosAsignados[0]?.name ?? "";

  const handleCreatePlan = async (formData: DatosFormularioPlanAudito) => {
    const success = await createPlan(formData);
    if (success) {
      setShowForm(false);
    }
    return success;
  };

  const asignarResponsableControl = (planCode: string, controlId: string, responsibleId: string) => {
    setControlAssignments((current) => current.map((assignment) =>
      assignment.planCode === planCode && assignment.controlId === controlId
        ? { ...assignment, responsibleId }
        : assignment,
    ));
    toast.success("Responsable del control actualizado.");
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
              {USE_REAL_BACKEND ? "Mock Data Servidor" : "Mock Data Local"}
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
                    const assignedControls = controlAssignments
                      .filter((assignment) => assignment.planCode === plan.code)
                      .map((assignment) => ({
                        ...assignment,
                        control: CONTROLS.find((control) => control.id === assignment.controlId),
                        responsible: INITIAL_USERS.find((user) => user.id === assignment.responsibleId),
                      }))
                      .filter((assignment) => assignment.control);
                      
                    return (
                      <Fragment key={plan.id}>
                        <tr className="border-b border-border hover:bg-muted/20">
                          <td className="py-3 px-4 font-medium">{plan.code}</td>
                          <td className="py-3 px-4">{plan.name}</td>
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
                              <div className="mb-3">
                                <h3 className="text-sm font-semibold text-foreground">Controles asignados</h3>
                                <p className="text-xs text-muted-foreground">Responsable del seguimiento durante este plan de auditoría.</p>
                              </div>
                              {assignedControls.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Este plan no tiene controles asignados.</p>
                              ) : (
                                <div className="space-y-2">
                                  {assignedControls.map(({ control, responsible, controlId, responsibleId }) => (
                                    <div key={controlId} className="flex items-center justify-between gap-4 rounded-md border border-border bg-card px-3 py-2">
                                      <div>
                                        <div className="text-sm font-medium text-foreground">{control!.businessControlNumber} · {control!.controlProcedureName}</div>
                                        <div className="text-xs text-muted-foreground">{control!.controlActivity}</div>
                                      </div>
                                      {esAuditorSenior ? (
                                        <select
                                          value={responsibleId}
                                          onChange={(event) => asignarResponsableControl(plan.code, controlId, event.target.value)}
                                          className="min-w-48 rounded-md border border-border bg-white px-2 py-1.5 text-xs"
                                        >
                                          {empleadosAsignados.map((empleado) => (
                                            <option key={empleado.id} value={empleado.id}>{empleado.name}</option>
                                          ))}
                                        </select>
                                      ) : (
                                        <span className="text-sm font-medium text-foreground">{responsible?.name ?? "Sin responsable"}</span>
                                      )}
                                    </div>
                                  ))}
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
    </div>
  );
}