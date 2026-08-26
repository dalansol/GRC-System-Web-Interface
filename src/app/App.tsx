import { useState } from "react";
import {
  LayoutDashboard, Shield, ClipboardList, GitBranch, Settings, Bell,
  ChevronRight, ChevronDown, Search, Clock, AlertTriangle, CheckCircle2,
  Circle, BarChart3, Users, FileText, Plus, Undo2, GripVertical, X,
  Sparkles, Filter, ChevronUp, ArrowRight, Loader2, Check,
  Building2, TrendingUp, PieChart, CalendarDays, ListTodo, Timer,
  RefreshCw, Save, Eye, Layers, AlignLeft, Palette, Maximize2,
  CalendarCheck, ClipboardCheck, Target, FileBarChart, RotateCcw,
  Lock, Unlock
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from "recharts";

// ─── Import all views ────────────────────────────────────────────────────────
import PlanningView from "./views/PlanningView";
import AuditsView from "./views/AuditsView";
import ExecutionView from "./views/ExecutionView";
import FindingsView from "./views/FindingsView";
import ClosureView from "./views/ClosureView";
import ReportsView from "./views/ReportsView";
import FollowUpView from "./views/FollowUpView";
import AdminView from "./views/AdminView";

// ─── Import shared types & components ────────────────────────────────────────
import {
  View, StatusKey, Task,
  STATUS_CONFIG, FONT_STYLE,
  StatusBadge, Breadcrumbs, PageHeader, Card, PrimaryBtn, GhostBtn, SectionCard
} from "./components/shared/SharedComponents";

// ─── Constants ──────────────────────────────────────────────────────────────
type NavSection = {
  label: string;
  items: { id: View; label: string; icon: React.ReactNode; badge?: number }[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Inicio",
    items: [
      { id: "dashboard",  label: "Dashboard",          icon: <LayoutDashboard size={16} />, badge: 3 },
    ]
  },
  {
    label: "Ciclo E2E de Auditoría",
    items: [
      { id: "planning",   label: "Planeación",          icon: <CalendarCheck size={16} /> },
      { id: "audits",     label: "Universo Auditorías", icon: <ClipboardList size={16} /> },
      { id: "execution",  label: "Ejecución",           icon: <ClipboardCheck size={16} /> },
      { id: "findings",   label: "Hallazgos & Planes",  icon: <Target size={16} />,          badge: 5 },
      { id: "closure",    label: "Cierre",              icon: <Lock size={16} /> },
      { id: "reports",    label: "Informes",            icon: <FileBarChart size={16} /> },
      { id: "follow_up",  label: "Seguimiento",         icon: <RotateCcw size={16} />,       badge: 2 },
    ]
  },
  {
    label: "Gestión",
    items: [
      { id: "record",     label: "Riesgos",             icon: <Shield size={16} /> },
      { id: "hierarchy",  label: "Catálogo Org.",       icon: <GitBranch size={16} /> },
    ]
  },
  {
    label: "Configuración",
    items: [
      { id: "admin",      label: "Administración",      icon: <Settings size={16} /> },
    ]
  },
];

const TASKS: Task[] = [
  { id: "T-0041", name: "Revisión controles SOX — Cuentas por pagar",  status: "overdue",     dueDate: "2025-07-15", owner: "M. García",   type: "Auditoría Financiera" },
  { id: "T-0042", name: "Entrevista CISO — Políticas de acceso",        status: "in_progress", dueDate: "2025-07-22", owner: "L. Herrera",  type: "TI & Seguridad"       },
  { id: "T-0043", name: "Pruebas sustantivas — Inventarios Q2",         status: "in_progress", dueDate: "2025-07-28", owner: "P. Morales",  type: "Auditoría Operacional" },
  { id: "T-0044", name: "Cierre hallazgos — Filial Brasil",             status: "pending",     dueDate: "2025-08-05", owner: "A. Costa",    type: "Cumplimiento"          },
  { id: "T-0045", name: "Informe ejecutivo — Riesgo regulatorio LATAM", status: "pending",     dueDate: "2025-08-12", owner: "M. García",   type: "Regulatorio"           },
  { id: "T-0046", name: "Walkthrough — Proceso nómina México",          status: "completed",   dueDate: "2025-07-10", owner: "R. Jiménez",  type: "Auditoría Operacional" },
];

const QUARTERLY_DATA = [
  { quarter: "Q1 2025", completadas: 8,  en_progreso: 3, pendientes: 2, vencidas: 1 },
  { quarter: "Q2 2025", completadas: 11, en_progreso: 4, pendientes: 3, vencidas: 2 },
  { quarter: "Q3 2025", completadas: 5,  en_progreso: 7, pendientes: 5, vencidas: 3 },
  { quarter: "Q4 2025", completadas: 0,  en_progreso: 2, pendientes: 9, vencidas: 0 },
];

const VERTICAL_DATA = [
  { name: "TI & Ciberseg.", mx: 4, br: 3, co: 2 },
  { name: "Financiero",     mx: 6, br: 5, co: 3 },
  { name: "Operacional",    mx: 5, br: 4, co: 4 },
  { name: "Regulatorio",    mx: 3, br: 2, co: 1 },
  { name: "Cumplimiento",   mx: 4, br: 3, co: 2 },
];

const CHART_COLORS = {
  completadas: "#16a34a", en_progreso: "#d97706", pendientes: "#2B6FD4", vencidas: "#C8271C"
};

// ─── Sidebar ────────────────────────────────────────────────────────────────
function Sidebar({ active, onNav }: { active: View; onNav: (v: View) => void }) {
  return (
    <aside className="w-60 min-h-screen bg-sidebar flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-sidebar-primary flex items-center justify-center">
            <Shield size={15} className="text-white" />
          </div>
          <div>
            <div className="text-white text-sm font-bold leading-none tracking-wide">AuditCore</div>
            <div className="text-sidebar-foreground/50 text-[10px] mt-0.5 font-mono uppercase tracking-widest">GRC v4.2</div>
          </div>
        </div>
      </div>

      {/* Role pill */}
      <div className="px-4 py-3 border-b border-sidebar-border">
        <div className="flex items-center gap-2 bg-sidebar-accent rounded-md px-3 py-2">
          <div className="w-6 h-6 rounded-full bg-sidebar-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">MG</div>
          <div className="min-w-0">
            <div className="text-white text-xs font-semibold truncate">María García</div>
            <div className="text-sidebar-foreground/60 text-[10px] truncate">Jefatura de Auditoría</div>
          </div>
        </div>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 py-2 px-3 overflow-y-auto space-y-0.5">
        {NAV_SECTIONS.map((section, si) => (
          <div key={section.label} className={si > 0 ? "pt-2" : ""}>
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 select-none">
              {section.label}
            </div>
            {section.items.map(item => (
              <button
                key={item.id}
                onClick={() => onNav(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left ${
                  active === item.id
                    ? "bg-sidebar-primary text-white"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
                }`}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active === item.id ? "bg-white/20 text-white" : "bg-red-500 text-white"}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-sidebar-border">
        <div className="text-[10px] text-sidebar-foreground/30 text-center font-mono">© 2025 FEMSA · AuditCore</div>
      </div>
    </aside>
  );
}

// ─── Top Bar ────────────────────────────────────────────────────────────────
function TopBar({ viewLabel }: { viewLabel: string }) {
  return (
    <header className="h-12 bg-card border-b border-border flex items-center px-6 gap-4 flex-shrink-0">
      <div className="relative flex-1 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
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
          <span className="font-mono text-xs">Lun 21 Jul 2025</span>
        </div>
      </div>
    </header>
  );
}

// ─── View: DASHBOARD ─────────────────────────────────────────────────────────
function DashboardView({ onNav }: { onNav: (v: View) => void }) {
  const [hours, setHours] = useState("");
  const [hourSaved, setHourSaved] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusKey | "all">("all");

  const saveHours = () => {
    if (!hours) return;
    setHourSaved(true);
    setTimeout(() => setHourSaved(false), 2500);
    setHours("");
  };

  const filteredTasks = statusFilter === "all" ? TASKS : TASKS.filter(t => t.status === statusFilter);

  const kpis = [
    { label: "Auditorías Activas", value: "14", delta: "+2 vs Q anterior", icon: <ClipboardList size={16} />, color: "text-blue-600 bg-blue-50" },
    { label: "Hallazgos Abiertos", value: "38", delta: "7 críticos",        icon: <AlertTriangle size={16} />, color: "text-red-600 bg-red-50"   },
    { label: "Controles Probados", value: "127", delta: "83% aprobados",    icon: <CheckCircle2 size={16} />,  color: "text-emerald-600 bg-emerald-50" },
    { label: "Horas Registradas",  value: "342h", delta: "Este mes",        icon: <Timer size={16} />,          color: "text-purple-600 bg-purple-50" },
  ];

  const quickLinks = [
    { label: "AUD-2025-041 — SOX Financiero",        urgency: "overdue",     desc: "Vencida · Entregable pendiente" },
    { label: "AUD-2025-038 — TI & Ciberseguridad",   urgency: "in_progress", desc: "En progreso · Faltan 6 días" },
    { label: "AUD-2025-035 — Nómina México",          urgency: "pending",     desc: "Inicio en 12 días" },
  ];

  const e2eSteps = [
    { label: "Planeación",  icon: <CalendarCheck size={13} />, view: "planning" as View,  status: "done"   },
    { label: "Auditorías",  icon: <ClipboardList size={13} />, view: "audits" as View,    status: "done"   },
    { label: "Ejecución",   icon: <ClipboardCheck size={13}/>, view: "execution" as View, status: "active" },
    { label: "Hallazgos",   icon: <Target size={13} />,        view: "findings" as View,  status: "active" },
    { label: "Cierre",      icon: <Lock size={13} />,          view: "closure" as View,   status: "pending"},
    { label: "Informes",    icon: <FileBarChart size={13} />,  view: "reports" as View,   status: "pending"},
    { label: "Seguimiento", icon: <RotateCcw size={13} />,     view: "follow_up" as View, status: "pending"},
  ];

  return (
    <div className="flex-1 overflow-auto p-6" style={FONT_STYLE}>
      <Breadcrumbs items={["Inicio", "Dashboard", "Jefatura de Auditoría"]} />
      <PageHeader
        title="Dashboard — Jefatura de Auditoría"
        subtitle="Período activo: Q3 2025 · Última actualización: hace 4 min"
        actions={<PrimaryBtn icon={<Plus size={14} />} onClick={() => onNav("audits")}>Nueva Auditoría</PrimaryBtn>}
      />

      {/* E2E Cycle Quick Nav */}
      <Card className="p-4 mb-5">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Ciclo E2E de Auditoría — Navegación Rápida</div>
        <div className="flex items-center">
          {e2eSteps.map((step, i) => (
            <div key={step.label} className="flex items-center flex-1 min-w-0">
              <button
                onClick={() => onNav(step.view)}
                className={`flex flex-col items-center gap-1 flex-shrink-0 group ${step.status === "active" ? "cursor-pointer" : "cursor-pointer opacity-60 hover:opacity-100"}`}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                  step.status === "done" ? "bg-emerald-500 text-white" :
                  step.status === "active" ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                } group-hover:scale-110 transition-transform`}>
                  {step.status === "done" ? <Check size={14} /> : step.icon}
                </div>
                <div className={`text-[10px] font-semibold text-center ${
                  step.status === "done" ? "text-emerald-600" :
                  step.status === "active" ? "text-primary" : "text-muted-foreground"
                }`}>{step.label}</div>
              </button>
              {i < e2eSteps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 mb-4 ${step.status === "done" ? "bg-emerald-500" : "bg-border"}`} />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {kpis.map(k => (
          <Card key={k.label} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2 rounded-lg ${k.color}`}>{k.icon}</div>
              <TrendingUp size={12} className="text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold text-foreground tracking-tight">{k.value}</div>
            <div className="text-xs font-semibold text-foreground mt-0.5">{k.label}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{k.delta}</div>
          </Card>
        ))}
      </div>

      {/* Quick Access & Hour Log */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="col-span-2">
          <Card>
            <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground">Accesos Rápidos — Registros Urgentes</div>
              <button onClick={() => onNav("audits")} className="text-xs text-accent flex items-center gap-1 hover:underline">Ver todos <ArrowRight size={10} /></button>
            </div>
            <div className="divide-y divide-border">
              {quickLinks.map((link, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 cursor-pointer group transition-colors" onClick={() => onNav("execution")}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_CONFIG[link.urgency as StatusKey].dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">{link.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{link.desc}</div>
                  </div>
                  <StatusBadge status={link.urgency as StatusKey} />
                  <ArrowRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Hour logger */}
        <Card className="p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={15} className="text-primary" />
            <div className="text-sm font-semibold text-foreground">Registro de Horas</div>
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
                type="number" min="0.5" max="24" step="0.5"
                placeholder="Horas (ej. 3.5)"
                value={hours} onChange={e => setHours(e.target.value)}
                className="flex-1 text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
              />
              <button onClick={saveHours}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${hourSaved ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}>
                {hourSaved ? <Check size={16} /> : <Save size={16} />}
              </button>
            </div>
          </div>
          {hourSaved && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 rounded-md px-3 py-2">
              <CheckCircle2 size={12} /><span>Horas registradas correctamente</span>
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-border">
            <div className="text-xs text-muted-foreground">Hoy: <span className="font-semibold text-foreground">4.5h</span> · Semana: <span className="font-semibold text-foreground">22h</span></div>
          </div>
        </Card>
      </div>

      {/* Tasks Table */}
      <Card className="mb-6">
        <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ListTodo size={15} className="text-primary" />
            <div className="text-sm font-semibold text-foreground">Tareas Pendientes</div>
            <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-medium">{TASKS.length}</span>
          </div>
          <div className="flex items-center gap-2">
            {(["all", "overdue", "in_progress", "pending", "completed"] as const).map(f => (
              <button key={f} onClick={() => setStatusFilter(f)}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${statusFilter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
                {f === "all" ? "Todos" : STATUS_CONFIG[f].label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["ID / Nombre", "Tipo", "Responsable", "Estatus", "Fecha Esperada", ""].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTasks.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <CheckCircle2 size={28} className="mx-auto mb-2 text-muted-foreground/40" />
                  <div className="text-sm">No hay tareas con este filtro</div>
                </td></tr>
              )}
              {filteredTasks.map(task => (
                <tr key={task.id} className="hover:bg-secondary/30 cursor-pointer group transition-colors" onClick={() => onNav("execution")}>
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-muted-foreground mb-0.5">{task.id}</div>
                    <div className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">{task.name}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{task.type}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                        {task.owner.split(" ").map(n => n[0]).join("")}
                      </div>
                      <span className="text-xs text-foreground">{task.owner}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={task.status} /></td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-xs ${task.status === "overdue" ? "text-red-600 font-semibold" : "text-muted-foreground"}`}>{task.dueDate}</span>
                  </td>
                  <td className="px-4 py-3">
                    <ArrowRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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
            <div className="text-sm font-semibold text-foreground">Auditorías por Trimestre</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart id="chart-quarterly" data={QUARTERLY_DATA} barSize={12} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: "#5A6A85" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#5A6A85" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 6, fontSize: 12 }} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Bar dataKey="completadas"  name="Completadas"  fill={CHART_COLORS.completadas}  radius={[3,3,0,0]} />
              <Bar dataKey="en_progreso"  name="En Progreso"  fill={CHART_COLORS.en_progreso}  radius={[3,3,0,0]} />
              <Bar dataKey="pendientes"   name="Pendientes"   fill={CHART_COLORS.pendientes}   radius={[3,3,0,0]} />
              <Bar dataKey="vencidas"     name="Vencidas"     fill={CHART_COLORS.vencidas}     radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={15} className="text-primary" />
            <div className="text-sm font-semibold text-foreground">Por Vertical · Entidad Auditada</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart id="chart-vertical" data={VERTICAL_DATA} barSize={14} barGap={3} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#5A6A85" }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#5A6A85" }} axisLine={false} tickLine={false} width={90} />
              <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 6, fontSize: 12 }} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Bar dataKey="mx" name="México"   fill="#1A4FA0" radius={[0,3,3,0]} />
              <Bar dataKey="br" name="Brasil"   fill="#2B6FD4" radius={[0,3,3,0]} />
              <Bar dataKey="co" name="Colombia" fill="#7BA7D9" radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

// ─── Keep existing views inline for remaining 3 (Record, Editor, Hierarchy) ──
// (These are large; we inline them to avoid breaking changes to existing code)
// For brevity and correctness, import the existing logic below:

// We inline minimal stubs referencing actual existing heavy views
// The 3 legacy views (RecordView, EditorView, HierarchyView) remain inside App.tsx
// to preserve 100% of existing functionality. They are reproduced here in full.

type RecordView_StatusKey = StatusKey;

function RecordView() {
  const [lang, setLang] = useState("es");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState("");
  const [openSection, setOpenSection] = useState<string[]>(["ubicacion", "controles"]);

  const toggleSection = (id: string) => {
    setOpenSection(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const generateAI = () => {
    setAiLoading(true); setAiText("");
    setTimeout(() => {
      setAiLoading(false);
      setAiText("Este riesgo corresponde a una exposición crítica en el proceso de cierre financiero de la filial México. Los controles asociados presentan efectividad del 72%. Se recomienda reforzar la segregación de funciones y actualizar la matriz RACI antes de Q4 2025. Hallazgos similares en Brasil sugieren un patrón regional que requiere atención inmediata de la Dirección Regional.");
    }, 1800);
  };

  const controls = [
    { id: "CTR-1041", name: "Segregación de funciones — Cierre contable", status: "in_progress" as StatusKey, owner: "L. Herrera", efectividad: 68 },
    { id: "CTR-1042", name: "Revisión por Dirección Financiera — Mes",    status: "completed"   as StatusKey, owner: "P. Morales", efectividad: 91 },
    { id: "CTR-1043", name: "Conciliación automática bancaria",            status: "overdue"     as StatusKey, owner: "A. Costa",   efectividad: 45 },
  ];

  const infoSections = [
    { id: "ubicacion", label: "Clasificación & Ubicación", fields: [
      { label: "Entidad", value: "Corporativo LATAM" }, { label: "Negocio", value: "Servicios Financieros" },
      { label: "Unidad de Negocio", value: "Banca Corporativa" }, { label: "País", value: "México · MX" },
      { label: "Vertical", value: "Financiero / Contabilidad" }, { label: "Proceso", value: "Cierre Financiero Mensual" },
    ]},
    { id: "evaluacion", label: "Evaluación de Riesgo", fields: [
      { label: "Probabilidad", value: "Alta (4/5)" }, { label: "Impacto", value: "Muy Alto (5/5)" },
      { label: "Riesgo Neto", value: "Crítico — 20/25" }, { label: "Categoría", value: "Riesgo Financiero" },
      { label: "Apetito", value: "Bajo" }, { label: "Última revisión", value: "12 Jun 2025" },
    ]}
  ];

  return (
    <div className="flex-1 overflow-auto p-6" style={FONT_STYLE}>
      <Breadcrumbs items={["Inicio", "Riesgos", "RIE-2025-0187"]} />
      <Card className="mb-5 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1.5">
              <span className="font-mono text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded font-bold">RIE-2025-0187</span>
              <StatusBadge status="in_progress" />
              <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">Crítico</span>
            </div>
            <h1 className="text-lg font-bold text-foreground leading-tight mb-2">Riesgo de Error Material en Cierre Financiero — México</h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
              Posibilidad de que estados financieros consolidados de la filial México contengan errores materiales por debilidades en los controles del proceso de cierre mensual.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <select value={lang} onChange={e => setLang(e.target.value)}
              className="text-xs bg-input-background border border-border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30">
              <option value="es">🇲🇽 Español</option>
              <option value="en">🇺🇸 English</option>
              <option value="pt">🇧🇷 Português</option>
            </select>
            <div className="flex gap-2">
              <GhostBtn small icon={<Eye size={12} />}>Vista previa</GhostBtn>
              <PrimaryBtn small icon={<Save size={12} />}>Guardar</PrimaryBtn>
            </div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-border">
          {!aiText && !aiLoading && (
            <button onClick={generateAI} className="inline-flex items-center gap-2 text-sm font-semibold text-accent border border-accent/30 bg-accent/5 px-4 py-2 rounded-md hover:bg-accent/10 transition-colors">
              <Sparkles size={14} />Generar resumen con IA
            </button>
          )}
          {aiLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 rounded-md px-4 py-3"><Loader2 size={14} className="animate-spin text-primary" />Analizando registros relacionados…</div>}
          {aiText && !aiLoading && (
            <div className="bg-accent/5 border border-accent/20 rounded-md p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-accent mb-2"><Sparkles size={12} />Resumen generado por IA</div>
              <p className="text-sm text-foreground leading-relaxed">{aiText}</p>
              <button onClick={() => setAiText("")} className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"><RefreshCw size={10} />Regenerar</button>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-3">
          {infoSections.map(section => (
            <Card key={section.id}>
              <button onClick={() => toggleSection(section.id)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors rounded-t-lg">
                <div className="text-sm font-semibold text-foreground">{section.label}</div>
                {openSection.includes(section.id) ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
              </button>
              {openSection.includes(section.id) && (
                <div className="px-4 pb-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-3">
                  {section.fields.map(f => (
                    <div key={f.label}>
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{f.label}</div>
                      <div className="text-sm font-semibold text-foreground">{f.value}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
          <Card>
            <button onClick={() => toggleSection("controles")} className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                Controles Relacionados
                <span className="text-xs bg-secondary px-2 py-0.5 rounded-full font-medium text-muted-foreground">{controls.length}</span>
              </div>
              {openSection.includes("controles") ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
            </button>
            {openSection.includes("controles") && (
              <div className="border-t border-border divide-y divide-border">
                {controls.map(ctrl => (
                  <div key={ctrl.id} className="px-4 py-3 hover:bg-secondary/20 cursor-pointer group transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-muted-foreground">{ctrl.id}</span>
                          <StatusBadge status={ctrl.status} />
                        </div>
                        <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{ctrl.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Responsable: {ctrl.owner}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs text-muted-foreground mb-1">Efectividad</div>
                        <div className="text-sm font-bold" style={{ color: ctrl.efectividad >= 80 ? "#16a34a" : ctrl.efectividad >= 60 ? "#d97706" : "#C8271C" }}>{ctrl.efectividad}%</div>
                        <div className="w-16 h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${ctrl.efectividad}%`, background: ctrl.efectividad >= 80 ? "#16a34a" : ctrl.efectividad >= 60 ? "#d97706" : "#C8271C" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="px-4 py-2">
                  <button className="text-xs text-accent flex items-center gap-1 hover:underline"><Plus size={11} />Asociar control existente</button>
                </div>
              </div>
            )}
          </Card>
        </div>
        <div className="space-y-3">
          <Card className="p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Historial de Cambios</div>
            <div className="space-y-3">
              {[{ user: "MG", date: "12 Jul", action: "Actualizó probabilidad a Alta" }, { user: "LH", date: "08 Jul", action: "Añadió control CTR-1043" }, { user: "PM", date: "01 Jul", action: "Creó el registro" }].map((h, i) => (
                <div key={i} className="flex gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[9px] font-bold text-primary flex-shrink-0 mt-0.5">{h.user}</div>
                  <div>
                    <div className="text-xs font-medium text-foreground">{h.action}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{h.date} 2025</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Documentos</div>
            <div className="space-y-2">
              {["Matriz_Riesgo_Q2.xlsx", "Walkthrough_Cierre.pdf", "Evidencia_CTR1041.zip"].map(doc => (
                <div key={doc} className="flex items-center gap-2 p-2 rounded-md hover:bg-secondary cursor-pointer group transition-colors">
                  <FileText size={13} className="text-primary flex-shrink-0" />
                  <span className="text-xs text-foreground group-hover:text-primary truncate transition-colors">{doc}</span>
                </div>
              ))}
              <button className="text-xs text-accent flex items-center gap-1 hover:underline mt-1"><Plus size={11} />Adjuntar documento</button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Editor & Hierarchy views (preserved from original) ──────────────────────
const WIDGET_CATALOG = [
  { id: "kpi",   label: "Tarjeta KPI",      icon: <TrendingUp size={22} />,  desc: "Métrica con delta y tendencia",       color: "bg-blue-50 text-blue-600"    },
  { id: "bar",   label: "Gráfica de Barras",icon: <BarChart3 size={22} />,   desc: "Comparativa por categoría o periodo", color: "bg-violet-50 text-violet-600" },
  { id: "table", label: "Tabla de Tareas",  icon: <ListTodo size={22} />,    desc: "Lista filtrable con estatus visual",  color: "bg-emerald-50 text-emerald-600"},
  { id: "horas", label: "Log de Horas",     icon: <Timer size={22} />,       desc: "Entrada rápida de horas trabajadas",  color: "bg-amber-50 text-amber-600"  },
  { id: "links", label: "Accesos Rápidos",  icon: <ArrowRight size={22} />,  desc: "Links priorizados a registros clave", color: "bg-rose-50 text-rose-600"    },
  { id: "pie",   label: "Gráfica Circular", icon: <PieChart size={22} />,    desc: "Distribución por estado o categoría", color: "bg-cyan-50 text-cyan-600"    },
];

type PlacedWidget = { id: string; widgetId: string; label: string; col: number; row: number; w: number; h: number };

function EditorView() {
  const [placed, setPlaced] = useState<PlacedWidget[]>([
    { id: "p1", widgetId: "kpi", label: "Tarjeta KPI", col: 1, row: 1, w: 2, h: 1 },
    { id: "p2", widgetId: "bar", label: "Gráfica de Barras", col: 3, row: 1, w: 4, h: 2 },
    { id: "p3", widgetId: "table", label: "Tabla de Tareas", col: 1, row: 2, w: 4, h: 2 },
  ]);
  const [selected, setSelected] = useState<PlacedWidget | null>(null);
  const [history, setHistory] = useState<PlacedWidget[][]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const push = (next: PlacedWidget[]) => { setHistory(h => [...h.slice(-20), placed]); setPlaced(next); };
  const undo = () => { if (!history.length) return; const prev = history[history.length - 1]; setHistory(h => h.slice(0, -1)); setPlaced(prev); setSelected(null); };
  const addWidget = (wid: typeof WIDGET_CATALOG[0]) => { const next: PlacedWidget = { id: `p${Date.now()}`, widgetId: wid.id, label: wid.label, col: 1, row: placed.length + 1, w: 3, h: 1 }; push([...placed, next]); setSelected(next); };
  const removeSelected = () => { if (!selected) return; push(placed.filter(p => p.id !== selected.id)); setSelected(null); };
  const updateProp = (field: keyof PlacedWidget, val: number) => { if (!selected) return; const updated = placed.map(p => p.id === selected.id ? { ...p, [field]: val } : p); push(updated); setSelected(s => s ? { ...s, [field]: val } : s); };
  const saveLayout = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={FONT_STYLE}>
      <div className="h-11 bg-card border-b border-border flex items-center px-4 gap-3 flex-shrink-0">
        <Breadcrumbs items={["Dashboard", "Editor de Vistas"]} />
        <div className="flex-1" />
        <button onClick={undo} disabled={!history.length} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-30"><Undo2 size={13} />Deshacer</button>
        <button onClick={saveLayout} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-semibold transition-all ${saved ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}>
          {saved ? <><Check size={13} />Guardado</> : <><Save size={13} />Guardar Vista</>}
        </button>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="w-56 bg-card border-r border-border flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <div className="text-xs font-semibold text-foreground uppercase tracking-wide">Catálogo de Widgets</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Haz clic para añadir al canvas</div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {WIDGET_CATALOG.map(wid => (
              <button key={wid.id} onClick={() => addWidget(wid)} className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-secondary/50 transition-all group">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${wid.color}`}>{wid.icon}</div>
                <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{wid.label}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{wid.desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-auto p-5 bg-muted/40">
          <div className="text-xs text-muted-foreground mb-3 flex items-center gap-2"><Maximize2 size={11} />Canvas — 12 columnas · Snap a cuadrícula</div>
          <div className="relative bg-card rounded-xl border-2 border-dashed border-border min-h-96 overflow-hidden" style={{ backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)", backgroundSize: "28px 28px" }}>
            {placed.length === 0 && <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8"><Layers size={32} className="text-muted-foreground/40 mb-3" /><div className="text-sm font-semibold text-muted-foreground">Canvas vacío</div></div>}
            <div className="p-4 grid grid-cols-6 gap-3 auto-rows-min">
              {placed.map(pw => {
                const wdef = WIDGET_CATALOG.find(w => w.id === pw.widgetId);
                const isSelected = selected?.id === pw.id;
                return (
                  <div key={pw.id} onClick={() => setSelected(isSelected ? null : pw)} draggable onDragStart={() => setDragging(pw.id)} onDragEnd={() => setDragging(null)}
                    style={{ gridColumn: `span ${Math.min(pw.w, 6)}`, gridRow: `span ${pw.h}` }}
                    className={`relative rounded-lg border-2 p-3 cursor-pointer transition-all min-h-20 flex flex-col ${isSelected ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" : dragging === pw.id ? "border-accent/60 bg-accent/5 opacity-70" : "border-border bg-white hover:border-primary/30 hover:shadow-sm"}`}>
                    <div className="flex items-start gap-2 mb-2">
                      <GripVertical size={13} className="text-muted-foreground/40 mt-0.5 flex-shrink-0" />
                      <div className={`p-1.5 rounded ${wdef?.color ?? ""}`}>{wdef?.icon && <div className="scale-75">{wdef.icon}</div>}</div>
                      <div className="text-xs font-semibold text-foreground flex-1">{pw.label}</div>
                      {isSelected && <button onClick={e => { e.stopPropagation(); removeSelected(); }} className="text-muted-foreground hover:text-red-500 transition-colors"><X size={13} /></button>}
                    </div>
                    <div className="flex-1 rounded bg-muted/40 flex items-center justify-center"><span className="text-[10px] text-muted-foreground/50">Vista previa</span></div>
                    {isSelected && <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-primary rounded-full ring-2 ring-white" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="w-56 bg-card border-l border-border flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <div className="text-xs font-semibold text-foreground uppercase tracking-wide">Propiedades</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{selected ? selected.label : "Selecciona un widget"}</div>
          </div>
          {selected ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5"><AlignLeft size={10} />Contenido</div>
                <div className="space-y-2">
                  <div><label className="text-xs text-muted-foreground block mb-1">Etiqueta</label><input defaultValue={selected.label} className="w-full text-xs bg-input-background border border-border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30" /></div>
                  <div><label className="text-xs text-muted-foreground block mb-1">Fuente de datos</label>
                    <select className="w-full text-xs bg-input-background border border-border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30">
                      <option>Auditorías activas</option><option>Hallazgos abiertos</option><option>Horas registradas</option>
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5"><Palette size={10} />Estilo</div>
                <div className="flex gap-1.5">{["#1A4FA0","#16a34a","#d97706","#C8271C","#7C3AED"].map(c => (<button key={c} className="w-5 h-5 rounded-full border-2 border-white ring-1 ring-border hover:ring-primary transition-all" style={{ background: c }} />))}</div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5"><Maximize2 size={10} />Tamaño</div>
                <div className="space-y-2">
                  <div><label className="text-xs text-muted-foreground block mb-1">Ancho (columnas)</label>
                    <div className="flex gap-1">{[1,2,3,4,5,6].map(n => (<button key={n} onClick={() => updateProp("w", n)} className={`flex-1 py-1 text-[10px] rounded font-medium transition-colors ${selected.w === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"}`}>{n}</button>))}</div>
                  </div>
                  <div><label className="text-xs text-muted-foreground block mb-1">Alto (filas)</label>
                    <div className="flex gap-1">{[1,2,3].map(n => (<button key={n} onClick={() => updateProp("h", n)} className={`flex-1 py-1 text-[10px] rounded font-medium transition-colors ${selected.h === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"}`}>{n}</button>))}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center"><Layers size={28} className="text-muted-foreground/30 mb-3" /><div className="text-xs text-muted-foreground">Haz clic en un widget del canvas para editar sus propiedades</div></div>
          )}
        </div>
      </div>
    </div>
  );
}

// Hierarchy view (preserved from original)
type TreeNode = { id: string; label: string; type: string; children?: TreeNode[]; risks?: number; hasCritical?: boolean; };
const TREE: TreeNode[] = [
  { id: "n1", label: "Servicios Financieros", type: "Negocio", risks: 14, hasCritical: true, children: [
    { id: "n1-1", label: "Banca Corporativa", type: "Unidad de Negocio", risks: 8, hasCritical: true, children: [
      { id: "n1-1-1", label: "División Crédito Empresarial", type: "División", risks: 5, hasCritical: true, children: [
        { id: "n1-1-1-1", label: "Área de Riesgo Crediticio", type: "Área", risks: 3, hasCritical: true, children: [
          { id: "n1-1-1-1-1", label: "México", type: "País", risks: 2, hasCritical: true },
          { id: "n1-1-1-1-2", label: "Colombia", type: "País", risks: 1, hasCritical: false },
        ]},
        { id: "n1-1-1-2", label: "Área de Tesorería", type: "Área", risks: 0, hasCritical: false },
      ]}
    ]},
    { id: "n1-2", label: "Banca Personas", type: "Unidad de Negocio", risks: 6, hasCritical: false, children: [
      { id: "n1-2-1", label: "División Productos Digitales", type: "División", risks: 4, hasCritical: false, children: [
        { id: "n1-2-1-1", label: "Área de Pagos", type: "Área", risks: 2, hasCritical: false, children: [
          { id: "n1-2-1-1-1", label: "Brasil", type: "País", risks: 2, hasCritical: false },
        ]}
      ]}
    ]}
  ]},
  { id: "n2", label: "Tecnología & Operaciones", type: "Negocio", risks: 11, hasCritical: false, children: [
    { id: "n2-1", label: "Infraestructura TI", type: "Unidad de Negocio", risks: 6, hasCritical: false, children: [
      { id: "n2-1-1", label: "División Ciberseguridad", type: "División", risks: 4, hasCritical: false, children: [
        { id: "n2-1-1-1", label: "Área de SOC", type: "Área", risks: 3, hasCritical: false, children: [
          { id: "n2-1-1-1-1", label: "Argentina", type: "País", risks: 3, hasCritical: false },
        ]}
      ]}
    ]},
    { id: "n2-2", label: "Operaciones LATAM", type: "Unidad de Negocio", risks: 5, hasCritical: false, children: [
      { id: "n2-2-1", label: "División Procesos", type: "División", risks: 5, hasCritical: false, children: [
        { id: "n2-2-1-1", label: "Área de Back-Office", type: "Área", risks: 2, hasCritical: false, children: [
          { id: "n2-2-1-1-1", label: "Chile", type: "País", risks: 2, hasCritical: false },
        ]}
      ]}
    ]}
  ]},
  { id: "n3", label: "Cumplimiento & Legal", type: "Negocio", risks: 7, hasCritical: false, children: [
    { id: "n3-1", label: "Regulatorio LATAM", type: "Unidad de Negocio", risks: 7, hasCritical: false, children: [
      { id: "n3-1-1", label: "División Normativa", type: "División", risks: 7, hasCritical: false, children: [
        { id: "n3-1-1-1", label: "Área de Compliance", type: "Área", risks: 4, hasCritical: false, children: [
          { id: "n3-1-1-1-1", label: "Perú", type: "País", risks: 2, hasCritical: false },
          { id: "n3-1-1-1-2", label: "Uruguay", type: "País", risks: 2, hasCritical: false },
        ]}
      ]}
    ]}
  ]}
];
const RISK_TABLE_ALL = [
  { id: "RIE-0187", name: "Error Material — Cierre Financiero",      nivel: "Crítico", status: "in_progress" as StatusKey, area: "Banca Corporativa",   pais: "México"   },
  { id: "RIE-0188", name: "Acceso no autorizado a datos sensibles",  nivel: "Alto",    status: "overdue"     as StatusKey, area: "Infraestructura TI",  pais: "Brasil"   },
  { id: "RIE-0190", name: "Concentración de contraparte — Crédito",  nivel: "Medio",   status: "pending"     as StatusKey, area: "Banca Corporativa",   pais: "Colombia" },
  { id: "RIE-0192", name: "Incumplimiento GDPR en app móvil",        nivel: "Alto",    status: "in_progress" as StatusKey, area: "Productos Digitales", pais: "Brasil"   },
  { id: "RIE-0193", name: "Falta de segregación — Tesorería",        nivel: "Medio",   status: "pending"     as StatusKey, area: "Banca Corporativa",   pais: "México"   },
  { id: "RIE-0194", name: "Brecha de política BYOD — SOC",           nivel: "Bajo",    status: "completed"   as StatusKey, area: "Infraestructura TI",  pais: "Argentina"},
  { id: "RIE-0195", name: "Incumplimiento normativa local — SUNAT",  nivel: "Alto",    status: "in_progress" as StatusKey, area: "Regulatorio LATAM",   pais: "Perú"     },
  { id: "RIE-0196", name: "Control KYC desactualizado",              nivel: "Medio",   status: "pending"     as StatusKey, area: "Cumplimiento & Legal", pais: "Uruguay"  },
  { id: "RIE-0197", name: "Retrasos en reconciliación — Back-Office",nivel: "Bajo",    status: "in_progress" as StatusKey, area: "Operaciones LATAM",   pais: "Chile"    },
  { id: "RIE-0198", name: "Configuración firewall — Colombia",       nivel: "Alto",    status: "overdue"     as StatusKey, area: "Infraestructura TI",  pais: "Colombia" },
];

const NIVEL_COLOR_H: Record<string, string> = {
  Crítico: "text-red-700 bg-red-50 border border-red-200",
  Alto:    "text-orange-700 bg-orange-50 border border-orange-200",
  Medio:   "text-amber-700 bg-amber-50 border border-amber-200",
  Bajo:    "text-emerald-700 bg-emerald-50 border border-emerald-200",
};
const TYPE_COLORS_H: Record<string, string> = {
  "Negocio": "bg-blue-100 text-blue-700", "Unidad de Negocio": "bg-violet-100 text-violet-700",
  "División": "bg-emerald-100 text-emerald-700", "Área": "bg-amber-100 text-amber-700", "País": "bg-slate-100 text-slate-600",
};

function riskColorH(node: TreeNode) {
  if (node.hasCritical || (node.risks ?? 0) >= 6) return { stripe: "bg-red-500", badge: "bg-red-50 text-red-700 border border-red-200", dot: "bg-red-500", label: "Crítico" };
  if ((node.risks ?? 0) >= 3) return { stripe: "bg-amber-400", badge: "bg-amber-50 text-amber-700 border border-amber-200", dot: "bg-amber-400", label: "Alto" };
  if ((node.risks ?? 0) >= 1) return { stripe: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500", label: "Normal" };
  return { stripe: "bg-slate-300", badge: "bg-slate-50 text-slate-500 border border-slate-200", dot: "bg-slate-300", label: "Sin riesgos" };
}

function flattenTreeH(nodes: TreeNode[], ancestors: TreeNode[] = []): { node: TreeNode; path: TreeNode[] }[] {
  return nodes.flatMap(n => [{ node: n, path: ancestors }, ...flattenTreeH(n.children ?? [], [...ancestors, n])]);
}
function collectLabelsH(node: TreeNode): string[] { return [node.label, ...(node.children ?? []).flatMap(collectLabelsH)]; }
const ALL_NODES_H = flattenTreeH(TREE);

function HierarchyView() {
  const [path, setPath] = useState<TreeNode[]>([]);
  const [viewMode, setViewMode] = useState<"cards" | "tree">("cards");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [nivelFilter, setNivelFilter] = useState<string>("all");
  const [treeExpanded, setTreeExpanded] = useState<Set<string>>(new Set(["n1","n2","n3"]));

  const currentNode = path.length > 0 ? path[path.length - 1] : null;
  const currentChildren: TreeNode[] = currentNode ? (currentNode.children ?? []) : TREE;
  const isLeaf = currentChildren.length === 0;
  const drillInto = (node: TreeNode) => { setPath([...path, node]); setNivelFilter("all"); setSearch(""); setSearchFocused(false); };
  const jumpToLevel = (index: number) => { setPath(path.slice(0, index + 1)); setNivelFilter("all"); };
  const goRoot = () => { setPath([]); setNivelFilter("all"); };
  const searchResults = search.trim().length >= 1 ? ALL_NODES_H.filter(({ node }) => node.label.toLowerCase().includes(search.toLowerCase())).slice(0, 7) : [];
  const jumpToNode = (entry: { node: TreeNode; path: TreeNode[] }) => { setPath([...entry.path, entry.node]); setSearch(""); setSearchFocused(false); setNivelFilter("all"); };
  const nodeLabels = currentNode ? collectLabelsH(currentNode) : [];
  const baseRisks = isLeaf && currentNode ? RISK_TABLE_ALL.filter(r => nodeLabels.some(l => r.pais === l || r.area.includes(l))) : RISK_TABLE_ALL;
  const filteredRisks = nivelFilter === "all" ? baseRisks : baseRisks.filter(r => r.nivel === nivelFilter);
  const toggleTreeNode = (id: string) => { setTreeExpanded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; }); };

  return (
    <div className="flex-1 overflow-auto flex flex-col" style={FONT_STYLE}>
      <div className="px-6 pt-5 pb-0 flex-shrink-0">
        <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
          <span className="hover:text-foreground cursor-pointer transition-colors">Inicio</span>
          <ChevronRight size={11} className="text-muted-foreground/40" />
          <span className="text-foreground font-medium">Catálogo Organizacional</span>
        </nav>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Catálogo Organizacional</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Navega la estructura corporativa y consulta los riesgos de cada entidad</p>
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button onClick={() => setViewMode("cards")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${viewMode === "cards" ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><Layers size={12} />Vista de tarjetas</button>
            <button onClick={() => setViewMode("tree")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${viewMode === "tree" ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><GitBranch size={12} />Vista de árbol</button>
          </div>
        </div>
        <div className="relative mb-4 max-w-xl">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} onFocus={() => setSearchFocused(true)} onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            placeholder="Buscar entidad… ej. Brasil, División Ciberseguridad"
            className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 shadow-sm placeholder:text-muted-foreground" />
          {searchFocused && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 overflow-hidden">
              {searchResults.map(({ node, path: nodePath }) => {
                const col = riskColorH(node);
                return (
                  <button key={node.id} onMouseDown={() => jumpToNode({ node, path: nodePath })} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/60 text-left transition-colors border-b border-border/50 last:border-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${col.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground">{node.label}</div>
                      <div className="text-xs text-muted-foreground truncate">{nodePath.map(p => p.label).join(" › ")}{nodePath.length > 0 && " › "}<span className="font-medium">{node.label}</span></div>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${TYPE_COLORS_H[node.type]}`}>{node.type}</span>
                    {(node.risks ?? 0) > 0 && <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${col.badge}`}>{node.risks} riesgos</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {viewMode === "cards" && (
          <div className="flex items-center gap-1 flex-wrap mb-5">
            <button onClick={goRoot} className={`text-sm px-2 py-0.5 rounded transition-colors ${path.length === 0 ? "font-bold text-primary" : "text-muted-foreground hover:text-foreground"}`}>Todos los negocios</button>
            {path.map((node, i) => (
              <span key={node.id} className="flex items-center gap-1">
                <ChevronRight size={13} className="text-muted-foreground/50" />
                <button onClick={() => jumpToLevel(i)} className={`text-sm px-2 py-0.5 rounded transition-colors ${i === path.length - 1 ? "font-bold text-primary bg-primary/8" : "text-muted-foreground hover:text-foreground"}`}>{node.label}</button>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-auto px-6 pb-6">
        {viewMode === "tree" && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-muted-foreground font-medium">Vista completa de la jerarquía</div>
              <div className="flex gap-1.5">
                <button onClick={() => setTreeExpanded(new Set(["n1","n1-1","n1-1-1","n1-1-1-1","n1-2","n1-2-1","n1-2-1-1","n2","n2-1","n2-1-1","n2-2","n2-2-1","n3","n3-1","n3-1-1"]))} className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground hover:bg-secondary transition-colors">Expandir todo</button>
                <button onClick={() => setTreeExpanded(new Set())} className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground hover:bg-secondary transition-colors">Colapsar</button>
              </div>
            </div>
            <div className="space-y-0.5">
              {TREE.map(n => {
                const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
                  const isOpen = treeExpanded.has(node.id);
                  const hasChildren = !!node.children?.length;
                  const col = riskColorH(node);
                  return (
                    <div key={node.id}>
                      <div className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-secondary/50 cursor-pointer group" style={{ paddingLeft: `${8 + depth * 18}px` }} onClick={() => hasChildren ? toggleTreeNode(node.id) : undefined}>
                        <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                          {hasChildren ? (isOpen ? <ChevronDown size={13} className="text-muted-foreground" /> : <ChevronRight size={13} className="text-muted-foreground" />) : <Circle size={4} className="text-muted-foreground/50" />}
                        </div>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${TYPE_COLORS_H[node.type] ?? "bg-gray-100 text-gray-600"}`}>{node.type}</span>
                        <span className="text-sm font-medium text-foreground flex-1 group-hover:text-primary transition-colors">{node.label}</span>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${col.dot}`} />
                        {node.risks !== undefined && node.risks > 0 && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded font-mono ${col.badge}`}>{node.risks}</span>}
                      </div>
                      {isOpen && node.children?.map(c => renderNode(c, depth + 1))}
                    </div>
                  );
                };
                return renderNode(n, 0);
              })}
            </div>
          </Card>
        )}
        {viewMode === "cards" && (
          <>
            {!isLeaf && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{currentNode ? `${currentChildren[0]?.type ?? "Nodo"}s en ${currentNode.label}` : "Unidades de Negocio"}</div>
                  <div className="text-xs text-muted-foreground">{currentChildren.length} entidades</div>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {currentChildren.map(node => {
                    const col = riskColorH(node);
                    const hasKids = !!node.children?.length;
                    return (
                      <button key={node.id} onClick={() => drillInto(node)} className="text-left bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-md transition-all group">
                        <div className={`h-1.5 w-full ${col.stripe}`} />
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded mb-1.5 inline-block ${TYPE_COLORS_H[node.type] ?? ""}`}>{node.type}</span>
                              <div className="text-base font-bold text-foreground leading-tight group-hover:text-primary transition-colors">{node.label}</div>
                            </div>
                            <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${col.badge}`}>{col.label}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-foreground leading-none">{node.risks ?? 0}</div>
                              <div className="text-[10px] text-muted-foreground">riesgos</div>
                            </div>
                          </div>
                          {hasKids && <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-1 text-xs text-muted-foreground"><span>{node.children!.length} {node.children![0]?.type ?? "sub-entidades"}{node.children!.length > 1 ? "s" : ""}</span><span className="ml-auto text-primary font-medium group-hover:underline">Ver detalle →</span></div>}
                          {!hasKids && <div className="mt-3 pt-3 border-t border-border/60 text-xs text-primary font-medium group-hover:underline">Ver riesgos asociados →</div>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            {(isLeaf || path.length > 0) && (
              <Card>
                <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <Shield size={15} className="text-primary flex-shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-foreground">Riesgos {currentNode ? `— ${currentNode.label}` : ""}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{isLeaf ? "Nivel final de la jerarquía" : "Todos los riesgos de esta rama"}</div>
                    </div>
                    <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-semibold">{filteredRisks.length}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Filter size={12} className="text-muted-foreground" />
                    {(["all","Crítico","Alto","Medio","Bajo"] as const).map(f => (
                      <button key={f} onClick={() => setNivelFilter(f)} className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${nivelFilter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>{f === "all" ? "Todos" : f}</button>
                    ))}
                  </div>
                </div>
                {filteredRisks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                    <div className="relative w-16 h-16 mb-4"><div className="absolute inset-0 rounded-full bg-emerald-50 border-2 border-emerald-200" /><CheckCircle2 size={28} className="absolute inset-0 m-auto text-emerald-500" /></div>
                    <div className="text-base font-bold text-foreground mb-1">Sin riesgos registrados</div>
                    <div className="text-sm text-muted-foreground max-w-xs">{nivelFilter !== "all" ? `No hay riesgos de nivel "${nivelFilter}". Prueba otro filtro.` : "Esta entidad no tiene riesgos registrados. ¡Bien!"}</div>
                    {nivelFilter !== "all" && <button onClick={() => setNivelFilter("all")} className="mt-3 text-xs text-accent font-semibold hover:underline">Ver todos los niveles</button>}
                  </div>
                ) : (
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-border bg-muted/30">{["ID / Riesgo","Nivel","Área","País","Estatus"].map(h => <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>)}</tr></thead>
                      <tbody className="divide-y divide-border">
                        {filteredRisks.map(r => (
                          <tr key={r.id} className="hover:bg-secondary/30 cursor-pointer group transition-colors">
                            <td className="px-4 py-3"><div className="font-mono text-xs text-muted-foreground mb-0.5">{r.id}</div><div className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">{r.name}</div></td>
                            <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${NIVEL_COLOR_H[r.nivel]}`}>{r.nivel}</span></td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{r.area}</td>
                            <td className="px-4 py-3 text-xs font-medium text-muted-foreground">{r.pais}</td>
                            <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Root App ────────────────────────────────────────────────────────────────
const VIEW_LABELS: Record<View, string> = {
  dashboard: "Dashboard", planning: "Planeación", audits: "Universo de Auditorías",
  execution: "Ejecución", findings: "Hallazgos & Planes", closure: "Cierre",
  reports: "Informes", follow_up: "Seguimiento",
  record: "Riesgos", editor: "Editor de Vistas", hierarchy: "Catálogo Organizacional",
  admin: "Administración"
};

export default function App() {
  const [view, setView] = useState<View>("dashboard");

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background" style={FONT_STYLE}>
      <Sidebar active={view} onNav={setView} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar viewLabel={VIEW_LABELS[view]} />
        {view === "dashboard"  && <DashboardView onNav={setView} />}
        {view === "planning"   && <PlanningView />}
        {view === "audits"     && <AuditsView onExecute={() => setView("execution")} />}
        {view === "execution"  && <ExecutionView />}
        {view === "findings"   && <FindingsView />}
        {view === "closure"    && <ClosureView />}
        {view === "reports"    && <ReportsView />}
        {view === "follow_up"  && <FollowUpView />}
        {view === "record"     && <RecordView />}
        {view === "editor"     && <EditorView />}
        {view === "hierarchy"  && <HierarchyView />}
        {view === "admin"      && <AdminView />}
      </div>
    </div>
  );
}
