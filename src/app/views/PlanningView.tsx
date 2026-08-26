import { useState } from "react";
import {
  CalendarDays, Users, Clock, AlertTriangle, ChevronDown, ChevronUp,
  Plus, Save, Check, GripVertical, Flag, BarChart3, Building2, X
} from "lucide-react";
import {
  Breadcrumbs, PageHeader, Card, SectionCard, PrimaryBtn, GhostBtn,
  StatusBadge, ProgressBar, FONT_STYLE, StatusKey
} from "../components/shared/SharedComponents";

// ─── Mock Data ────────────────────────────────────────────────────────────────
const AUDIT_TYPES = ["Auditoría Financiera", "TI & Seguridad", "Auditoría Operacional", "Cumplimiento", "Regulatorio", "Fraude & Ética"];

const AUDITORS = [
  { id: "mg", name: "M. García",  role: "Jefatura",       certs: ["CIA", "CPA"],        hours: 120 },
  { id: "lh", name: "L. Herrera", role: "Gerencia",        certs: ["CISA", "CIA"],       hours: 160 },
  { id: "pm", name: "P. Morales", role: "Auditor Senior",  certs: ["CIA"],               hours: 200 },
  { id: "ac", name: "A. Costa",   role: "Auditor Sr.",     certs: ["CFE"],               hours: 200 },
  { id: "rj", name: "R. Jiménez", role: "Auditor",         certs: ["CPA"],               hours: 180 },
];

interface PlanAudit {
  id: string; name: string; type: string; bu: string; country: string;
  quarter: "Q1" | "Q2" | "Q3" | "Q4"; risk: "Crítico" | "Alto" | "Medio" | "Bajo";
  hoursEst: number; lead: string; status: StatusKey; lastAudit: string;
}

const PLAN_AUDITS: PlanAudit[] = [
  { id: "PA-001", name: "SOX Financiero — Cierre Contable", type: "Auditoría Financiera", bu: "Servicios Financieros", country: "México",    quarter: "Q1", risk: "Crítico", hoursEst: 120, lead: "M. García",  status: "completed",   lastAudit: "2024-Q1" },
  { id: "PA-002", name: "Ciberseguridad — Accesos & IAM",   type: "TI & Seguridad",       bu: "Infraestructura TI",   country: "Brasil",    quarter: "Q1", risk: "Alto",    hoursEst: 80,  lead: "L. Herrera", status: "completed",   lastAudit: "2024-Q2" },
  { id: "PA-003", name: "Inventarios — Bebidas México",     type: "Auditoría Operacional", bu: "Operaciones LATAM",   country: "México",    quarter: "Q2", risk: "Medio",   hoursEst: 100, lead: "P. Morales", status: "in_progress", lastAudit: "2024-Q3" },
  { id: "PA-004", name: "Cumplimiento GDPR — App Digital",  type: "Cumplimiento",          bu: "Productos Digitales", country: "Brasil",    quarter: "Q2", risk: "Alto",    hoursEst: 60,  lead: "A. Costa",   status: "in_progress", lastAudit: "2024-Q2" },
  { id: "PA-005", name: "Regulatorio SUNAT — Perú",         type: "Regulatorio",           bu: "Regulatorio LATAM",   country: "Perú",      quarter: "Q3", risk: "Alto",    hoursEst: 90,  lead: "M. García",  status: "pending",     lastAudit: "2024-Q4" },
  { id: "PA-006", name: "Nómina & Compensaciones — México", type: "Auditoría Operacional", bu: "Banca Corporativa",   country: "México",    quarter: "Q3", risk: "Medio",   hoursEst: 70,  lead: "R. Jiménez", status: "pending",     lastAudit: "2023-Q3" },
  { id: "PA-007", name: "KYC & Prevención Lavado",          type: "Cumplimiento",          bu: "Cumplimiento & Legal", country: "Uruguay",   quarter: "Q3", risk: "Medio",   hoursEst: 80,  lead: "L. Herrera", status: "pending",     lastAudit: "2024-Q1" },
  { id: "PA-008", name: "Cierre Financiero — Colombia",     type: "Auditoría Financiera",  bu: "Servicios Financieros", country: "Colombia", quarter: "Q4", risk: "Medio",   hoursEst: 100, lead: "P. Morales", status: "pending",     lastAudit: "2025-Q1" },
  { id: "PA-009", name: "Infraestructura Cloud — AWS",      type: "TI & Seguridad",        bu: "Infraestructura TI",   country: "Argentina", quarter: "Q4", risk: "Alto",    hoursEst: 90,  lead: "A. Costa",   status: "pending",     lastAudit: "2024-Q2" },
];

const CONFLICT_DATA = [
  { auditor: "M. García",  area: "Servicios Financieros", declared: "2025-01-15", risk: "Bajo",  detail: "Relación familiar lejana — pariente 3° en área auditada" },
  { auditor: "L. Herrera", area: "TI & Infraestructura",  declared: "2025-01-18", risk: "Ninguno", detail: "Sin conflicto" },
  { auditor: "P. Morales", area: "Operaciones LATAM",     declared: "2025-01-20", risk: "Ninguno", detail: "Sin conflicto" },
];

const QUARTERS: ("Q1" | "Q2" | "Q3" | "Q4")[] = ["Q1", "Q2", "Q3", "Q4"];

const RISK_COLORS = {
  Crítico: { bg: "bg-red-50",    border: "border-red-200",    text: "text-red-700",    bar: "#C8271C" },
  Alto:    { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", bar: "#d97706" },
  Medio:   { bg: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-700",  bar: "#eab308" },
  Bajo:    { bg: "bg-emerald-50",border: "border-emerald-200",text: "text-emerald-700",bar: "#16a34a" },
};

const TOTAL_HOURS = 1200;

export default function PlanningView() {
  const [activeTab, setActiveTab] = useState<"annual" | "quarterly" | "budget" | "conflicts">("annual");
  const [expandedQ, setExpandedQ] = useState<Set<string>>(new Set(["Q1", "Q2", "Q3"]));
  const [showAddModal, setShowAddModal] = useState(false);
  const [savedNew, setSavedNew] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<PlanAudit | null>(null);

  const usedHours = PLAN_AUDITS.reduce((s, a) => s + a.hoursEst, 0);
  const pctUsed = Math.round((usedHours / TOTAL_HOURS) * 100);

  const toggleQ = (q: string) => {
    setExpandedQ(prev => {
      const next = new Set(prev);
      next.has(q) ? next.delete(q) : next.add(q);
      return next;
    });
  };

  const saveNew = () => {
    setSavedNew(true);
    setShowAddModal(false);
    setTimeout(() => setSavedNew(false), 2000);
  };

  const TABS = [
    { id: "annual",     label: "Plan Anual",       icon: <CalendarDays size={14} /> },
    { id: "quarterly",  label: "Plan Trimestral",   icon: <BarChart3 size={14} /> },
    { id: "budget",     label: "Presupuesto",       icon: <Clock size={14} /> },
    { id: "conflicts",  label: "Conflictos Interés",icon: <AlertTriangle size={14} /> },
  ];

  return (
    <div className="flex-1 overflow-auto p-6" style={FONT_STYLE}>
      <Breadcrumbs items={["Inicio", "Planeación", "Plan Anual 2025"]} />
      <PageHeader
        title="Planeación de Auditoría 2025"
        subtitle="Período activo: Enero–Diciembre 2025 · Versión aprobada: 15 Ene 2025"
        actions={
          <div className="flex gap-2">
            <GhostBtn small icon={<Flag size={12} />}>Exportar Plan</GhostBtn>
            <PrimaryBtn small icon={<Plus size={12} />} onClick={() => setShowAddModal(true)}>Nueva Auditoría</PrimaryBtn>
          </div>
        }
      />

      {/* KPI Strip */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        {[
          { label: "Total Auditorías", value: PLAN_AUDITS.length, sub: "Plan 2025", color: "text-primary" },
          { label: "Completadas", value: PLAN_AUDITS.filter(a => a.status === "completed").length, sub: "Q1–Q2", color: "text-emerald-600" },
          { label: "En Progreso", value: PLAN_AUDITS.filter(a => a.status === "in_progress").length, sub: "Q2–Q3", color: "text-amber-600" },
          { label: "Riesgo Crítico", value: PLAN_AUDITS.filter(a => a.risk === "Crítico").length, sub: "Prioridad máx", color: "text-red-600" },
          { label: "Horas Presupuesto", value: `${TOTAL_HOURS}h`, sub: `${usedHours}h asignadas`, color: "text-violet-600" },
        ].map(k => (
          <Card key={k.label} className="p-3">
            <div className={`text-2xl font-bold tracking-tight ${k.color}`}>{k.value}</div>
            <div className="text-xs font-semibold text-foreground mt-0.5">{k.label}</div>
            <div className="text-[10px] text-muted-foreground">{k.sub}</div>
          </Card>
        ))}
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 mb-5 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-colors ${activeTab === t.id ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Annual Plan ── */}
      {activeTab === "annual" && (
        <Card>
          <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between">
            <div className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CalendarDays size={15} className="text-primary" />
              Universo de Auditorías — Plan Anual
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>Completada</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"/>En progreso</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400 inline-block"/>Pendiente</span>
            </div>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["ID", "Auditoría", "Tipo", "Unidad de Negocio", "País", "Trimestre", "Riesgo", "Horas Est.", "Responsable", "Último Ciclo", "Estatus"].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {PLAN_AUDITS.map(a => {
                  const rc = RISK_COLORS[a.risk];
                  return (
                    <tr
                      key={a.id}
                      className="hover:bg-secondary/30 cursor-pointer group transition-colors"
                      onClick={() => setSelectedAudit(a)}
                    >
                      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{a.id}</td>
                      <td className="px-3 py-2.5 font-medium text-foreground text-sm group-hover:text-primary transition-colors max-w-[220px]">
                        <div className="truncate">{a.name}</div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{a.type}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.bu}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.country}</td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">{a.quarter}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${rc.bg} ${rc.border} ${rc.text} border`}>{a.risk}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">{a.hoursEst}h</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.lead}</td>
                      <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">{a.lastAudit}</td>
                      <td className="px-3 py-2.5"><StatusBadge status={a.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── TAB: Quarterly Plan ── */}
      {activeTab === "quarterly" && (
        <div className="space-y-4">
          {QUARTERS.map(q => {
            const qAudits = PLAN_AUDITS.filter(a => a.quarter === q);
            const isOpen = expandedQ.has(q);
            const totalH = qAudits.reduce((s, a) => s + a.hoursEst, 0);
            return (
              <Card key={q}>
                <button
                  onClick={() => toggleQ(q)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">{q} 2025</span>
                    <span className="text-sm font-semibold text-foreground">{qAudits.length} auditorías</span>
                    <span className="text-xs text-muted-foreground">· {totalH}h presupuestadas</span>
                    {qAudits.some(a => a.risk === "Crítico") && (
                      <span className="text-xs font-semibold bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">⚠ Crítico</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {(["completed", "in_progress", "pending"] as StatusKey[]).map(s => {
                        const cnt = qAudits.filter(a => a.status === s).length;
                        if (!cnt) return null;
                        const dotColors: Record<StatusKey, string> = { completed: "bg-emerald-500", in_progress: "bg-amber-500", overdue: "bg-red-500", pending: "bg-slate-400" };
                        return (
                          <span key={s} className="flex items-center gap-1 text-xs text-muted-foreground">
                            <span className={`w-1.5 h-1.5 rounded-full ${dotColors[s]}`} />{cnt}
                          </span>
                        );
                      })}
                    </div>
                    {isOpen ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-border">
                    {qAudits.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-muted-foreground">Sin auditorías programadas en {q}</div>
                    ) : (
                      <div className="divide-y divide-border">
                        {qAudits.map(a => {
                          const rc = RISK_COLORS[a.risk];
                          return (
                            <div key={a.id} className="px-4 py-3 flex items-center gap-4 hover:bg-secondary/20 group cursor-pointer">
                              <div className={`w-1.5 h-10 rounded-full flex-shrink-0 ${rc.text.replace("text", "bg")}`} style={{ background: rc.bar }} />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">{a.name}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">{a.type} · {a.bu} · {a.country}</div>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${rc.bg} ${rc.border} ${rc.text}`}>{a.risk}</span>
                                <span className="text-xs text-muted-foreground font-mono">{a.hoursEst}h</span>
                                <span className="text-xs text-muted-foreground">{a.lead}</span>
                                <StatusBadge status={a.status} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── TAB: Budget ── */}
      {activeTab === "budget" && (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 space-y-4">
            <Card className="p-4">
              <div className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Clock size={14} className="text-primary" /> Presupuesto de Horas — 2025
              </div>
              <ProgressBar value={usedHours} max={TOTAL_HOURS} color="#1A4FA0" />
              <div className="grid grid-cols-4 gap-3 mt-4">
                {QUARTERS.map(q => {
                  const qH = PLAN_AUDITS.filter(a => a.quarter === q).reduce((s, a) => s + a.hoursEst, 0);
                  const qMax = TOTAL_HOURS / 4;
                  return (
                    <div key={q} className="bg-muted/40 rounded-lg p-3">
                      <div className="text-xs font-bold text-primary mb-1">{q}</div>
                      <ProgressBar value={qH} max={qMax} color="#2B6FD4" />
                      <div className="text-[10px] text-muted-foreground mt-1">{qH}h / {qMax}h</div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <SectionCard title="Capacidad por Auditor" icon={<Users size={15} />}>
              <div className="divide-y divide-border">
                {AUDITORS.map(au => {
                  const assigned = PLAN_AUDITS.filter(a => a.lead.startsWith(au.name.split(" ")[0])).reduce((s, a) => s + a.hoursEst, 0);
                  return (
                    <div key={au.id} className="px-4 py-3 flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                        {au.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground">{au.name}</div>
                        <div className="text-xs text-muted-foreground">{au.role}</div>
                        <div className="mt-1.5">
                          <ProgressBar value={assigned} max={au.hours} color={assigned > au.hours ? "#C8271C" : "#1A4FA0"} />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs font-mono font-semibold text-foreground">{assigned}h</div>
                        <div className="text-[10px] text-muted-foreground">de {au.hours}h</div>
                        <div className="flex gap-1 mt-1 justify-end">
                          {au.certs.map(c => (
                            <span key={c} className="text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded font-semibold">{c}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          </div>

          <div className="space-y-4">
            <Card className="p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Distribución por Riesgo</div>
              {(["Crítico", "Alto", "Medio", "Bajo"] as const).map(nivel => {
                const cnt = PLAN_AUDITS.filter(a => a.risk === nivel).length;
                const rc = RISK_COLORS[nivel];
                return (
                  <div key={nivel} className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border w-20 text-center ${rc.bg} ${rc.border} ${rc.text}`}>{nivel}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(cnt / PLAN_AUDITS.length) * 100}%`, background: rc.bar }} />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground w-6 text-right">{cnt}</span>
                  </div>
                );
              })}
            </Card>
            <Card className="p-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Rotación de Cobertura</div>
              <div className="text-xs text-muted-foreground space-y-2">
                <div className="flex justify-between"><span>Auditorías &lt;1 año ciclo</span><span className="font-semibold text-foreground">3</span></div>
                <div className="flex justify-between"><span>1–2 años</span><span className="font-semibold text-foreground">4</span></div>
                <div className="flex justify-between"><span>&gt;2 años</span><span className="font-semibold text-amber-600 font-bold">2 ⚠</span></div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ── TAB: Conflicts ── */}
      {activeTab === "conflicts" && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-amber-800">Política de Independencia y Objetividad</div>
              <div className="text-xs text-amber-700 mt-1">Todos los auditores deben declarar posibles conflictos de interés antes del inicio del período. El sistema aplicará restricciones automáticas en la asignación de auditorías para garantizar la objetividad.</div>
            </div>
          </div>

          <SectionCard title="Registro de Declaraciones — 2025" icon={<AlertTriangle size={15} />} count={CONFLICT_DATA.length}
            action={<PrimaryBtn small icon={<Plus size={11} />}>Nueva Declaración</PrimaryBtn>}>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Auditor", "Área de Posible Conflicto", "Fecha Declaración", "Nivel de Riesgo", "Detalle", "Restricción Aplicada"].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {CONFLICT_DATA.map((c, i) => (
                    <tr key={i} className="hover:bg-secondary/20">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-primary">
                            {c.auditor.split(" ").map(n => n[0]).join("")}
                          </div>
                          <span className="text-sm font-medium text-foreground">{c.auditor}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{c.area}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.declared}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          c.risk === "Bajo" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                          c.risk === "Ninguno" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                          "bg-red-50 text-red-700 border border-red-200"
                        }`}>{c.risk}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">{c.detail}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          c.risk === "Ninguno"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}>
                          {c.risk === "Ninguno" ? "✓ Sin restricción" : "⛔ Restringido"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── Audit Detail Side Panel ── */}
      {selectedAudit && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setSelectedAudit(null)}>
          <div className="flex-1 bg-black/20" />
          <div className="w-96 bg-card shadow-2xl flex flex-col overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <div className="font-mono text-xs text-muted-foreground">{selectedAudit.id}</div>
                <div className="text-sm font-bold text-foreground mt-0.5">{selectedAudit.name}</div>
              </div>
              <button onClick={() => setSelectedAudit(null)} className="text-muted-foreground hover:text-foreground transition-colors"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4 flex-1">
              <StatusBadge status={selectedAudit.status} />
              {[
                ["Tipo", selectedAudit.type],
                ["Unidad de Negocio", selectedAudit.bu],
                ["País", selectedAudit.country],
                ["Trimestre", selectedAudit.quarter + " 2025"],
                ["Nivel de Riesgo", selectedAudit.risk],
                ["Horas Estimadas", selectedAudit.hoursEst + "h"],
                ["Responsable", selectedAudit.lead],
                ["Último Ciclo", selectedAudit.lastAudit],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">{label}</div>
                  <div className="text-sm text-foreground">{value}</div>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-2">
              <GhostBtn small onClick={() => setSelectedAudit(null)}>Cerrar</GhostBtn>
              <PrimaryBtn small icon={<GripVertical size={12} />}>Ir a Ejecución</PrimaryBtn>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Audit Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-card rounded-xl shadow-2xl w-[480px] max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="text-base font-bold text-foreground">Nueva Auditoría Planificada</div>
              <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { label: "Nombre de la Auditoría", type: "text", placeholder: "Ej. SOX Financiero Q1 2025" },
                { label: "Tipo de Auditoría", type: "select", options: AUDIT_TYPES },
                { label: "Unidad de Negocio", type: "text", placeholder: "Ej. Servicios Financieros" },
                { label: "País", type: "text", placeholder: "Ej. México" },
                { label: "Trimestre", type: "select", options: ["Q1", "Q2", "Q3", "Q4"] },
                { label: "Nivel de Riesgo", type: "select", options: ["Crítico", "Alto", "Medio", "Bajo"] },
                { label: "Horas Estimadas", type: "number", placeholder: "Ej. 80" },
                { label: "Responsable Principal", type: "select", options: AUDITORS.map(a => a.name) },
              ].map(f => (
                <div key={f.label}>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">{f.label}</label>
                  {f.type === "select" ? (
                    <select className="w-full text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30">
                      {f.options?.map(o => <option key={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type={f.type}
                      placeholder={f.placeholder}
                      className="w-full text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <GhostBtn onClick={() => setShowAddModal(false)}>Cancelar</GhostBtn>
              <PrimaryBtn icon={savedNew ? <Check size={14} /> : <Save size={14} />} onClick={saveNew}>
                {savedNew ? "¡Guardado!" : "Guardar Auditoría"}
              </PrimaryBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
