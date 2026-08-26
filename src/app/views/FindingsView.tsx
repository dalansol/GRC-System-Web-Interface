import { useState } from "react";
import {
  AlertTriangle, Plus, Check, X, Save, ChevronDown, ChevronUp,
  Target, TrendingDown, ArrowRight, Clock, User, FileText, CheckCircle2
} from "lucide-react";
import {
  Breadcrumbs, PageHeader, Card, SectionCard, PrimaryBtn, GhostBtn,
  DangerBtn, StatusBadge, NivelBadge, RiskGauge, FONT_STYLE, StatusKey
} from "../components/shared/SharedComponents";

// ─── Types & Data ─────────────────────────────────────────────────────────────
type FindingType = "Hallazgo" | "Observación" | "Debilidad Material" | "Deficiencia Significativa";
type ActionStatus = "Definido" | "En Progreso" | "Implementado" | "Validado" | "Rechazado";

interface ActionPlan {
  id: string; description: string; responsible: string;
  dueDate: string; status: ActionStatus;
  mitigationImpact: number; // reduces residual risk by X points
  approvalStatus: "Pendiente" | "Aprobado" | "Rechazado";
  approvalComment: string;
}

interface Finding {
  id: string; name: string; type: FindingType;
  vulnerability: string; residualRisk: number; rootCause: string;
  recommendation: string; control: string; auditor: string;
  status: StatusKey; actionPlans: ActionPlan[];
  riskAccepted: boolean; riskAcceptanceJustification: string;
  expanded: boolean;
}

const ACTION_STATUS_COLORS: Record<ActionStatus, string> = {
  "Definido":      "bg-slate-50 text-slate-600 border border-slate-200",
  "En Progreso":   "bg-amber-50 text-amber-700 border border-amber-200",
  "Implementado":  "bg-blue-50 text-blue-700 border border-blue-200",
  "Validado":      "bg-emerald-50 text-emerald-700 border border-emerald-200",
  "Rechazado":     "bg-red-50 text-red-700 border border-red-200",
};

const APPROVAL_COLORS = {
  "Pendiente": "bg-amber-50 text-amber-700 border border-amber-200",
  "Aprobado":  "bg-emerald-50 text-emerald-700 border border-emerald-200",
  "Rechazado": "bg-red-50 text-red-700 border border-red-200",
};

const FINDINGS_INIT: Finding[] = [
  {
    id: "HAL-2025-001", name: "Segregación de funciones insuficiente en proceso de cierre", type: "Debilidad Material",
    vulnerability: "Alto", residualRisk: 16, rootCause: "El mismo usuario puede registrar y aprobar ajustes contables sin revisión independiente, generando riesgo de error o fraude no detectado.",
    recommendation: "Implementar segregación de funciones en el módulo de ajustes de SAP. Actualizar la matriz RACI y configurar flujos de aprobación dual antes del cierre de agosto 2025.",
    control: "CTR-1041", auditor: "L. Herrera", status: "in_progress", riskAccepted: false, riskAcceptanceJustification: "", expanded: true,
    actionPlans: [
      { id: "PA-001", description: "Configurar roles SAP con restricción de ajuste/aprobación al mismo usuario", responsible: "CISO", dueDate: "2025-08-15", status: "En Progreso", mitigationImpact: 6, approvalStatus: "Aprobado", approvalComment: "Plan aprobado. Se asigna presupuesto de 40h de TI." },
      { id: "PA-002", description: "Actualizar matriz RACI del proceso de cierre", responsible: "Finanzas", dueDate: "2025-08-30", status: "Definido", mitigationImpact: 3, approvalStatus: "Pendiente", approvalComment: "" },
    ]
  },
  {
    id: "HAL-2025-002", name: "Múltiples partidas sin conciliar en conciliación bancaria",type: "Hallazgo",
    vulnerability: "Crítico", residualRisk: 20, rootCause: "Falta de proceso automatizado y supervisión de conciliaciones bancarias. Partidas pendientes acumuladas por más de 60 días sin resolución.",
    recommendation: "Implementar herramienta de conciliación automática y establecer revisión semanal obligatoria por el Jefe de Tesorería.",
    control: "CTR-1043", auditor: "A. Costa", status: "overdue", riskAccepted: false, riskAcceptanceJustification: "", expanded: false,
    actionPlans: [
      { id: "PA-003", description: "Depurar partidas pendientes acumuladas (>60 días) antes del 31 Jul", responsible: "Tesorería", dueDate: "2025-07-31", status: "En Progreso", mitigationImpact: 8, approvalStatus: "Aprobado", approvalComment: "Prioridad máxima. Revisión semanal con Dirección." },
    ]
  },
  {
    id: "HAL-2025-003", name: "Accesos privilegiados a SAP sin revisión trimestral", type: "Observación",
    vulnerability: "Medio", residualRisk: 9, rootCause: "No se ejecutó la revisión trimestral de accesos privilegiados según política interna. 12 usuarios con roles críticos no revisados en el último trimestre.",
    recommendation: "Ejecutar revisión de accesos inmediata y establecer proceso automatizado de recertificación trimestral.",
    control: "CTR-1044", auditor: "R. Jiménez", status: "pending", riskAccepted: false, riskAcceptanceJustification: "", expanded: false,
    actionPlans: []
  },
];

export default function FindingsView() {
  const [findings, setFindings] = useState<Finding[]>(FINDINGS_INIT);
  const [showNewFinding, setShowNewFinding] = useState(false);
  const [showNewAP, setShowNewAP] = useState<string | null>(null);
  const [approvalComments, setApprovalComments] = useState<Record<string, string>>({});
  const [simulating, setSimulating] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const toggleExpand = (id: string) => {
    setFindings(prev => prev.map(f => f.id === id ? { ...f, expanded: !f.expanded } : f));
  };

  const approveAP = (findingId: string, apId: string, approved: boolean) => {
    setFindings(prev => prev.map(f => f.id === findingId ? {
      ...f,
      actionPlans: f.actionPlans.map(ap => ap.id === apId ? {
        ...ap,
        approvalStatus: approved ? "Aprobado" : "Rechazado",
        approvalComment: approvalComments[apId] || ""
      } : ap)
    } : f));
  };

  const toggleRiskAcceptance = (id: string) => {
    setFindings(prev => prev.map(f => f.id === id ? { ...f, riskAccepted: !f.riskAccepted } : f));
  };

  const addActionPlan = (findingId: string) => {
    setFindings(prev => prev.map(f => f.id === findingId ? {
      ...f,
      actionPlans: [...f.actionPlans, {
        id: `PA-${Date.now()}`, description: "Nuevo plan de acción", responsible: "",
        dueDate: "2025-09-30", status: "Definido", mitigationImpact: 3,
        approvalStatus: "Pendiente", approvalComment: ""
      }]
    } : f));
    setShowNewAP(null);
  };

  const totalFindings = findings.length;
  const criticalFindings = findings.filter(f => f.vulnerability === "Crítico").length;
  const openAPs = findings.flatMap(f => f.actionPlans).filter(ap => ap.status !== "Validado").length;

  return (
    <div className="flex-1 overflow-auto p-6" style={FONT_STYLE}>
      <Breadcrumbs items={["Auditorías", "AUD-2025-041", "Hallazgos"]} />
      <PageHeader
        title="Hallazgos & Planes de Acción"
        subtitle="SOX Financiero — Cuentas por Pagar · AUD-2025-041"
        actions={
          <PrimaryBtn small icon={<Plus size={12} />} onClick={() => setShowNewFinding(true)}>Nuevo Hallazgo</PrimaryBtn>
        }
      />

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total Hallazgos", value: totalFindings, color: "text-primary" },
          { label: "Críticos", value: criticalFindings, color: criticalFindings > 0 ? "text-red-600" : "text-emerald-600" },
          { label: "Planes Activos", value: openAPs, color: "text-amber-600" },
          { label: "Riesgo Residual Prom.", value: Math.round(findings.reduce((s, f) => s + f.residualRisk, 0) / findings.length), color: "text-red-600" },
        ].map(k => (
          <Card key={k.label} className="p-3">
            <div className={`text-2xl font-bold tracking-tight ${k.color}`}>{k.value}</div>
            <div className="text-xs font-semibold text-foreground mt-0.5">{k.label}</div>
          </Card>
        ))}
      </div>

      {/* Findings list */}
      <div className="space-y-4">
        {findings.map(finding => {
          const simMitigated = simulating === finding.id
            ? Math.max(0, finding.residualRisk - finding.actionPlans.reduce((s, ap) => s + ap.mitigationImpact, 0))
            : null;

          return (
            <Card key={finding.id}>
              {/* Finding header */}
              <button onClick={() => toggleExpand(finding.id)}
                className="w-full flex items-start gap-3 px-4 py-4 hover:bg-secondary/20 transition-colors text-left">
                <AlertTriangle size={16} className={`flex-shrink-0 mt-0.5 ${finding.vulnerability === "Crítico" ? "text-red-500" : finding.vulnerability === "Alto" ? "text-orange-500" : "text-amber-500"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground">{finding.id}</span>
                    <span className="text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full">{finding.type}</span>
                    <NivelBadge nivel={finding.vulnerability} />
                    <StatusBadge status={finding.status} />
                    {finding.riskAccepted && (
                      <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">Riesgo Aceptado</span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-foreground">{finding.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Control: {finding.control} · Auditor: {finding.auditor}</div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <RiskGauge value={finding.residualRisk} label="Riesgo Residual" />
                  {finding.expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                </div>
              </button>

              {/* Expanded content */}
              {finding.expanded && (
                <div className="border-t border-border">
                  {/* Root cause & recommendation */}
                  <div className="px-4 py-4 grid grid-cols-2 gap-4 border-b border-border">
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Causa Raíz</div>
                      <p className="text-sm text-foreground leading-relaxed">{finding.rootCause}</p>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Recomendación</div>
                      <p className="text-sm text-foreground leading-relaxed">{finding.recommendation}</p>
                    </div>
                  </div>

                  {/* Action Plans */}
                  <div className="px-4 py-4 border-b border-border">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Target size={14} className="text-primary" />
                        Planes de Acción
                        <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-medium">
                          {finding.actionPlans.length}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {finding.actionPlans.length > 0 && (
                          <button
                            onClick={() => setSimulating(simulating === finding.id ? null : finding.id)}
                            className={`text-xs px-3 py-1.5 rounded-md font-semibold border transition-colors ${
                              simulating === finding.id
                                ? "bg-violet-600 text-white border-violet-600"
                                : "border-violet-300 text-violet-700 hover:bg-violet-50"
                            }`}>
                            <TrendingDown size={12} className="inline mr-1" />
                            {simulating === finding.id ? "Ocultando simulación" : "Simular mitigación"}
                          </button>
                        )}
                        <PrimaryBtn small icon={<Plus size={11} />} onClick={() => addActionPlan(finding.id)}>Nuevo Plan</PrimaryBtn>
                      </div>
                    </div>

                    {/* Simulation panel */}
                    {simulating === finding.id && simMitigated !== null && (
                      <div className="mb-4 bg-violet-50 border border-violet-200 rounded-lg p-4">
                        <div className="text-xs font-semibold text-violet-800 uppercase tracking-wide mb-3">
                          Simulación de Mitigación — Efecto Proyectado
                        </div>
                        <div className="flex items-center gap-8 justify-center">
                          <div className="text-center">
                            <div className="text-xs text-muted-foreground mb-1">Riesgo Actual</div>
                            <RiskGauge value={finding.residualRisk} />
                          </div>
                          <ArrowRight size={24} className="text-violet-400" />
                          <div className="text-center">
                            <div className="text-xs text-muted-foreground mb-1">Post-Implementación</div>
                            <RiskGauge value={simMitigated} />
                          </div>
                          <div className="bg-white rounded-lg border border-violet-200 p-3 text-center">
                            <div className="text-xs text-violet-700 font-semibold">Reducción</div>
                            <div className="text-2xl font-bold text-violet-700">{finding.residualRisk - simMitigated}</div>
                            <div className="text-xs text-violet-600">puntos</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {finding.actionPlans.length === 0 ? (
                      <div className="text-center py-6 text-sm text-muted-foreground bg-muted/30 rounded-lg">
                        Sin planes de acción definidos. Agrega uno para iniciar la remediación.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {finding.actionPlans.map(ap => (
                          <div key={ap.id} className="bg-muted/30 rounded-lg border border-border p-3">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-mono text-[10px] text-muted-foreground">{ap.id}</span>
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ACTION_STATUS_COLORS[ap.status]}`}>{ap.status}</span>
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${APPROVAL_COLORS[ap.approvalStatus]}`}>{ap.approvalStatus}</span>
                                </div>
                                <div className="text-sm text-foreground">{ap.description}</div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1"><User size={10} />{ap.responsible}</span>
                                  <span className="flex items-center gap-1"><Clock size={10} />{ap.dueDate}</span>
                                  <span className="flex items-center gap-1 text-violet-600 font-semibold">
                                    <TrendingDown size={10} />-{ap.mitigationImpact} pts
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Approval workflow */}
                            {ap.approvalStatus === "Pendiente" && (
                              <div className="mt-2 pt-2 border-t border-border">
                                <div className="text-xs text-muted-foreground mb-1.5">Comentario de aprobación:</div>
                                <input
                                  value={approvalComments[ap.id] || ""}
                                  onChange={e => setApprovalComments(prev => ({ ...prev, [ap.id]: e.target.value }))}
                                  placeholder="Comentario opcional…"
                                  className="w-full text-xs bg-card border border-border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30 mb-2 placeholder:text-muted-foreground"
                                />
                                <div className="flex gap-2">
                                  <button onClick={() => approveAP(finding.id, ap.id, true)}
                                    className="flex-1 text-xs py-1.5 rounded-md font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1">
                                    <Check size={11} />Aprobar
                                  </button>
                                  <button onClick={() => approveAP(finding.id, ap.id, false)}
                                    className="flex-1 text-xs py-1.5 rounded-md font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center justify-center gap-1">
                                    <X size={11} />Rechazar
                                  </button>
                                </div>
                              </div>
                            )}
                            {ap.approvalComment && ap.approvalStatus !== "Pendiente" && (
                              <div className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground">
                                <span className="font-semibold">Comentario AI: </span>{ap.approvalComment}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Risk Acceptance */}
                  <div className="px-4 py-3 flex items-center justify-between bg-muted/20">
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Aceptación del Riesgo</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {finding.riskAccepted
                          ? "El área auditada ha aceptado formalmente el riesgo residual"
                          : "El riesgo residual requiere remediación o aceptación formal"}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {!finding.riskAccepted ? (
                        <button onClick={() => toggleRiskAcceptance(finding.id)}
                          className="text-xs px-3 py-1.5 rounded-md font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors">
                          Registrar Aceptación
                        </button>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
                          <CheckCircle2 size={12} />Riesgo aceptado
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* New Finding Modal */}
      {showNewFinding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-card rounded-xl shadow-2xl w-[540px] max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="text-base font-bold text-foreground">Nuevo Hallazgo</div>
              <button onClick={() => setShowNewFinding(false)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { label: "Nombre del Hallazgo", type: "text", placeholder: "Describa el hallazgo encontrado" },
              ].map(f => (
                <div key={f.label}>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">{f.label}</label>
                  <input type={f.type} placeholder={f.placeholder}
                    className="w-full text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Tipo</label>
                  <select className="w-full text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30">
                    {["Hallazgo","Observación","Debilidad Material","Deficiencia Significativa"].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Nivel de Vulnerabilidad</label>
                  <select className="w-full text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30">
                    {["Crítico","Alto","Medio","Bajo"].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Causa Raíz</label>
                <textarea rows={3} placeholder="Describa la causa raíz del hallazgo…"
                  className="w-full text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none placeholder:text-muted-foreground" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Recomendación</label>
                <textarea rows={3} placeholder="Describa la recomendación de remediación…"
                  className="w-full text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none placeholder:text-muted-foreground" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Control Relacionado</label>
                  <select className="w-full text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30">
                    {["CTR-1041","CTR-1042","CTR-1043","CTR-1044","CTR-1045"].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Riesgo Residual (1–25)</label>
                  <input type="number" min={1} max={25} defaultValue={12}
                    className="w-full text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <GhostBtn onClick={() => setShowNewFinding(false)}>Cancelar</GhostBtn>
              <PrimaryBtn icon={<Save size={14} />} onClick={() => { setShowNewFinding(false); }}>Guardar Hallazgo</PrimaryBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
