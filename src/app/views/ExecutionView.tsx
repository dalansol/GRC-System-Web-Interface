import { useState } from "react";
import {
  ClipboardCheck, Upload, Lock, Unlock, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronUp, Users, FileText, Plus, Save, Check,
  BarChart3, Layers, Target, X, Sparkles, Loader2
} from "lucide-react";
import {
  Breadcrumbs, PageHeader, Card, SectionCard, PrimaryBtn, GhostBtn,
  StatusBadge, ProgressBar, RiskGauge, FONT_STYLE, StatusKey, EmptyState
} from "../components/shared/SharedComponents";

// ─── Types & Data ─────────────────────────────────────────────────────────────
type MaturityLevel = 1 | 2 | 3 | 4 | 5;
type SamplingMethod = "estadístico" | "juicio" | "haphazard";

interface Control {
  id: string; name: string; process: string; owner: string;
  status: StatusKey; designEff: MaturityLevel | null; opEff: MaturityLevel | null;
  evidenceCount: number; samplingMethod: SamplingMethod | null;
  sampleSize: number | null; deficiencies: string;
}

const MATURITY_LABELS: Record<MaturityLevel, { label: string; color: string }> = {
  1: { label: "Inicial",      color: "#C8271C" },
  2: { label: "Repetible",    color: "#d97706" },
  3: { label: "Definido",     color: "#eab308" },
  4: { label: "Gestionado",   color: "#2B6FD4" },
  5: { label: "Optimizado",   color: "#16a34a" },
};

const CONTROLS_INIT: Control[] = [
  { id: "CTR-1041", name: "Segregación de funciones — Cierre contable", process: "Cierre Financiero", owner: "L. Herrera", status: "in_progress", designEff: 4, opEff: 3,    evidenceCount: 2, samplingMethod: "estadístico", sampleSize: 25,   deficiencies: "Control parcialmente implementado. Falta actualizar matriz RACI." },
  { id: "CTR-1042", name: "Revisión por Dirección Financiera — Mensual",process: "Cierre Financiero", owner: "P. Morales", status: "completed",   designEff: 5, opEff: 5,    evidenceCount: 4, samplingMethod: "juicio",       sampleSize: 10,   deficiencies: "" },
  { id: "CTR-1043", name: "Conciliación automática bancaria",           process: "Tesorería",         owner: "A. Costa",   status: "overdue",     designEff: 3, opEff: 2,    evidenceCount: 1, samplingMethod: "estadístico", sampleSize: 30,   deficiencies: "Múltiples partidas no conciliadas. Proceso manual sin supervisión." },
  { id: "CTR-1044", name: "Revisión de accesos — Aplicativo SAP",       process: "TI & Seguridad",   owner: "R. Jiménez", status: "pending",     designEff: null, opEff: null, evidenceCount: 0, samplingMethod: null,        sampleSize: null, deficiencies: "" },
  { id: "CTR-1045", name: "Aprobación multinivel — Compras >$50k",      process: "Adquisiciones",    owner: "M. García",  status: "pending",     designEff: null, opEff: null, evidenceCount: 0, samplingMethod: null,        sampleSize: null, deficiencies: "" },
];

const WALKTHROUGHS = [
  { id: "WT-01", process: "Cierre Financiero Mensual", description: "El proceso de cierre financiero comienza el día 1 hábil de cada mes con la consolidación de saldos de todas las subsidiarias. El equipo de Contabilidad Corporativa revisa las conciliaciones bancarias, verifica partidas de ajuste y emite los estados financieros preliminares antes del día 10.", status: "completed" as StatusKey },
  { id: "WT-02", process: "Gestión de Accesos — SAP", description: "Los accesos al sistema SAP son gestionados por el equipo de TI bajo solicitud formal. Cada trimestre se realiza una revisión de perfiles activos. El proceso incluye aprobación del responsable del área y registro en el sistema de tickets.", status: "in_progress" as StatusKey },
];

const EVIDENCE_FILES = [
  { name: "Cierre_Financiero_Jun2025.xlsx", size: "2.4 MB", confidential: true,  uploadedBy: "L. Herrera", date: "2025-07-08" },
  { name: "Conciliacion_Bancaria_Q2.pdf",   size: "840 KB", confidential: false, uploadedBy: "A. Costa",   date: "2025-07-10" },
  { name: "Evidencia_Controles_CTR1041.zip", size: "15.2 MB",confidential: true, uploadedBy: "P. Morales", date: "2025-07-12" },
];

const TABS = [
  { id: "walkthrough", label: "Entendimiento",  icon: <Layers size={14} /> },
  { id: "controls",   label: "Controles",       icon: <ClipboardCheck size={14} /> },
  { id: "sampling",   label: "Muestreo",        icon: <BarChart3 size={14} /> },
  { id: "evidence",   label: "Evidencias",      icon: <FileText size={14} /> },
];

export default function ExecutionView() {
  const [activeTab, setActiveTab] = useState<"walkthrough" | "controls" | "sampling" | "evidence">("controls");
  const [controls, setControls] = useState<Control[]>(CONTROLS_INIT);
  const [selectedControl, setSelectedControl] = useState<Control | null>(null);
  const [draggingDesign, setDraggingDesign] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState("");
  const [savedEval, setSavedEval] = useState(false);
  const [expandedWT, setExpandedWT] = useState<Set<string>>(new Set(["WT-01"]));

  const completed = controls.filter(c => c.status === "completed").length;
  const totalEff = controls.filter(c => c.opEff !== null).reduce((s, c) => s + (c.opEff ?? 0), 0);
  const avgEff = controls.filter(c => c.opEff !== null).length > 0
    ? Math.round((totalEff / (controls.filter(c => c.opEff !== null).length * 5)) * 100)
    : 0;

  const updateControl = (id: string, changes: Partial<Control>) => {
    setControls(prev => prev.map(c => c.id === id ? { ...c, ...changes } : c));
    if (selectedControl?.id === id) setSelectedControl(prev => prev ? { ...prev, ...changes } : null);
  };

  const saveEval = () => {
    if (!selectedControl) return;
    updateControl(selectedControl.id, {
      status: selectedControl.designEff && selectedControl.opEff ? "completed" : "in_progress"
    });
    setSavedEval(true);
    setTimeout(() => setSavedEval(false), 1500);
  };

  const generateAI = () => {
    setAiLoading(true);
    setAiText("");
    setTimeout(() => {
      setAiLoading(false);
      setAiText("Análisis de proceso: El cierre financiero presenta brechas en la segregación de funciones (CTR-1041) con efectividad operativa del 60%. La conciliación bancaria (CTR-1043) muestra deficiencias críticas con múltiples partidas sin conciliar. Se recomienda priorizar la remediación de CTR-1043 antes del Q3 y reforzar los controles de revisión gerencial.");
    }, 1800);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={FONT_STYLE}>
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-border flex-shrink-0 bg-card">
        <Breadcrumbs items={["Auditorías", "AUD-2025-041", "Ejecución"]} />
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded font-bold">AUD-2025-041</span>
              <StatusBadge status="in_progress" />
            </div>
            <h1 className="text-lg font-bold text-foreground">SOX Financiero — Cuentas por Pagar</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Servicios Financieros · México · Responsable: M. García</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Quick stats */}
            <div className="flex gap-3">
              {[
                { label: "Controles", value: controls.length, color: "text-primary" },
                { label: "Completados", value: completed, color: "text-emerald-600" },
                { label: "Ef. Promedio", value: `${avgEff}%`, color: avgEff >= 80 ? "text-emerald-600" : avgEff >= 60 ? "text-amber-600" : "text-red-600" },
                { label: "Evidencias", value: EVIDENCE_FILES.length, color: "text-blue-600" },
              ].map(s => (
                <div key={s.label} className="text-center bg-muted/40 rounded-lg px-3 py-2 min-w-[60px]">
                  <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-muted rounded-lg p-1 mt-4 w-fit">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id as any)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-colors ${activeTab === t.id ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-auto p-5">

          {/* ── WALKTHROUGH ── */}
          {activeTab === "walkthrough" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-foreground">Entendimiento de Procesos</div>
                <PrimaryBtn small icon={<Plus size={12} />}>Agregar Proceso</PrimaryBtn>
              </div>
              {WALKTHROUGHS.map(wt => (
                <Card key={wt.id}>
                  <button onClick={() => setExpandedWT(prev => { const n = new Set(prev); n.has(wt.id) ? n.delete(wt.id) : n.add(wt.id); return n; })}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <StatusBadge status={wt.status} />
                      <span className="text-sm font-semibold text-foreground">{wt.process}</span>
                      <span className="font-mono text-xs text-muted-foreground">{wt.id}</span>
                    </div>
                    {expandedWT.has(wt.id) ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                  </button>
                  {expandedWT.has(wt.id) && (
                    <div className="px-4 pb-4 border-t border-border pt-3">
                      <textarea
                        defaultValue={wt.description}
                        rows={4}
                        className="w-full text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none"
                      />
                      <div className="flex justify-end mt-2">
                        <PrimaryBtn small icon={<Save size={12} />}>Guardar</PrimaryBtn>
                      </div>
                    </div>
                  )}
                </Card>
              ))}

              {/* AI Analysis */}
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={14} className="text-accent" />
                  <div className="text-sm font-semibold text-foreground">Análisis de Proceso con IA</div>
                </div>
                {!aiText && !aiLoading && (
                  <button onClick={generateAI}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-accent border border-accent/30 bg-accent/5 px-4 py-2 rounded-md hover:bg-accent/10 transition-colors">
                    <Sparkles size={14} />Generar análisis de riesgos del proceso
                  </button>
                )}
                {aiLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 rounded-md px-4 py-3">
                    <Loader2 size={14} className="animate-spin text-primary" />Analizando procesos y controles…
                  </div>
                )}
                {aiText && (
                  <div className="bg-accent/5 border border-accent/20 rounded-md p-4">
                    <p className="text-sm text-foreground leading-relaxed">{aiText}</p>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ── CONTROLS ── */}
          {activeTab === "controls" && (
            <SectionCard title="Controles Asignados" count={controls.length} icon={<ClipboardCheck size={15} />}
              action={<PrimaryBtn small icon={<Plus size={12} />}>Agregar Control</PrimaryBtn>}>
              <div className="divide-y divide-border">
                {controls.map(ctrl => {
                  const isSelected = selectedControl?.id === ctrl.id;
                  const designColor = ctrl.designEff ? MATURITY_LABELS[ctrl.designEff].color : "#A0ABBE";
                  const opColor = ctrl.opEff ? MATURITY_LABELS[ctrl.opEff].color : "#A0ABBE";
                  return (
                    <div key={ctrl.id}
                      className={`px-4 py-3 cursor-pointer group transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-secondary/30"}`}
                      onClick={() => setSelectedControl(isSelected ? null : ctrl)}>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-mono text-xs text-muted-foreground">{ctrl.id}</span>
                            <StatusBadge status={ctrl.status} />
                            {ctrl.deficiencies && <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />}
                          </div>
                          <div className={`text-sm font-medium transition-colors ${isSelected ? "text-primary" : "text-foreground group-hover:text-primary"}`}>{ctrl.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{ctrl.process} · {ctrl.owner}</div>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          {/* Design Effectiveness */}
                          <div className="text-center">
                            <div className="text-[10px] text-muted-foreground mb-0.5">Diseño</div>
                            {ctrl.designEff ? (
                              <div className="flex gap-0.5">
                                {([1,2,3,4,5] as MaturityLevel[]).map(n => (
                                  <div key={n} className="w-3 h-3 rounded-sm" style={{ background: n <= ctrl.designEff! ? designColor : "#E2E8F3" }} />
                                ))}
                              </div>
                            ) : <div className="text-xs text-muted-foreground">—</div>}
                          </div>
                          {/* Operating Effectiveness */}
                          <div className="text-center">
                            <div className="text-[10px] text-muted-foreground mb-0.5">Efectividad</div>
                            {ctrl.opEff ? (
                              <div className="flex gap-0.5">
                                {([1,2,3,4,5] as MaturityLevel[]).map(n => (
                                  <div key={n} className="w-3 h-3 rounded-sm" style={{ background: n <= ctrl.opEff! ? opColor : "#E2E8F3" }} />
                                ))}
                              </div>
                            ) : <div className="text-xs text-muted-foreground">—</div>}
                          </div>
                          {/* Evidence */}
                          <div className="text-center">
                            <div className="text-[10px] text-muted-foreground mb-0.5">Evidencias</div>
                            <div className={`text-sm font-bold ${ctrl.evidenceCount > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>{ctrl.evidenceCount}</div>
                          </div>
                          {isSelected ? <ChevronUp size={14} className="text-primary" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                        </div>
                      </div>

                      {/* Inline Evaluation Panel */}
                      {isSelected && (
                        <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-5" onClick={e => e.stopPropagation()}>
                          {/* Design Effectiveness */}
                          <div>
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Efectividad de Diseño</div>
                            <div className="flex gap-2">
                              {([1,2,3,4,5] as MaturityLevel[]).map(n => {
                                const ml = MATURITY_LABELS[n];
                                const selected = ctrl.designEff === n;
                                return (
                                  <button key={n} onClick={() => updateControl(ctrl.id, { designEff: n })}
                                    className={`flex-1 py-2 rounded-lg border-2 transition-all text-center ${selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                                    title={ml.label}>
                                    <div className="text-sm font-bold" style={{ color: selected ? ml.color : "#A0ABBE" }}>{n}</div>
                                    <div className="text-[8px] text-muted-foreground leading-tight">{ml.label}</div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          {/* Operating Effectiveness */}
                          <div>
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Efectividad Operativa</div>
                            <div className="flex gap-2">
                              {([1,2,3,4,5] as MaturityLevel[]).map(n => {
                                const ml = MATURITY_LABELS[n];
                                const selected = ctrl.opEff === n;
                                return (
                                  <button key={n} onClick={() => updateControl(ctrl.id, { opEff: n })}
                                    className={`flex-1 py-2 rounded-lg border-2 transition-all text-center ${selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                                    title={ml.label}>
                                    <div className="text-sm font-bold" style={{ color: selected ? ml.color : "#A0ABBE" }}>{n}</div>
                                    <div className="text-[8px] text-muted-foreground leading-tight">{ml.label}</div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          {/* Deficiencies */}
                          <div className="col-span-2">
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Deficiencias / Observaciones</div>
                            <textarea
                              value={ctrl.deficiencies}
                              onChange={e => updateControl(ctrl.id, { deficiencies: e.target.value })}
                              rows={2}
                              placeholder="Documente deficiencias identificadas en este control…"
                              className="w-full text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none placeholder:text-muted-foreground"
                            />
                          </div>
                          <div className="col-span-2 flex justify-end">
                            <PrimaryBtn small icon={savedEval ? <Check size={12} /> : <Save size={12} />} onClick={saveEval}>
                              {savedEval ? "¡Guardado!" : "Guardar Evaluación"}
                            </PrimaryBtn>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}

          {/* ── SAMPLING ── */}
          {activeTab === "sampling" && (
            <div className="space-y-4">
              {controls.filter(c => c.samplingMethod).map(ctrl => (
                <Card key={ctrl.id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-mono text-xs text-muted-foreground">{ctrl.id}</div>
                      <div className="text-sm font-semibold text-foreground mt-0.5">{ctrl.name}</div>
                    </div>
                    <StatusBadge status={ctrl.status} />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Método</div>
                      <select defaultValue={ctrl.samplingMethod!}
                        className="w-full text-sm bg-input-background border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30 capitalize">
                        {["estadístico","juicio","haphazard"].map(m => <option key={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Tamaño Muestra</div>
                      <input type="number" defaultValue={ctrl.sampleSize!}
                        className="w-full text-sm bg-input-background border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Ítems Examinados</div>
                      <input type="number" defaultValue={ctrl.sampleSize!}
                        className="w-full text-sm bg-input-background border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Proyección / Resultado del Modelo</div>
                    <div className="bg-muted/40 rounded-md p-3 text-xs text-muted-foreground">
                      {ctrl.samplingMethod === "estadístico"
                        ? `Intervalo de confianza: 95% · Error tolerable: 5% · Error proyectado: ${ctrl.status === "completed" ? "1.2%" : "N/A"}`
                        : `Método por juicio profesional · ${ctrl.sampleSize} transacciones revisadas manualmente`}
                    </div>
                  </div>
                  {ctrl.deficiencies && (
                    <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md p-3">
                      <AlertTriangle size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-800">{ctrl.deficiencies}</div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}

          {/* ── EVIDENCE ── */}
          {activeTab === "evidence" && (
            <div className="space-y-4">
              {/* Upload area */}
              <div
                className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group"
                onDragOver={e => e.preventDefault()}
                onDrop={e => e.preventDefault()}
              >
                <Upload size={28} className="mx-auto mb-3 text-muted-foreground group-hover:text-primary transition-colors" />
                <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">Arrastra archivos aquí o haz clic para seleccionar</div>
                <div className="text-xs text-muted-foreground mt-1">Soporta PDF, Excel, Word, imágenes, ZIP · Máximo 1GB por archivo</div>
                <PrimaryBtn small className="mt-3">Seleccionar Archivos</PrimaryBtn>
              </div>

              {/* Evidence list */}
              <SectionCard title="Evidencias Adjuntas" count={EVIDENCE_FILES.length} icon={<FileText size={15} />}>
                <div className="divide-y divide-border">
                  {EVIDENCE_FILES.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/20 group transition-colors">
                      <FileText size={16} className="text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">{f.name}</div>
                        <div className="text-xs text-muted-foreground">{f.size} · Subido por {f.uploadedBy} · {f.date}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {f.confidential ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                            <Lock size={10} />Confidencial
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            <Unlock size={10} />Estándar
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          )}
        </div>

        {/* Right Panel — Progress Summary */}
        <div className="w-64 border-l border-border bg-card flex-shrink-0 overflow-auto p-4 space-y-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Resumen de Avance</div>

          {/* Circular progress */}
          <div className="flex flex-col items-center py-2">
            <div className="relative w-24 h-24">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#E2E8F3" strokeWidth="12" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="#1A4FA0" strokeWidth="12"
                  strokeDasharray={`${(completed / controls.length) * 251.3} 251.3`}
                  strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-xl font-bold text-primary">{completed}/{controls.length}</div>
                <div className="text-[9px] text-muted-foreground">controles</div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">Efectividad promedio: <span className="font-semibold text-foreground">{avgEff}%</span></div>
          </div>

          {/* By status */}
          <div className="space-y-2">
            {(["completed", "in_progress", "overdue", "pending"] as StatusKey[]).map(s => {
              const cnt = controls.filter(c => c.status === s).length;
              return (
                <div key={s} className="flex items-center justify-between">
                  <StatusBadge status={s} />
                  <span className="text-xs font-bold text-foreground">{cnt}</span>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border pt-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Controles por Proceso</div>
            {["Cierre Financiero", "Tesorería", "TI & Seguridad", "Adquisiciones"].map(proc => {
              const cnt = controls.filter(c => c.process === proc).length;
              const done = controls.filter(c => c.process === proc && c.status === "completed").length;
              return (
                <div key={proc} className="mb-2">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                    <span className="truncate">{proc}</span>
                    <span>{done}/{cnt}</span>
                  </div>
                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: cnt > 0 ? `${(done / cnt) * 100}%` : "0%" }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border pt-3">
            <PrimaryBtn small className="w-full justify-center">Ir a Hallazgos →</PrimaryBtn>
          </div>
        </div>
      </div>
    </div>
  );
}
