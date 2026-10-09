import React, { useState, useEffect, useRef } from "react";
import { toast, Toaster } from "sonner";

import {
  LayoutDashboard,
  Shield,
  ClipboardList,
  GitBranch,
  Settings,
  Bell,
  ChevronRight,
  ChevronDown,
  Search,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Circle,
  BarChart3,
  Users,
  FileText,
  Plus,
  Undo2,
  GripVertical,
  X,
  Sparkles,
  Filter,
  ChevronUp,
  ArrowRight,
  Loader2,
  Check,
  Building2,
  TrendingUp,
  PieChart,
  CalendarDays,
  ListTodo,
  Timer,
  RefreshCw,
  Save,
  Eye,
  Layers,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  Maximize2,
  SlidersHorizontal,
  ClipboardCheck,
  ShieldAlert,
  MoreVertical,
  Trash2,
  Pencil,
  FileSpreadsheet,
  Lock,
  Download,
  MessageSquare,
  Send,
  HelpCircle,
  UploadCloud,
  BookOpen,
  UserCheck,
  Hash,
  ChevronLeft,
  Flag,
  FileCheck2,
  Ban,
  Activity,
  LogOut,
  ShieldCheck,
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
  DetailField,
  RiskLevelBadge,
  ValidityBadge,
  AISummaryCard,
  exportToCSV,
  NavItem
} from "./components/SharedComponents";

import type {
  // Types
  DetailType,
  StatusKey,
  NavView,
  Navigate,
  // Interfaces
  AuditPlan,
  AuditDocument,
  AuditRecord,
  Finding,
  UserRecord,
  BilacoraEntry,
} from "./components/SharedComponents";

import {
  INITIAL_FINDINGS,
  INITIAL_USERS,
  AUDIT_PLANS_DATA,
  STATUS_CONFIG,
  AUDIT_ENTITIES,
  TASKS,
  AUDIT_RECORDS,
  GENERAL_RISKS,
  QUARTERLY_DATA,
  VERTICAL_DATA,
  CHART_COLORS,
  SPECIFIC_RISKS,
  PLAN_ENTITIES,
  PROCEDURE_TRACKING,
  CONTROLS,
  BITACORA_DATA,
  DEFAULT_PERMISSIONS,
  ROLES
} from "./data/mock_data";

import VistaHallazgo from "./components/VistaHallazgo";
import VistaControles from "./components/VistaControles";
import EvidenciasSection from "./components/EvidenciasSection";
import CopilotPanel from "./components/CopilotPanel";
import SpreadsheetEditor from "./components/SpreadsheetEditor";
import UsuariosRolesView from "./components/UsuariosRolesView";
import { useSesion } from "./auth/SesionContext";
import { listarMisPlanesAccion, type PlanAccion } from "./api/planesAccion";

const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard size={18} />,
    badge: 3,
  },
  {
    id: "filter",
    label: "Filtrar",
    icon: <SlidersHorizontal size={18} />,
  },
  {
    id: "hierarchy",
    label: "Catálogo",
    icon: <GitBranch size={18} />,
  },
];


// ─── Sidebar ────────────────────────────────────────────────────────────────
function Sidebar({
  active,
  onNav,
}: {
  active: NavView;
  onNav: (v: NavView) => void;
}) {
  const { usuario, esAdministrador, cerrarSesion } = useSesion();
  const iniciales = (usuario?.nombre ?? "").split(" ").map(n => n[0]).join("").slice(0, 2);

  return (
    <aside className="w-56 min-h-screen bg-sidebar flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 96 64" xmlns="http://www.w3.org/2000/svg" className="h-7 w-auto flex-shrink-0" fill="none">
            <path d="M6 6 L26 32 L6 58" stroke="white" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M38 6 L58 32 L38 58" stroke="white" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M70 6 L90 32 L70 58" stroke="white" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <div className="text-white text-sm font-bold leading-none tracking-wide">
              Expedite
            </div>
            <div className="text-sidebar-foreground/50 text-[10px] mt-0.5 font-mono uppercase tracking-widest">
              GRC v1.0
            </div>
          </div>
        </div>
      </div>

      {/* Role pill */}
      <div className="px-4 py-3 border-b border-sidebar-border">
        <div className="flex items-center gap-2 bg-sidebar-accent rounded-md px-3 py-2">
          <div className="w-6 h-6 rounded-full bg-sidebar-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {iniciales}
          </div>
          <div className="min-w-0">
            <div className="text-white text-xs font-semibold truncate">
              {usuario?.nombre}
            </div>
            <div className="text-sidebar-foreground/60 text-[10px] truncate">
              {usuario?.rol}
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            id={`tour-nav-${item.id}`}
            onClick={() => onNav(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left ${active === item.id
              ? "bg-sidebar-primary text-white"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
              }`}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {item.badge && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active === item.id ? "bg-white/20 text-white" : "bg-red-500 text-white"}`}
              >
                {item.badge}
              </span>
            )}
          </button>
        ))}

        <div className="pt-3 pb-1 px-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
            Auditoría
          </div>
        </div>

        {([
          { id: "plans" as NavView, label: "Planes de Auditoría", icon: <BookOpen size={16} /> },
          { id: "findings" as NavView, label: "Hallazgos", icon: <Flag size={16} /> },
          { id: "controles" as NavView, label: "Controles", icon: <ShieldCheck size={16} /> },
          { id: "auditado" as NavView, label: "Portal del Auditado", icon: <UserCheck size={16} /> },
        ] as { id: NavView; label: string; icon: React.ReactNode }[]).map(item => (
          <button
            key={item.id}
            id={`tour-nav-${item.id}`}
            onClick={() => onNav(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left ${active === item.id
              ? "bg-sidebar-primary text-white"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
              }`}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
          </button>
        ))}

        <div className="pt-3 pb-1 px-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
            Configuración
          </div>
        </div>

        {esAdministrador && (
          <button
            id="tour-nav-users"
            onClick={() => onNav("users")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left ${active === "users"
              ? "bg-sidebar-primary text-white"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
              }`}
          >
            <span className="flex-shrink-0"><Users size={16} /></span>
            Usuarios & Roles
          </button>
        )}
        <button
          id="tour-nav-bitacora"
          onClick={() => onNav("bitacora")}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left ${active === "bitacora"
            ? "bg-sidebar-primary text-white"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
            }`}
        >
          <span className="flex-shrink-0"><Activity size={16} /></span>
          Bitácora
        </button>
        <button
          onClick={() => onNav("settings")}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left ${active === "settings"
            ? "bg-sidebar-primary text-white"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
            }`}
        >
          <span className="flex-shrink-0">
            <Settings size={16} />
          </span>
          Ajustes sistema
        </button>
      </nav>

      <div className="px-4 py-3 border-t border-sidebar-border space-y-2">
        <button
          onClick={() => void cerrarSesion()}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-white transition-colors text-left"
        >
          <LogOut size={14} />
          Cerrar sesión
        </button>
        <div className="text-[10px] text-sidebar-foreground/30 text-center font-mono">
          © 2025 Expedite
        </div>
      </div>
    </aside>
  );
}

// ─── Top Bar ────────────────────────────────────────────────────────────────
function TopBar({ viewLabel }: { viewLabel: string }) {
  return (
    <header className="h-12 bg-card border-b border-border flex items-center px-6 gap-4 flex-shrink-0">
      <div className="relative flex-1 max-w-sm">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          placeholder="Buscar auditorías, riesgos, controles…"
          className="w-full bg-input-background text-sm pl-9 pr-3 py-1.5 rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
        />
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        <button className="relative p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors">
          <Bell size={16} />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays size={14} />
          <span className="font-mono text-xs">
            Lun 21 Jul 2025
          </span>
        </div>
      </div>
    </header>
  );
}

// ─── View 1: DASHBOARD ──────────────────────────────────────────────────────
type QuickLink = { label: string; urgency: string; desc: string };

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

function DashboardView({
  onNav,
}: {
  onNav: (v: NavView) => void;
}) {
  const [hours, setHours] = useState("");
  const [hourSaved, setHourSaved] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusKey | "all">("all");
  const [showNewAudit, setShowNewAudit] = useState(false);
  const [dashPdfOpen, setDashPdfOpen] = useState(false);
  const [auditForm, setAuditForm] = useState(EMPTY_AUDIT_FORM);
  const [auditErr, setAuditErr] = useState<Record<string, string>>({});
  const [auditCounter, setAuditCounter] = useState(47);

  const [quickLinks, setQuickLinks] = useState<QuickLink[]>([
    { label: "AUD-2025-041 — SOX Financiero", urgency: "overdue", desc: "Vencida · Entregable pendiente" },
    { label: "AUD-2025-038 — TI & Ciberseguridad", urgency: "in_progress", desc: "En progreso · Faltan 6 días" },
    { label: "AUD-2025-035 — Nómina México", urgency: "pending", desc: "Inicio en 12 días" },
  ]);

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

  const kpis = [
    { label: "Auditorías Activas", value: "14", delta: "+2 vs Q anterior", icon: <ClipboardList size={16} />, color: "text-blue-600 bg-blue-50" },
    { label: "Hallazgos Abiertos", value: "38", delta: "7 críticos", icon: <AlertTriangle size={16} />, color: "text-red-600 bg-red-50" },
    { label: "Controles Probados", value: "127", delta: "83% aprobados", icon: <CheckCircle2 size={16} />, color: "text-emerald-600 bg-emerald-50" },
    { label: "Horas Registradas", value: "342h", delta: "Este mes", icon: <Timer size={16} />, color: "text-purple-600 bg-purple-50" },
  ];

  const activeUsers = INITIAL_USERS.filter(u => u.status === "active");
  const auditPlansAll = AUDIT_PLANS_DATA;

  return (
    <>
      {/* ── Nueva Auditoría Modal ── */}
      {showNewAudit && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => { setShowNewAudit(false); setAuditErr({}); }} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {/* Header */}
              <div className="px-6 pt-5 pb-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-primary/10 rounded-lg"><ClipboardList size={15} className="text-primary" /></div>
                  <div>
                    <div className="text-sm font-bold text-foreground">Nueva Auditoría</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Completa todos los campos requeridos</div>
                  </div>
                </div>
                <button onClick={() => { setShowNewAudit(false); setAuditErr({}); }} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors">
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-4">
                {/* Nombre */}
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

                {/* Tipo */}
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

                {/* Entidad auditable */}
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

                {/* Plan de auditoría */}
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

                {/* Auditor líder */}
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

                {/* Fechas */}
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

              {/* Footer */}
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
          items={["Inicio", "Dashboard", "Jefatura de Auditoría"]}
        />
        <PageHeader
          title="Dashboard — Jefatura de Auditoría"
          subtitle="Período activo: Q3 2025 · Última actualización: hace 4 min"
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDashPdfOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-secondary transition-colors font-semibold"
              >
                <FileText size={12} /> Exportar PDF
              </button>
              <PrimaryBtn icon={<Plus size={14} />} onClick={() => setShowNewAudit(true)}>
                Nueva Auditoría
              </PrimaryBtn>
            </div>
          }
        />
        {dashPdfOpen && (
          <PDFPreviewModal
            onClose={() => setDashPdfOpen(false)}
            doc={{
              title: "Resumen del Período Q3 2025",
              subtitle: "Jefatura de Auditoría · Expedite GRC Platform",
              sections: [
                {
                  heading: "Indicadores Clave",
                  rows: [
                    ["Auditorías activas", "14"],
                    ["Hallazgos abiertos", "38 (7 críticos)"],
                    ["Controles probados", "127 (83% aprobados)"],
                    ["Horas registradas", "342h (este mes)"],
                  ],
                },
                {
                  heading: "Tareas Urgentes",
                  rows: [
                    ["AUD-2025-041", "SOX Financiero — Vencida"],
                    ["AUD-2025-038", "TI & Ciberseguridad — En progreso"],
                    ["AUD-2025-035", "Nómina México — Pendiente"],
                  ],
                },
                {
                  heading: "Tendencias Q3 2025",
                  rows: [
                    ["Q1 completadas", "8"],
                    ["Q2 completadas", "11"],
                    ["Q3 en ejecución", "5 completadas · 7 en progreso"],
                    ["Q4 proyectadas", "9 pendientes"],
                  ],
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
                <TrendingUp
                  size={12}
                  className="text-muted-foreground"
                />
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
                    <StatusBadge
                      status={link.urgency as StatusKey}
                    />
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
                <option>
                  AUD-2025-038 — TI & Ciberseguridad
                </option>
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
                  className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${hourSaved
                    ? "bg-emerald-500 text-white"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                >
                  {hourSaved ? (
                    <Check size={16} />
                  ) : (
                    <Save size={16} />
                  )}
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
                Hoy:{" "}
                <span className="font-semibold text-foreground">
                  4.5h
                </span>{" "}
                · Semana:{" "}
                <span className="font-semibold text-foreground">
                  22h
                </span>
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
              {(
                [
                  "all",
                  "overdue",
                  "in_progress",
                  "pending",
                  "completed",
                ] as const
              ).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${statusFilter === f
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
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      <CheckCircle2
                        size={28}
                        className="mx-auto mb-2 text-muted-foreground/40"
                      />
                      <div className="text-sm">
                        No hay tareas con este filtro
                      </div>
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
                      <div className="font-mono text-xs text-muted-foreground mb-0.5">
                        {task.id}
                      </div>
                      <div className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">
                        {task.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {task.type}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                          {task.owner
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </div>
                        <span className="text-xs text-foreground">
                          {task.owner}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={task.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-mono text-xs ${task.status === "overdue" ? "text-red-600 font-semibold" : "text-muted-foreground"}`}
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
          {/* Quarterly */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={15} className="text-primary" />
              <div className="text-sm font-semibold text-foreground">
                Auditorías por Trimestre
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={QUARTERLY_DATA}
                barSize={12}
                barGap={4}
              >
                <CartesianGrid key="qgrid" strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis key="qxaxis" dataKey="quarter" tick={{ fontSize: 11, fill: "#5A6A85" }} axisLine={false} tickLine={false} />
                <YAxis key="qyaxis" tick={{ fontSize: 11, fill: "#5A6A85" }} axisLine={false} tickLine={false} />
                <Tooltip key="qtooltip" contentStyle={{ background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 6, fontSize: 12 }} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                <Legend key="qlegend" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar key="qbar-completadas" dataKey="completadas" name="Completadas" fill={CHART_COLORS.completadas} radius={[3, 3, 0, 0]} />
                <Bar key="qbar-en_progreso" dataKey="en_progreso" name="En Progreso" fill={CHART_COLORS.en_progreso} radius={[3, 3, 0, 0]} />
                <Bar key="qbar-pendientes" dataKey="pendientes" name="Pendientes" fill={CHART_COLORS.pendientes} radius={[3, 3, 0, 0]} />
                <Bar key="qbar-vencidas" dataKey="vencidas" name="Vencidas" fill={CHART_COLORS.vencidas} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Vertical/Country */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Building2 size={15} className="text-primary" />
              <div className="text-sm font-semibold text-foreground">
                Por Vertical · Entidad Auditada
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={VERTICAL_DATA} barSize={14} barGap={3} layout="vertical">
                <CartesianGrid key="vgrid" strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                <XAxis key="vxaxis" type="number" tick={{ fontSize: 11, fill: "#5A6A85" }} axisLine={false} tickLine={false} />
                <YAxis key="vyaxis" dataKey="name" type="category" tick={{ fontSize: 11, fill: "#5A6A85" }} axisLine={false} tickLine={false} width={90} />
                <Tooltip key="vtooltip" contentStyle={{ background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 6, fontSize: 12 }} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
                <Legend key="vlegend" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar key="vbar-mx" dataKey="mx" name="México" fill="#1A4FA0" radius={[0, 3, 3, 0]} />
                <Bar key="vbar-br" dataKey="br" name="Brasil" fill="#2B6FD4" radius={[0, 3, 3, 0]} />
                <Bar key="vbar-co" dataKey="co" name="Colombia" fill="#7BA7D9" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>
    </>
  );
}



// ─── View 2: FILTER / SEARCH PAGE ────────────────────────────────────────────
type FilterCategory =
  | "general_risk"
  | "specific_risk"
  | "audit_entity"
  | "plan_entity"
  | "audit";

const FILTER_TABS: {
  id: FilterCategory;
  label: string;
  icon: React.ReactNode;
}[] = [
    { id: "general_risk", label: "Riesgos Generales", icon: <Shield size={14} /> },
    { id: "specific_risk", label: "Riesgos Específicos", icon: <ShieldAlert size={14} /> },
    { id: "audit_entity", label: "Entidades Auditoras", icon: <Building2 size={14} /> },
    { id: "plan_entity", label: "Entidades de Plan", icon: <ClipboardList size={14} /> },
    { id: "audit", label: "Auditorías", icon: <ClipboardCheck size={14} /> },
  ];

function FilterView({ navigate }: { navigate: Navigate }) {
  const [category, setCategory] =
    useState<FilterCategory>("general_risk");
  const [search, setSearch] = useState("");

  const q = search.toLowerCase().trim();

  const grResults = GENERAL_RISKS.filter(
    (r) =>
      !q ||
      r.id.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.auditDepartment.toLowerCase().includes(q),
  );
  const srResults = SPECIFIC_RISKS.filter(
    (r) =>
      !q ||
      r.id.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.businessName.toLowerCase().includes(q) ||
      r.country.toLowerCase().includes(q) ||
      r.inherentRiskLevel.toLowerCase().includes(q) ||
      r.residualRiskLevel.toLowerCase().includes(q),
  );
  const aeResults = AUDIT_ENTITIES.filter(
    (r) =>
      !q ||
      r.id.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.auditDomain.toLowerCase().includes(q) ||
      r.country.toLowerCase().includes(q) ||
      r.divisionName.toLowerCase().includes(q),
  );
  const peResults = PLAN_ENTITIES.filter(
    (r) =>
      !q ||
      r.id.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.scope.toLowerCase().includes(q) ||
      r.auditDepartment.toLowerCase().includes(q),
  );

  const auditResults = AUDIT_RECORDS.filter(
    (r) =>
      !q ||
      r.id.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.type.toLowerCase().includes(q) ||
      r.entity.toLowerCase().includes(q) ||
      r.responsible.toLowerCase().includes(q),
  );

  const counts: Record<FilterCategory, number> = {
    general_risk: grResults.length,
    specific_risk: srResults.length,
    audit_entity: aeResults.length,
    plan_entity: peResults.length,
    audit: auditResults.length,
  };

  return (
    <div
      className="flex-1 overflow-auto p-6"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <Breadcrumbs items={["Inicio", "Filtrar"]} />
      <PageHeader
        title="Filtrar Registros"
        subtitle="Busca riesgos, entidades auditoras y entidades de plan por cualquier atributo"
      />

      {/* Search */}
      <div className="relative mb-5 max-w-2xl">
        <Search
          size={15}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por ID, nombre, país, descripción, nivel de riesgo…"
          className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 shadow-sm placeholder:text-muted-foreground"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCategory(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${category === tab.id
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card text-foreground border-border hover:border-primary/40 hover:bg-secondary"
              }`}
          >
            {tab.icon}
            {tab.label}
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${category === tab.id ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"}`}
            >
              {counts[tab.id]}
            </span>
          </button>
        ))}
      </div>

      {/* Results */}
      <Card>
        <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between">
          <div className="text-sm font-semibold text-foreground">
            {FILTER_TABS.find((t) => t.id === category)?.label}
          </div>
          <div className="text-xs text-muted-foreground">
            {counts[category]} resultado
            {counts[category] !== 1 ? "s" : ""}
          </div>
        </div>

        {category === "general_risk" &&
          (grResults.length === 0 ? (
            <EmptyResults />
          ) : (
            <div className="divide-y divide-border">
              {grResults.map((r) => (
                <FilterRow
                  key={r.id}
                  id={r.id}
                  name={r.name}
                  meta={r.auditDepartment}
                  onClick={() => navigate("general_risk", r.id)}
                />
              ))}
            </div>
          ))}
        {category === "specific_risk" &&
          (srResults.length === 0 ? (
            <EmptyResults />
          ) : (
            <div className="divide-y divide-border">
              {srResults.map((r) => (
                <FilterRow
                  key={r.id}
                  id={r.id}
                  name={r.description.slice(0, 80) + "…"}
                  meta={`${r.inherentRiskLevel} → ${r.residualRiskLevel} · ${r.country}`}
                  onClick={() =>
                    navigate("specific_risk", r.id)
                  }
                />
              ))}
            </div>
          ))}
        {category === "audit_entity" &&
          (aeResults.length === 0 ? (
            <EmptyResults />
          ) : (
            <div className="divide-y divide-border">
              {aeResults.map((r) => (
                <FilterRow
                  key={r.id}
                  id={r.id}
                  name={r.name}
                  meta={`${r.auditDomain} · ${r.country}`}
                  onClick={() => navigate("audit_entity", r.id)}
                />
              ))}
            </div>
          ))}
        {category === "plan_entity" &&
          (peResults.length === 0 ? (
            <EmptyResults />
          ) : (
            <div className="divide-y divide-border">
              {peResults.map((r) => (
                <FilterRow
                  key={r.id}
                  id={r.id}
                  name={r.name}
                  meta={`${r.auditDepartment} · ${r.year}`}
                  onClick={() => undefined}
                />
              ))}
            </div>
          ))}
        {category === "audit" &&
          (auditResults.length === 0 ? (
            <EmptyResults />
          ) : (
            <div className="divide-y divide-border">
              {auditResults.map((r) => (
                <AuditFilterCard key={r.id} audit={r} />
              ))}
            </div>
          ))}
      </Card>
    </div>
  );
}

function AuditFilterCard({ audit }: { audit: AuditRecord }) {
  const [expanded, setExpanded] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [auditPdfOpen, setAuditPdfOpen] = useState(false);
  const [xlsxEditorDoc, setXlsxEditorDoc] = useState<AuditDocument | null>(null);

  const DocIcon = ({ type }: { type: string }) => {
    if (type === "xlsx") return <FileSpreadsheet size={14} className="text-emerald-600 flex-shrink-0" />;
    if (type === "docx") return <FileText size={14} className="text-blue-600 flex-shrink-0" />;
    if (type === "pptx") return <Layers size={14} className="text-orange-500 flex-shrink-0" />;
    return <FileText size={14} className="text-red-500 flex-shrink-0" />;
  };

  return (
    <div className="px-4 py-4">
      <div
        className="flex items-center gap-3 cursor-pointer group"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="font-mono text-xs font-bold text-primary bg-primary/8 px-2.5 py-1 rounded-md flex-shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          {audit.id}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">{audit.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{audit.type} · {audit.entity} · {audit.responsible}</div>
        </div>
        <StatusBadge status={audit.status} />
        <span className="text-xs text-muted-foreground flex-shrink-0">{audit.documents.length} docs</span>
        {expanded
          ? <ChevronUp size={14} className="text-muted-foreground flex-shrink-0" />
          : <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />}
      </div>

      {expanded && (
        <div className="mt-4 ml-1 space-y-4">
          {/* Audit metadata grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-secondary/30 rounded-lg text-xs">
            {[
              ["Inicio", audit.startDate],
              ["Fin previsto", audit.endDate],
              ["Responsable", audit.responsible],
              ["Entidad", audit.entity],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">{label}</div>
                <div className="font-medium text-foreground">{value}</div>
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground bg-secondary/20 rounded-md px-3 py-2 border-l-2 border-primary/30">
            <span className="font-semibold text-foreground/70">Alcance: </span>{audit.scope}
          </div>

          {/* Export actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={e => { e.stopPropagation(); setAuditPdfOpen(true); }}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:bg-secondary transition-colors font-medium"
            >
              <FileText size={12} /> Exportar PDF
            </button>
            <button
              onClick={e => { e.stopPropagation(); exportToCSV(`auditoria_${audit.id}.csv`, ["Campo", "Valor"], [["ID", audit.id], ["Nombre", audit.name], ["Tipo", audit.type], ["Entidad", audit.entity], ["Responsable", audit.responsible], ["Inicio", audit.startDate], ["Fin", audit.endDate], ["Estado", audit.status]]); }}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:bg-secondary transition-colors font-medium"
            >
              <Download size={12} /> Exportar CSV
            </button>
          </div>
          {auditPdfOpen && (
            <PDFPreviewModal
              onClose={() => setAuditPdfOpen(false)}
              doc={{
                title: `Informe de Auditoría — ${audit.id}`,
                subtitle: audit.name,
                sections: [
                  {
                    heading: "Información General",
                    rows: [
                      ["ID", audit.id],
                      ["Nombre", audit.name],
                      ["Tipo", audit.type],
                      ["Entidad auditada", audit.entity],
                      ["Responsable", audit.responsible],
                      ["Estado", audit.status],
                    ],
                  },
                  {
                    heading: "Alcance y Vigencia",
                    rows: [
                      ["Fecha de inicio", audit.startDate],
                      ["Fecha prevista de fin", audit.endDate],
                      ["Alcance", audit.scope],
                    ],
                  },
                  {
                    heading: "Documentos Adjuntos",
                    rows: audit.documents.map(d => [d.name, `${d.type.toUpperCase()} · ${d.size} · ${d.date}`]),
                  },
                ],
              }}
            />
          )}

          {/* Documents */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Documentos relacionados</div>
            <div className="space-y-1.5">
              {audit.documents.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5 bg-white border border-border rounded-lg hover:bg-secondary/20 transition-colors">
                  <DocIcon type={doc.type} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">{doc.name}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                      {doc.type.toUpperCase()} · {doc.size} · {doc.date}
                    </div>
                  </div>
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === doc.id ? null : doc.id); }}
                      className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <MoreVertical size={13} />
                    </button>
                    {openMenu === doc.id && (
                      <>
                        <div
                          className="fixed inset-0"
                          style={{ zIndex: 9 }}
                          onClick={e => { e.stopPropagation(); setOpenMenu(null); }}
                        />
                        <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-border rounded-lg shadow-lg overflow-hidden" style={{ zIndex: 10 }}>
                          {doc.type === "xlsx" ? (
                            <button
                              onClick={e => { e.stopPropagation(); setXlsxEditorDoc(doc); setOpenMenu(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-emerald-700 hover:bg-emerald-50 transition-colors font-semibold"
                            >
                              <FileSpreadsheet size={12} /> Editar en Expedite
                            </button>
                          ) : (
                            <button
                              onClick={e => { e.stopPropagation(); setOpenMenu(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-secondary transition-colors"
                            >
                              <Pencil size={12} className="text-primary" /> Editar
                            </button>
                          )}
                          <button
                            onClick={e => { e.stopPropagation(); setOpenMenu(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={12} /> Eliminar
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {xlsxEditorDoc && (
        <SpreadsheetEditor
          filename={xlsxEditorDoc.name}
          fileVersion={3}
          entityId={audit.id}
          onClose={() => setXlsxEditorDoc(null)}
          onHashUpdate={() => { setXlsxEditorDoc(null); }}
        />
      )}
    </div>
  );
}

function FilterRow({
  id,
  name,
  meta,
  onClick,
}: {
  id: string;
  name: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 px-4 py-3.5 hover:bg-secondary/40 cursor-pointer group transition-colors"
    >
      <span className="font-mono text-xs font-bold text-primary bg-primary/8 px-2.5 py-1 rounded-md flex-shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
        {id}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
          {name}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {meta}
        </div>
      </div>
      <ArrowRight
        size={14}
        className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
      />
    </div>
  );
}

function EmptyResults() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <Search
        size={28}
        className="text-muted-foreground/30 mb-3"
      />
      <div className="text-sm font-semibold text-muted-foreground">
        Sin resultados
      </div>
      <div className="text-xs text-muted-foreground/60 mt-1">
        Intenta con otro término o limpia la búsqueda
      </div>
    </div>
  );
}


// ─── GENERAL RISK DETAIL ──────────────────────────────────────────────────────
function GeneralRiskDetailView({
  id,
  navigate,
  crumbs,
}: {
  id: string;
  navigate: Navigate;
  crumbs: React.ReactNode;
}) {
  const gr = GENERAL_RISKS.find((r) => r.id === id)!;
  const registers = SPECIFIC_RISKS.filter(
    (sr) => sr.generalRiskId === id,
  );
  const [srSearch, setSrSearch] = useState("");
  const q = srSearch.toLowerCase();
  const filteredRegs = registers.filter(
    (r) =>
      !q ||
      r.id.toLowerCase().includes(q) ||
      r.auditEntityId.toLowerCase().includes(q) ||
      r.country.toLowerCase().includes(q) ||
      r.businessName.toLowerCase().includes(q),
  );

  const ae = (aeId: string) =>
    AUDIT_ENTITIES.find((a) => a.id === aeId);

  return (
    <div
      className="flex-1 overflow-auto p-6"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {crumbs}
      {/* Header */}
      <Card className="mb-5 p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
            <Shield size={18} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-primary bg-primary/8 px-2.5 py-1 rounded-md">
                {gr.id}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground bg-muted px-2 py-0.5 rounded">
                Riesgo General
              </span>
            </div>
            <h1 className="text-xl font-bold text-foreground leading-tight mb-1">
              {gr.name}
            </h1>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 pt-3 border-t border-border">
          <DetailField label="ID" value={gr.id} />
          <DetailField
            label="Departamento Auditor"
            value={gr.auditDepartment}
          />
          <DetailField
            label="Registros de Riesgo"
            value={`${registers.length} específico${registers.length !== 1 ? "s" : ""}`}
          />
        </div>
        <div className="mt-4 pt-3 border-t border-border">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
            Descripción
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            {gr.description}
          </p>
        </div>
      </Card>

      {/* Risk Registers table */}
      <Card>
        <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert size={15} className="text-primary" />
            <div className="text-sm font-semibold text-foreground">
              Registros de Riesgo (Riesgos Específicos)
            </div>
            <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-semibold">
              {filteredRegs.length}
            </span>
          </div>
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={srSearch}
              onChange={(e) => setSrSearch(e.target.value)}
              placeholder="Buscar…"
              className="text-xs bg-input-background border border-border rounded-md pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30 w-48 placeholder:text-muted-foreground"
            />
          </div>
        </div>
        {filteredRegs.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Sin registros de riesgo específico para este riesgo
            general
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {[
                    "ID Riesgo Específico",
                    "Nivel Inherente",
                    "Nivel Residual",
                    "Entidad Auditora",
                    "Depto. Negocio",
                    "Negocio",
                    "División",
                    "País de Origen",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRegs.map((sr) => (
                  <tr
                    key={sr.id}
                    className="hover:bg-secondary/30 cursor-pointer group transition-colors"
                    onClick={() =>
                      navigate("specific_risk", sr.id)
                    }
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-bold text-primary group-hover:underline">
                        {sr.id}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <RiskLevelBadge
                        level={sr.inherentRiskLevel}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <RiskLevelBadge
                        level={sr.residualRiskLevel}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {ae(sr.auditEntityId)?.id} —{" "}
                      {ae(sr.auditEntityId)
                        ?.name.split("—")[1]
                        ?.trim()}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {sr.businessDeptName}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {sr.businessName}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {sr.divisionName}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {sr.country}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <AISummaryCard entityId={gr.id} entityType="Riesgo General" />
    </div>
  );
}

// ─── SPECIFIC RISK DETAIL ─────────────────────────────────────────────────────
function SpecificRiskDetailView({
  id,
  navigate,
  crumbs,
}: {
  id: string;
  navigate: Navigate;
  crumbs: React.ReactNode;
}) {
  const sr = SPECIFIC_RISKS.find((r) => r.id === id)!;
  const ae = AUDIT_ENTITIES.find(
    (a) => a.id === sr.auditEntityId,
  );
  const gr = GENERAL_RISKS.find(
    (g) => g.id === sr.generalRiskId,
  );
  const controls = CONTROLS.filter((c) =>
    c.specificRiskIds.includes(id),
  );

  return (
    <div
      className="flex-1 overflow-auto p-6"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {crumbs}
      {/* Header */}
      <Card className="mb-5 p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
            <ShieldAlert size={18} className="text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-xs font-bold text-primary bg-primary/8 px-2.5 py-1 rounded-md">
                {sr.id}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground bg-muted px-2 py-0.5 rounded">
                Riesgo Específico
              </span>
              {gr && (
                <span className="text-xs text-muted-foreground">
                  ←{" "}
                  <span className="font-semibold text-foreground">
                    {gr.id}
                  </span>{" "}
                  {gr.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <RiskLevelBadge level={sr.inherentRiskLevel} />
              <ArrowRight
                size={12}
                className="text-muted-foreground"
              />
              <RiskLevelBadge level={sr.residualRiskLevel} />
              <span className="text-xs text-muted-foreground ml-1">
                Inherente → Residual
              </span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 pt-3 border-t border-border mb-3">
          <DetailField
            label="ID Riesgo Específico"
            value={sr.id}
          />
          <DetailField
            label="Nivel de Riesgo Inherente"
            value={sr.inherentRiskLevel}
          />
          <DetailField
            label="Nivel de Riesgo Residual"
            value={sr.residualRiskLevel}
          />
          <DetailField
            label="Entidad Auditora"
            value={`${ae?.id} — ${ae?.name.split("—")[1]?.trim() ?? ""}`}
          />
          <DetailField
            label="Depto. de Negocio"
            value={sr.businessDeptName}
          />
          <DetailField
            label="Negocio"
            value={sr.businessName}
          />
          <DetailField
            label="División"
            value={sr.divisionName}
          />
          <DetailField
            label="País de Origen"
            value={sr.country}
          />
        </div>
        <div className="pt-3 border-t border-border">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
            Descripción Detallada
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            {sr.description}
          </p>
        </div>
      </Card>

      {/* Controls table */}
      <Card>
        <div className="px-4 pt-4 pb-3 border-b border-border flex items-center gap-2">
          <ClipboardCheck size={15} className="text-primary" />
          <div className="text-sm font-semibold text-foreground">
            Procedimientos de Control
          </div>
          <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-semibold">
            {controls.length}
          </span>
        </div>
        {controls.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Sin procedimientos de control asociados
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {[
                    "ID Control",
                    "Validez del Control",
                    "N° Control Negocio",
                    "Actividad de Control",
                    "Vulnerabilidad Actual",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {controls.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-secondary/30 cursor-pointer group transition-colors"
                    onClick={() => navigate("control", c.id)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-bold text-primary group-hover:underline">
                        {c.id}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ValidityBadge
                        status={c.validityStatus}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {c.businessControlNumber}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs">
                      {c.controlActivity}
                    </td>
                    <td className="px-4 py-3">
                      <RiskLevelBadge
                        level={c.currentVulnerability}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <AISummaryCard entityId={sr.id} entityType="Riesgo Específico" />
    </div>
  );
}

// ─── AUDIT ENTITY DETAIL ──────────────────────────────────────────────────────
function AuditEntityDetailView({
  id,
  navigate,
  crumbs,
}: {
  id: string;
  navigate: Navigate;
  crumbs: React.ReactNode;
}) {
  const ae = AUDIT_ENTITIES.find((a) => a.id === id)!;
  const linkedSRs = SPECIFIC_RISKS.filter(
    (sr) => sr.auditEntityId === id,
  );
  const linkedGRIds = [
    ...new Set(linkedSRs.map((sr) => sr.generalRiskId)),
  ];
  const linkedGRs = GENERAL_RISKS.filter((gr) =>
    linkedGRIds.includes(gr.id),
  );
  const linkedControls = CONTROLS.filter(
    (c) => c.auditEntityId === id,
  );

  return (
    <div
      className="flex-1 overflow-auto p-6"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {crumbs}
      {/* Header */}
      <Card className="mb-5 p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 bg-violet-100 rounded-lg flex-shrink-0">
            <Building2 size={18} className="text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-primary bg-primary/8 px-2.5 py-1 rounded-md">
                {ae.id}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground bg-muted px-2 py-0.5 rounded">
                Entidad Auditora
              </span>
            </div>
            <h1 className="text-xl font-bold text-foreground leading-tight">
              {ae.name}
            </h1>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 pt-3 border-t border-border">
          <DetailField label="ID Auditoría" value={ae.id} />
          <DetailField
            label="Departamento Auditor"
            value={ae.auditDepartment}
          />
          <DetailField
            label="Dominio de Auditoría"
            value={ae.auditDomain}
          />
          <DetailField
            label="División"
            value={ae.divisionName}
          />
          <DetailField
            label="País de Origen"
            value={ae.country}
          />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        {/* General Risks */}
        <Card>
          <div className="px-4 pt-4 pb-3 border-b border-border flex items-center gap-2">
            <Shield size={14} className="text-primary" />
            <div className="text-sm font-semibold text-foreground">
              Riesgos Generales Asociados
            </div>
            <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-semibold">
              {linkedGRs.length}
            </span>
          </div>
          <div className="divide-y divide-border">
            {linkedGRs.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Sin riesgos generales
              </div>
            ) : (
              linkedGRs.map((gr) => (
                <div
                  key={gr.id}
                  onClick={() =>
                    navigate("general_risk", gr.id)
                  }
                  className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 cursor-pointer group transition-colors"
                >
                  <span className="font-mono text-xs font-bold text-primary group-hover:underline flex-shrink-0">
                    {gr.id}
                  </span>
                  <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors text-left flex-1">
                    {gr.name}
                  </span>
                  <ArrowRight
                    size={13}
                    className="text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0"
                  />
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Controls */}
        <Card>
          <div className="px-4 pt-4 pb-3 border-b border-border flex items-center gap-2">
            <ClipboardCheck
              size={14}
              className="text-primary"
            />
            <div className="text-sm font-semibold text-foreground">
              Procedimientos de Control
            </div>
            <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-semibold">
              {linkedControls.length}
            </span>
          </div>
          <div className="divide-y divide-border">
            {linkedControls.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Sin controles
              </div>
            ) : (
              linkedControls.map((c) => (
                <div
                  key={c.id}
                  onClick={() => navigate("control", c.id)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 cursor-pointer group transition-colors"
                >
                  <span className="font-mono text-xs font-bold text-primary group-hover:underline flex-shrink-0">
                    {c.id}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                      {c.controlProcedureName}
                    </div>
                    <ValidityBadge status={c.validityStatus} />
                  </div>
                  <ArrowRight
                    size={13}
                    className="text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0"
                  />
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
      <AISummaryCard entityId={ae.id} entityType="Entidad Auditora" />
    </div>
  );
}

// ─── CONTROL DETAIL ───────────────────────────────────────────────────────────
function ControlDetailView({
  id,
  crumbs,
}: {
  id: string;
  crumbs: React.ReactNode;
}) {
  const ctrl = CONTROLS.find((c) => c.id === id)!;
  const ae = AUDIT_ENTITIES.find(
    (a) => a.id === ctrl.auditEntityId,
  )!;
  const procedures = PROCEDURE_TRACKING.filter(
    (p) => p.controlId === id,
  );

  return (
    <div
      className="flex-1 overflow-auto p-6"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {crumbs}
      {/* Header */}
      <Card className="mb-5 p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 bg-emerald-100 rounded-lg flex-shrink-0">
            <ClipboardCheck
              size={18}
              className="text-emerald-600"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-primary bg-primary/8 px-2.5 py-1 rounded-md">
                {ctrl.id}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground bg-muted px-2 py-0.5 rounded">
                Procedimiento de Control
              </span>
              <ValidityBadge status={ctrl.validityStatus} />
            </div>
            <h1 className="text-xl font-bold text-foreground leading-tight">
              {ctrl.controlProcedureName}
            </h1>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 pt-3 border-t border-border mb-4">
          <DetailField label="ID Control" value={ctrl.id} />
          <DetailField
            label="Entidad Auditora"
            value={ae.name}
          />
          <DetailField
            label="ID Entidad Auditora"
            value={ae.id}
          />
        </div>
        <div className="pt-3 border-t border-border">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
            Actividad de Control
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            {ctrl.controlActivity}
          </p>
        </div>
      </Card>

      {/* Transversal Control Procedures */}
      <Card className="mb-5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="text-sm font-bold text-foreground">
            Procedimientos de Control Transversal
          </div>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
            {ctrl.controlType}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-4">
          {[
            {
              label: "Tipo de Control",
              value: ctrl.controlType,
            },
            {
              label: "Frecuencia de Operación",
              value: ctrl.frequency,
            },
            {
              label: "Tamaño de Muestra",
              value: ctrl.sampleSize,
            },
            { label: "Rotación", value: ctrl.rotation },
            { label: "Estatus", value: ctrl.controlStatus },
          ].map((f) => (
            <div
              key={f.label}
              className="bg-muted/40 rounded-lg p-3"
            >
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                {f.label}
              </div>
              <div className="text-sm font-bold text-foreground">
                {f.value}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Procedure Tracking Table */}
      <Card>
        <div className="px-4 pt-4 pb-3 border-b border-border flex items-center gap-2">
          <ClipboardList size={15} className="text-primary" />
          <div className="text-sm font-semibold text-foreground">
            Seguimiento de Procedimientos
          </div>
          <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-semibold">
            {procedures.length}
          </span>
        </div>
        {procedures.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Sin procedimientos de seguimiento registrados
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {[
                    "ID Seguimiento",
                    "Nombre Procedimiento",
                    "Identificador",
                    "Depto. Negocio",
                    "Negocio",
                    "División",
                    "Área",
                    "País",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {procedures.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-secondary/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-bold text-primary">
                      {p.id}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-foreground">
                      {p.procedureName}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {p.identificator}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {p.businessDeptName}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {p.businessName}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {p.divisionName}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {p.area}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {p.country}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <EvidenciasSection 
        entityId={ctrl.id} 
        entityType="control"
        controlId={ctrl.id}
        businessEntityId={ctrl.auditEntityId} 
      />
      <AISummaryCard entityId={ctrl.id} entityType="Control" />
    </div>
  );
}

// ─── View 3: DASHBOARD EDITOR ────────────────────────────────────────────────
const WIDGET_CATALOG = [
  {
    id: "kpi",
    label: "Tarjeta KPI",
    icon: <TrendingUp size={22} />,
    desc: "Métrica con delta y tendencia",
    color: "bg-blue-50 text-blue-600",
  },
  {
    id: "bar",
    label: "Gráfica de Barras",
    icon: <BarChart3 size={22} />,
    desc: "Comparativa por categoría o periodo",
    color: "bg-violet-50 text-violet-600",
  },
  {
    id: "table",
    label: "Tabla de Tareas",
    icon: <ListTodo size={22} />,
    desc: "Lista filtrable con estatus visual",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    id: "horas",
    label: "Log de Horas",
    icon: <Timer size={22} />,
    desc: "Entrada rápida de horas trabajadas",
    color: "bg-amber-50 text-amber-600",
  },
  {
    id: "links",
    label: "Accesos Rápidos",
    icon: <ArrowRight size={22} />,
    desc: "Links priorizados a registros clave",
    color: "bg-rose-50 text-rose-600",
  },
  {
    id: "pie",
    label: "Gráfica Circular",
    icon: <PieChart size={22} />,
    desc: "Distribución por estado o categoría",
    color: "bg-cyan-50 text-cyan-600",
  },
];

type PlacedWidget = {
  id: string;
  widgetId: string;
  label: string;
  col: number;
  row: number;
  w: number;
  h: number;
};

function EditorView() {
  const [placed, setPlaced] = useState<PlacedWidget[]>([
    {
      id: "p1",
      widgetId: "kpi",
      label: "Tarjeta KPI",
      col: 1,
      row: 1,
      w: 2,
      h: 1,
    },
    {
      id: "p2",
      widgetId: "bar",
      label: "Gráfica de Barras",
      col: 3,
      row: 1,
      w: 4,
      h: 2,
    },
    {
      id: "p3",
      widgetId: "table",
      label: "Tabla de Tareas",
      col: 1,
      row: 2,
      w: 4,
      h: 2,
    },
  ]);
  const [selected, setSelected] = useState<PlacedWidget | null>(
    null,
  );
  const [history, setHistory] = useState<PlacedWidget[][]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const push = (next: PlacedWidget[]) => {
    setHistory((h) => [...h.slice(-20), placed]);
    setPlaced(next);
  };

  const undo = () => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setPlaced(prev);
    setSelected(null);
  };

  const addWidget = (wid: (typeof WIDGET_CATALOG)[0]) => {
    const next: PlacedWidget = {
      id: `p${Date.now()}`,
      widgetId: wid.id,
      label: wid.label,
      col: 1,
      row: placed.length + 1,
      w: 3,
      h: 1,
    };
    push([...placed, next]);
    setSelected(next);
  };

  const removeSelected = () => {
    if (!selected) return;
    push(placed.filter((p) => p.id !== selected.id));
    setSelected(null);
  };

  const updateProp = (
    field: keyof PlacedWidget,
    val: number,
  ) => {
    if (!selected) return;
    const updated = placed.map((p) =>
      p.id === selected.id ? { ...p, [field]: val } : p,
    );
    push(updated);
    setSelected((s) => (s ? { ...s, [field]: val } : s));
  };

  const saveLayout = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Editor toolbar */}
      <div className="h-11 bg-card border-b border-border flex items-center px-4 gap-3 flex-shrink-0">
        <Breadcrumbs
          items={["Dashboard", "Editor de Vistas"]}
        />
        <div className="flex-1" />
        <button
          onClick={undo}
          disabled={!history.length}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-30"
        >
          <Undo2 size={13} />
          Deshacer
        </button>
        <button
          onClick={saveLayout}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-semibold transition-all ${saved ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
        >
          {saved ? (
            <>
              <Check size={13} />
              Guardado
            </>
          ) : (
            <>
              <Save size={13} />
              Guardar Vista
            </>
          )}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Widget catalog */}
        <div className="w-56 bg-card border-r border-border flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <div className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Catálogo de Widgets
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Haz clic para añadir al canvas
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {WIDGET_CATALOG.map((wid) => (
              <button
                key={wid.id}
                onClick={() => addWidget(wid)}
                className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-secondary/50 transition-all group"
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${wid.color}`}
                >
                  {wid.icon}
                </div>
                <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                  {wid.label}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                  {wid.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 overflow-auto p-5 bg-muted/40">
          <div className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
            <Maximize2 size={11} />
            Canvas — 12 columnas · Snap a cuadrícula
          </div>
          <div
            className="relative bg-card rounded-xl border-2 border-dashed border-border min-h-96 overflow-hidden"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          >
            {placed.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                <Layers
                  size={32}
                  className="text-muted-foreground/40 mb-3"
                />
                <div className="text-sm font-semibold text-muted-foreground">
                  Canvas vacío
                </div>
                <div className="text-xs text-muted-foreground/60 mt-1">
                  Selecciona widgets del panel izquierdo para
                  añadirlos
                </div>
              </div>
            )}
            <div className="p-4 grid grid-cols-6 gap-3 auto-rows-min">
              {placed.map((pw) => {
                const wdef = WIDGET_CATALOG.find(
                  (w) => w.id === pw.widgetId,
                );
                const isSelected = selected?.id === pw.id;
                return (
                  <div
                    key={pw.id}
                    onClick={() =>
                      setSelected(isSelected ? null : pw)
                    }
                    draggable
                    onDragStart={() => setDragging(pw.id)}
                    onDragEnd={() => setDragging(null)}
                    style={{
                      gridColumn: `span ${Math.min(pw.w, 6)}`,
                      gridRow: `span ${pw.h}`,
                    }}
                    className={`relative rounded-lg border-2 p-3 cursor-pointer transition-all min-h-20 flex flex-col ${isSelected
                      ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                      : dragging === pw.id
                        ? "border-accent/60 bg-accent/5 opacity-70"
                        : "border-border bg-white hover:border-primary/30 hover:shadow-sm"
                      }`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <GripVertical
                        size={13}
                        className="text-muted-foreground/40 mt-0.5 flex-shrink-0"
                      />
                      <div
                        className={`p-1.5 rounded ${wdef?.color ?? ""}`}
                      >
                        {wdef?.icon && (
                          <div className="scale-75">
                            {wdef.icon}
                          </div>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-foreground flex-1">
                        {pw.label}
                      </div>
                      {isSelected && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSelected();
                          }}
                          className="text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                    <div className="flex-1 rounded bg-muted/40 flex items-center justify-center">
                      <span className="text-[10px] text-muted-foreground/50">
                        Vista previa
                      </span>
                    </div>
                    {isSelected && (
                      <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-primary rounded-full ring-2 ring-white" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Properties */}
        <div className="w-56 bg-card border-l border-border flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <div className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Propiedades
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {selected
                ? selected.label
                : "Selecciona un widget"}
            </div>
          </div>
          {selected ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Content */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                  <AlignLeft size={10} />
                  Contenido
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Etiqueta
                    </label>
                    <input
                      defaultValue={selected.label}
                      className="w-full text-xs bg-input-background border border-border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Fuente de datos
                    </label>
                    <select className="w-full text-xs bg-input-background border border-border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30">
                      <option>Auditorías activas</option>
                      <option>Hallazgos abiertos</option>
                      <option>Horas registradas</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Style */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Palette size={10} />
                  Estilo
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Color de acento
                    </label>
                    <div className="flex gap-1.5">
                      {[
                        "#1A4FA0",
                        "#16a34a",
                        "#d97706",
                        "#C8271C",
                        "#7C3AED",
                      ].map((c) => (
                        <button
                          key={c}
                          className="w-5 h-5 rounded-full border-2 border-white ring-1 ring-border hover:ring-primary transition-all"
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Size */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Maximize2 size={10} />
                  Tamaño
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Ancho (columnas)
                    </label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <button
                          key={n}
                          onClick={() => updateProp("w", n)}
                          className={`flex-1 py-1 text-[10px] rounded font-medium transition-colors ${selected.w === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"}`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Alto (filas)
                    </label>
                    <div className="flex gap-1">
                      {[1, 2, 3].map((n) => (
                        <button
                          key={n}
                          onClick={() => updateProp("h", n)}
                          className={`flex-1 py-1 text-[10px] rounded font-medium transition-colors ${selected.h === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"}`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <Layers
                size={28}
                className="text-muted-foreground/30 mb-3"
              />
              <div className="text-xs text-muted-foreground">
                Haz clic en un widget del canvas para editar sus
                propiedades
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── View 4: HIERARCHY / CATALOG (drill-down) ───────────────────────────────
type TreeNode = {
  id: string;
  label: string;
  type: string;
  children?: TreeNode[];
  risks?: number;
  hasCritical?: boolean;
};

const TREE: TreeNode[] = [
  {
    id: "n1",
    label: "Servicios Financieros",
    type: "Negocio",
    risks: 14,
    hasCritical: true,
    children: [
      {
        id: "n1-1",
        label: "Banca Corporativa",
        type: "Unidad de Negocio",
        risks: 8,
        hasCritical: true,
        children: [
          {
            id: "n1-1-1",
            label: "División Crédito Empresarial",
            type: "División",
            risks: 5,
            hasCritical: true,
            children: [
              {
                id: "n1-1-1-1",
                label: "Área de Riesgo Crediticio",
                type: "Área",
                risks: 3,
                hasCritical: true,
                children: [
                  {
                    id: "n1-1-1-1-1",
                    label: "México",
                    type: "País",
                    risks: 2,
                    hasCritical: true,
                  },
                  {
                    id: "n1-1-1-1-2",
                    label: "Colombia",
                    type: "País",
                    risks: 1,
                    hasCritical: false,
                  },
                ],
              },
              {
                id: "n1-1-1-2",
                label: "Área de Tesorería",
                type: "Área",
                risks: 0,
                hasCritical: false,
              },
            ],
          },
        ],
      },
      {
        id: "n1-2",
        label: "Banca Personas",
        type: "Unidad de Negocio",
        risks: 6,
        hasCritical: false,
        children: [
          {
            id: "n1-2-1",
            label: "División Productos Digitales",
            type: "División",
            risks: 4,
            hasCritical: false,
            children: [
              {
                id: "n1-2-1-1",
                label: "Área de Pagos",
                type: "Área",
                risks: 2,
                hasCritical: false,
                children: [
                  {
                    id: "n1-2-1-1-1",
                    label: "Brasil",
                    type: "País",
                    risks: 2,
                    hasCritical: false,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "n2",
    label: "Tecnología & Operaciones",
    type: "Negocio",
    risks: 11,
    hasCritical: false,
    children: [
      {
        id: "n2-1",
        label: "Infraestructura TI",
        type: "Unidad de Negocio",
        risks: 6,
        hasCritical: false,
        children: [
          {
            id: "n2-1-1",
            label: "División Ciberseguridad",
            type: "División",
            risks: 4,
            hasCritical: false,
            children: [
              {
                id: "n2-1-1-1",
                label: "Área de SOC",
                type: "Área",
                risks: 3,
                hasCritical: false,
                children: [
                  {
                    id: "n2-1-1-1-1",
                    label: "Argentina",
                    type: "País",
                    risks: 3,
                    hasCritical: false,
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "n2-2",
        label: "Operaciones LATAM",
        type: "Unidad de Negocio",
        risks: 5,
        hasCritical: false,
        children: [
          {
            id: "n2-2-1",
            label: "División Procesos",
            type: "División",
            risks: 5,
            hasCritical: false,
            children: [
              {
                id: "n2-2-1-1",
                label: "Área de Back-Office",
                type: "Área",
                risks: 2,
                hasCritical: false,
                children: [
                  {
                    id: "n2-2-1-1-1",
                    label: "Chile",
                    type: "País",
                    risks: 2,
                    hasCritical: false,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "n3",
    label: "Cumplimiento & Legal",
    type: "Negocio",
    risks: 7,
    hasCritical: false,
    children: [
      {
        id: "n3-1",
        label: "Regulatorio LATAM",
        type: "Unidad de Negocio",
        risks: 7,
        hasCritical: false,
        children: [
          {
            id: "n3-1-1",
            label: "División Normativa",
            type: "División",
            risks: 7,
            hasCritical: false,
            children: [
              {
                id: "n3-1-1-1",
                label: "Área de Compliance",
                type: "Área",
                risks: 4,
                hasCritical: false,
                children: [
                  {
                    id: "n3-1-1-1-1",
                    label: "Perú",
                    type: "País",
                    risks: 2,
                    hasCritical: false,
                  },
                  {
                    id: "n3-1-1-1-2",
                    label: "Uruguay",
                    type: "País",
                    risks: 2,
                    hasCritical: false,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

const RISK_TABLE_ALL = [
  {
    id: "RIE-0187",
    name: "Error Material — Cierre Financiero",
    nivel: "Crítico",
    status: "in_progress" as StatusKey,
    area: "Banca Corporativa",
    pais: "México",
  },
  {
    id: "RIE-0188",
    name: "Acceso no autorizado a datos sensibles",
    nivel: "Alto",
    status: "overdue" as StatusKey,
    area: "Infraestructura TI",
    pais: "Brasil",
  },
  {
    id: "RIE-0190",
    name: "Concentración de contraparte — Crédito",
    nivel: "Medio",
    status: "pending" as StatusKey,
    area: "Banca Corporativa",
    pais: "Colombia",
  },
  {
    id: "RIE-0192",
    name: "Incumplimiento GDPR en app móvil",
    nivel: "Alto",
    status: "in_progress" as StatusKey,
    area: "Productos Digitales",
    pais: "Brasil",
  },
  {
    id: "RIE-0193",
    name: "Falta de segregación — Tesorería",
    nivel: "Medio",
    status: "pending" as StatusKey,
    area: "Banca Corporativa",
    pais: "México",
  },
  {
    id: "RIE-0194",
    name: "Brecha de política BYOD — SOC",
    nivel: "Bajo",
    status: "completed" as StatusKey,
    area: "Infraestructura TI",
    pais: "Argentina",
  },
  {
    id: "RIE-0195",
    name: "Incumplimiento normativa local — SUNAT",
    nivel: "Alto",
    status: "in_progress" as StatusKey,
    area: "Regulatorio LATAM",
    pais: "Perú",
  },
  {
    id: "RIE-0196",
    name: "Control KYC desactualizado",
    nivel: "Medio",
    status: "pending" as StatusKey,
    area: "Cumplimiento & Legal",
    pais: "Uruguay",
  },
  {
    id: "RIE-0197",
    name: "Retrasos en reconciliación — Back-Office",
    nivel: "Bajo",
    status: "in_progress" as StatusKey,
    area: "Operaciones LATAM",
    pais: "Chile",
  },
  {
    id: "RIE-0198",
    name: "Configuración firewall — Colombia",
    nivel: "Alto",
    status: "overdue" as StatusKey,
    area: "Infraestructura TI",
    pais: "Colombia",
  },
];

// Flatten tree to all nodes with their ancestor paths (for search)
function flattenTree(
  nodes: TreeNode[],
  ancestors: TreeNode[] = [],
): { node: TreeNode; path: TreeNode[] }[] {
  return nodes.flatMap((n) => [
    { node: n, path: ancestors },
    ...flattenTree(n.children ?? [], [...ancestors, n]),
  ]);
}

const ALL_NODES = flattenTree(TREE);

// Collect all labels under a subtree (for risk table filtering)
function collectLabels(node: TreeNode): string[] {
  return [
    node.label,
    ...(node.children ?? []).flatMap(collectLabels),
  ];
}

function riskColor(node: TreeNode): {
  stripe: string;
  badge: string;
  dot: string;
  label: string;
} {
  if (node.hasCritical || (node.risks ?? 0) >= 6)
    return {
      stripe: "bg-red-500",
      badge: "bg-red-50 text-red-700 border border-red-200",
      dot: "bg-red-500",
      label: "Crítico",
    };
  if ((node.risks ?? 0) >= 3)
    return {
      stripe: "bg-amber-400",
      badge:
        "bg-amber-50 text-amber-700 border border-amber-200",
      dot: "bg-amber-400",
      label: "Alto",
    };
  if ((node.risks ?? 0) >= 1)
    return {
      stripe: "bg-emerald-500",
      badge:
        "bg-emerald-50 text-emerald-700 border border-emerald-200",
      dot: "bg-emerald-500",
      label: "Normal",
    };
  return {
    stripe: "bg-slate-300",
    badge: "bg-slate-50 text-slate-500 border border-slate-200",
    dot: "bg-slate-300",
    label: "Sin riesgos",
  };
}

const NIVEL_COLOR: Record<string, string> = {
  Crítico: "text-red-700 bg-red-50 border border-red-200",
  Alto: "text-orange-700 bg-orange-50 border border-orange-200",
  Medio: "text-amber-700 bg-amber-50 border border-amber-200",
  Bajo: "text-emerald-700 bg-emerald-50 border border-emerald-200",
};

const TYPE_COLORS: Record<string, string> = {
  Negocio: "bg-blue-100 text-blue-700",
  "Unidad de Negocio": "bg-violet-100 text-violet-700",
  División: "bg-emerald-100 text-emerald-700",
  Área: "bg-amber-100 text-amber-700",
  País: "bg-slate-100 text-slate-600",
};

// Tree view helper (for the toggle mode)
function TreeRow({
  node,
  depth,
  expanded,
  onToggle,
  onJump,
  completedIds,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onJump: (path: TreeNode[]) => void;
  completedIds: Set<string>;
}) {
  const isOpen = expanded.has(node.id);
  const hasChildren = !!node.children?.length;
  const col = riskColor(node);
  const nodeAllLabels = collectLabels(node);
  const nodeRisksForTree = RISK_TABLE_ALL.filter(r =>
    nodeAllLabels.some(l => r.pais === l || r.area.includes(l))
  );
  const completedCountTree = nodeRisksForTree.filter(r => completedIds.has(r.id)).length;
  const allCompletedTree = nodeRisksForTree.length > 0 && completedCountTree === nodeRisksForTree.length;
  const partialCompletedTree = completedCountTree > 0 && !allCompletedTree;

  return (
    <>
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-secondary/50 cursor-pointer group"
        style={{ paddingLeft: `${8 + depth * 18}px` }}
        onClick={() =>
          hasChildren ? onToggle(node.id) : undefined
        }
      >
        <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
          {hasChildren ? (
            isOpen ? (
              <ChevronDown
                size={13}
                className="text-muted-foreground"
              />
            ) : (
              <ChevronRight
                size={13}
                className="text-muted-foreground"
              />
            )
          ) : (
            <Circle
              size={4}
              className="text-muted-foreground/50"
            />
          )}
        </div>
        <span
          className={`text-[9px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${TYPE_COLORS[node.type] ?? "bg-gray-100 text-gray-600"}`}
        >
          {node.type}
        </span>
        <span className="text-sm font-medium text-foreground flex-1 group-hover:text-primary transition-colors">
          {node.label}
        </span>
        {allCompletedTree && (
          <div title="Todos los riesgos completados" className="flex-shrink-0 flex items-center">
            <CheckCircle2 size={13} className="text-emerald-500" />
          </div>
        )}
        {partialCompletedTree && (
          <div
            className="w-3.5 h-3.5 rounded-full border-2 border-emerald-400 bg-emerald-100 flex-shrink-0"
            title={`${completedCountTree} de ${nodeRisksForTree.length} realizados`}
          />
        )}
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${col.dot}`}
        />
        {node.risks !== undefined && node.risks > 0 && (
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded font-mono ${col.badge}`}
          >
            {node.risks}
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onJump([]);
          }}
          className="opacity-0 group-hover:opacity-100 text-[10px] text-accent font-medium hover:underline transition-opacity ml-1"
        >
          Ir →
        </button>
      </div>
      {isOpen &&
        node.children?.map((c) => (
          <TreeRow
            key={c.id}
            node={c}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
            onJump={onJump}
            completedIds={completedIds}
          />
        ))}
    </>
  );
}

function HierarchyView() {
  // Drill-down path: array of ancestors navigated into
  const [path, setPath] = useState<TreeNode[]>([]);
  const [viewMode, setViewMode] = useState<"cards" | "tree">(
    "cards",
  );
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [nivelFilter, setNivelFilter] = useState<string>("all");
  const [treeExpanded, setTreeExpanded] = useState<Set<string>>(
    new Set(["n1", "n2", "n3"]),
  );
  const [completedIds, setCompletedIds] = useState<Set<string>>(
    () => new Set(RISK_TABLE_ALL.filter(r => r.status === "completed").map(r => r.id))
  );
  const [showOnlyCompleted, setShowOnlyCompleted] = useState(false);

  const toggleComplete = (riskId: string) => {
    const wasCompleted = completedIds.has(riskId);
    const prevIds = new Set(completedIds);
    setCompletedIds(prev => {
      const next = new Set(prev);
      wasCompleted ? next.delete(riskId) : next.add(riskId);
      return next;
    });
    if (!wasCompleted) {
      const risk = RISK_TABLE_ALL.find(r => r.id === riskId);
      toast.success("Riesgo marcado como realizado", {
        description: risk?.name,
        action: { label: "Deshacer", onClick: () => setCompletedIds(prevIds) },
        duration: 4500,
      });
    }
  };

  const getNodeCompletion = (node: TreeNode) => {
    const labels = collectLabels(node);
    const risks = RISK_TABLE_ALL.filter(r => labels.some(l => r.pais === l || r.area.includes(l)));
    const completed = risks.filter(r => completedIds.has(r.id)).length;
    return { total: risks.length, completed };
  };

  // Current children to display as cards
  const currentNode =
    path.length > 0 ? path[path.length - 1] : null;
  const currentChildren: TreeNode[] = currentNode
    ? (currentNode.children ?? [])
    : TREE;
  const isLeaf = currentChildren.length === 0;

  // Navigate into a node
  const drillInto = (node: TreeNode) => {
    setPath([...path, node]);
    setNivelFilter("all");
    setSearch("");
    setSearchFocused(false);
  };

  // Jump to a specific breadcrumb level
  const jumpToLevel = (index: number) => {
    setPath(path.slice(0, index + 1));
    setNivelFilter("all");
  };

  // Jump to root
  const goRoot = () => {
    setPath([]);
    setNivelFilter("all");
  };

  // Search autocomplete results
  const searchResults =
    search.trim().length >= 1
      ? ALL_NODES.filter(({ node }) =>
        node.label
          .toLowerCase()
          .includes(search.toLowerCase()),
      ).slice(0, 7)
      : [];

  // Jump directly to any search result
  const jumpToNode = (entry: {
    node: TreeNode;
    path: TreeNode[];
  }) => {
    setPath([...entry.path, entry.node]);
    setSearch("");
    setSearchFocused(false);
    setNivelFilter("all");
  };

  // Risk table: at leaf (no children) show all risks matching current node labels
  const nodeLabels = currentNode
    ? collectLabels(currentNode)
    : [];
  const baseRisks =
    isLeaf && currentNode
      ? RISK_TABLE_ALL.filter((r) =>
        nodeLabels.some(
          (l) => r.pais === l || r.area.includes(l),
        ),
      )
      : RISK_TABLE_ALL;
  const byNivel = nivelFilter === "all" ? baseRisks : baseRisks.filter((r) => r.nivel === nivelFilter);
  const filteredRisks = showOnlyCompleted ? byNivel.filter(r => completedIds.has(r.id)) : byNivel;

  const toggleTreeNode = (id: string) => {
    setTreeExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div
      className="flex-1 overflow-auto flex flex-col"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* ── Page header ── */}
      <div className="px-6 pt-5 pb-0 flex-shrink-0">
        {/* Macro breadcrumb (page location) */}
        <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
          <span className="hover:text-foreground cursor-pointer transition-colors">
            Inicio
          </span>
          <ChevronRight
            size={11}
            className="text-muted-foreground/40"
          />
          <span className="text-foreground font-medium">
            Catálogo Organizacional
          </span>
        </nav>

        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              Catálogo Organizacional
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Navega la estructura corporativa y consulta los
              riesgos de cada entidad
            </p>
          </div>
          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setViewMode("cards")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${viewMode === "cards" ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Layers size={12} />
              Vista de tarjetas
            </button>
            <button
              onClick={() => setViewMode("tree")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${viewMode === "tree" ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <GitBranch size={12} />
              Vista de árbol
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mb-4 max-w-xl">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() =>
              setTimeout(() => setSearchFocused(false), 150)
            }
            placeholder="Buscar entidad… ej. Brasil, División Ciberseguridad, Banca Corporativa"
            className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 shadow-sm placeholder:text-muted-foreground"
          />
          {/* Autocomplete dropdown */}
          {searchFocused && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 overflow-hidden">
              {searchResults.map(({ node, path: nodePath }) => {
                const col = riskColor(node);
                return (
                  <button
                    key={node.id}
                    onMouseDown={() =>
                      jumpToNode({ node, path: nodePath })
                    }
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/60 text-left transition-colors border-b border-border/50 last:border-0"
                  >
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${col.dot}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground">
                        {node.label}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {nodePath
                          .map((p) => p.label)
                          .join(" › ")}
                        {nodePath.length > 0 && " › "}
                        <span className="font-medium">
                          {node.label}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${TYPE_COLORS[node.type]}`}
                    >
                      {node.type}
                    </span>
                    {(node.risks ?? 0) > 0 && (
                      <span
                        className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${col.badge}`}
                      >
                        {node.risks} riesgos
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {searchFocused &&
            search.trim().length >= 1 &&
            searchResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 px-4 py-3 text-sm text-muted-foreground">
                Sin resultados para "{search}"
              </div>
            )}
        </div>

        {/* Drill-down breadcrumb — only in card mode */}
        {viewMode === "cards" && (
          <div className="flex items-center gap-1 flex-wrap mb-5">
            <button
              onClick={goRoot}
              className={`text-sm px-2 py-0.5 rounded transition-colors ${path.length === 0 ? "font-bold text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              Todos los negocios
            </button>
            {path.map((node, i) => (
              <span
                key={node.id}
                className="flex items-center gap-1"
              >
                <ChevronRight
                  size={13}
                  className="text-muted-foreground/50"
                />
                <button
                  onClick={() => jumpToLevel(i)}
                  className={`text-sm px-2 py-0.5 rounded transition-colors ${i === path.length - 1 ? "font-bold text-primary bg-primary/8" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {node.label}
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Content area ── */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {/* ── TREE VIEW MODE ── */}
        {viewMode === "tree" && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-muted-foreground font-medium">
                Vista completa de la jerarquía
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() =>
                    setTreeExpanded(
                      new Set([
                        "n1",
                        "n1-1",
                        "n1-1-1",
                        "n1-1-1-1",
                        "n1-2",
                        "n1-2-1",
                        "n1-2-1-1",
                        "n2",
                        "n2-1",
                        "n2-1-1",
                        "n2-2",
                        "n2-2-1",
                        "n3",
                        "n3-1",
                        "n3-1-1",
                      ]),
                    )
                  }
                  className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground hover:bg-secondary transition-colors"
                >
                  Expandir todo
                </button>
                <button
                  onClick={() => setTreeExpanded(new Set())}
                  className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground hover:bg-secondary transition-colors"
                >
                  Colapsar
                </button>
              </div>
            </div>
            <div className="space-y-0.5">
              {TREE.map((n) => (
                <TreeRow
                  key={n.id}
                  node={n}
                  depth={0}
                  expanded={treeExpanded}
                  onToggle={toggleTreeNode}
                  onJump={setPath}
                  completedIds={completedIds}
                />
              ))}
            </div>
          </Card>
        )}

        {/* ── CARD / DRILL-DOWN MODE ── */}
        {viewMode === "cards" && (
          <>
            {/* Current level label */}
            {!isLeaf && (
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  {currentNode
                    ? `${currentChildren[0]?.type ?? "Nodo"}s en ${currentNode.label}`
                    : "Unidades de Negocio"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {currentChildren.length} entidades
                </div>
              </div>
            )}

            {/* Cards grid */}
            {!isLeaf && (
              <div className="grid grid-cols-3 gap-4 mb-6">
                {currentChildren.map((node) => {
                  const col = riskColor(node);
                  const hasKids = !!node.children?.length;
                  const { total: nodeTotal, completed: nodeCompleted } = getNodeCompletion(node);
                  const allNodeComplete = nodeTotal > 0 && nodeCompleted === nodeTotal;
                  const pct = nodeTotal > 0 ? Math.round(nodeCompleted / nodeTotal * 100) : 0;
                  return (
                    <button
                      key={node.id}
                      onClick={() => drillInto(node)}
                      className="text-left bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-md transition-all group"
                    >
                      {/* Color stripe */}
                      <div
                        className={`h-1.5 w-full ${allNodeComplete ? "bg-emerald-500" : col.stripe}`}
                      />
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded mb-1.5 inline-block ${TYPE_COLORS[node.type] ?? ""}`}
                            >
                              {node.type}
                            </span>
                            <div className="text-base font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
                              {node.label}
                            </div>
                          </div>
                          <ChevronRight
                            size={16}
                            className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${allNodeComplete ? "bg-emerald-500" : col.dot}`}
                            />
                            {allNodeComplete ? (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Completado
                              </span>
                            ) : (
                              <span
                                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${col.badge}`}
                              >
                                {col.label}
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-foreground leading-none">
                              {node.risks ?? 0}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              riesgos
                            </div>
                          </div>
                        </div>
                        {nodeTotal > 0 && (
                          <div className="mt-2.5">
                            <div className="flex items-center gap-1.5 mb-1">
                              <CheckCircle2
                                size={11}
                                className={`flex-shrink-0 ${allNodeComplete ? "text-emerald-500" : "text-muted-foreground/60"}`}
                              />
                              <span className="text-xs text-muted-foreground">
                                {nodeCompleted} / {nodeTotal} realizados
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {hasKids && (
                          <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-1 text-xs text-muted-foreground">
                            <span>
                              {node.children!.length}{" "}
                              {node.children![0]?.type ??
                                "sub-entidades"}
                              {node.children!.length > 1
                                ? "s"
                                : ""}
                            </span>
                            <span className="ml-auto text-primary font-medium group-hover:underline">
                              Ver detalle →
                            </span>
                          </div>
                        )}
                        {!hasKids && (
                          <div className="mt-3 pt-3 border-t border-border/60 text-xs text-primary font-medium group-hover:underline">
                            Ver riesgos asociados →
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── RISK TABLE — shown at leaf or when root and wanting risks ── */}
            {(isLeaf || path.length > 0) && (
              <Card>
                <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <Shield
                      size={15}
                      className="text-primary flex-shrink-0"
                    />
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        Riesgos{" "}
                        {currentNode
                          ? `— ${currentNode.label}`
                          : ""}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {isLeaf
                          ? "Nivel final de la jerarquía"
                          : "Todos los riesgos de esta rama"}
                      </div>
                    </div>
                    <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-semibold">
                      {filteredRisks.length}
                    </span>
                  </div>
                  <button
                    onClick={() => exportToCSV(
                      "riesgos_catalogo.csv",
                      ["ID", "Nombre", "Nivel", "Área", "País", "Estatus"],
                      filteredRisks.map(r => [r.id, r.name, r.nivel, r.area, r.pais, completedIds.has(r.id) ? "Completado" : r.status])
                    )}
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:bg-secondary transition-colors"
                  >
                    <Download size={12} /> Exportar CSV
                  </button>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Filter
                      size={12}
                      className="text-muted-foreground"
                    />
                    {(
                      [
                        "all",
                        "Crítico",
                        "Alto",
                        "Medio",
                        "Bajo",
                      ] as const
                    ).map((f) => (
                      <button
                        key={f}
                        onClick={() => setNivelFilter(f)}
                        className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${nivelFilter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
                      >
                        {f === "all" ? "Todos" : f}
                      </button>
                    ))}
                    <div className="w-px h-4 bg-border mx-0.5 flex-shrink-0" />
                    <button
                      onClick={() => setShowOnlyCompleted(s => !s)}
                      className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${showOnlyCompleted
                        ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                        : "text-muted-foreground hover:bg-secondary"
                        }`}
                    >
                      <CheckCircle2 size={11} />
                      Ver solo realizados
                    </button>
                  </div>
                </div>

                {filteredRisks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                    <div className="relative w-16 h-16 mb-4">
                      <div className="absolute inset-0 rounded-full bg-emerald-50 border-2 border-emerald-200" />
                      <CheckCircle2
                        size={28}
                        className="absolute inset-0 m-auto text-emerald-500"
                      />
                    </div>
                    <div className="text-base font-bold text-foreground mb-1">
                      {showOnlyCompleted ? "Sin riesgos realizados" : "Sin riesgos registrados"}
                    </div>
                    <div className="text-sm text-muted-foreground max-w-xs">
                      {showOnlyCompleted
                        ? "No hay riesgos marcados como realizados con el filtro actual."
                        : nivelFilter !== "all"
                          ? `No hay riesgos de nivel "${nivelFilter}" en esta entidad. Prueba otro filtro.`
                          : "Esta entidad no tiene riesgos registrados en el sistema. ¡Bien!"}
                    </div>
                    {(nivelFilter !== "all" || showOnlyCompleted) && (
                      <button
                        onClick={() => { setNivelFilter("all"); setShowOnlyCompleted(false); }}
                        className="mt-3 text-xs text-accent font-semibold hover:underline"
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="px-4 py-2.5 w-10 flex-shrink-0" />
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            ID / Riesgo
                          </th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Nivel
                          </th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Área
                          </th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            País
                          </th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Estatus
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredRisks.map((r) => {
                          const done = completedIds.has(r.id);
                          return (
                            <tr
                              key={r.id}
                              className={`hover:bg-secondary/30 cursor-pointer group transition-colors ${done ? "opacity-60" : ""}`}
                            >
                              <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => toggleComplete(r.id)}
                                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${done
                                    ? "bg-emerald-500 border-emerald-500"
                                    : "border-border hover:border-emerald-400"
                                    }`}
                                >
                                  {done && <Check size={11} className="text-white" />}
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-mono text-xs text-muted-foreground mb-0.5">
                                  {r.id}
                                </div>
                                <div className={`font-medium text-sm transition-colors ${done ? "line-through text-muted-foreground" : "text-foreground group-hover:text-primary"}`}>
                                  {r.name}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${NIVEL_COLOR[r.nivel]}`}
                                >
                                  {r.nivel}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">
                                {r.area}
                              </td>
                              <td className="px-4 py-3 text-xs font-medium text-muted-foreground">
                                {r.pais}
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge status={done ? "completed" : r.status} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}

            {/* Empty state at root with no selection */}
            {path.length === 0 && !isLeaf && (
              <div className="mt-2 text-xs text-muted-foreground text-center">
                Haz clic en una tarjeta para explorar su
                estructura interna
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Root App ────────────────────────────────────────────────────────────────
// ─── Settings View ───────────────────────────────────────────────────────────
function SettingsView({
  onOpenEditor,
}: {
  onOpenEditor: () => void;
}) {
  const [avatarSrc, setAvatarSrc] = useState<string | null>(
    null,
  );
  const [form, setForm] = useState({
    firstName: "María",
    lastName: "García",
    email: "m.garcia@auditcore.com",
    phone: "+34 91 555 0124",
    role: "Jefatura de Auditoría",
    department: "Auditoría Interna",
    location: "Madrid, España",
    bio: "",
  });
  const [saved, setSaved] = useState(false);

  const handleAvatarChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAvatarSrc(url);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const field = (
    label: string,
    key: keyof typeof form,
    placeholder?: string,
    type = "text",
  ) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) =>
          setForm((f) => ({ ...f, [key]: e.target.value }))
        }
        placeholder={placeholder}
        className="px-3 py-2 rounded-md border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
      />
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8">
      <div>
        <h2 className="text-xl font-bold text-foreground">
          Ajustes del Sistema
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Administra tu perfil, información de contacto y la
          apariencia del dashboard.
        </p>
      </div>

      {/* Profile picture */}
      <section className="bg-white rounded-xl border border-border p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <Users size={16} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
            Foto de Perfil
          </h3>
        </div>
        <div className="flex items-center gap-6">
          <div className="relative flex-shrink-0">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt="Avatar"
                className="w-20 h-20 rounded-full object-cover ring-4 ring-primary/20"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center ring-4 ring-primary/20">
                <span className="text-white text-2xl font-bold select-none">
                  MG
                </span>
              </div>
            )}
            <label className="absolute -bottom-1 -right-1 w-7 h-7 bg-white border-2 border-border rounded-full flex items-center justify-center cursor-pointer hover:bg-secondary transition-colors shadow-sm">
              <RefreshCw
                size={12}
                className="text-muted-foreground"
              />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </label>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {form.firstName} {form.lastName}
            </p>
            <p className="text-xs text-muted-foreground">
              {form.role}
            </p>
            <label className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-semibold rounded-md cursor-pointer hover:bg-secondary/80 transition-colors">
              <Plus size={12} />
              Subir imagen
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </label>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              JPG, PNG o WebP · máx. 2 MB
            </p>
          </div>
        </div>
      </section>

      {/* Contact details */}
      <section className="bg-white rounded-xl border border-border p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <FileText size={16} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
            Datos de Contacto
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {field("Nombre", "firstName", "María")}
          {field("Apellidos", "lastName", "García")}
          {field(
            "Correo electrónico",
            "email",
            "correo@empresa.com",
            "email",
          )}
          {field("Teléfono", "phone", "+34 91 000 0000")}
          {field(
            "Cargo / Rol",
            "role",
            "Jefatura de Auditoría",
          )}
          {field(
            "Departamento",
            "department",
            "Auditoría Interna",
          )}
          {field("Ubicación", "location", "Ciudad, País")}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Biografía
          </label>
          <textarea
            value={form.bio}
            onChange={(e) =>
              setForm((f) => ({ ...f, bio: e.target.value }))
            }
            rows={3}
            placeholder="Breve descripción profesional (opcional)"
            className="px-3 py-2 rounded-md border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition resize-none"
          />
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-md hover:bg-primary/90 transition-colors"
          >
            {saved ? <Check size={14} /> : <Save size={14} />}
            {saved ? "Guardado" : "Guardar cambios"}
          </button>
          {saved && (
            <span className="text-xs text-emerald-600 font-medium">
              Los cambios se guardaron correctamente.
            </span>
          )}
        </div>
      </section>

      {/* Dashboard appearance */}
      <section className="bg-white rounded-xl border border-border p-6">
        <div className="flex items-center gap-2 mb-1">
          <Layers size={16} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
            Apariencia del Dashboard
          </h3>
        </div>
        <p className="text-sm text-muted-foreground mt-2 mb-5">
          Personaliza los widgets, el orden de las secciones y
          el diseño de tu vista de inicio usando el editor de
          layouts interactivo.
        </p>
        <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary/50 border border-border">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Layers size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-foreground">
              Editor de Vistas
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Arrastra y suelta widgets, cambia tamaños y guarda
              tu layout personalizado.
            </div>
          </div>
          <button
            onClick={onOpenEditor}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-md hover:bg-primary/90 transition-colors flex-shrink-0"
          >
            <Eye size={14} />
            Abrir editor
          </button>
        </div>
      </section>

    </div>
  );
}

// ─── Bitácora View ───────────────────────────────────────────────────────────
// Maps an action string to one of the filter chip categories
function classifyAction(action: string): string {
  const a = action.toLowerCase();
  if (a.startsWith("creó") || a.startsWith("creo")) return "Creó";
  if (a.startsWith("modificó") || a.startsWith("modifico") || a.startsWith("asignó") || a.startsWith("marcó")) return "Modificó";
  if (a.startsWith("aprobó") || a.startsWith("aprobo")) return "Aprobó";
  if (a.startsWith("cargó") || a.startsWith("cargo")) return "Cargó evidencia";
  if (a.startsWith("exportó") || a.startsWith("exporto")) return "Exportó";
  if (a.startsWith("consultó") || a.startsWith("consulto")) return "Consultó";
  return "Otro";
}

// Maps an entity string to one of the entity type categories
function classifyEntity(entity: string): string {
  const e = entity.toLowerCase();
  if (e.startsWith("rie") || e.startsWith("rg-") || e.startsWith("riesgo")) return "Riesgos";
  if (e.startsWith("hal") || e.startsWith("hallazgo")) return "Hallazgos";
  if (e.startsWith("pai") || e.startsWith("plan")) return "Planes";
  if (e.startsWith("ctr") || e.startsWith("control")) return "Controles";
  if (e.startsWith("auditor") || e.startsWith("solo lectura") || e.startsWith("role")) return "Roles";
  if (e.startsWith("catálogo") || e.startsWith("catalogo")) return "Catálogo";
  return "Otro";
}

const ACTION_CHIPS = ["Todos", "Creó", "Modificó", "Aprobó", "Cargó evidencia", "Exportó", "Consultó"] as const;
const ENTITY_TYPES = ["Todos", "Riesgos", "Hallazgos", "Planes", "Controles", "Roles", "Catálogo"] as const;
const DATE_PRESETS = ["Todos", "Hoy", "Últimos 7 días", "Últimos 30 días", "Personalizado"] as const;
const PAGE_SIZE = 20;

function BitacoraView() {
  const [search, setSearch] = useState("");
  const [actionChip, setActionChip] = useState<string>("Todos");
  const [entityType, setEntityType] = useState<string>("Todos");
  const [datePreset, setDatePreset] = useState<string>("Todos");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [userFilter, setUserFilter] = useState<string>("Todos");
  const [page, setPage] = useState(1);

  const userList = ["Todos", ...Array.from(new Set(INITIAL_USERS.map(u => u.name)))];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const inDateRange = (dateStr: string): boolean => {
    const d = new Date(dateStr.slice(0, 10));
    if (datePreset === "Hoy") return d >= today;
    if (datePreset === "Últimos 7 días") { const t = new Date(today); t.setDate(t.getDate() - 6); return d >= t; }
    if (datePreset === "Últimos 30 días") { const t = new Date(today); t.setDate(t.getDate() - 29); return d >= t; }
    if (datePreset === "Personalizado") {
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo && d > new Date(dateTo)) return false;
    }
    return true;
  };

  const filtered = BITACORA_DATA.filter(b => {
    const q = search.trim().toLowerCase();
    if (q && !b.user.toLowerCase().includes(q) && !b.action.toLowerCase().includes(q) && !b.entity.toLowerCase().includes(q)) return false;
    if (actionChip !== "Todos" && classifyAction(b.action) !== actionChip) return false;
    if (entityType !== "Todos" && classifyEntity(b.entity) !== entityType) return false;
    if (userFilter !== "Todos" && b.user !== userFilter) return false;
    if (!inDateRange(b.date)) return false;
    return true;
  });

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = paginated.length < filtered.length;

  // Active filter chips for the "active filters" bar
  type ActiveFilter = { label: string; clear: () => void };
  const activeFilters: ActiveFilter[] = [];
  if (actionChip !== "Todos") activeFilters.push({ label: `Acción: ${actionChip}`, clear: () => setActionChip("Todos") });
  if (entityType !== "Todos") activeFilters.push({ label: `Entidad: ${entityType}`, clear: () => setEntityType("Todos") });
  if (userFilter !== "Todos") activeFilters.push({ label: `Usuario: ${userFilter}`, clear: () => setUserFilter("Todos") });
  if (datePreset !== "Todos") activeFilters.push({ label: datePreset === "Personalizado" ? `${dateFrom || "…"} → ${dateTo || "…"}` : datePreset, clear: () => { setDatePreset("Todos"); setDateFrom(""); setDateTo(""); } });
  if (search.trim()) activeFilters.push({ label: `"${search.trim()}"`, clear: () => setSearch("") });

  const clearAll = () => { setSearch(""); setActionChip("Todos"); setEntityType("Todos"); setUserFilter("Todos"); setDatePreset("Todos"); setDateFrom(""); setDateTo(""); setPage(1); };

  const handleExport = () => exportToCSV(
    "bitacora.csv",
    ["ID", "Usuario", "Acción", "Entidad", "Fecha"],
    filtered.map(b => [b.id, b.user, b.action, b.entity, b.date])
  );

  // Reset to page 1 whenever filters change
  const applyFilter = (fn: () => void) => { fn(); setPage(1); };

  return (
    <div className="flex-1 overflow-auto p-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Breadcrumbs items={["Inicio", "Configuración", "Bitácora"]} />
      <PageHeader
        title="Bitácora de Actividad"
        subtitle="Registro completo de acciones realizadas por los usuarios del sistema."
        actions={
          <button onClick={handleExport}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-secondary transition-colors font-medium">
            <Download size={12} /> Exportar CSV
          </button>
        }
      />

      {/* ── Filter row 1: search + action chips ─────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar usuario, acción o entidad…"
            value={search}
            onChange={e => applyFilter(() => setSearch(e.target.value))}
            className="pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-60"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ACTION_CHIPS.map(chip => (
            <button key={chip}
              onClick={() => applyFilter(() => setActionChip(chip))}
              className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${actionChip === chip
                ? "bg-primary text-white border-primary"
                : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                }`}>
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filter row 2: date, user, entity type ───────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-3">
        {/* Date preset */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {DATE_PRESETS.map(p => (
            <button key={p}
              onClick={() => applyFilter(() => { setDatePreset(p); if (p !== "Personalizado") { setDateFrom(""); setDateTo(""); } })}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${datePreset === p
                ? "bg-primary/10 text-primary border-primary/40"
                : "bg-background text-muted-foreground border-border hover:border-primary/30"
                }`}>
              {p}
            </button>
          ))}
          {datePreset === "Personalizado" && (
            <div className="flex items-center gap-1.5 ml-1">
              <input type="date" value={dateFrom} onChange={e => applyFilter(() => setDateFrom(e.target.value))}
                className="text-xs px-2 py-1.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <span className="text-xs text-muted-foreground">→</span>
              <input type="date" value={dateTo} onChange={e => applyFilter(() => setDateTo(e.target.value))}
                className="text-xs px-2 py-1.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          )}
        </div>

        {/* User dropdown */}
        <select value={userFilter} onChange={e => applyFilter(() => setUserFilter(e.target.value))}
          className="text-xs px-3 py-1.5 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
          {userList.map(u => <option key={u} value={u}>{u === "Todos" ? "Usuario: Todos" : u}</option>)}
        </select>

        {/* Entity type dropdown */}
        <select value={entityType} onChange={e => applyFilter(() => setEntityType(e.target.value))}
          className="text-xs px-3 py-1.5 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
          {ENTITY_TYPES.map(t => <option key={t} value={t}>{t === "Todos" ? "Tipo de entidad: Todos" : t}</option>)}
        </select>
      </div>

      {/* ── Active filter chips ─────────────────────────────────────────── */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {activeFilters.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-xs bg-primary/8 text-primary border border-primary/20 px-2.5 py-1 rounded-full font-medium">
              {f.label}
              <button onClick={f.clear} className="ml-0.5 rounded-full hover:bg-primary/20 transition-colors p-0.5">
                <X size={10} />
              </button>
            </span>
          ))}
          <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-primary underline-offset-2 hover:underline transition-colors">
            Limpiar filtros
          </button>
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-6 py-3 border-b border-border bg-secondary/20 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {filtered.length} {filtered.length === 1 ? "registro" : "registros"}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Activity size={11} />
            Última actualización: {BITACORA_DATA[0]?.date ?? "—"}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                {["Usuario", "Acción", "Tipo", "Entidad afectada", "Fecha"].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-14 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Activity size={24} className="text-muted-foreground/30" />
                      <div className="text-sm font-semibold text-muted-foreground">Sin registros para los filtros seleccionados</div>
                      <button onClick={clearAll} className="text-xs text-primary hover:underline mt-1">Limpiar filtros</button>
                    </div>
                  </td>
                </tr>
              ) : paginated.map(b => {
                const cat = classifyAction(b.action);
                const catColor: Record<string, string> = {
                  "Creó": "bg-emerald-50 text-emerald-700 border-emerald-200",
                  "Modificó": "bg-blue-50 text-blue-700 border-blue-200",
                  "Aprobó": "bg-violet-50 text-violet-700 border-violet-200",
                  "Cargó evidencia": "bg-amber-50 text-amber-700 border-amber-200",
                  "Exportó": "bg-sky-50 text-sky-700 border-sky-200",
                  "Consultó": "bg-secondary text-muted-foreground border-border",
                };
                return (
                  <tr key={b.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold flex-shrink-0">
                          {b.user.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                        </div>
                        <span className="text-sm font-medium text-foreground">{b.user}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-sm text-foreground">{b.action}</td>
                    <td className="px-6 py-3">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${catColor[cat] ?? catColor["Consultó"]}`}>
                        {cat}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className="font-mono text-xs text-primary bg-primary/8 px-2 py-0.5 rounded-md">{b.entity}</span>
                    </td>
                    <td className="px-6 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">{b.date}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Show more ───────────────────────────────────────────────── */}
        {hasMore && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-secondary/10">
            <span className="text-xs text-muted-foreground">Mostrando {paginated.length} de {filtered.length} registros</span>
            <button onClick={() => setPage(p => p + 1)}
              className="text-xs px-4 py-1.5 rounded-lg border border-border bg-background text-foreground font-medium hover:bg-secondary transition-colors">
              Mostrar más
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── View: PLANES DE AUDITORÍA ───────────────────────────────────────────────
const PLAN_STATUS_CFG: Record<AuditPlan["status"], { label: string; cls: string }> = {
  "Borrador": { label: "Borrador", cls: "bg-slate-50 text-slate-600 border border-slate-200" },
  "Aprobado": { label: "Aprobado", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  "En Ejecución": { label: "En Ejecución", cls: "bg-amber-50 text-amber-700 border border-amber-200" },
  "Cerrado": { label: "Cerrado", cls: "bg-blue-50 text-blue-700 border border-blue-200" },
};

function AuditPlansView({ canCreate }: { canCreate: boolean }) {
  const [plans, setPlans] = useState<AuditPlan[]>(AUDIT_PLANS_DATA);
  const [showForm, setShowForm] = useState(false);
  const [planPdfTarget, setPlanPdfTarget] = useState<AuditPlan | null>(null);
  const [form, setForm] = useState({ code: "", name: "", type: "", period: "", startDate: "", endDate: "", estimatedHours: "", responsible: "M. García", scope: "" });
  const [formErr, setFormErr] = useState<Record<string, string>>({});

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

  const handleSubmit = () => {
    const errs = validate();
    if (Object.keys(errs).length) { setFormErr(errs); return; }
    const newPlan: AuditPlan = {
      id: `AP-${String(plans.length + 1).padStart(3, "0")}`,
      code: form.code, name: form.name, type: form.type as AuditPlan["type"], period: form.period,
      startDate: form.startDate, endDate: form.endDate,
      status: "Borrador", estimatedHours: Number(form.estimatedHours),
      responsible: form.responsible, scope: form.scope,
    };
    setPlans(prev => [newPlan, ...prev]);
    setShowForm(false);
    setForm({ code: "", name: "", type: "", period: "", startDate: "", endDate: "", estimatedHours: "", responsible: "M. García", scope: "" });
    setFormErr({});
    toast.success(`Plan "${newPlan.name}" creado correctamente`);
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
      <PageHeader
        title="Planes de Auditoría"
        subtitle={`${plans.length} planes registrados · Ciclo 2024–2025`}
        actions={canCreate ? (
          <PrimaryBtn icon={<Plus size={14} />} onClick={() => setShowForm(s => !s)}>
            {showForm ? "Cancelar" : "Nuevo plan"}
          </PrimaryBtn>
        ) : undefined}
      />

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
            {inp("Responsable", "responsible")}
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
          <PrimaryBtn icon={<Save size={14} />} onClick={handleSubmit}>Guardar plan</PrimaryBtn>
        </Card>
      )}

      <Card>
        <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={14} className="text-primary" />
            <div className="text-sm font-semibold text-foreground">Planes registrados</div>
            <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-semibold">{plans.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportToCSV("planes_auditoria.csv", ["ID", "Código", "Nombre", "Tipo", "Periodo", "Inicio", "Fin", "Estado", "Horas"], plans.map(p => [p.id, p.code, p.name, p.type, p.period, p.startDate, p.endDate, p.status, String(p.estimatedHours)]))}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:bg-secondary transition-colors"
            >
              <Download size={12} /> Exportar CSV
            </button>
            <button
              onClick={() => setPlanPdfTarget(plans[0])}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:bg-secondary transition-colors"
            >
              <FileText size={12} /> Exportar PDF
            </button>
          </div>
        </div>
        {planPdfTarget && (
          <PDFPreviewModal
            onClose={() => setPlanPdfTarget(null)}
            doc={{
              title: `Plan de Auditoría — ${planPdfTarget.code}`,
              subtitle: planPdfTarget.name,
              sections: [
                {
                  heading: "Información General",
                  rows: [
                    ["Código", planPdfTarget.code],
                    ["Nombre del plan", planPdfTarget.name],
                    ["Tipo", planPdfTarget.type],
                    ["Período", planPdfTarget.period],
                    ["Estado", planPdfTarget.status],
                    ["Responsable", planPdfTarget.responsible],
                    ["Horas estimadas", `${planPdfTarget.estimatedHours}h`],
                  ],
                },
                {
                  heading: "Alcance y Fechas",
                  rows: [
                    ["Fecha de inicio", planPdfTarget.startDate],
                    ["Fecha de fin", planPdfTarget.endDate],
                    ["Alcance", planPdfTarget.scope || "No especificado"],
                  ],
                },
                {
                  heading: "Resumen de Planes",
                  rows: plans.map(p => [p.code, `${p.name} · ${p.status}`]),
                },
              ],
            }}
          />
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Código", "Nombre del Plan", "Tipo", "Periodo", "Inicio", "Fin", "Estado", "Horas Est.", "Responsable"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {plans.map(p => {
                const st = PLAN_STATUS_CFG[p.status];
                return (
                  <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-bold text-primary bg-primary/8 px-2 py-0.5 rounded-md">{p.code}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground text-sm">{p.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.scope}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground whitespace-nowrap">{p.type}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{p.period}</td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{p.startDate}</td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{p.endDate}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground font-semibold">{p.estimatedHours}h</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{p.responsible}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── View: HALLAZGOS ─────────────────────────────────────────────────────────
const SEV_COLOR: Record<Finding["severity"], string> = {
  "Crítico": "bg-red-50 text-red-700 border border-red-200",
  "Alto": "bg-orange-50 text-orange-700 border border-orange-200",
  "Medio": "bg-amber-50 text-amber-700 border border-amber-200",
  "Bajo": "bg-emerald-50 text-emerald-700 border border-emerald-200",
};
const FIND_STATUS_CFG: Record<Finding["status"], string> = {
  "Abierto": "bg-red-50 text-red-700 border border-red-200",
  "En Revisión": "bg-amber-50 text-amber-700 border border-amber-200",
  "Asignado": "bg-blue-50 text-blue-700 border border-blue-200",
  "Cerrado": "bg-emerald-50 text-emerald-700 border border-emerald-200",
};



// ─── View: PORTAL DEL AUDITADO ───────────────────────────────────────────────
function AuditadoPortalView() {
  // Planes de acción asignados al usuario en sesión (SF-10, SF-11; historia #91). Vienen del backend.
  const { usuario } = useSesion();
  const [planes, setPlanes] = useState<PlanAccion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hoy = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    listarMisPlanesAccion()
      .then((datos) => { if (vigente) { setPlanes(datos); setError(null); } })
      .catch((e: unknown) => { if (vigente) setError(e instanceof Error ? e.message : "No se pudieron cargar tus planes de acción."); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [usuario?.id]);

  return (
    <div className="flex-1 overflow-auto p-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Breadcrumbs items={["Inicio", "Auditoría", "Portal del Auditado"]} />
      <PageHeader
        title="Portal del Auditado"
        subtitle={`Vista de solo lectura — Planes de acción asignados a ${usuario?.nombre ?? "tu área"}`}
      />
      <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
        <Eye size={14} className="flex-shrink-0" />
        <span>Esta vista es de <strong>solo lectura</strong>. Para actualizar el estado de un plan, contacta al equipo de auditoría.</span>
      </div>
      {cargando ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">Cargando tus planes de acción...</Card>
      ) : error ? (
        <Card className="p-12 text-center">
          <div className="text-sm font-semibold text-red-600">{error}</div>
        </Card>
      ) : planes.length === 0 ? (
        <Card className="p-12 text-center">
          <UserCheck size={32} className="mx-auto text-muted-foreground/30 mb-3" />
          <div className="text-sm font-semibold text-muted-foreground">Sin planes de acción asignados</div>
          <div className="text-xs text-muted-foreground/60 mt-1">Los planes de acción asignados a ti aparecerán aquí.</div>
        </Card>
      ) : (
        <div className="space-y-4">
          {planes.map(plan => {
            const vencido = plan.estado !== "Completado" && plan.fechaCompromiso < hoy;
            const severidad = plan.hallazgo.severidad as Finding["severity"] | null;
            return (
              <Card key={plan.id} className="p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-primary bg-primary/8 px-2 py-0.5 rounded-md">{plan.hallazgo.folio ?? plan.hallazgo.id}</span>
                      {severidad && SEV_COLOR[severidad] && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SEV_COLOR[severidad]}`}>{severidad}</span>
                      )}
                    </div>
                    <div className="text-base font-bold text-foreground leading-tight">{plan.hallazgo.titulo}</div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${plan.estado === "Completado" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
                    {plan.estado}
                  </span>
                </div>
                <div className="bg-secondary/40 rounded-lg p-4 space-y-3">
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Plan de remediación</div>
                    <p className="text-sm text-foreground leading-relaxed">{plan.descripcion}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Responsable</div>
                      <div className="text-sm font-medium text-foreground">{plan.responsable.nombre}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Fecha límite</div>
                      <div className={`text-sm font-semibold font-mono ${vencido ? "text-red-600" : "text-foreground"}`}>
                        {plan.fechaCompromiso}{vencido && <span className="ml-2 text-xs font-sans font-semibold">Vencido</span>}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-border">
                  <EvidenciasSection
                    entityId={plan.hallazgo.id}
                    entityType="hallazgo"
                    findingId={plan.hallazgo.id}
                    auditId={plan.hallazgo.auditoriaId ?? undefined}
                    controlId={plan.hallazgo.controlId ?? undefined}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Guided Tour ──────────────────────────────────────────────────────────────
const TOUR_STEPS = [
  {
    targetId: "tour-nav-dashboard",
    title: "Dashboard",
    description: "Resumen del trabajo del día: KPIs en tiempo real, tareas urgentes y gráficas del trimestre.",
  },
  {
    targetId: "tour-nav-filter",
    title: "Filtrar",
    description: "Busca riesgos, controles, entidades y auditorías. Filtra por cualquier atributo y navega con drill-down.",
  },
  {
    targetId: "tour-nav-hierarchy",
    title: "Catálogo",
    description: "Estructura organizacional completa y riesgos por entidad, con vista de tarjetas y árbol jerárquico.",
  },
  {
    targetId: "tour-nav-plans",
    title: "Planes de Auditoría",
    description: "Define el calendario anual y trimestral de auditorías: alcance, responsables y fechas clave.",
  },
  {
    targetId: "tour-nav-findings",
    title: "Hallazgos",
    description: "Registra lo que falló durante la auditoría y crea planes de acción con responsable y fecha compromiso.",
  },
  {
    targetId: "tour-nav-auditado",
    title: "Portal del Auditado",
    description: "La vista que ve el negocio para dar seguimiento a sus planes de acción y evidencias asignadas.",
  },
  {
    targetId: "tour-nav-users",
    title: "Usuarios & Roles",
    description: "Gestiona accesos y permisos granulares por rol. Solo disponible para administradores del sistema.",
  },
  {
    targetId: "tour-nav-bitacora",
    title: "Bitácora",
    description: "Registro completo de quién hizo qué y cuándo. Permite auditar la propia plataforma y detectar cambios no autorizados.",
  },
  {
    targetId: "tour-copilot-btn",
    title: "Asistente IA",
    description: "Genera resúmenes, redacta hallazgos y recibe ayuda contextual sobre cualquier vista del sistema.",
  },
];

const TOOLTIP_W = 288; // w-72 = 18rem = 288px
const TOOLTIP_H = 260; // approximate rendered height
const MARGIN = 16;     // min distance from viewport edge
const SPOTLIGHT_PAD = 6;
const GAP = 12;        // gap between highlight ring and tooltip

function computeTooltipPos(box: DOMRect): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Available space on each side (from highlight edge to viewport edge)
  const spaceRight = vw - (box.right + SPOTLIGHT_PAD) - GAP;
  const spaceLeft = (box.left - SPOTLIGHT_PAD) - GAP;
  const spaceBottom = vh - (box.bottom + SPOTLIGHT_PAD) - GAP;
  const spaceTop = (box.top - SPOTLIGHT_PAD) - GAP;

  // Pick preferred horizontal side: right first, then left
  let left: number;
  if (spaceRight >= TOOLTIP_W + MARGIN) {
    left = box.right + SPOTLIGHT_PAD + GAP;
  } else if (spaceLeft >= TOOLTIP_W + MARGIN) {
    left = box.left - SPOTLIGHT_PAD - GAP - TOOLTIP_W;
  } else {
    // Neither side has enough room — center horizontally under/above
    left = box.left + box.width / 2 - TOOLTIP_W / 2;
  }

  // Pick preferred vertical placement:
  // If we placed the tooltip to the left or right, align top of tooltip with top of target.
  // If we placed it above/below (center case), use top/bottom.
  let top: number;
  const horizontalPlacement = spaceRight >= TOOLTIP_W + MARGIN || spaceLeft >= TOOLTIP_W + MARGIN;
  if (horizontalPlacement) {
    // Try to top-align with target; if tooltip overflows bottom, shift up
    top = box.top - SPOTLIGHT_PAD;
  } else {
    // Stacked: prefer below, fall back to above
    if (spaceBottom >= TOOLTIP_H + MARGIN) {
      top = box.bottom + SPOTLIGHT_PAD + GAP;
    } else {
      top = box.top - SPOTLIGHT_PAD - GAP - TOOLTIP_H;
    }
  }

  // Clamp to viewport with margin
  left = Math.max(MARGIN, Math.min(left, vw - TOOLTIP_W - MARGIN));
  top = Math.max(MARGIN, Math.min(top, vh - TOOLTIP_H - MARGIN));

  return { left, top };
}

function GuidedTour({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [box, setBox] = useState<DOMRect | null>(null);
  const { esAdministrador } = useSesion();

  // "Usuarios & Roles" solo aparece en la barra lateral del Administrador.
  const pasos = TOUR_STEPS.filter(p => p.targetId !== "tour-nav-users" || esAdministrador);
  const current = pasos[step];

  useEffect(() => {
    const el = document.getElementById(current.targetId);
    if (el) {
      setBox(el.getBoundingClientRect());
      el.scrollIntoView({ block: "nearest" });
    }
  }, [step, current.targetId]);

  const next = () => { if (step < pasos.length - 1) setStep(s => s + 1); else onClose(); };
  const prev = () => { if (step > 0) setStep(s => s - 1); };

  const pos = box ? computeTooltipPos(box) : { left: MARGIN, top: MARGIN };

  return (
    <>
      {/* Overlay — z-[60] so it sits above floating buttons (z-40) */}
      <div className="fixed inset-0 z-[60] pointer-events-none">
        <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          <defs>
            <mask id="spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              {box && <rect x={box.left - SPOTLIGHT_PAD} y={box.top - SPOTLIGHT_PAD} width={box.width + SPOTLIGHT_PAD * 2} height={box.height + SPOTLIGHT_PAD * 2} rx="8" fill="black" />}
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#spotlight-mask)" />
        </svg>
        {/* Highlight ring */}
        {box && (
          <div
            className="absolute border-2 border-primary rounded-lg shadow-[0_0_0_4px_rgba(15,79,255,0.25)] transition-all duration-300"
            style={{ left: box.left - SPOTLIGHT_PAD, top: box.top - SPOTLIGHT_PAD, width: box.width + SPOTLIGHT_PAD * 2, height: box.height + SPOTLIGHT_PAD * 2 }}
          />
        )}
      </div>

      {/* Tooltip — z-[61] so it renders above the overlay */}
      <div
        className="fixed z-[61] bg-card border border-border rounded-xl shadow-2xl p-5 transition-all duration-200"
        style={{ left: pos.left, top: pos.top, width: TOOLTIP_W, pointerEvents: "auto" }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <Sparkles size={12} className="text-primary" />
            </div>
            <div className="text-xs font-bold text-primary uppercase tracking-wide">Tour guiado</div>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"><X size={14} /></button>
        </div>

        <div className="mb-1">
          <div className="text-sm font-bold text-foreground">{current.title}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Paso {step + 1} de {pasos.length}</div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed mt-2 mb-4">{current.description}</p>

        {/* Progress */}
        <div className="flex gap-1 mb-4">
          {pasos.map((_, i) => (
            <button key={i} onClick={() => setStep(i)}
              className={`h-1.5 flex-1 rounded-full transition-all ${i === step ? "bg-primary" : i < step ? "bg-primary/40" : "bg-border"}`} />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {step > 0 && (
            <button onClick={prev} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-secondary transition-colors">
              <ChevronLeft size={12} /> Anterior
            </button>
          )}
          <button onClick={next} className="flex-1 flex items-center justify-center gap-1 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors">
            {step === pasos.length - 1 ? "Finalizar" : "Siguiente"} <ChevronRight size={12} />
          </button>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2">Omitir</button>
        </div>
      </div>
    </>
  );
}

const NAV_LABELS: Record<NavView, string> = {
  dashboard: "Dashboard",
  filter: "Filtrar",
  editor: "Editor de Vistas",
  hierarchy: "Catálogo Organizacional",
  settings: "Ajustes del Sistema",
  users: "Usuarios & Roles",
  bitacora: "Bitácora de Actividad",
  plans: "Planes de Auditoría",
  findings: "Hallazgos",
  controles: "Catálogo de Controles",
  auditado: "Portal del Auditado",
};

const DETAIL_LABELS: Record<DetailType, string> = {
  general_risk: "Riesgo General",
  specific_risk: "Riesgo Específico",
  audit_entity: "Entidad Auditora",
  control: "Procedimiento de Control",
};

type StackEntry = { type: DetailType; id: string };

export default function App() {
  const [navView, setNavView] = useState<NavView>("dashboard");
  const [stack, setStack] = useState<StackEntry[]>([]);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [tourActive, setTourActive] = useState(() => {
    try { return localStorage.getItem("expedite_tour_done") !== "1"; } catch { return true; }
  });

  const goToNav = (v: NavView) => {
    setNavView(v);
    setStack([]);
  };
  const navigate: Navigate = (type, id) =>
    setStack((prev) => [...prev, { type, id }]);
  const popTo = (index: number) =>
    setStack((prev) => prev.slice(0, index + 1));
  const clearStack = () => setStack([]);

  const top = stack[stack.length - 1] ?? null;

  // Build breadcrumb nodes for detail views
  const crumbs = top ? (
    <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-4 flex-wrap">
      <button
        onClick={() => {
          goToNav("dashboard");
        }}
        className="hover:text-foreground transition-colors"
      >
        Inicio
      </button>
      <ChevronRight
        size={11}
        className="text-muted-foreground/40"
      />
      <button
        onClick={clearStack}
        className="hover:text-foreground transition-colors"
      >
        {NAV_LABELS[navView]}
      </button>
      {stack.map((entry, i) => {
        const isLast = i === stack.length - 1;
        const label = entry.id;
        return (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight
              size={11}
              className="text-muted-foreground/40"
            />
            {isLast ? (
              <span className="font-semibold text-foreground">
                {label}
              </span>
            ) : (
              <button
                onClick={() => popTo(i)}
                className="hover:text-foreground transition-colors"
              >
                {label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  ) : null;

  const renderContent = () => {
    if (top) {
      switch (top.type) {
        case "general_risk":
          return (
            <GeneralRiskDetailView
              id={top.id}
              navigate={navigate}
              crumbs={crumbs}
            />
          );
        case "specific_risk":
          return (
            <SpecificRiskDetailView
              id={top.id}
              navigate={navigate}
              crumbs={crumbs}
            />
          );
        case "audit_entity":
          return (
            <AuditEntityDetailView
              id={top.id}
              navigate={navigate}
              crumbs={crumbs}
            />
          );
        case "control":
          return (
            <ControlDetailView id={top.id} crumbs={crumbs} />
          );
      }
    }
    switch (navView) {
      case "dashboard":
        return <DashboardView onNav={goToNav} />;
      case "filter":
        return <FilterView navigate={navigate} />;
      case "editor":
        return <EditorView />;
      case "hierarchy":
        return <HierarchyView />;
      case "settings":
        return (
          <SettingsView
            onOpenEditor={() => goToNav("editor")}
          />
        );
      case "users":
        return <UsuariosRolesView />;
      case "bitacora":
        return <BitacoraView />;
      case "plans":
        return <AuditPlansView canCreate={true} />;
      case "findings":
        return <VistaHallazgo />;
      case "controles":
        return <VistaControles navigate={navigate} />;
      case "auditado":
        return <AuditadoPortalView />;
    }
  };

  const topLabel = top
    ? `${DETAIL_LABELS[top.type]} — ${top.id}`
    : NAV_LABELS[navView];

  const handleTourClose = () => {
    setTourActive(false);
    try { localStorage.setItem("expedite_tour_done", "1"); } catch { }
  };

  return (
    <div
      className="flex h-screen w-full overflow-hidden bg-background"
      style={{
        fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
      }}
    >
      <Sidebar active={navView} onNav={goToNav} />
      <div className={`flex flex-col flex-1 overflow-hidden transition-all ${copilotOpen ? "mr-96" : ""}`}>
        <TopBar viewLabel={topLabel} />
        {renderContent()}
      </div>
      <Toaster position="bottom-right" richColors />
      <CopilotPanel currentView={navView} detalle={top} open={copilotOpen} onToggle={() => setCopilotOpen(o => !o)} />
      {tourActive && <GuidedTour onClose={handleTourClose} />}
      {/* Tour relaunch button */}
      {!tourActive && !copilotOpen && (
        <button
          onClick={() => setTourActive(true)}
          title="Relanzar tour guiado"
          className="fixed bottom-6 left-[calc(256px+1rem)] z-[62] w-8 h-8 flex items-center justify-center rounded-full bg-card border border-border shadow-md text-muted-foreground hover:text-primary hover:border-primary transition-colors text-sm font-bold"
        >
          ?
        </button>
      )}
    </div>
  );
}