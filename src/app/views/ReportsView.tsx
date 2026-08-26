import { useState } from "react";
import {
  FileText, Download, Share2, Filter, BarChart3, PieChart,
  TrendingUp, Clock, Users, Search, Eye, ChevronRight,
  RefreshCw, Check
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart as RechartPie, Pie, Cell, LineChart, Line
} from "recharts";
import {
  Breadcrumbs, PageHeader, Card, SectionCard, PrimaryBtn, GhostBtn,
  StatusBadge, ProgressBar, FONT_STYLE
} from "../components/shared/SharedComponents";

// ─── Data ─────────────────────────────────────────────────────────────────────
const REPORT_TEMPLATES = [
  { id: "exec",     label: "Resumen Ejecutivo",          icon: <BarChart3 size={22} />,   desc: "Visión consolidada para alta dirección",           color: "bg-blue-50 text-blue-600"   },
  { id: "findings", label: "Informe de Hallazgos",       icon: <FileText size={22} />,    desc: "Detalle completo de hallazgos y planes de acción", color: "bg-red-50 text-red-600"     },
  { id: "controls", label: "Efectividad de Controles",   icon: <TrendingUp size={22} />,  desc: "Matriz de madurez y efectividad por proceso",      color: "bg-emerald-50 text-emerald-600" },
  { id: "hours",    label: "Utilización de Recursos",    icon: <Clock size={22} />,       desc: "Horas auditadas vs presupuesto por compromiso",    color: "bg-amber-50 text-amber-600" },
  { id: "progress", label: "Avance Operativo",           icon: <Users size={22} />,       desc: "Estado de auditorías activas y cerradas",          color: "bg-violet-50 text-violet-600"},
  { id: "historic", label: "Comparativo Histórico",      icon: <PieChart size={22} />,    desc: "Tendencias 2023–2025 por vertical y geografía",    color: "bg-cyan-50 text-cyan-600"   },
];

const QUARTERLY_DATA = [
  { quarter: "Q1 2025", completadas: 8,  en_progreso: 3, pendientes: 2, vencidas: 1 },
  { quarter: "Q2 2025", completadas: 11, en_progreso: 4, pendientes: 3, vencidas: 2 },
  { quarter: "Q3 2025", completadas: 5,  en_progreso: 7, pendientes: 5, vencidas: 3 },
  { quarter: "Q4 2025", completadas: 0,  en_progreso: 2, pendientes: 9, vencidas: 0 },
];

const RISK_DIST = [
  { name: "Crítico", value: 3, color: "#C8271C" },
  { name: "Alto",    value: 8, color: "#d97706" },
  { name: "Medio",   value: 15, color: "#eab308" },
  { name: "Bajo",    value: 4, color: "#16a34a" },
];

const HOURS_DATA = [
  { audit: "AUD-041", budget: 120, used: 98,  extra: 0 },
  { audit: "AUD-038", budget: 80,  used: 65,  extra: 0 },
  { audit: "AUD-035", budget: 100, used: 10,  extra: 0 },
  { audit: "AUD-031", budget: 70,  used: 72,  extra: 2 },
  { audit: "AUD-028", budget: 60,  used: 58,  extra: 0 },
];

const TREND_DATA = [
  { month: "Ene", hallazgos: 12, controles: 40, cerradas: 3 },
  { month: "Feb", hallazgos: 8,  controles: 45, cerradas: 4 },
  { month: "Mar", hallazgos: 15, controles: 38, cerradas: 2 },
  { month: "Abr", hallazgos: 10, controles: 50, cerradas: 5 },
  { month: "May", hallazgos: 7,  controles: 55, cerradas: 3 },
  { month: "Jun", hallazgos: 9,  controles: 48, cerradas: 4 },
  { month: "Jul", hallazgos: 12, controles: 52, cerradas: 2 },
];

const QUICK_QUERIES = [
  { label: "Auditorías vencidas en Q3", tag: "overdue" },
  { label: "Hallazgos críticos sin plan", tag: "critical" },
  { label: "Controles con efectividad < 60%", tag: "low-eff" },
  { label: "Presupuesto excedido", tag: "budget" },
];

const CHART_COLORS = {
  completadas: "#16a34a", en_progreso: "#d97706", pendientes: "#2B6FD4", vencidas: "#C8271C"
};

export default function ReportsView() {
  const [selectedReport, setSelectedReport] = useState("exec");
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ from: "2025-01-01", to: "2025-12-31" });
  const [buFilter, setBuFilter] = useState("Todos");

  const handleExport = (format: string) => {
    setExporting(format);
    setTimeout(() => setExporting(null), 2000);
  };

  return (
    <div className="flex-1 overflow-auto p-6" style={FONT_STYLE}>
      <Breadcrumbs items={["Inicio", "Informes", "Centro de Reportes"]} />
      <PageHeader
        title="Centro de Informes & Reportes"
        subtitle="Generación automatizada de informes y analítica de gestión"
        actions={
          <div className="flex gap-2">
            <GhostBtn small icon={<Share2 size={12} />}>Compartir</GhostBtn>
            <div className="flex gap-1">
              {["PDF", "Excel", "PowerBI"].map(fmt => (
                <button key={fmt} onClick={() => handleExport(fmt)}
                  className={`text-xs px-3 py-1.5 rounded-md font-semibold border transition-all ${
                    exporting === fmt
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "border-border text-foreground hover:bg-secondary"
                  }`}>
                  {exporting === fmt ? <><Check size={11} className="inline mr-1" />Exportado</> : fmt}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-4 gap-5">
        {/* Left sidebar: template selector + filters */}
        <div className="space-y-4">
          <Card>
            <div className="px-3 py-2.5 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">Plantillas de Reporte</div>
            <div className="p-2 space-y-1">
              {REPORT_TEMPLATES.map(t => (
                <button key={t.id} onClick={() => setSelectedReport(t.id)}
                  className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left transition-all ${
                    selectedReport === t.id ? "bg-primary/8 border border-primary/20" : "hover:bg-secondary/50"
                  }`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${t.color}`}>
                    {t.icon}
                  </div>
                  <div className="min-w-0">
                    <div className={`text-xs font-semibold ${selectedReport === t.id ? "text-primary" : "text-foreground"}`}>{t.label}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{t.desc}</div>
                  </div>
                  {selectedReport === t.id && <ChevronRight size={12} className="text-primary flex-shrink-0 mt-1" />}
                </button>
              ))}
            </div>
          </Card>

          {/* Filters */}
          <Card className="p-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Filtros</div>
            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Período</label>
                <input type="date" value={dateRange.from} onChange={e => setDateRange(p => ({ ...p, from: e.target.value }))}
                  className="w-full text-xs bg-input-background border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30 mb-1" />
                <input type="date" value={dateRange.to} onChange={e => setDateRange(p => ({ ...p, to: e.target.value }))}
                  className="w-full text-xs bg-input-background border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Unidad de Negocio</label>
                <select value={buFilter} onChange={e => setBuFilter(e.target.value)}
                  className="w-full text-xs bg-input-background border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30">
                  {["Todos","Servicios Financieros","Infraestructura TI","Productos Digitales","Regulatorio LATAM"].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Nivel de Riesgo</label>
                <select className="w-full text-xs bg-input-background border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30">
                  {["Todos","Crítico","Alto","Medio","Bajo"].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </Card>

          {/* Quick queries */}
          <Card className="p-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Consultas Rápidas</div>
            <div className="space-y-1">
              {QUICK_QUERIES.map(q => (
                <button key={q.tag} onClick={() => setActiveQuery(activeQuery === q.tag ? null : q.tag)}
                  className={`w-full text-left text-xs px-2.5 py-2 rounded-md transition-colors flex items-center gap-2 ${
                    activeQuery === q.tag ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:bg-secondary"
                  }`}>
                  <Search size={10} className="flex-shrink-0" />{q.label}
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Main: Report preview */}
        <div className="col-span-3 space-y-4">
          {/* Report header */}
          <Card className="p-5 border-l-4 border-primary">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-muted-foreground font-mono mb-1">FEMSA Servicios · Auditoría Interna</div>
                <div className="text-lg font-bold text-foreground">
                  {REPORT_TEMPLATES.find(t => t.id === selectedReport)?.label}
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">Período: {dateRange.from} — {dateRange.to} · {buFilter}</div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <RefreshCw size={11} />Actualizado: hace 2 min
              </div>
            </div>
          </Card>

          {/* KPI tiles */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Auditorías Activas", value: "14", sub: "+2 vs Q ant.", color: "text-primary" },
              { label: "Hallazgos Abiertos", value: "38", sub: "7 críticos", color: "text-red-600" },
              { label: "Controles Probados", value: "127", sub: "83% aprobados", color: "text-emerald-600" },
              { label: "Horas Registradas", value: "342h", sub: "Mes en curso", color: "text-violet-600" },
            ].map(k => (
              <Card key={k.label} className="p-3">
                <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
                <div className="text-xs font-semibold text-foreground mt-0.5">{k.label}</div>
                <div className="text-[10px] text-muted-foreground">{k.sub}</div>
              </Card>
            ))}
          </div>

          {/* Charts grid — varies by selected report */}
          <div className="grid grid-cols-2 gap-4">
            {/* Quarterly bar */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={14} className="text-primary" />
                <div className="text-sm font-semibold text-foreground">Auditorías por Trimestre</div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={QUARTERLY_DATA} barSize={10} barGap={3}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                  <XAxis dataKey="quarter" tick={{ fontSize: 10, fill: "#5A6A85" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#5A6A85" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 6, fontSize: 11 }} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
                  <Bar dataKey="completadas" name="Completadas" fill={CHART_COLORS.completadas} radius={[3,3,0,0]} />
                  <Bar dataKey="en_progreso" name="En Progreso" fill={CHART_COLORS.en_progreso} radius={[3,3,0,0]} />
                  <Bar dataKey="pendientes"  name="Pendientes"  fill={CHART_COLORS.pendientes}  radius={[3,3,0,0]} />
                  <Bar dataKey="vencidas"    name="Vencidas"    fill={CHART_COLORS.vencidas}    radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Risk distribution pie */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <PieChart size={14} className="text-primary" />
                <div className="text-sm font-semibold text-foreground">Distribución de Riesgo</div>
              </div>
              <div className="flex items-center justify-center gap-6">
                <ResponsiveContainer width="55%" height={200}>
                  <RechartPie>
                    <Pie data={RISK_DIST} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value">
                      {RISK_DIST.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 6, fontSize: 11 }} />
                  </RechartPie>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {RISK_DIST.map(d => (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: d.color }} />
                      <span className="text-xs text-foreground">{d.name}</span>
                      <span className="text-xs font-bold text-foreground ml-auto">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Trend line */}
            <Card className="p-4 col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={14} className="text-primary" />
                <div className="text-sm font-semibold text-foreground">Tendencia Mensual — Hallazgos & Controles</div>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={TREND_DATA}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#5A6A85" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#5A6A85" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 6, fontSize: 11 }} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="hallazgos" name="Hallazgos" stroke="#C8271C" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="controles"  name="Controles" stroke="#1A4FA0" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="cerradas"   name="Cerradas"  stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Hours utilization */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className="text-primary" />
              <div className="text-sm font-semibold text-foreground">Utilización de Horas — Top 5 Compromisos</div>
            </div>
            <div className="space-y-3">
              {HOURS_DATA.map(h => (
                <div key={h.audit} className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground w-20">{h.audit}</span>
                  <div className="flex-1">
                    <ProgressBar value={h.used} max={h.budget}
                      color={h.used > h.budget ? "#C8271C" : h.used / h.budget > 0.9 ? "#d97706" : "#1A4FA0"} />
                  </div>
                  <span className={`text-xs font-semibold w-20 text-right ${h.used > h.budget ? "text-red-600" : "text-muted-foreground"}`}>
                    {h.used}h / {h.budget}h
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Share options */}
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Share2 size={14} className="text-primary" />
              <div className="text-sm font-semibold text-foreground">Compartir Informe</div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {["Dirección de Auditoría", "Área Auditada — SOX", "Comité de Riesgos", "Alta Dirección"].map(recipient => (
                <button key={recipient}
                  className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors flex items-center gap-1">
                  <Share2 size={10} />{recipient}
                </button>
              ))}
              <button className="text-xs px-3 py-1.5 rounded-full border border-dashed border-primary/30 text-primary hover:bg-primary/5 transition-colors">
                + Destinatario personalizado
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
