import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BookOpen, ChevronDown, Download, FileText, Plus, Save, Loader2, RefreshCw } from "lucide-react";

import {
  Breadcrumbs,
  Card,
  PageHeader,
  PDFPreviewModal,
  PrimaryBtn,
  exportToCSV,
} from "./SharedComponents";
import type { AuditPlan } from "./SharedComponents";
import { useAuditPlansViewModel } from "../domain/planes-auditoria/useAuditPlansViewModel";
import { CONTROLS, INITIAL_USERS, PLAN_CONTROL_ASSIGNMENTS } from "../data/mock_data";
import { useSesion } from "../auth/SesionContext";

const PLAN_STATUS_CFG: Record<AuditPlan["status"], { label: string; cls: string }> = {
  "Borrador": { label: "Borrador", cls: "bg-slate-50 text-slate-600 border border-slate-200" },
  "Aprobado": { label: "Aprobado", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  "En Ejecución": { label: "En Ejecución", cls: "bg-amber-50 text-amber-700 border border-amber-200" },
  "Cerrado": { label: "Cerrado", cls: "bg-blue-50 text-blue-700 border border-blue-200" },
};

export default function AuditPlansView({ canCreate }: { canCreate: boolean }) {
  // Consume the custom hook
  const { plans, loading, isCreating, USE_REAL_BACKEND, fetchPlans, createPlan } = useAuditPlansViewModel();
  const { usuario } = useSesion();
  const esAuditorSenior = usuario?.rol === "Auditor Senior";

  const [showForm, setShowForm] = useState(false);
  const [planPdfTarget, setPlanPdfTarget] = useState<AuditPlan | null>(null);
  const empleadosAsignados = useMemo(() => {
    const jefe = INITIAL_USERS.find((user) => user.name === usuario?.nombre && user.role === "Jefe de Auditoría");
    const managerId = jefe?.id ?? "USR-001";

    return INITIAL_USERS
      .filter((user) => user.manager === managerId && user.status === "active")
      .sort((left, right) => left.name.localeCompare(right.name, "es"));
  }, [usuario?.nombre]);
  const responsableInicial = empleadosAsignados[0]?.name ?? "";
  const [form, setForm] = useState({ code: "", name: "", type: "", period: "", startDate: "", endDate: "", estimatedHours: "", responsible: responsableInicial, scope: "" });
  const [formErr, setFormErr] = useState<Record<string, string>>({});
  const [expandedPlanCode, setExpandedPlanCode] = useState<string | null>(null);
  const [controlAssignments, setControlAssignments] = useState(PLAN_CONTROL_ASSIGNMENTS);

  useEffect(() => {
    setForm((previous) => previous.responsible
      ? previous
      : { ...previous, responsible: responsableInicial });
  }, [responsableInicial]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.code.trim()) errs.code = "Requerido";
    if (!form.name.trim()) errs.name = "Requerido";
    if (form.type !== "Anual" && form.type !== "Trimestral") errs.type = "Selecciona anual o trimestral";
    if (!form.startDate) errs.startDate = "Requerido";
    if (!form.endDate) errs.endDate = "Requerido";
    if (form.startDate && form.endDate && form.endDate <= form.startDate) errs.endDate = "Debe ser posterior a la fecha de inicio";
    const h = Number(form.estimatedHours);
    if (!form.estimatedHours || h <= 0 || !Number.isFinite(h)) errs.estimatedHours = "Debe ser mayor a 0";
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setFormErr(errs); return; }

    const success = await createPlan({
      code: form.code,
      name: form.name,
      type: form.type as AuditPlan["type"],
      period: form.period,
      startDate: form.startDate,
      endDate: form.endDate,
      estimatedHours: Number(form.estimatedHours),
      responsible: form.responsible,
      scope: form.scope,
    });

    if (success) {
      setShowForm(false);
      setForm({ code: "", name: "", type: "", period: "", startDate: "", endDate: "", estimatedHours: "", responsible: responsableInicial, scope: "" });
      setFormErr({});
    }
  };

  const asignarResponsableControl = (planCode: string, controlId: string, responsibleId: string) => {
    setControlAssignments((current) => current.map((assignment) =>
      assignment.planCode === planCode && assignment.controlId === controlId
        ? { ...assignment, responsibleId }
        : assignment,
    ));
    toast.success("Responsable del control actualizado.");
  };

  const inp = (label: string, key: keyof typeof form, type = "text", placeholder = "") => (
    <div>
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">{label}</label>
      <input
        type={type} value={form[key]} placeholder={placeholder}
        onChange={e => { setForm(f => ({ ...f, [key]: e.target.value })); setFormErr(f => ({ ...f, [key]: "" })); }}
        className={`w-full text-sm px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 ${formErr[key] ? "border-red-400" : "border-border"}`}
      />
      {formErr[key] && <div className="text-xs text-red-600 mt-0.5">{formErr[key]}</div>}
    </div>
  );

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
              {USE_REAL_BACKEND ? "API Backend (SQL Server)" : "Mock Data Local"}
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
            <PrimaryBtn icon={<Plus size={14} />} onClick={() => setShowForm(s => !s)}>
              {showForm ? "Cancelar" : "Nuevo plan"}
            </PrimaryBtn>
          )}
        </div>
      </div>

      {showForm && (
        <Card className="p-5 mb-6 border-primary/30 bg-primary/[0.02]">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen size={15} className="text-primary" />
            <div className="text-sm font-semibold text-foreground">Nuevo Plan de Auditoría</div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {inp("Código del plan", "code", "text", "PAI-2025-004")}
            {inp("Nombre del plan", "name", "text", "Plan de Auditoría…")}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Tipo de plan</label>
              <select
                value={form.type}
                onChange={e => { setForm(f => ({ ...f, type: e.target.value })); setFormErr(f => ({ ...f, type: "" })); }}
                className={`w-full text-sm px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 ${formErr.type ? "border-red-400" : "border-border"}`}
              >
                <option value="">— Seleccionar —</option>
                <option value="Anual">Anual</option>
                <option value="Trimestral">Trimestral</option>
              </select>
              {formErr.type && <div className="text-xs text-red-600 mt-0.5">{formErr.type}</div>}
            </div>
            {inp("Periodo", "period", "text", "Q3–Q4 2025")}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Responsable</label>
              <select
                value={form.responsible}
                onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))}
                className="w-full text-sm px-3 py-2 rounded-md border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">— Seleccionar responsable —</option>
                {empleadosAsignados.map((empleado) => (
                  <option key={empleado.id} value={empleado.name}>{empleado.name}</option>
                ))}
              </select>
            </div>
            {inp("Fecha de inicio", "startDate", "date")}
            {inp("Fecha de fin", "endDate", "date")}
            {inp("Horas estimadas", "estimatedHours", "number", "120")}
          </div>
          <div className="mb-4">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Alcance</label>
            <textarea
              value={form.scope} rows={2} placeholder="Descripción del alcance del plan…"
              onChange={e => setForm(f => ({ ...f, scope: e.target.value }))}
              className="w-full text-sm px-3 py-2 rounded-md border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
          <PrimaryBtn
            icon={isCreating ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
            onClick={() => { handleSubmit(); }}
          >
            {isCreating ? "Guardando..." : "Guardar plan"}
          </PrimaryBtn>
        </Card>
      )}

      {/* Table Section */}
      <Card>
        {/* Header Actions Omitted for brevity (same as before) */}

        <div className="overflow-x-auto">
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