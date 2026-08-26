import { useState } from "react";
import {
  Target, AlertTriangle, CheckCircle2, Clock, User, ArrowRight,
  MessageSquare, TrendingDown, Bell, ChevronDown, ChevronUp,
  Check, Filter, Search, RefreshCw
} from "lucide-react";
import {
  Breadcrumbs, PageHeader, Card, SectionCard, PrimaryBtn, GhostBtn,
  StatusBadge, NivelBadge, RiskGauge, ProgressBar, FONT_STYLE
} from "../components/shared/SharedComponents";

// ─── Types & Data ─────────────────────────────────────────────────────────────
type APStatus = "Definido" | "En Progreso" | "Implementado" | "Validado";

interface ActionPlanTrack {
  id: string; findingId: string; auditId: string; auditName: string;
  description: string; responsible: string; bu: string;
  dueDate: string; status: APStatus;
  progress: number; // 0–100
  residualRiskBefore: number; residualRiskAfter: number;
  mitigationImpact: number;
  isOverdue: boolean; comments: string[];
  vulnerability: string;
}

const AP_STATUS_COLORS: Record<APStatus, { bg: string; text: string; border: string; dot: string; bar: string }> = {
  "Definido":     { bg: "bg-slate-50",   text: "text-slate-600",   border: "border-slate-200",   dot: "bg-slate-400",   bar: "#A0ABBE" },
  "En Progreso":  { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-500",   bar: "#d97706" },
  "Implementado": { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",    dot: "bg-blue-500",    bar: "#2B6FD4" },
  "Validado":     { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500", bar: "#16a34a" },
};

const PIPELINE: APStatus[] = ["Definido", "En Progreso", "Implementado", "Validado"];

const ACTION_PLANS: ActionPlanTrack[] = [
  {
    id: "PA-001", findingId: "HAL-2025-001", auditId: "AUD-2025-041", auditName: "SOX Financiero",
    description: "Configurar roles SAP con restricción de ajuste/aprobación al mismo usuario",
    responsible: "CISO — R. Torres", bu: "Servicios Financieros", dueDate: "2025-08-15",
    status: "En Progreso", progress: 60, residualRiskBefore: 16, residualRiskAfter: 10,
    mitigationImpact: 6, isOverdue: false, vulnerability: "Alto",
    comments: ["2025-07-10 — R. Torres: Roles configurados en ambiente QA. Pruebas en producción esta semana.", "2025-07-18 — L. Herrera (AI): Progreso adecuado. Confirmar fecha de pase a producción."]
  },
  {
    id: "PA-002", findingId: "HAL-2025-001", auditId: "AUD-2025-041", auditName: "SOX Financiero",
    description: "Actualizar matriz RACI del proceso de cierre contable",
    responsible: "CFO — P. Ávila", bu: "Servicios Financieros", dueDate: "2025-08-30",
    status: "Definido", progress: 10, residualRiskBefore: 16, residualRiskAfter: 13,
    mitigationImpact: 3, isOverdue: false, vulnerability: "Alto",
    comments: []
  },
  {
    id: "PA-003", findingId: "HAL-2025-002", auditId: "AUD-2025-041", auditName: "SOX Financiero",
    description: "Depurar partidas pendientes acumuladas (>60 días) y establecer revisión semanal",
    responsible: "Tesorería — C. Vega", bu: "Servicios Financieros", dueDate: "2025-07-31",
    status: "En Progreso", progress: 75, residualRiskBefore: 20, residualRiskAfter: 12,
    mitigationImpact: 8, isOverdue: true, vulnerability: "Crítico",
    comments: ["2025-07-05 — C. Vega: 43 de 58 partidas depuradas.", "2025-07-15 — C. Vega: Quedan 15 partidas que requieren aprobación de Dirección."]
  },
  {
    id: "PA-004", findingId: "HAL-2025-003", auditId: "AUD-2025-038", auditName: "TI & Ciberseguridad",
    description: "Ejecutar revisión de accesos y establecer proceso de recertificación trimestral",
    responsible: "CISO — R. Torres", bu: "Infraestructura TI", dueDate: "2025-09-15",
    status: "Implementado", progress: 90, residualRiskBefore: 9, residualRiskAfter: 4,
    mitigationImpact: 5, isOverdue: false, vulnerability: "Medio",
    comments: ["2025-07-20 — R. Torres: Recertificación completada para 45 de 50 usuarios. Pendientes 5 casos especiales."]
  },
  {
    id: "PA-005", findingId: "HAL-2025-004", auditId: "AUD-2025-031", auditName: "Nómina México",
    description: "Implementar doble aprobación en modificaciones de nómina superiores a $100k",
    responsible: "CHRO — M. Fuentes", bu: "Banca Corporativa", dueDate: "2025-10-01",
    status: "Validado", progress: 100, residualRiskBefore: 12, residualRiskAfter: 5,
    mitigationImpact: 7, isOverdue: false, vulnerability: "Medio",
    comments: ["2025-07-25 — M. García (AI): Control implementado y verificado en entorno productivo. Plan Validado."]
  },
];

export default function FollowUpView() {
  const [plans, setPlans] = useState<ActionPlanTrack[]>(ACTION_PLANS);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<APStatus | "all">("all");
  const [expandedPlan, setExpandedPlan] = useState<string | null>("PA-001");
  const [commentInput, setCommentInput] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<"pipeline" | "table">("pipeline");

  const filtered = plans.filter(p => {
    const matchSearch = !search || p.description.toLowerCase().includes(search.toLowerCase()) || p.responsible.toLowerCase().includes(search.toLowerCase()) || p.auditId.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const advanceStatus = (id: string) => {
    setPlans(prev => prev.map(p => {
      if (p.id !== id) return p;
      const idx = PIPELINE.indexOf(p.status);
      if (idx < PIPELINE.length - 1) return { ...p, status: PIPELINE[idx + 1], progress: Math.min(100, p.progress + 25) };
      return p;
    }));
  };

  const addComment = (id: string) => {
    if (!commentInput[id]?.trim()) return;
    const today = new Date().toISOString().split("T")[0];
    setPlans(prev => prev.map(p => p.id === id ? {
      ...p, comments: [...p.comments, `${today} — Usuario: ${commentInput[id]}`]
    } : p));
    setCommentInput(prev => ({ ...prev, [id]: "" }));
  };

  const overdueCount = plans.filter(p => p.isOverdue && p.status !== "Validado").length;
  const openCount = plans.filter(p => p.status !== "Validado").length;
  const avgRiskReduction = Math.round(plans.reduce((s, p) => s + (p.residualRiskBefore - p.residualRiskAfter), 0) / plans.length);

  return (
    <div className="flex-1 overflow-auto p-6" style={FONT_STYLE}>
      <Breadcrumbs items={["Inicio", "Seguimiento", "Planes de Acción"]} />
      <PageHeader
        title="Seguimiento de Planes de Acción"
        subtitle={`${plans.length} planes registrados · ${openCount} abiertos · ${overdueCount > 0 ? `⚠ ${overdueCount} vencidos` : "Sin vencidos"}`}
        actions={
          <div className="flex gap-2">
            {overdueCount > 0 && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-3 py-1.5 rounded-md">
                <Bell size={12} />{overdueCount} vencido{overdueCount > 1 ? "s" : ""}
              </span>
            )}
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              {(["pipeline", "table"] as const).map(m => (
                <button key={m} onClick={() => setViewMode(m)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${viewMode === m ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  {m === "pipeline" ? "Pipeline" : "Tabla"}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total Planes", value: plans.length, color: "text-primary" },
          { label: "Validados", value: plans.filter(p => p.status === "Validado").length, color: "text-emerald-600" },
          { label: "Vencidos", value: overdueCount, color: overdueCount > 0 ? "text-red-600" : "text-emerald-600" },
          { label: "Reducción Riesgo Prom.", value: `-${avgRiskReduction} pts`, color: "text-violet-600" },
        ].map(k => (
          <Card key={k.label} className="p-3">
            <div className={`text-2xl font-bold tracking-tight ${k.color}`}>{k.value}</div>
            <div className="text-xs font-semibold text-foreground mt-0.5">{k.label}</div>
          </Card>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar plan, responsable, auditoría…"
            className="w-full text-sm bg-card border border-border rounded-md pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground" />
        </div>
        <div className="flex items-center gap-1">
          <Filter size={13} className="text-muted-foreground" />
          {(["all", ...PIPELINE] as const).map(s => {
            const pc = s !== "all" ? AP_STATUS_COLORS[s] : null;
            return (
              <button key={s} onClick={() => setStatusFilter(s as any)}
                className={`text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors ${
                  statusFilter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                }`}>
                {s === "all" ? "Todos" : s}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── PIPELINE VIEW ── */}
      {viewMode === "pipeline" && (
        <div className="grid grid-cols-4 gap-4">
          {PIPELINE.map(stage => {
            const stagePlans = filtered.filter(p => p.status === stage);
            const pc = AP_STATUS_COLORS[stage];
            return (
              <div key={stage} className="flex flex-col gap-3">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${pc.bg} ${pc.border}`}>
                  <span className={`w-2 h-2 rounded-full ${pc.dot}`} />
                  <span className={`text-xs font-bold ${pc.text}`}>{stage}</span>
                  <span className={`ml-auto text-xs font-bold ${pc.text}`}>{stagePlans.length}</span>
                </div>
                <div className="space-y-3">
                  {stagePlans.map(plan => (
                    <button key={plan.id} onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
                      className={`w-full text-left rounded-lg border p-3 transition-all ${
                        plan.isOverdue && plan.status !== "Validado"
                          ? "border-red-200 bg-red-50/50 hover:border-red-300"
                          : "border-border bg-card hover:border-primary/40 hover:shadow-sm"
                      }`}>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="font-mono text-[10px] text-muted-foreground">{plan.id}</span>
                        {plan.isOverdue && plan.status !== "Validado" && (
                          <span className="text-[10px] font-semibold text-red-600 flex items-center gap-0.5">
                            <AlertTriangle size={9} />Vencido
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-foreground leading-tight mb-1.5">{plan.description}</div>
                      <div className="text-[10px] text-muted-foreground mb-2 truncate">{plan.responsible}</div>
                      <ProgressBar value={plan.progress} max={100} color={pc.bar} showLabel={false} />
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] font-mono text-muted-foreground">{plan.dueDate}</span>
                        <span className="text-[10px] text-violet-600 font-semibold">-{plan.mitigationImpact} pts riesgo</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TABLE VIEW ── */}
      {viewMode === "table" && (
        <Card>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["ID", "Hallazgo", "Descripción", "Responsable", "BU", "Vencimiento", "Estado", "Avance", "Riesgo Actual→Futuro", ""].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(p => {
                  const pc = AP_STATUS_COLORS[p.status];
                  return (
                    <tr key={p.id} className={`hover:bg-secondary/30 group transition-colors ${p.isOverdue && p.status !== "Validado" ? "bg-red-50/30" : ""}`}>
                      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{p.id}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{p.findingId}</td>
                      <td className="px-3 py-2.5 max-w-[180px]">
                        <div className="text-sm text-foreground truncate">{p.description}</div>
                        <div className="text-xs text-muted-foreground">{p.auditName}</div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{p.responsible}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{p.bu}</td>
                      <td className="px-3 py-2.5">
                        <span className={`font-mono text-xs ${p.isOverdue && p.status !== "Validado" ? "text-red-600 font-bold" : "text-muted-foreground"}`}>
                          {p.isOverdue && p.status !== "Validado" && <AlertTriangle size={10} className="inline mr-0.5" />}
                          {p.dueDate}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${pc.bg} ${pc.border} ${pc.text}`}>{p.status}</span>
                      </td>
                      <td className="px-3 py-2.5 w-28">
                        <div className="text-xs text-muted-foreground mb-0.5">{p.progress}%</div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden w-20">
                          <div className="h-full rounded-full transition-all" style={{ width: `${p.progress}%`, background: pc.bar }} />
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="font-mono text-red-600">{p.residualRiskBefore}</span>
                          <ArrowRight size={10} className="text-muted-foreground" />
                          <span className="font-mono text-emerald-600">{p.residualRiskAfter}</span>
                          <span className="text-violet-600 font-semibold">(-{p.mitigationImpact})</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {p.status !== "Validado" && (
                          <button onClick={() => advanceStatus(p.id)}
                            className="text-[10px] px-2 py-1 rounded border border-primary/30 text-primary hover:bg-primary/5 transition-colors whitespace-nowrap">
                            Avanzar →
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Expanded plan detail panel */}
      {expandedPlan && (() => {
        const plan = plans.find(p => p.id === expandedPlan);
        if (!plan) return null;
        const pc = AP_STATUS_COLORS[plan.status];
        return (
          <div className="fixed inset-0 z-50 flex" onClick={() => setExpandedPlan(null)}>
            <div className="flex-1 bg-black/20" />
            <div className="w-[420px] bg-card shadow-2xl flex flex-col overflow-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between px-5 py-4 border-b border-border">
                <div>
                  <div className="font-mono text-xs text-muted-foreground">{plan.id} · {plan.findingId}</div>
                  <div className="text-sm font-bold text-foreground mt-0.5 leading-tight">{plan.description}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${pc.bg} ${pc.border} ${pc.text}`}>{plan.status}</span>
                    <NivelBadge nivel={plan.vulnerability} />
                  </div>
                </div>
                <button onClick={() => setExpandedPlan(null)} className="text-muted-foreground hover:text-foreground mt-1">✕</button>
              </div>

              <div className="flex-1 p-5 space-y-4 overflow-auto">
                {/* Risk impact */}
                <div className="flex items-center justify-center gap-6 py-2">
                  <RiskGauge value={plan.residualRiskBefore} label="Antes" />
                  <div className="flex flex-col items-center gap-1">
                    <ArrowRight size={20} className="text-muted-foreground" />
                    <span className="text-xs font-semibold text-violet-600">-{plan.mitigationImpact} pts</span>
                  </div>
                  <RiskGauge value={plan.residualRiskAfter} label="Proyectado" />
                </div>

                {/* Progress */}
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Avance</span>
                    <span className="font-semibold text-foreground">{plan.progress}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${plan.progress}%`, background: pc.bar }} />
                  </div>
                </div>

                {/* Details */}
                {[
                  ["Auditoría", plan.auditName],
                  ["Responsable", plan.responsible],
                  ["Unidad de Negocio", plan.bu],
                  ["Fecha Límite", plan.dueDate + (plan.isOverdue ? " ⚠ Vencido" : "")],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">{label}</div>
                    <div className={`text-sm text-foreground ${plan.isOverdue && label === "Fecha Límite" ? "text-red-600 font-semibold" : ""}`}>{value}</div>
                  </div>
                ))}

                {/* Pipeline */}
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pipeline de Estado</div>
                  <div className="flex gap-1">
                    {PIPELINE.map((stage, i) => {
                      const isCurrent = stage === plan.status;
                      const isPast = PIPELINE.indexOf(plan.status) > i;
                      const spc = AP_STATUS_COLORS[stage];
                      return (
                        <div key={stage} className="flex-1 flex flex-col items-center">
                          <div className={`h-1.5 w-full rounded-full mb-1 ${isPast || isCurrent ? "" : "bg-muted"}`} style={{ background: isPast || isCurrent ? spc.bar : undefined }} />
                          <div className={`text-[9px] font-medium text-center ${isCurrent ? spc.text : isPast ? "text-emerald-600" : "text-muted-foreground"}`}>{stage}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Comments */}
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    <MessageSquare size={11} className="inline mr-1" />Comentarios ({plan.comments.length})
                  </div>
                  <div className="space-y-2 mb-3">
                    {plan.comments.length === 0 && (
                      <div className="text-xs text-muted-foreground">Sin comentarios aún</div>
                    )}
                    {plan.comments.map((c, i) => (
                      <div key={i} className="bg-muted/40 rounded-lg p-2.5 text-xs text-foreground leading-relaxed">{c}</div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={commentInput[plan.id] || ""}
                      onChange={e => setCommentInput(prev => ({ ...prev, [plan.id]: e.target.value }))}
                      placeholder="Agregar comentario…"
                      onKeyDown={e => e.key === "Enter" && addComment(plan.id)}
                      className="flex-1 text-xs bg-input-background border border-border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
                    />
                    <button onClick={() => addComment(plan.id)}
                      className="text-xs px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors">
                      Enviar
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-5 py-4 border-t border-border flex gap-2">
                <GhostBtn small onClick={() => setExpandedPlan(null)}>Cerrar</GhostBtn>
                {plan.status !== "Validado" && (
                  <PrimaryBtn small icon={<ArrowRight size={12} />} onClick={() => advanceStatus(plan.id)}>
                    Avanzar Estado
                  </PrimaryBtn>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
