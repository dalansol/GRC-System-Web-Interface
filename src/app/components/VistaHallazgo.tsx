import React, { useState } from "react";
import { toast } from "sonner";

import {
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  Filter,
  Flag,
  Info,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import FormularioHallazgo from "./FormularioHallazgo";

import type {
  CreatedFinding,
  FindingControlOption,
} from "./FormularioHallazgo";

import {
  Breadcrumbs,
  PageHeader,
  Card,
  PrimaryBtn,
  GhostBtn,
  PDFPreviewModal,
  RiskLevelBadge,
  exportToCSV,
} from "./SharedComponents";

import type {
  Finding
} from "./SharedComponents";

import EvidenciasSection from "./EvidenciasSection";
import { INITIAL_FINDINGS, CONTROLS } from "../data/mock_data";

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

const controlOptions = CONTROLS.map(control => ({
  id: control.id,
  name: control.controlProcedureName,
  vulnerability: control.currentVulnerability as "Baja" | "Media" | "Alta",
}));

export default function VistaHallazgo() {
  const handleExport = () => {
    exportToCSV(
      "hallazgos.csv",
      [
        "Folio",
        "Título",
        "Descripción",
        "Tipo",
        "Gravedad",
        "Control Fallido",
        "Riesgo Residual",
        "Estado",
        "Fecha",
      ],
      findings.map(f => [
        f.folio,
        f.title,
        f.description ?? "",
        f.type ?? "",
        f.severity,
        f.failedControl,
        f.residualRisk,
        f.status,
        f.date,
      ]),
    );
  };

  const [findings, setFindings] = useState<Finding[]>(INITIAL_FINDINGS);
  const [actionModal, setActionModal] = useState<Finding | null>(null);
  const [findingPdf, setFindingPdf] = useState<Finding | null>(null);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [actionForm, setActionForm] = useState({ description: "", responsible: "", dueDate: "" });
  const [actionErr, setActionErr] = useState<Record<string, string>>({});
  const [sevFilter, setSevFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showFindingForm, setShowFindingForm] = useState(false);
  const nextFolio = `HAL-2025-${String(findings.length + 1).padStart(3, "0")}`;

  const filtered = findings.filter(f =>
    (sevFilter === "all" || f.severity === sevFilter) &&
    (statusFilter === "all" || f.status === statusFilter)
  );

  const saveActionPlan = () => {
    const errs: Record<string, string> = {};
    if (!actionForm.description.trim()) errs.description = "Requerido";
    if (!actionForm.responsible.trim()) errs.responsible = "Requerido";
    if (!actionForm.dueDate) errs.dueDate = "Requerido";
    if (Object.keys(errs).length) { setActionErr(errs); return; }
    setFindings(prev => prev.map(f => f.id === actionModal!.id ? {
      ...f, status: "Asignado",
      actionPlan: { description: actionForm.description, responsible: actionForm.responsible, dueDate: actionForm.dueDate, status: "Asignado" },
    } : f));
    setActionModal(null);
    setActionForm({ description: "", responsible: "", dueDate: "" });
    toast.success(`Plan de acción asignado para "${actionModal!.folio}"`);
  };

  const handleFindingCreated = (created: CreatedFinding) => {
    setFindings(current => [
      {
        ...created,
        description: created.description,
        type: created.type,
        status: "Abierto",
      },
      ...current,
    ]);

    setShowFindingForm(false);
  };

  return (
    <div className="flex-1 overflow-auto p-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Breadcrumbs items={["Inicio", "Auditoría", "Hallazgos"]} />
      {showFindingForm && (
        <FormularioHallazgo
          controls={controlOptions}
          nextFolio={nextFolio}
          onCreated={handleFindingCreated}
          onClose={() => setShowFindingForm(false)}
        />
      )}
      <PageHeader
        title="Hallazgos de Auditoría"
        subtitle={`${findings.length} hallazgos registrados`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFindingForm(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
            >
              <Plus size={13} />
              Nuevo hallazgo
            </button>

            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary"
            >
              <Download size={12} />
              Exportar CSV
            </button>

            <button
              onClick={() => setFindingPdf(findings[0])}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary"
            >
              <FileText size={12} />
              Exportar PDF
            </button>
          </div>
        }
      />
      {findingPdf && (
        <PDFPreviewModal
          onClose={() => setFindingPdf(null)}
          doc={{
            title: `Ficha de Hallazgo — ${findingPdf.folio}`,
            subtitle: findingPdf.title,
            sections: [
              {
                heading: "Datos del Hallazgo",
                rows: [
                  ["Folio", findingPdf.folio],
                  ["Fecha de registro", findingPdf.date],
                  ["Gravedad", findingPdf.severity],
                  ["Estado", findingPdf.status],
                  ["Riesgo residual", findingPdf.residualRisk],
                ],
              },
              {
                heading: "Control Fallido",
                rows: [
                  ["ID de control", findingPdf.failedControlId],
                  ["Descripción", findingPdf.failedControl],
                ],
              },
              ...(findingPdf.actionPlan ? [{
                heading: "Plan de Acción",
                rows: [
                  ["Descripción", findingPdf.actionPlan.description],
                  ["Responsable", findingPdf.actionPlan.responsible],
                  ["Fecha compromiso", findingPdf.actionPlan.dueDate],
                  ["Estado del plan", findingPdf.actionPlan.status],
                ] as [string, string][],
              }] : []),
              {
                heading: "Resumen Global",
                rows: [
                  ["Total hallazgos", String(findings.length)],
                  ["Abiertos", String(findings.filter(f => f.status === "Abierto").length)],
                  ["Asignados", String(findings.filter(f => f.status === "Asignado").length)],
                  ["Cerrados", String(findings.filter(f => f.status === "Cerrado").length)],
                ],
              },
            ],
          }}
        />
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        <Filter size={12} className="text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">Gravedad:</span>
        {["all", "Crítico", "Alto", "Medio", "Bajo"].map(f => (
          <button key={f} onClick={() => setSevFilter(f)}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${sevFilter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
            {f === "all" ? "Todos" : f}
          </button>
        ))}
        <div className="w-px h-4 bg-border mx-1" />
        <span className="text-xs text-muted-foreground font-medium">Estado:</span>
        {["all", "Abierto", "En Revisión", "Asignado", "Cerrado"].map(f => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${statusFilter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
            {f === "all" ? "Todos" : f}
          </button>
        ))}
      </div>

      <Card>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Flag size={28} className="text-muted-foreground/30 mb-3" />
            <div className="text-sm font-semibold text-muted-foreground">Sin hallazgos con estos filtros</div>
            <button onClick={() => { setSevFilter("all"); setStatusFilter("all"); }} className="mt-2 text-xs text-accent font-semibold hover:underline">Limpiar filtros</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Folio", "Título", "Gravedad", "Control Fallido", "Riesgo Residual", "Estado", "Fecha", ""].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(f => {
                  const isExpanded = expandedFinding === f.id;
                  return (
                    <React.Fragment key={f.id}>
                      <tr
                        className={`transition-colors cursor-pointer group ${isExpanded ? "bg-secondary/40" : "hover:bg-secondary/30"}`}
                        onClick={() => setExpandedFinding(isExpanded ? null : f.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground transition-transform" style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>
                              <ChevronRight size={12} />
                            </span>
                            <span className="font-mono text-xs font-bold text-primary bg-primary/8 px-2 py-0.5 rounded-md">{f.folio}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <div className="font-medium text-foreground text-sm line-clamp-2">{f.title}</div>
                          {f.actionPlan && (
                            <div className="text-[10px] text-emerald-600 mt-0.5 flex items-center gap-1">
                              <CheckCircle2 size={10} /> Plan asignado — {f.actionPlan.dueDate}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SEV_COLOR[f.severity]}`}>{f.severity}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          <span className="font-mono text-primary">{f.failedControlId}</span>
                          <div className="text-[10px] mt-0.5 max-w-[140px] truncate">{f.failedControl}</div>
                        </td>
                        <td className="px-4 py-3"><RiskLevelBadge level={f.residualRisk} /></td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${FIND_STATUS_CFG[f.status]}`}>{f.status}</span>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{f.date}</td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          {!f.actionPlan && f.status !== "Cerrado" && (
                            <button onClick={() => setActionModal(f)}
                              className="text-xs px-2.5 py-1 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 transition-colors whitespace-nowrap">
                              Crear plan
                            </button>
                          )}
                        </td>
                        <td
                          className="px-4 py-3"
                          onClick={event => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            disabled
                            title="La eliminación está deshabilitada para mantener la trazabilidad"
                            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground opacity-50"
                          >
                            <Trash2 size={12} />
                            Eliminar
                          </button>

                          {f.status === "En Revisión" && (
                            <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-700">
                              <Info size={10} />
                              No se puede eliminar porque el hallazgo ya está en revisión.
                            </div>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="px-4 pb-4 bg-secondary/20 border-b border-border">
                            <div className="pt-3 space-y-3">
                              {f.actionPlan && (
                                <div className="bg-white rounded-lg border border-border p-4">
                                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Plan de remediación</div>
                                  <p className="text-sm text-foreground mb-3">{f.actionPlan.description}</p>
                                  <div className="grid grid-cols-3 gap-4 text-xs">
                                    <div><div className="text-muted-foreground font-semibold mb-0.5">Responsable</div><div className="text-foreground font-medium">{f.actionPlan.responsible}</div></div>
                                    <div><div className="text-muted-foreground font-semibold mb-0.5">Fecha compromiso</div><div className="font-mono text-foreground">{f.actionPlan.dueDate}</div></div>
                                    <div><div className="text-muted-foreground font-semibold mb-0.5">Estado</div><div className="text-foreground">{f.actionPlan.status}</div></div>
                                  </div>
                                </div>
                              )}
                              <EvidenciasSection entityId={f.id} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Action Plan Modal */}
      {actionModal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setActionModal(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl shadow-2xl w-full max-w-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-bold text-foreground">Crear Plan de Acción</div>
                  <div className="text-xs text-muted-foreground mt-0.5 font-mono">{actionModal.folio} — {actionModal.title.slice(0, 50)}…</div>
                </div>
                <button onClick={() => setActionModal(null)} className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"><X size={16} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Descripción del plan de remediación</label>
                  <textarea
                    value={actionForm.description} rows={3} placeholder="Describe las acciones a tomar para cerrar este hallazgo…"
                    onChange={e => { setActionForm(f => ({ ...f, description: e.target.value })); setActionErr(e => ({ ...e, description: "" })); }}
                    className={`w-full text-sm px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none ${actionErr.description ? "border-red-400" : "border-border"}`}
                  />
                  {actionErr.description && <div className="text-xs text-red-600 mt-0.5">{actionErr.description}</div>}
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Responsable auditado</label>
                  <input
                    value={actionForm.responsible} placeholder="Nombre y área del responsable"
                    onChange={e => { setActionForm(f => ({ ...f, responsible: e.target.value })); setActionErr(e => ({ ...e, responsible: "" })); }}
                    className={`w-full text-sm px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 ${actionErr.responsible ? "border-red-400" : "border-border"}`}
                  />
                  {actionErr.responsible && <div className="text-xs text-red-600 mt-0.5">{actionErr.responsible}</div>}
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Fecha de compromiso</label>
                  <input
                    type="date" value={actionForm.dueDate}
                    onChange={e => { setActionForm(f => ({ ...f, dueDate: e.target.value })); setActionErr(e => ({ ...e, dueDate: "" })); }}
                    className={`w-full text-sm px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 ${actionErr.dueDate ? "border-red-400" : "border-border"}`}
                  />
                  {actionErr.dueDate && <div className="text-xs text-red-600 mt-0.5">{actionErr.dueDate}</div>}
                </div>
              </div>
              <div className="flex gap-3 mt-5 pt-4 border-t border-border">
                <PrimaryBtn icon={<Check size={14} />} onClick={saveActionPlan}>Asignar plan</PrimaryBtn>
                <GhostBtn onClick={() => setActionModal(null)}>Cancelar</GhostBtn>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}