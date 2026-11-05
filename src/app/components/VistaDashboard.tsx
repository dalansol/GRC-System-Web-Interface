import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  ClipboardList,
  Clock,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  FileText,
  Plus,
  ArrowRight,
  Check,
  Building2,
  TrendingUp,
  Timer,
  ListTodo,
  Save,
  ShieldCheck,
  CalendarDays,
  FileCheck2,
} from "lucide-react";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import {
  StatusBadge,
  Breadcrumbs,
  PageHeader,
  Card,
  PrimaryBtn,
  GhostBtn,
  PDFPreviewModal,
} from "../components/SharedComponents";

import type {
  StatusKey,
  NavView,
} from "../components/SharedComponents";

import {
  INITIAL_USERS,
  AUDIT_PLANS_DATA,
  STATUS_CONFIG,
  AUDIT_ENTITIES,
  TASKS,
  QUARTERLY_DATA,
  VERTICAL_DATA,
  CHART_COLORS,
} from "../data/mock_data";
import { pedir } from "../api/cliente";
import { listarHallazgos, type HallazgoApi } from "../api/hallazgos";
import { listarControles } from "../api/controles";
import { listarMisPlanesAccion, listarPlanesAccion, type PlanAccion } from "../api/planesAccion";
import { useSesion } from "../auth/SesionContext";

type QuickLink = { label: string; urgency: string; desc: string };
type UserRole = "auditor" | "senior_auditor" | "jefe_auditoria" | "jefe_auditado" | "empleado_auditado";
type TimePeriod = "weekly" | "monthly" | "quarterly" | "yearly";
type DashboardRole = UserRole | "administrador";

interface DashboardData {
  auditorias: Array<{ id: number; codigo?: string; nombre?: string; estado?: string }>;
  hallazgos: HallazgoApi[];
  controles: Array<{ status?: string; hours_spent?: string | number }>;
  planesAccion: PlanAccion[];
}

const AUDIT_TYPE_OPTIONS = [
  "Auditoría Financiera",
  "Auditoría Operacional",
  "TI & Ciberseguridad",
  "Cumplimiento Regulatorio",
  "Auditoría de Nómina",
];

const EMPTY_AUDIT_FORM = {
  name: "",
  entityId: "",
  planId: "",
  leadAuditor: "",
  startDate: "",
  endDate: "",
  auditType: "",
};

// Mock dataset extensions for the Auditee role views across timeframes
const AUDITEE_PERIOD_DATA: Record<TimePeriod, { findings: any[]; actionPlans: any[] }> = {
  weekly: {
    findings: [
      { period: "Sem 1", abiertos: 2, mitigados: 4, criticos: 0 },
      { period: "Sem 2", abiertos: 3, mitigados: 2, criticos: 1 },
      { period: "Sem 3", abiertos: 1, mitigados: 5, criticos: 0 },
      { period: "Sem 4", abiertos: 4, mitigados: 3, criticos: 2 },
    ],
    actionPlans: [
      { period: "Sem 1", enTiempo: 6, atrasados: 1, completados: 4 },
      { period: "Sem 2", enTiempo: 5, atrasados: 2, completados: 3 },
      { period: "Sem 3", enTiempo: 8, atrasados: 0, completados: 6 },
      { period: "Sem 4", enTiempo: 7, atrasados: 1, completados: 5 },
    ],
  },
  monthly: {
    findings: [
      { period: "Julio", abiertos: 5, mitigados: 12, criticos: 1 },
      { period: "Agosto", abiertos: 8, mitigados: 10, criticos: 3 },
      { period: "Septiembre", abiertos: 4, mitigados: 15, criticos: 0 },
      { period: "Octubre", abiertos: 6, mitigados: 9, criticos: 2 },
    ],
    actionPlans: [
      { period: "Julio", enTiempo: 14, atrasados: 2, completados: 10 },
      { period: "Agosto", enTiempo: 12, atrasados: 4, completados: 9 },
      { period: "Septiembre", enTiempo: 18, atrasados: 1, completados: 14 },
      { period: "Octubre", enTiempo: 15, atrasados: 3, completados: 11 },
    ],
  },
  quarterly: {
    findings: [
      { period: "Q1 2025", abiertos: 12, mitigados: 30, criticos: 4 },
      { period: "Q2 2025", abiertos: 15, mitigados: 28, criticos: 5 },
      { period: "Q3 2025", abiertos: 9, mitigados: 35, criticos: 2 },
      { period: "Q4 2025 (Proj)", abiertos: 7, mitigados: 20, criticos: 1 },
    ],
    actionPlans: [
      { period: "Q1 2025", enTiempo: 35, atrasados: 8, completados: 28 },
      { period: "Q2 2025", enTiempo: 32, atrasados: 10, completados: 25 },
      { period: "Q3 2025", enTiempo: 40, atrasados: 5, completados: 36 },
      { period: "Q4 2025 (Proj)", enTiempo: 28, atrasados: 3, completados: 19 },
    ],
  },
  yearly: {
    findings: [
      { period: "2023", abiertos: 45, mitigados: 110, criticos: 12 },
      { period: "2024", abiertos: 38, mitigados: 125, criticos: 9 },
      { period: "2025", abiertos: 28, mitigados: 95, criticos: 6 },
    ],
    actionPlans: [
      { period: "2023", enTiempo: 90, atrasados: 25, completados: 85 },
      { period: "2024", enTiempo: 105, atrasados: 18, completados: 98 },
      { period: "2025", enTiempo: 85, atrasados: 12, completados: 78 },
    ],
  },
};

export default function DashboardView({
  onNav,
  userRole,
}: {
  onNav: (v: NavView) => void;
  userRole?: DashboardRole;
}) {
  const { usuario } = useSesion();
  const roleFromSession: DashboardRole =
    usuario?.rol === "Auditor" ? "auditor"
      : usuario?.rol === "Auditor Senior" ? "senior_auditor"
        : usuario?.rol === "Jefe de Auditoría" ? "jefe_auditoria"
          : usuario?.rol === "Jefe Auditado" ? "jefe_auditado"
            : usuario?.rol === "Empleado Auditado" ? "empleado_auditado"
              : "administrador";
  const activeRole = userRole ?? roleFromSession;
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    setDashboardLoading(true);
    setDashboardError(null);
    const cargar = async () => {
      try {
        const esAuditado = activeRole === "jefe_auditado" || activeRole === "empleado_auditado";
        if (esAuditado) {
          const [planesResultado, hallazgosResultado] = await Promise.allSettled([
            listarMisPlanesAccion(),
            pedir<HallazgoApi[]>("/hallazgos/unidad-negocio"),
          ]);
          if (vigente) {
            setDashboardData({
              auditorias: [],
              controles: [],
              planesAccion: planesResultado.status === "fulfilled" ? planesResultado.value : [],
              hallazgos: hallazgosResultado.status === "fulfilled" ? hallazgosResultado.value : [],
            });
            if (hallazgosResultado.status === "rejected" && planesResultado.status === "rejected") {
              throw hallazgosResultado.reason;
            }
          }
        } else {
          const [auditoriasResultado, hallazgosResultado, controlesResultado, planesResultado] = await Promise.allSettled([
            pedir<DashboardData["auditorias"]>("/planes"),
            listarHallazgos(),
            listarControles(),
            listarPlanesAccion(),
          ]);
          if (vigente) {
            setDashboardData({
              auditorias: auditoriasResultado.status === "fulfilled" ? auditoriasResultado.value : [],
              hallazgos: hallazgosResultado.status === "fulfilled" ? hallazgosResultado.value : [],
              controles: controlesResultado.status === "fulfilled" ? controlesResultado.value : [],
              planesAccion: planesResultado.status === "fulfilled" ? planesResultado.value : [],
            });
            if ([auditoriasResultado, hallazgosResultado, controlesResultado, planesResultado].every((resultado) => resultado.status === "rejected")) {
              throw auditoriasResultado.reason;
            }
          }
        }
      } catch (error) {
        if (vigente) setDashboardError(error instanceof Error ? error.message : "No se pudieron cargar los datos del dashboard.");
      } finally {
        if (vigente) setDashboardLoading(false);
      }
    };
    void cargar();
    return () => { vigente = false; };
  }, [activeRole]);

  // Common states
  const [dashPdfOpen, setDashPdfOpen] = useState(false);

  // Auditor Team states
  const [hours, setHours] = useState("");
  const [hourSaved, setHourSaved] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusKey | "all">("all");
  const [showNewAudit, setShowNewAudit] = useState(false);
  const [auditForm, setAuditForm] = useState(EMPTY_AUDIT_FORM);
  const [auditErr, setAuditErr] = useState<Record<string, string>>({});
  const [auditCounter, setAuditCounter] = useState(47);
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>([
    { label: "AUD-2025-041 — SOX Financiero", urgency: "overdue", desc: "Vencida · Entregable pendiente" },
    { label: "AUD-2025-038 — TI & Ciberseguridad", urgency: "in_progress", desc: "En progreso · Faltan 6 días" },
    { label: "AUD-2025-035 — Nómina México", urgency: "pending", desc: "Inicio en 12 días" },
  ]);

  // Auditee Team states
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("quarterly");

  // Role checks
  const isAuditeeRole = activeRole === "jefe_auditado" || activeRole === "empleado_auditado";

  // Auditor helper actions
  const saveHours = () => {
    if (!hours) return;
    setHourSaved(true);
    setTimeout(() => setHourSaved(false), 2500);
    setHours("");
  };

  const setField = (key: keyof typeof EMPTY_AUDIT_FORM, val: string) => {
    setAuditForm(f => ({ ...f, [key]: val }));
    setAuditErr(e => ({ ...e, [key]: "" }));
  };

  const validateAudit = () => {
    const e: Record<string, string> = {};
    if (!auditForm.name.trim()) e.name = "Requerido";
    if (!auditForm.entityId) e.entityId = "Requerido";
    if (!auditForm.leadAuditor) e.leadAuditor = "Requerido";
    if (!auditForm.startDate) e.startDate = "Requerido";
    if (!auditForm.endDate) e.endDate = "Requerido";
    if (auditForm.startDate && auditForm.endDate && auditForm.endDate <= auditForm.startDate)
      e.endDate = "Debe ser posterior a la fecha de inicio";
    return e;
  };

  const handleCreateAudit = () => {
    const errs = validateAudit();
    if (Object.keys(errs).length) { setAuditErr(errs); return; }
    const next = auditCounter + 1;
    setAuditCounter(next);
    const code = `AUD-2025-0${String(next).padStart(2, "0")}`;
    const entity = AUDIT_ENTITIES.find(a => a.id === auditForm.entityId);
    const newLink: QuickLink = {
      label: `${code} — ${auditForm.name}`,
      urgency: "pending",
      desc: `Pendiente · ${entity?.country ?? ""} · Inicio ${auditForm.startDate}`,
    };
    setQuickLinks(prev => [newLink, ...prev]);
    setShowNewAudit(false);
    setAuditForm(EMPTY_AUDIT_FORM);
    setAuditErr({});
    toast.success(`Auditoría ${code} creada correctamente`);
  };

  const filteredTasks =
    statusFilter === "all"
      ? TASKS
      : TASKS.filter((t) => t.status === statusFilter);

  const hallazgos = dashboardData?.hallazgos ?? [];
  const planesAccion = dashboardData?.planesAccion ?? [];
  const controles = dashboardData?.controles ?? [];
  const auditorias = dashboardData?.auditorias ?? [];
  const hallazgosAbiertos = hallazgos.filter((hallazgo) => hallazgo.status !== "Cerrado");
  const hallazgosCriticos = hallazgosAbiertos.filter((hallazgo) => hallazgo.severity === "Crítico").length;
  const controlesCompletados = controles.filter((control) => control.status === "Completado").length;
  const horasRegistradas = controles.reduce((total, control) => total + Number(control.hours_spent ?? 0), 0);
  const planesCompletados = planesAccion.filter((plan) => plan.estado === "Completado").length;
  const planesEnTiempo = planesAccion.filter((plan) => plan.estado !== "Completado" && plan.fechaCompromiso >= new Date().toISOString().slice(0, 10)).length;
  const kpis = isAuditeeRole
    ? [
        { label: "Planes Asignados", value: String(planesAccion.length), delta: `${planesEnTiempo} en tiempo`, icon: <ClipboardList size={16} />, color: "text-blue-600 bg-blue-50" },
        { label: "Hallazgos Abiertos", value: String(hallazgosAbiertos.length), delta: `${hallazgosCriticos} críticos`, icon: <AlertTriangle size={16} />, color: "text-amber-600 bg-amber-50" },
        { label: "Planes de Acción", value: String(planesAccion.length), delta: `${planesCompletados} completados`, icon: <ShieldCheck size={16} />, color: "text-emerald-600 bg-emerald-50" },
        { label: "Vencimientos Próximos", value: String(planesAccion.filter((plan) => plan.estado !== "Completado" && plan.fechaCompromiso <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)).length), delta: "Próximos 7 días", icon: <CalendarDays size={16} />, color: "text-purple-600 bg-purple-50" },
      ]
    : [
        { label: "Auditorías Activas", value: String(auditorias.filter((plan) => plan.estado !== "Cerrado").length), delta: "Desde el backend", icon: <ClipboardList size={16} />, color: "text-blue-600 bg-blue-50" },
        { label: "Hallazgos Abiertos", value: String(hallazgosAbiertos.length), delta: `${hallazgosCriticos} críticos`, icon: <AlertTriangle size={16} />, color: "text-red-600 bg-red-50" },
        { label: "Controles Probados", value: String(controlesCompletados), delta: `${controles.length} asignados`, icon: <CheckCircle2 size={16} />, color: "text-emerald-600 bg-emerald-50" },
        { label: "Horas Registradas", value: `${horasRegistradas.toFixed(1)}h`, delta: "Acumuladas", icon: <Timer size={16} />, color: "text-purple-600 bg-purple-50" },
      ];

  const activeUsers = INITIAL_USERS.filter(u => u.status === "active");
  const auditPlansAll = AUDIT_PLANS_DATA;
  const currentChartData = useMemo(() => {
    const fallback = AUDITEE_PERIOD_DATA[timePeriod];
    if (!dashboardData) return fallback;
    return {
      findings: [{ period: "Actual", abiertos: hallazgosAbiertos.length, mitigados: hallazgos.filter((item) => item.status === "Cerrado").length, criticos: hallazgosCriticos }],
      actionPlans: [{ period: "Actual", enTiempo: planesEnTiempo, atrasados: planesAccion.filter((plan) => plan.estado !== "Completado" && plan.fechaCompromiso < new Date().toISOString().slice(0, 10)).length, completados: planesCompletados }],
    };
  }, [dashboardData, timePeriod, hallazgos, hallazgosAbiertos.length, hallazgosCriticos, planesAccion, planesCompletados, planesEnTiempo]);

  return (
    <>
      {/* ── Nueva Auditoría Modal (Solo Auditor Roles) ── */}
      {showNewAudit && !isAuditeeRole && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => { setShowNewAudit(false); setAuditErr({}); }} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <div className="px-6 pt-5 pb-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-primary/10 rounded-lg"><ClipboardList size={15} className="text-primary" /></div>
                  <div>
                    <div className="text-sm font-bold text-foreground">Nueva Auditoría</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Completa todos los campos requeridos</div>
                  </div>
                </div>
                <button onClick={() => { setShowNewAudit(false); setAuditErr({}); }} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors">
                  ✕
                </button>
              </div>

              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                    Nombre de la auditoría <span className="text-destructive">*</span>
                  </label>
                  <input
                    value={auditForm.name}
                    onChange={e => setField("name", e.target.value)}
                    placeholder="Ej. Auditoría Financiera Q4 — Tesorería"
                    className={`w-full text-sm px-3 py-2 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 ${auditErr.name ? "border-destructive" : "border-border"}`}
                  />
                  {auditErr.name && <p className="text-xs text-destructive mt-0.5">{auditErr.name}</p>}
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Tipo de auditoría</label>
                  <select
                    value={auditForm.auditType}
                    onChange={e => setField("auditType", e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">— Seleccionar —</option>
                    {AUDIT_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                    Entidad auditable <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={auditForm.entityId}
                    onChange={e => setField("entityId", e.target.value)}
                    className={`w-full text-sm px-3 py-2 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 ${auditErr.entityId ? "border-destructive" : "border-border"}`}
                  >
                    <option value="">— Seleccionar entidad —</option>
                    {AUDIT_ENTITIES.map(ae => (
                      <option key={ae.id} value={ae.id}>{ae.id} — {ae.name.replace("Entidad Auditora — ", "")}</option>
                    ))}
                  </select>
                  {auditErr.entityId && <p className="text-xs text-destructive mt-0.5">{auditErr.entityId}</p>}
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Plan de auditoría asociado</label>
                  <select
                    value={auditForm.planId}
                    onChange={e => setField("planId", e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">— Sin plan asociado —</option>
                    {auditPlansAll.map(p => (
                      <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                    Auditor líder <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={auditForm.leadAuditor}
                    onChange={e => setField("leadAuditor", e.target.value)}
                    className={`w-full text-sm px-3 py-2 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 ${auditErr.leadAuditor ? "border-destructive" : "border-border"}`}
                  >
                    <option value="">— Seleccionar auditor —</option>
                    {activeUsers.map(u => (
                      <option key={u.id} value={u.name}>{u.name} · {u.role}</option>
                    ))}
                  </select>
                  {auditErr.leadAuditor && <p className="text-xs text-destructive mt-0.5">{auditErr.leadAuditor}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                      Fecha de inicio <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="date"
                      value={auditForm.startDate}
                      onChange={e => setField("startDate", e.target.value)}
                      className={`w-full text-sm px-3 py-2 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 ${auditErr.startDate ? "border-destructive" : "border-border"}`}
                    />
                    {auditErr.startDate && <p className="text-xs text-destructive mt-0.5">{auditErr.startDate}</p>}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                      Fecha de fin <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="date"
                      value={auditForm.endDate}
                      onChange={e => setField("endDate", e.target.value)}
                      className={`w-full text-sm px-3 py-2 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 ${auditErr.endDate ? "border-destructive" : "border-border"}`}
                    />
                    {auditErr.endDate && <p className="text-xs text-destructive mt-0.5">{auditErr.endDate}</p>}
                  </div>
                </div>
              </div>

              <div className="px-6 pb-5 flex items-center gap-3">
                <PrimaryBtn icon={<Check size={14} />} onClick={handleCreateAudit}>
                  Crear auditoría
                </PrimaryBtn>
                <GhostBtn onClick={() => { setShowNewAudit(false); setAuditErr({}); setAuditForm(EMPTY_AUDIT_FORM); }}>
                  Cancelar
                </GhostBtn>
              </div>
            </div>
          </div>
        </>
      )}

      <div
        className="flex-1 overflow-auto p-6"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        <Breadcrumbs
          items={[
            "Inicio",
            "Dashboard",
            isAuditeeRole ? "Portal de Auditados" : "Portal de Equipo de Auditoría",
          ]}
        />

        <PageHeader
          title={
            isAuditeeRole
              ? "Dashboard — Gestión de Evidencias y Planes (Auditado)"
              : "Dashboard — Jefatura y Ejecución de Auditoría"
          }
          subtitle={`Rol activo: ${activeRole.replace("_", " ").toUpperCase()} · ${dashboardLoading ? "Cargando datos..." : dashboardError ? "No se pudo actualizar" : "Actualizado ahora"}`}
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDashPdfOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-secondary transition-colors font-semibold"
              >
                <FileText size={12} /> Exportar PDF
              </button>
              {!isAuditeeRole && (
                <PrimaryBtn icon={<Plus size={14} />} onClick={() => setShowNewAudit(true)}>
                  Nueva Auditoría
                </PrimaryBtn>
              )}
            </div>
          }
        />

        {dashPdfOpen && (
          <PDFPreviewModal
            onClose={() => setDashPdfOpen(false)}
            doc={{
              title: isAuditeeRole ? "Reporte de Hallazgos y Planes del Auditado" : "Resumen del Período Q3 2025",
              subtitle: "Expedite GRC Platform",
              sections: [
                {
                  heading: "Indicadores Principales",
                  rows: isAuditeeRole
                    ? [["Evidencias asignadas", "8"], ["Hallazgos abiertos", "5"], ["Planes de acción", "12"]]
                    : [["Auditorías activas", "14"], ["Hallazgos abiertos", "38 (7 críticos)"], ["Controles probados", "127"]],
                },
              ],
            }}
          />
        )}

        {/* KPI Row */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {kpis.map((k) => (
            <Card key={k.label} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-lg ${k.color}`}>
                  {k.icon}
                </div>
                <TrendingUp size={12} className="text-muted-foreground" />
              </div>
              <div className="text-2xl font-bold text-foreground tracking-tight">
                {k.value}
              </div>
              <div className="text-xs font-semibold text-foreground mt-0.5">
                {k.label}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {k.delta}
              </div>
            </Card>
          ))}
        </div>

        {/* ── CONDITIONAL RENDERING BASED ON ROLE TYPE ── */}
        {isAuditeeRole ? (
          /* ======================================================== */
          /* AUDITEE SHARED VIEW (Jefe Auditado & Empleado Auditado)  */
          /* ======================================================== */
          <div className="space-y-6">
            {/* Timeframe Filter Bar */}
            <Card className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays size={16} className="text-primary" />
                <span className="text-sm font-semibold text-foreground">Seleccionar Vista Temporal:</span>
              </div>
              <div className="flex items-center gap-1.5 bg-secondary/60 p-1 rounded-lg">
                {(["weekly", "monthly", "quarterly", "yearly"] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setTimePeriod(period)}
                    className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all ${
                      timePeriod === period
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {period === "weekly" && "Semanal"}
                    {period === "monthly" && "Mensual"}
                    {period === "quarterly" && "Trimestral"}
                    {period === "yearly" && "Anual"}
                  </button>
                ))}
              </div>
            </Card>

            {/* Charts Grid: Findings and Action Plans */}
            <div className="grid grid-cols-2 gap-4">
              {/* Findings Chart */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle size={15} className="text-amber-600" />
                  <div className="text-sm font-semibold text-foreground">
                    Hallazgos ({timePeriod.toUpperCase()})
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={currentChartData.findings} barSize={12} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#5A6A85" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#5A6A85" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 6, fontSize: 12 }} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Bar dataKey="abiertos" name="Abiertos" fill="#E02424" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="mitigados" name="Mitigados" fill="#10B981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="criticos" name="Críticos" fill="#F59E0B" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Action Plans Chart */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <FileCheck2 size={15} className="text-emerald-600" />
                  <div className="text-sm font-semibold text-foreground">
                    Planes de Acción ({timePeriod.toUpperCase()})
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={currentChartData.actionPlans} barSize={12} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#5A6A85" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#5A6A85" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 6, fontSize: 12 }} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Bar dataKey="enTiempo" name="En Tiempo" fill="#3B82F6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="atrasados" name="Atrasados" fill="#EF4444" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="completados" name="Completados" fill="#10B981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* AUDITOR TEAM SHARED VIEW (Auditor, Senior, Jefe)         */
          /* ======================================================== */
          <>
            {/* Quick Access & Hour Log */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="col-span-2">
                <Card>
                  <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between">
                    <div className="text-sm font-semibold text-foreground">
                      Accesos Rápidos — Registros Urgentes
                    </div>
                    <button
                      onClick={() => onNav("filter")}
                      className="text-xs text-accent flex items-center gap-1 hover:underline"
                    >
                      Ver todos <ArrowRight size={10} />
                    </button>
                  </div>
                  <div className="divide-y divide-border">
                    {quickLinks.map((link, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 cursor-pointer group transition-colors"
                      >
                        <div
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_CONFIG[link.urgency as StatusKey].dot}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                            {link.label}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {link.desc}
                          </div>
                        </div>
                        <StatusBadge status={link.urgency as StatusKey} />
                        <ArrowRight
                          size={14}
                          className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        />
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Hour logger */}
              <Card className="p-4 flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={15} className="text-primary" />
                  <div className="text-sm font-semibold text-foreground">
                    Registro de Horas
                  </div>
                </div>
                <div className="space-y-2.5 flex-1">
                  <select className="w-full text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30">
                    <option>AUD-2025-041 — SOX Financiero</option>
                    <option>AUD-2025-038 — TI & Ciberseguridad</option>
                    <option>AUD-2025-035 — Nómina México</option>
                  </select>
                  <select className="w-full text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30">
                    <option>Planificación</option>
                    <option>Trabajo de campo</option>
                    <option>Revisión / QA</option>
                    <option>Reporte</option>
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0.5"
                      max="24"
                      step="0.5"
                      placeholder="Horas (ej. 3.5)"
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      className="flex-1 text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
                    />
                    <button
                      onClick={saveHours}
                      className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                        hourSaved
                          ? "bg-emerald-500 text-white"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      }`}
                    >
                      {hourSaved ? <Check size={16} /> : <Save size={16} />}
                    </button>
                  </div>
                </div>
                {hourSaved && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 rounded-md px-3 py-2">
                    <CheckCircle2 size={12} />
                    <span>Horas registradas correctamente</span>
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="text-xs text-muted-foreground">
                    Hoy: <span className="font-semibold text-foreground">4.5h</span> · Semana:{" "}
                    <span className="font-semibold text-foreground">22h</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Tasks Table */}
            <Card className="mb-6">
              <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ListTodo size={15} className="text-primary" />
                  <div className="text-sm font-semibold text-foreground">
                    Tareas Pendientes
                  </div>
                  <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-medium">
                    {TASKS.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {(["all", "overdue", "in_progress", "pending", "completed"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setStatusFilter(f)}
                      className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                        statusFilter === f
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      {f === "all" ? "Todos" : STATUS_CONFIG[f].label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        ID / Nombre
                      </th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Tipo
                      </th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Responsable
                      </th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Estatus
                      </th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Fecha Esperada
                      </th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredTasks.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                          <CheckCircle2 size={28} className="mx-auto mb-2 text-muted-foreground/40" />
                          <div className="text-sm">No hay tareas con este filtro</div>
                        </td>
                      </tr>
                    )}
                    {filteredTasks.map((task) => (
                      <tr
                        key={task.id}
                        className="hover:bg-secondary/30 cursor-pointer group transition-colors"
                        onClick={() => onNav("filter")}
                      >
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs text-muted-foreground mb-0.5">{task.id}</div>
                          <div className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">
                            {task.name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{task.type}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                              {task.owner.split(" ").map((n) => n[0]).join("")}
                            </div>
                            <span className="text-xs text-foreground">{task.owner}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={task.status} />
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`font-mono text-xs ${
                              task.status === "overdue" ? "text-red-600 font-semibold" : "text-muted-foreground"
                            }`}
                          >
                            {task.dueDate}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <ArrowRight
                            size={14}
                            className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Charts */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 size={15} className="text-primary" />
                  <div className="text-sm font-semibold text-foreground">
                    Auditorías por Trimestre
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={QUARTERLY_DATA} barSize={12} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                    <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: "#5A6A85" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#5A6A85" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 6, fontSize: 12 }} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Bar dataKey="completadas" name="Completadas" fill={CHART_COLORS.completadas} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="en_progreso" name="En Progreso" fill={CHART_COLORS.en_progreso} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="pendientes" name="Pendientes" fill={CHART_COLORS.pendientes} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="vencidas" name="Vencidas" fill={CHART_COLORS.vencidas} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 size={15} className="text-primary" />
                  <div className="text-sm font-semibold text-foreground">
                    Por Vertical · Entidad Auditada
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={VERTICAL_DATA} barSize={14} barGap={3} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#5A6A85" }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#5A6A85" }} axisLine={false} tickLine={false} width={90} />
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 6, fontSize: 12 }} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                    <Bar dataKey="mx" name="México" fill="#1A4FA0" radius={[0, 3, 3, 0]} />
                    <Bar dataKey="br" name="Brasil" fill="#2B6FD4" radius={[0, 3, 3, 0]} />
                    <Bar dataKey="co" name="Colombia" fill="#7BA7D9" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  );
}