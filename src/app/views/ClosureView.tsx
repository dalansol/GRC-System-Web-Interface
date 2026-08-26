import { useState } from "react";
import {
  CheckCircle2, AlertTriangle, Check, X, MessageSquare, Clock,
  ChevronDown, ChevronUp, FileText, Lock, Shield
} from "lucide-react";
import {
  Breadcrumbs, PageHeader, Card, SectionCard, PrimaryBtn, GhostBtn,
  StatusBadge, StepIndicator, FONT_STYLE
} from "../components/shared/SharedComponents";

// ─── Types & Data ─────────────────────────────────────────────────────────────
type ApprovalStatus = "pending" | "approved" | "rejected";

interface Approver {
  id: string; name: string; role: string; initials: string;
  status: ApprovalStatus; date: string | null; comment: string;
}

interface CheckItem {
  id: string; label: string; done: boolean; blocker: boolean;
}

const CHECKLIST_ITEMS: CheckItem[] = [
  { id: "c1",  label: "Todos los controles del alcance han sido evaluados",                    done: true,  blocker: true  },
  { id: "c2",  label: "Evidencias adjuntas para cada control evaluado",                         done: true,  blocker: true  },
  { id: "c3",  label: "Todos los hallazgos han sido documentados con causa raíz y recomendación",done: true,  blocker: true  },
  { id: "c4",  label: "Planes de acción definidos para todos los hallazgos críticos",           done: true,  blocker: true  },
  { id: "c5",  label: "Planes de acción aprobados por Auditoría Interna",                       done: false, blocker: true  },
  { id: "c6",  label: "Riesgo residual documentado para todos los hallazgos",                  done: true,  blocker: false },
  { id: "c7",  label: "Walkthrough de procesos completado y documentado",                       done: true,  blocker: false },
  { id: "c8",  label: "Informe borrador revisado por el responsable del compromiso",            done: false, blocker: false },
  { id: "c9",  label: "Hallazgos comunicados al área auditada",                                 done: false, blocker: false },
  { id: "c10", label: "Tiempos de ejecución dentro del presupuesto (±15%)",                    done: true,  blocker: false },
];

const APPROVERS_INIT: Approver[] = [
  { id: "a1", name: "M. García",    role: "Jefatura de Auditoría",    initials: "MG", status: "approved",  date: "2025-07-18", comment: "Trabajo de campo sólido. Hallazgos bien documentados. Proceder a revisión gerencial." },
  { id: "a2", name: "R. Sánchez",   role: "Gerencia de Auditoría",    initials: "RS", status: "pending",   date: null,         comment: "" },
  { id: "a3", name: "D. Villanueva",role: "Dirección de Auditoría",   initials: "DV", status: "pending",   date: null,         comment: "" },
];

export default function ClosureView() {
  const [checklist, setChecklist] = useState<CheckItem[]>(CHECKLIST_ITEMS);
  const [approvers, setApprovers] = useState<Approver[]>(APPROVERS_INIT);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [showFinalModal, setShowFinalModal] = useState(false);
  const [closingNotes, setClosingNotes] = useState("");
  const [closed, setClosed] = useState(false);
  const [expandedApprover, setExpandedApprover] = useState<string | null>("a2");

  const doneCount = checklist.filter(c => c.done).length;
  const blockersDone = checklist.filter(c => c.blocker && !c.done).length === 0;
  const currentApprovalStep = approvers.findIndex(a => a.status === "pending");
  const allApproved = approvers.every(a => a.status === "approved");

  const toggleCheck = (id: string) => {
    setChecklist(prev => prev.map(c => c.id === id ? { ...c, done: !c.done } : c));
  };

  const submitApproval = (approverId: string, approved: boolean) => {
    setApprovers(prev => prev.map(a => a.id === approverId ? {
      ...a,
      status: approved ? "approved" : "rejected",
      date: new Date().toISOString().split("T")[0],
      comment: commentInputs[approverId] || (approved ? "Aprobado sin observaciones adicionales." : "Revisión rechazada. Se requieren correcciones.")
    } : a));
  };

  const closeAudit = () => {
    setClosed(true);
    setShowFinalModal(false);
  };

  const STEP_LABELS = approvers.map(a => ({ label: a.role.split(" ")[0], sublabel: a.name.split(" ")[0] }));
  const completedSteps = approvers.filter(a => a.status === "approved").length;

  return (
    <div className="flex-1 overflow-auto p-6" style={FONT_STYLE}>
      <Breadcrumbs items={["Auditorías", "AUD-2025-041", "Cierre"]} />
      <PageHeader
        title="Cierre de Auditoría"
        subtitle="SOX Financiero — Cuentas por Pagar · AUD-2025-041"
        actions={
          allApproved && blockersDone && !closed ? (
            <PrimaryBtn icon={<Shield size={14} />} onClick={() => setShowFinalModal(true)}>
              Cerrar Auditoría
            </PrimaryBtn>
          ) : closed ? (
            <span className="flex items-center gap-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-md">
              <CheckCircle2 size={14} />Auditoría Cerrada Oficialmente
            </span>
          ) : null
        }
      />

      <div className="grid grid-cols-3 gap-5">
        {/* Left: Checklist + Approval flow */}
        <div className="col-span-2 space-y-5">

          {/* Pre-close Checklist */}
          <Card>
            <div className="px-4 pt-4 pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-primary" />
                  <span className="text-sm font-semibold text-foreground">Criterios Mínimos de Cierre</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    doneCount === checklist.length ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}>
                    {doneCount}/{checklist.length}
                  </span>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  blockersDone ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
                }`}>
                  {blockersDone ? "✓ Bloqueantes cumplidos" : "⛔ Bloqueantes pendientes"}
                </span>
              </div>
            </div>
            <div className="p-4 space-y-2">
              {checklist.map(item => (
                <label key={item.id} className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-secondary/20 transition-colors group ${item.blocker && !item.done ? "bg-red-50/50" : ""}`}>
                  <div
                    onClick={() => toggleCheck(item.id)}
                    className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 border-2 transition-colors cursor-pointer ${
                      item.done ? "bg-emerald-500 border-emerald-500" : "border-border hover:border-primary"
                    }`}>
                    {item.done && <Check size={11} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm transition-colors ${item.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {item.label}
                    </span>
                    {item.blocker && (
                      <span className="ml-2 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                        Requerido
                      </span>
                    )}
                  </div>
                </label>
              ))}
            </div>
          </Card>

          {/* Multi-level Approval Flow */}
          <Card>
            <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield size={15} className="text-primary" />
                <span className="text-sm font-semibold text-foreground">Flujo de Aprobación Multinivel</span>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                allApproved ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : approvers.some(a => a.status === "rejected") ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}>
                {allApproved ? "Completamente Aprobado" : approvers.some(a => a.status === "rejected") ? "Requiere Correcciones" : `Paso ${completedSteps + 1} de ${approvers.length}`}
              </span>
            </div>

            {/* Step indicator */}
            <div className="px-6 py-5 border-b border-border">
              <StepIndicator steps={STEP_LABELS} current={completedSteps} />
            </div>

            {/* Approver details */}
            <div className="divide-y divide-border">
              {approvers.map((approver, i) => {
                const isActive = approver.status === "pending" && i === currentApprovalStep;
                const isExpanded = expandedApprover === approver.id;

                return (
                  <div key={approver.id} className={`${isActive ? "bg-primary/3" : ""}`}>
                    <button
                      onClick={() => setExpandedApprover(isExpanded ? null : approver.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/20 transition-colors text-left">
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        approver.status === "approved" ? "bg-emerald-500 text-white"
                        : approver.status === "rejected" ? "bg-red-500 text-white"
                        : isActive ? "bg-primary text-white"
                        : "bg-muted text-muted-foreground"
                      }`}>
                        {approver.status === "approved" ? <Check size={16} /> : approver.status === "rejected" ? <X size={16} /> : approver.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{approver.name}</span>
                          <span className="text-xs text-muted-foreground">· {approver.role}</span>
                          {isActive && <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">Turno actual</span>}
                        </div>
                        <div className={`text-xs mt-0.5 ${
                          approver.status === "approved" ? "text-emerald-600 font-medium"
                          : approver.status === "rejected" ? "text-red-600 font-medium"
                          : isActive ? "text-primary" : "text-muted-foreground"
                        }`}>
                          {approver.status === "approved" ? `✓ Aprobado el ${approver.date}` :
                           approver.status === "rejected" ? `✗ Rechazado el ${approver.date}` :
                           isActive ? "Pendiente de revisión" : "En espera de pasos anteriores"}
                        </div>
                      </div>
                      {approver.comment && <MessageSquare size={13} className="text-muted-foreground flex-shrink-0" />}
                      {isExpanded ? <ChevronUp size={14} className="text-muted-foreground flex-shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />}
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-border bg-muted/20">
                        {/* Comment area */}
                        {approver.comment ? (
                          <div className={`mt-3 p-3 rounded-lg text-sm ${
                            approver.status === "approved" ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-red-50 text-red-800 border border-red-200"
                          }`}>
                            <div className="flex items-center gap-1.5 text-xs font-semibold mb-1">
                              <MessageSquare size={11} />Comentario de {approver.name.split(" ")[0]}:
                            </div>
                            {approver.comment}
                          </div>
                        ) : isActive ? (
                          <div className="mt-3">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Comentario (opcional)</label>
                            <textarea
                              value={commentInputs[approver.id] || ""}
                              onChange={e => setCommentInputs(prev => ({ ...prev, [approver.id]: e.target.value }))}
                              rows={2}
                              placeholder="Añada observaciones o comentarios a su decisión…"
                              className="w-full text-sm bg-card border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none placeholder:text-muted-foreground mb-2"
                            />
                            <div className="flex gap-2">
                              <button onClick={() => submitApproval(approver.id, true)}
                                className="flex-1 py-2 rounded-md font-semibold text-sm bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5">
                                <Check size={14} />Aprobar
                              </button>
                              <button onClick={() => submitApproval(approver.id, false)}
                                className="flex-1 py-2 rounded-md font-semibold text-sm bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5">
                                <X size={14} />Rechazar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 text-sm text-muted-foreground">Sin acción aún</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right: Summary */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Resumen del Compromiso</div>
            {[
              ["ID", "AUD-2025-041"],
              ["Tipo", "Auditoría Financiera"],
              ["Unidad", "Servicios Financieros"],
              ["País", "México"],
              ["Período", "Jun – Jul 2025"],
              ["Controles", "5 evaluados"],
              ["Hallazgos", "3 identificados"],
              ["Evidencias", "3 adjuntas"],
              ["Horas usadas", "98h / 120h"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between py-1 border-b border-border/50 last:border-0">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-xs font-semibold text-foreground">{value}</span>
              </div>
            ))}
          </Card>

          <Card className="p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Estado del Cierre</div>
            <div className="space-y-2">
              {[
                { label: "Criterios cumplidos", ok: blockersDone },
                { label: "Jefatura aprobó", ok: approvers[0].status === "approved" },
                { label: "Gerencia aprobó", ok: approvers[1].status === "approved" },
                { label: "Dirección aprobó", ok: approvers[2].status === "approved" },
                { label: "Informe generado", ok: false },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${item.ok ? "bg-emerald-500" : "bg-muted"}`}>
                    {item.ok && <Check size={9} className="text-white" />}
                  </div>
                  <span className={`text-xs ${item.ok ? "text-foreground" : "text-muted-foreground"}`}>{item.label}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Documentos de Cierre</div>
            {["Borrador_Informe_AUD2025041.docx", "Hallazgos_Detalle.pdf", "Evidencias_Pack.zip"].map(doc => (
              <div key={doc} className="flex items-center gap-2 p-2 rounded hover:bg-secondary cursor-pointer group transition-colors">
                <FileText size={12} className="text-primary flex-shrink-0" />
                <span className="text-xs text-foreground group-hover:text-primary truncate transition-colors">{doc}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>

      {/* Final Close Modal */}
      {showFinalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-card rounded-xl shadow-2xl w-[480px]">
            <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Shield size={20} className="text-emerald-600" />
              </div>
              <div>
                <div className="text-base font-bold text-foreground">Confirmar Cierre de Auditoría</div>
                <div className="text-xs text-muted-foreground mt-0.5">Esta acción es irreversible</div>
              </div>
            </div>
            <div className="p-6">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-800">
                <AlertTriangle size={12} className="inline mr-1.5" />
                Al cerrar la auditoría, el registro quedará sellado y no podrá modificarse. Los planes de acción continuarán en seguimiento.
              </div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Notas de Cierre</label>
              <textarea
                value={closingNotes}
                onChange={e => setClosingNotes(e.target.value)}
                rows={3}
                placeholder="Resumen ejecutivo del compromiso, lecciones aprendidas, observaciones finales…"
                className="w-full text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="px-6 py-4 border-t border-border flex gap-2 justify-end">
              <GhostBtn onClick={() => setShowFinalModal(false)}>Cancelar</GhostBtn>
              <PrimaryBtn icon={<Lock size={14} />} onClick={closeAudit}>Cerrar Auditoría Oficialmente</PrimaryBtn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
