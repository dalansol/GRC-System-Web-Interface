import { useState } from "react";
import {
  ClipboardList, Plus, Search, Filter, ArrowRight, X, Save, Check,
  Building2, Calendar, Users, ChevronRight, Eye
} from "lucide-react";
import {
  Breadcrumbs, PageHeader, Card, SectionCard, PrimaryBtn, GhostBtn,
  StatusBadge, FONT_STYLE, StatusKey, EmptyState
} from "../components/shared/SharedComponents";

// ─── Types & Data ─────────────────────────────────────────────────────────────
type AuditPhase = "Planeada" | "En Ejecución" | "En Revisión" | "Cerrada";

interface AuditEngagement {
  id: string; name: string; type: string; bu: string; country: string;
  phase: AuditPhase; status: StatusKey; lead: string; team: string[];
  startDate: string; endDate: string; progress: number;
  findings: number; controls: number; risk: string;
}

const AUDIT_ENGAGEMENTS: AuditEngagement[] = [
  { id: "AUD-2025-041", name: "SOX Financiero — Cuentas por Pagar",   type: "Auditoría Financiera",  bu: "Servicios Financieros", country: "México",    phase: "En Ejecución", status: "overdue",     lead: "M. García",  team: ["L. Herrera","P. Morales"], startDate: "2025-06-01", endDate: "2025-07-31", progress: 72, findings: 3, controls: 14, risk: "Crítico" },
  { id: "AUD-2025-038", name: "TI & Ciberseguridad — IAM",            type: "TI & Seguridad",         bu: "Infraestructura TI",   country: "Brasil",    phase: "En Ejecución", status: "in_progress", lead: "L. Herrera", team: ["A. Costa"],                 startDate: "2025-06-15", endDate: "2025-08-15", progress: 45, findings: 1, controls: 8,  risk: "Alto"  },
  { id: "AUD-2025-035", name: "Inventarios Q2 — Bebidas México",       type: "Auditoría Operacional", bu: "Operaciones LATAM",    country: "México",    phase: "Planeada",     status: "pending",     lead: "P. Morales", team: ["R. Jiménez"],               startDate: "2025-08-01", endDate: "2025-09-30", progress: 5,  findings: 0, controls: 10, risk: "Medio" },
  { id: "AUD-2025-031", name: "Nómina y Compensaciones — México",      type: "Auditoría Operacional", bu: "Banca Corporativa",    country: "México",    phase: "En Revisión",  status: "in_progress", lead: "R. Jiménez", team: ["M. García"],                startDate: "2025-05-01", endDate: "2025-07-15", progress: 90, findings: 2, controls: 12, risk: "Medio" },
  { id: "AUD-2025-028", name: "Cumplimiento GDPR — App Móvil",        type: "Cumplimiento",           bu: "Productos Digitales",  country: "Brasil",    phase: "En Revisión",  status: "in_progress", lead: "A. Costa",   team: ["L. Herrera"],               startDate: "2025-04-15", endDate: "2025-07-30", progress: 88, findings: 4, controls: 9,  risk: "Alto"  },
  { id: "AUD-2025-022", name: "Cierre Financiero — Colombia Q1",       type: "Auditoría Financiera",  bu: "Servicios Financieros", country: "Colombia", phase: "Cerrada",      status: "completed",   lead: "M. García",  team: ["P. Morales","A. Costa"],    startDate: "2025-02-01", endDate: "2025-04-30", progress: 100, findings: 2, controls: 16, risk: "Medio" },
  { id: "AUD-2025-018", name: "SOC & Monitoreo Seguridad — Argentina", type: "TI & Seguridad",        bu: "Infraestructura TI",   country: "Argentina", phase: "Cerrada",      status: "completed",   lead: "L. Herrera", team: ["R. Jiménez"],               startDate: "2025-01-15", endDate: "2025-03-31", progress: 100, findings: 1, controls: 11, risk: "Bajo"  },
  { id: "AUD-2025-015", name: "KYC & Prevención Lavado — Uruguay",     type: "Cumplimiento",           bu: "Cumplimiento & Legal", country: "Uruguay",   phase: "Planeada",     status: "pending",     lead: "L. Herrera", team: [],                           startDate: "2025-09-01", endDate: "2025-11-30", progress: 0,  findings: 0, controls: 0,  risk: "Medio" },
  { id: "AUD-2025-010", name: "Regulatorio SUNAT — Filial Perú",       type: "Regulatorio",           bu: "Regulatorio LATAM",    country: "Perú",      phase: "Planeada",     status: "pending",     lead: "M. García",  team: [],                           startDate: "2025-09-15", endDate: "2025-11-15", progress: 0,  findings: 0, controls: 0,  risk: "Alto"  },
];

const PHASES: AuditPhase[] = ["Planeada", "En Ejecución", "En Revisión", "Cerrada"];

const PHASE_COLORS: Record<AuditPhase, { bg: string; text: string; border: string; dot: string }> = {
  "Planeada":      { bg: "bg-slate-50",   text: "text-slate-600",   border: "border-slate-200",   dot: "bg-slate-400"   },
  "En Ejecución":  { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-500"   },
  "En Revisión":   { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",    dot: "bg-blue-500"    },
  "Cerrada":       { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
};

const RISK_COLORS: Record<string, string> = {
  Crítico: "text-red-700 bg-red-50 border border-red-200",
  Alto:    "text-orange-700 bg-orange-50 border border-orange-200",
  Medio:   "text-amber-700 bg-amber-50 border border-amber-200",
  Bajo:    "text-emerald-700 bg-emerald-50 border border-emerald-200",
};

const CREATE_STEPS = ["Identificación", "Alcance", "Equipo", "Confirmación"];

export default function AuditsView({ onExecute }: { onExecute?: () => void }) {
  const [viewMode, setViewMode] = useState<"table" | "pipeline">("pipeline");
  const [searchTerm, setSearchTerm] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<AuditPhase | "all">("all");
  const [selectedAudit, setSelectedAudit] = useState<AuditEngagement | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState(0);
  const [saved, setSaved] = useState(false);

  const filtered = AUDIT_ENGAGEMENTS.filter(a => {
    const matchSearch = !searchTerm || a.name.toLowerCase().includes(searchTerm.toLowerCase()) || a.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchPhase = phaseFilter === "all" || a.phase === phaseFilter;
    return matchSearch && matchPhase;
  });

  const saveAudit = () => {
    setSaved(true);
    setTimeout(() => { setSaved(false); setShowCreateModal(false); setCreateStep(0); }, 1500);
  };

  return (
    <div className="flex-1 overflow-auto p-6" style={FONT_STYLE}>
      <Breadcrumbs items={["Inicio", "Auditorías", "Universo"]} />
      <PageHeader
        title="Universo de Auditorías 2025"
        subtitle={`${AUDIT_ENGAGEMENTS.length} compromisos activos · Período Q1–Q4 2025`}
        actions={
          <div className="flex gap-2">
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              {(["pipeline", "table"] as const).map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${viewMode === mode ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  {mode === "pipeline" ? "Pipeline" : "Tabla"}
                </button>
              ))}
            </div>
            <PrimaryBtn small icon={<Plus size={12} />} onClick={() => setShowCreateModal(true)}>Nueva Auditoría</PrimaryBtn>
          </div>
        }
      />

      {/* Pipeline summary stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {PHASES.map(phase => {
          const cnt = AUDIT_ENGAGEMENTS.filter(a => a.phase === phase).length;
          const pc = PHASE_COLORS[phase];
          return (
            <button key={phase} onClick={() => setPhaseFilter(phaseFilter === phase ? "all" : phase)}
              className={`rounded-lg border p-3 text-left transition-all ${phaseFilter === phase ? "ring-2 ring-primary ring-offset-1" : "hover:border-primary/40"} ${pc.bg} ${pc.border}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${pc.dot}`} />
                <span className={`text-xs font-semibold ${pc.text}`}>{phase}</span>
              </div>
              <div className={`text-2xl font-bold ${pc.text}`}>{cnt}</div>
              <div className="text-xs text-muted-foreground">auditorías</div>
            </button>
          );
        })}
      </div>

      {/* Search & Filter bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre o ID…"
            className="w-full text-sm bg-card border border-border rounded-md pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground" />
        </div>
        <div className="flex items-center gap-1">
          <Filter size={13} className="text-muted-foreground" />
          {(["all", ...PHASES] as const).map(f => (
            <button key={f} onClick={() => setPhaseFilter(f as any)}
              className={`text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors ${phaseFilter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
              {f === "all" ? "Todas" : f}
            </button>
          ))}
        </div>
      </div>

      {/* ── PIPELINE VIEW ── */}
      {viewMode === "pipeline" && (
        <div className="grid grid-cols-4 gap-4">
          {PHASES.map(phase => {
            const phaseAudits = filtered.filter(a => a.phase === phase);
            const pc = PHASE_COLORS[phase];
            return (
              <div key={phase} className="flex flex-col gap-3">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${pc.bg} ${pc.border} border`}>
                  <span className={`w-2 h-2 rounded-full ${pc.dot}`} />
                  <span className={`text-xs font-bold ${pc.text}`}>{phase}</span>
                  <span className={`ml-auto text-xs font-bold ${pc.text}`}>{phaseAudits.length}</span>
                </div>
                <div className="space-y-3">
                  {phaseAudits.length === 0 && (
                    <div className="rounded-lg border-2 border-dashed border-border p-4 text-center">
                      <div className="text-xs text-muted-foreground">Sin auditorías</div>
                    </div>
                  )}
                  {phaseAudits.map(a => (
                    <button key={a.id} onClick={() => setSelectedAudit(a)}
                      className="w-full text-left bg-card border border-border rounded-lg p-3 hover:border-primary/40 hover:shadow-md transition-all group">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="font-mono text-[10px] text-muted-foreground">{a.id}</div>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${RISK_COLORS[a.risk]}`}>{a.risk}</span>
                      </div>
                      <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors leading-tight mb-2">{a.name}</div>
                      <div className="text-[10px] text-muted-foreground mb-2">{a.bu} · {a.country}</div>
                      {a.progress > 0 && (
                        <div className="mb-2">
                          <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                            <span>Avance</span><span className="font-semibold text-foreground">{a.progress}%</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${a.progress}%` }} />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Users size={10} />
                          <span>{a.lead.split(" ")[0]}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          {a.findings > 0 && <span className="text-red-600 font-semibold">{a.findings} hall.</span>}
                          <span>{a.controls} ctrl.</span>
                        </div>
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
                  {["ID", "Nombre", "Tipo", "Unidad de Negocio", "País", "Fase", "Riesgo", "Avance", "Hallazgos", "Responsable", "Fecha Cierre", "Acciones"].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 && (
                  <tr><td colSpan={12} className="px-4 py-10 text-center text-sm text-muted-foreground">Sin resultados</td></tr>
                )}
                {filtered.map(a => {
                  const pc = PHASE_COLORS[a.phase];
                  return (
                    <tr key={a.id} className="hover:bg-secondary/30 group transition-colors">
                      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{a.id}</td>
                      <td className="px-3 py-2.5 max-w-[200px]">
                        <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">{a.name}</div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{a.type}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.bu}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.country}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${pc.bg} ${pc.border} ${pc.text}`}>{a.phase}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${RISK_COLORS[a.risk]}`}>{a.risk}</span>
                      </td>
                      <td className="px-3 py-2.5 w-24">
                        <div className="text-xs text-muted-foreground mb-0.5">{a.progress}%</div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden w-20">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${a.progress}%` }} />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {a.findings > 0 ? <span className="text-xs font-bold text-red-600">{a.findings}</span> : <span className="text-xs text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{a.lead}</td>
                      <td className="px-3 py-2.5 text-xs font-mono text-muted-foreground">{a.endDate}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1">
                          <button onClick={() => setSelectedAudit(a)} className="text-muted-foreground hover:text-primary transition-colors"><Eye size={13} /></button>
                          {a.phase === "En Ejecución" && (
                            <button onClick={onExecute} className="text-muted-foreground hover:text-primary transition-colors"><ArrowRight size={13} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Audit Detail Side Panel ── */}
      {selectedAudit && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setSelectedAudit(null)}>
          <div className="flex-1 bg-black/20" />
          <div className="w-[420px] bg-card shadow-2xl flex flex-col overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between px-5 py-4 border-b border-border">
              <div>
                <div className="font-mono text-xs text-muted-foreground">{selectedAudit.id}</div>
                <div className="text-base font-bold text-foreground mt-0.5 leading-tight">{selectedAudit.name}</div>
                <div className="flex items-center gap-2 mt-2">
                  <StatusBadge status={selectedAudit.status} />
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${RISK_COLORS[selectedAudit.risk]}`}>{selectedAudit.risk}</span>
                </div>
              </div>
              <button onClick={() => setSelectedAudit(null)} className="text-muted-foreground hover:text-foreground mt-1 flex-shrink-0"><X size={16} /></button>
            </div>
            <div className="flex-1 p-5 space-y-4 overflow-auto">
              {/* Progress */}
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Avance General</div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Progreso</span>
                  <span className="font-bold text-primary">{selectedAudit.progress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${selectedAudit.progress}%` }} />
                </div>
              </div>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Controles", value: selectedAudit.controls, color: "text-primary" },
                  { label: "Hallazgos", value: selectedAudit.findings, color: selectedAudit.findings > 0 ? "text-red-600" : "text-emerald-600" },
                  { label: "Equipo", value: selectedAudit.team.length + 1, color: "text-blue-600" },
                ].map(s => (
                  <div key={s.label} className="bg-muted/40 rounded-lg p-2 text-center">
                    <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-[10px] text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>
              {/* Details */}
              {[
                ["Tipo", selectedAudit.type],
                ["Unidad de Negocio", selectedAudit.bu],
                ["País", selectedAudit.country],
                ["Fase", selectedAudit.phase],
                ["Responsable", selectedAudit.lead],
                ["Equipo", [selectedAudit.lead, ...selectedAudit.team].join(", ")],
                ["Inicio", selectedAudit.startDate],
                ["Cierre Previsto", selectedAudit.endDate],
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">{label}</div>
                  <div className="text-sm text-foreground">{value}</div>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-2">
              <GhostBtn small onClick={() => setSelectedAudit(null)}>Cerrar</GhostBtn>
              {selectedAudit.phase === "En Ejecución" && (
                <PrimaryBtn small icon={<ArrowRight size={12} />} onClick={() => { setSelectedAudit(null); onExecute?.(); }}>
                  Ir a Ejecución
                </PrimaryBtn>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Create Audit Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-card rounded-xl shadow-2xl w-[520px] max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <div className="text-base font-bold text-foreground">Nuevo Compromiso de Auditoría</div>
                <div className="text-xs text-muted-foreground mt-0.5">Paso {createStep + 1} de {CREATE_STEPS.length}: {CREATE_STEPS[createStep]}</div>
              </div>
              <button onClick={() => { setShowCreateModal(false); setCreateStep(0); }} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>

            {/* Step progress */}
            <div className="px-6 py-3 border-b border-border">
              <div className="flex gap-1">
                {CREATE_STEPS.map((step, i) => (
                  <div key={step} className="flex-1 flex flex-col items-center gap-1">
                    <div className={`h-1.5 w-full rounded-full transition-colors ${i <= createStep ? "bg-primary" : "bg-muted"}`} />
                    <span className={`text-[10px] font-medium ${i === createStep ? "text-primary" : "text-muted-foreground"}`}>{step}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6">
              {createStep === 0 && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Nombre del Compromiso *</label>
                    <input placeholder="Ej. SOX Financiero — Cuentas por Pagar Q3"
                      className="w-full text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Tipo</label>
                      <select className="w-full text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30">
                        {["Auditoría Financiera","TI & Seguridad","Auditoría Operacional","Cumplimiento","Regulatorio"].map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Nivel de Riesgo</label>
                      <select className="w-full text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30">
                        {["Crítico","Alto","Medio","Bajo"].map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}
              {createStep === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Unidad de Negocio</label>
                      <input placeholder="Ej. Servicios Financieros" className="w-full text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">País</label>
                      <select className="w-full text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30">
                        {["México","Brasil","Colombia","Argentina","Perú","Uruguay","Chile"].map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Fecha de Inicio</label>
                      <input type="date" className="w-full text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Fecha de Cierre</label>
                      <input type="date" className="w-full text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Objetivos del Alcance</label>
                    <textarea rows={3} placeholder="Describa el alcance y objetivos de la auditoría…" className="w-full text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground resize-none" />
                  </div>
                </div>
              )}
              {createStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Responsable Principal</label>
                    <select className="w-full text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30">
                      {["M. García","L. Herrera","P. Morales","A. Costa","R. Jiménez"].map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Equipo Auditor</label>
                    <div className="space-y-2">
                      {["L. Herrera","P. Morales","A. Costa","R. Jiménez"].map(name => (
                        <label key={name} className="flex items-center gap-2 cursor-pointer group">
                          <input type="checkbox" className="rounded border-border" />
                          <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-primary">
                            {name.split(" ").map(n => n[0]).join("")}
                          </div>
                          <span className="text-sm text-foreground group-hover:text-primary transition-colors">{name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {createStep === 3 && (
                <div className="space-y-3 text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mx-auto">
                    <Check size={28} className="text-emerald-500" />
                  </div>
                  <div className="text-base font-bold text-foreground">¿Confirmar creación?</div>
                  <div className="text-sm text-muted-foreground">El compromiso se creará en estado "Planeada" y podrá iniciar la ejecución cuando esté listo el equipo.</div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-border flex justify-between">
              <GhostBtn onClick={() => createStep > 0 ? setCreateStep(s => s - 1) : setShowCreateModal(false)}>
                {createStep === 0 ? "Cancelar" : "Atrás"}
              </GhostBtn>
              <PrimaryBtn icon={createStep === CREATE_STEPS.length - 1 ? (saved ? <Check size={14} /> : <Save size={14} />) : <ChevronRight size={14} />}
                onClick={() => createStep < CREATE_STEPS.length - 1 ? setCreateStep(s => s + 1) : saveAudit()}>
                {createStep === CREATE_STEPS.length - 1 ? (saved ? "¡Creada!" : "Confirmar & Crear") : "Siguiente"}
              </PrimaryBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
