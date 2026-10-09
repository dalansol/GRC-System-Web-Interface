export {
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
};

import { useState } from "react";
import { toast } from "sonner";

import {
  ChevronRight,
  FileText,
  X,
  Sparkles,
  Loader2,
  Download,
  AlertTriangle,
  Info
} from "lucide-react";

import {STATUS_CONFIG} from "../data/mock_data"
import { consultarVista, type EstadoRespuesta } from "../api/asistente";
import { ErrorApi } from "../api/cliente";
import { contextoPorEtiqueta } from "../domain/contextoVista";

export type {
  // Types
  DetailType,
  StatusKey,
  NavView,
  View,
  Navigate,
  // Interfaces
  Task,
  NavItem,
  GeneralRisk,
  AuditEntity,
  AuditDocument,
  AuditRecord,
  SpecificRisk,
  ControlRecord,
  ProcedureTracking,
  PlanEntity,
  AuditPlan,
  BilacoraEntry,
  ActionPlan,
  Finding,
  UserRecord
};



// ─── Shared Types ───────────────────────────────────────────────────────
type Navigate = (type: DetailType, id: string) => void;

type DetailType =
  "general_risk" | "specific_risk" | "audit_entity" | "control";

type StatusKey =
  "completed" | "in_progress" | "overdue" | "pending";

type NavView =
  "dashboard" | "filter" | "editor" | "hierarchy" | "settings" | "users"
  | "plans" | "findings" | "auditado" | "bitacora" | "controles";

type View = NavView; // alias kept for existing components

// ─── Data Interfaces ─────────────────────────────────────────────────────────

interface UserRecord {
  id: string; name: string; email: string;
  role: string; status: "active" | "inactive"; lastLogin: string;
}


interface Task {
  id: string;
  name: string;
  status: StatusKey;
  dueDate: string;
  owner: string;
  type: string;
}

interface AuditDocument {
  id: string; name: string; type: "pdf" | "docx" | "xlsx" | "pptx"; size: string; date: string;
}
interface AuditRecord {
  id: string; name: string; type: string; status: StatusKey;
  entity: string; responsible: string; startDate: string; endDate: string;
  scope: string; documents: AuditDocument[];
}

interface NavItem {
  id: NavView;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}


interface GeneralRisk {
  id: string;
  name: string;
  description: string;
  auditDepartment: string;
}
interface AuditEntity {
  id: string;
  name: string;
  auditDepartment: string;
  auditDomain: string;
  divisionName: string;
  country: string;
}
interface SpecificRisk {
  id: string;
  generalRiskId: string;
  auditEntityId: string;
  inherentRiskLevel: string;
  residualRiskLevel: string;
  businessDeptName: string;
  businessName: string;
  divisionName: string;
  country: string;
  description: string;
}
interface ControlRecord {
  id: string;
  auditEntityId: string;
  specificRiskIds: string[];
  controlProcedureName: string;
  validityStatus: string;
  businessControlNumber: string;
  controlActivity: string;
  currentVulnerability: string;
  controlType: string;
  frequency: string;
  sampleSize: string;
  rotation: string;
  controlStatus: string;
}
interface ProcedureTracking {
  id: string;
  controlId: string;
  procedureName: string;
  identificator: string;
  businessDeptName: string;
  businessName: string;
  divisionName: string;
  area: string;
  country: string;
}
interface PlanEntity {
  id: string;
  name: string;
  auditDepartment: string;
  year: number;
  status: StatusKey;
  scope: string;
}

interface AuditPlan {
  id: string;
  code: string;
  name: string;
  type: "Anual" | "Trimestral";
  period: string;
  startDate: string;
  endDate: string;
  status: "Borrador" | "Aprobado" | "En Ejecución" | "Cerrado";
  estimatedHours: number;
  responsible: string;
  scope: string;
}



interface BilacoraEntry {
  id: string;
  user: string;
  action: string;
  entity: string;
  entityId: string;
  date: string;
}

interface ActionPlan {
  description: string;
  responsible: string;
  dueDate: string;
  status: "Asignado" | "En Progreso" | "Completado";
}

interface Finding {
  id: string;
  folio: string;
  title: string;
  description?: string;
  type?: string;
  severity: "Crítico" | "Alto" | "Medio" | "Bajo";
  failedControl: string;
  failedControlId: string;
  residualRisk: string;
  status: "Abierto" | "En Revisión" | "Cerrado" | "Asignado";
  actionPlan?: ActionPlan;
  auditId: string;
  date: string;
}

// ─── Shared Components ───────────────────────────────────────────────────────
function StatusBadge({ status }: { status: StatusKey }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function Breadcrumbs({ items }: { items: string[] }) {
  return (
    <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && (
            <ChevronRight
              size={12}
              className="text-muted-foreground/50"
            />
          )}
          <span
            className={
              i === items.length - 1
                ? "text-foreground font-medium"
                : "hover:text-foreground cursor-pointer transition-colors"
            }
          >
            {item}
          </span>
        </span>
      ))}
    </nav>
  );
}

function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2">{actions}</div>
        
      )}
    </div>
    
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-card rounded-lg border border-border shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function PrimaryBtn({
  children,
  onClick,
  icon,
  small,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ReactNode;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold rounded-md hover:bg-primary/90 transition-colors active:scale-[0.98] ${small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"}`}
    >
      {icon}
      {children}
    </button>
  );
}

function GhostBtn({
  children,
  onClick,
  icon,
  small,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ReactNode;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 bg-transparent text-foreground border border-border font-medium rounded-md hover:bg-secondary transition-colors ${small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"}`}
    >
      {icon}
      {children}
    </button>
  );
}

// ─── PDF Preview Modal ───────────────────────────────────────────────────────
interface PDFDoc {
  title: string;
  subtitle: string;
  sections: { heading: string; rows: [string, string][] }[];
}

const PDF_LOGOS = (
  <svg viewBox="0 0 96 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-7 w-auto">
    <rect width="24" height="24" rx="5" fill="#0F4FFF" y="4" />
    <path d="M7 16 L12 10 L17 16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 10 L12 22" stroke="white" strokeWidth="2" strokeLinecap="round" />
    <text x="30" y="22" fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight="700" fontSize="13" fill="#0F1B2D">Expedite</text>
    <text x="30" y="32" fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight="400" fontSize="8" fill="#5A6A85">GRC Platform</text>
  </svg>
);

function PDFPreviewModal({ doc, onClose }: { doc: PDFDoc; onClose: () => void }) {
  const today = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });

  const handleDownload = () => {
    // Simulate download — in production this would call a PDF generation API
    toast.success(`"${doc.title}" descargado correctamente`);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col pointer-events-auto"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          onClick={e => e.stopPropagation()}
        >
          {/* Modal chrome */}
          <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-red-50 rounded-lg"><FileText size={15} className="text-red-600" /></div>
              <div>
                <div className="text-sm font-bold text-foreground">Vista previa — PDF</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Datos simulados · {today}</div>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* PDF preview area */}
          <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
            {/* Simulated PDF paper */}
            <div className="bg-white rounded-xl border border-border shadow-sm mx-auto max-w-xl p-8 text-[13px]">
              {/* PDF header */}
              <div className="flex items-start justify-between mb-6 pb-5 border-b-2 border-primary/20">
                <div>
                  {PDF_LOGOS}
                  <div className="text-[10px] text-muted-foreground mt-1 font-mono">expedite-grc.com</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Fecha de generación</div>
                  <div className="text-xs font-mono text-foreground mt-0.5">{today}</div>
                  <div className="text-[10px] text-muted-foreground mt-2 uppercase tracking-wide font-semibold">Documento</div>
                  <div className="text-[10px] font-mono text-primary mt-0.5">EXP-{Date.now().toString().slice(-6)}</div>
                </div>
              </div>

              {/* Title block */}
              <div className="mb-6">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Expedite GRC · Informe Oficial</div>
                <h1 className="text-lg font-bold text-foreground leading-snug">{doc.title}</h1>
                <p className="text-xs text-muted-foreground mt-1">{doc.subtitle}</p>
              </div>

              {/* Sections */}
              {doc.sections.map((sec, si) => (
                <div key={si} className={si > 0 ? "mt-5" : ""}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="h-px flex-1 bg-border" />
                    <div className="text-[10px] uppercase tracking-widest font-bold text-primary px-2">{sec.heading}</div>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      {sec.rows.map(([label, value], ri) => (
                        <tr key={ri} className={ri % 2 === 0 ? "bg-secondary/30" : ""}>
                          <td className="py-1.5 px-2 font-semibold text-muted-foreground w-2/5 align-top">{label}</td>
                          <td className="py-1.5 px-2 text-foreground align-top">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

              {/* Footer */}
              <div className="mt-8 pt-4 border-t border-border text-[10px] text-muted-foreground flex items-center justify-between">
                <span>Confidencial — Expedite GRC Platform</span>
                <span className="font-mono">Pág. 1 de 1</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="px-5 py-4 border-t border-border flex items-center gap-3 flex-shrink-0">
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors shadow-sm"
            >
              <Download size={14} /> Descargar PDF
            </button>
            <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Shared detail helpers ────────────────────────────────────────────────────
function DetailField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
        {label}
      </div>
      <div className="text-sm font-semibold text-foreground">
        {value}
      </div>
    </div>
  );
}

function RiskLevelBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    Crítico: "bg-red-50 text-red-700 border border-red-200",
    Alto: "bg-orange-50 text-orange-700 border border-orange-200",
    Medio: "bg-amber-50 text-amber-700 border border-amber-200",
    Bajo: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  };
  return (
    <span
      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${map[level] ?? "bg-slate-50 text-slate-600 border border-slate-200"}`}
    >
      {level}
    </span>
  );
}

function ValidityBadge({ status }: { status: string }) {
  const isValid = status === "Válido";
  return (
    <span
      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${isValid ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}
    >
      {status}
    </span>
  );
}

// ─── AI Summary Card ──────────────────────────────────────────────────────────
// Resumen con IA del registro abierto (riesgo, entidad o control), con los mismos datos de la pantalla.
function AISummaryCard({ entityId, entityType }: { entityId: string; entityType: string }) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{ texto: string; estado: EstadoRespuesta } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [desactivado, setDesactivado] = useState(false);
  const contexto = contextoPorEtiqueta(entityType, entityId);

  const generate = async () => {
    if (!contexto) return;
    setLoading(true);
    setSummary(null);
    setError(null);
    try {
      const respuesta = await consultarVista(contexto.vista, contexto.contexto);
      setSummary({ texto: respuesta.texto, estado: respuesta.estado });
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "Ocurrió un error inesperado.");
      // Si la IA no responde, la función se desactiva; el resto de la vista sigue funcionando.
      if (e instanceof ErrorApi && (e.status === 503 || e.status === 0)) setDesactivado(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-5 mt-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-lg">
            <Sparkles size={14} className="text-primary" />
          </div>
          <div className="text-sm font-semibold text-foreground">Asistente IA — Resumen</div>
        </div>
        <button
          onClick={() => void generate()}
          disabled={loading || desactivado || !contexto}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {loading ? "Generando…" : "Generar resumen"}
        </button>
      </div>
      {error && (
        <div role="alert" className="mb-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {!summary && !loading && !error && (
        <p className="text-xs text-muted-foreground bg-secondary/40 rounded-md px-3 py-2.5">
          {contexto
            ? `Haz clic en "Generar resumen" para obtener un análisis con IA de este registro y los controles, riesgos y hallazgos relacionados.`
            : "No hay datos de este registro para el asistente."}
        </p>
      )}
      {loading && (
        <div className="space-y-2">
          {[1, 0.7, 0.5].map((w, i) => (
            <div key={i} className="h-3 bg-primary/10 rounded animate-pulse" style={{ width: `${w * 100}%` }} />
          ))}
        </div>
      )}
      {summary && (
        <div
          className={`rounded-lg p-3.5 text-sm leading-relaxed whitespace-pre-line ${
            summary.estado === "respondida" ? "bg-primary/5 border border-primary/15 text-foreground" : "bg-secondary/40 border border-border text-muted-foreground"
          }`}
        >
          {summary.estado !== "respondida" && <Info size={13} className="mr-1.5 inline-block align-[-2px]" />}
          {summary.texto}
        </div>
      )}
      {summary && (
        <p className="mt-2 text-[10px] text-muted-foreground">Generado por IA con los datos de este registro; verifícalo antes de usarlo.</p>
      )}
    </Card>
  );
}

// ─── CSV Export Utility ────────────────────────────────────────────────────────
function exportToCSV(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

