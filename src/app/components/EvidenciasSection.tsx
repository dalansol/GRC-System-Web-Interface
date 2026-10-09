import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Ban,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Hash,
  Loader2,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";

import { ROLES_ASISTENTE } from "../api/asistente";
import { useSesion } from "../auth/SesionContext";
import PanelAsistenteEvidencia from "./PanelAsistenteEvidencia";
import { Card } from "./SharedComponents";
import SpreadsheetEditor from "./SpreadsheetEditor.tsx";

// ─── Evidencias Section ───────────────────────────────────────────────────────
const BLOCKED_EXTENSIONS = [".exe", ".bat", ".js", ".msi", ".sh", ".cmd", ".vbs", ".ps1"];

const API_BASE = "http://localhost:3000/api";

interface EvidenceFile {
  id: string;
  name: string;
  size: string;
  mimeType: string;
  hash: string;
  uploadDate: string;
  uploadedBy: string;
  entityId: string;
  version?: number;
}

// ─── Fallback mock data (used when the API is unavailable) ────────────────────
const FALLBACK_EVIDENCES: EvidenceFile[] = [
  { id: "EV-001", name: "Conciliacion_Bancaria_Jun2025.xlsx", size: "2.1 MB", mimeType: "xlsx", hash: "sha256:a3f9c12e…4f2a1c0e", uploadDate: "2025-07-12", uploadedBy: "M. García", entityId: "CTR-001" },
  { id: "EV-002", name: "Listado_Accesos_SAP_Q2.pdf", size: "890 KB", mimeType: "pdf", hash: "sha256:b8e4d7c9…e1c8d4b7", uploadDate: "2025-07-15", uploadedBy: "C. Morales", entityId: "CTR-002" },
  { id: "EV-003", name: "Reporte_Accesos_Privilegiados_Jul.pdf", size: "1.4 MB", mimeType: "pdf", hash: "sha256:c9f5e2a8…c1e4f7a0", uploadDate: "2025-07-18", uploadedBy: "L. Fernández", entityId: "CTR-003" },
  { id: "EV-004", name: "Hallazgo_Segregacion_Evidencia.pdf", size: "560 KB", mimeType: "pdf", hash: "sha256:d7a3b9e1…f8c2d5b4", uploadDate: "2025-07-11", uploadedBy: "M. García", entityId: "HAL-001" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatFileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb < 1 ? `${Math.round(bytes / 1024)} KB` : `${mb.toFixed(1)} MB`;
}

/** Map a DB row returned by the API into an EvidenceFile for the UI. */
function mapApiRow(row: any): EvidenceFile {
  return {
    id: row.id,
    name: row.file_name,
    size: formatFileSize(Number(row.file_size)),
    mimeType: row.mime_type,
    hash: `sha256:${String(row.file_hash).slice(0, 8)}…${String(row.file_hash).slice(-8)}`,
    uploadDate: row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    uploadedBy: row.uploaded_by || "Auditor",
    entityId: row.entity_id,
    version: 1,
  };
}

export default function EvidenciasSection({ 
  entityId, 
  entityType = "control",
  controlId,
  findingId,
  auditId,
  businessEntityId
}: { 
  entityId: string; 
  entityType?: "control" | "hallazgo";
  controlId?: string;
  findingId?: string;
  auditId?: string;
  businessEntityId?: string;
}) {
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [xlsxTarget, setXlsxTarget] = useState<EvidenceFile | null>(null);
  const [iaTarget, setIaTarget] = useState<EvidenceFile | null>(null);
  const { usuario } = useSesion();
  const puedeUsarAsistente = !!usuario && ROLES_ASISTENTE.includes(usuario.rol);
  const [usingFallback, setUsingFallback] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ─── Fetch evidences from API (or fall back to mock data) ─────────────────
  const fetchEvidences = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/evidencias?entityId=${encodeURIComponent(entityId)}&entityType=${encodeURIComponent(entityType)}`);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setFiles(data.map(mapApiRow));
      setUsingFallback(false);
    } catch {
      // API unavailable — fall back to local mock data
      setFiles(FALLBACK_EVIDENCES.filter(e => e.entityId === entityId).map(e => ({ ...e, version: e.version ?? 3 })));
      setUsingFallback(true);
    }
  }, [entityId]);

  useEffect(() => {
    fetchEvidences();
  }, [fetchEvidences]);

  // ─── Client-side validation + upload ──────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (BLOCKED_EXTENSIONS.includes(ext)) {
      setError(`Tipo de archivo no permitido (${ext}). Solo se aceptan .pdf y .xlsx.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (![".pdf", ".xlsx"].includes(ext)) {
      setError(`Solo se aceptan archivos .pdf y .xlsx.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > 50) {
      setError("El archivo supera el límite de 50 MB.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    // If the API is unavailable, fall back to local-only behavior
    if (usingFallback) {
      const fakeHash = "sha256:" + Math.random().toString(36).slice(2,10) + "…" + Math.random().toString(36).slice(2,10);
      const newEv: EvidenceFile = {
        id: `EV-${Date.now()}`, name: file.name,
        size: formatFileSize(file.size),
        mimeType: file.name.split(".").pop()?.toLowerCase() ?? "bin",
        hash: fakeHash, uploadDate: new Date().toISOString().slice(0,10),
        uploadedBy: "M. García", entityId, version: 1,
      };
      setFiles(prev => [newEv, ...prev]);
      toast.success(`Evidencia "${file.name}" cargada correctamente`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    // Upload via API
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityId", entityId);
      formData.append("entityType", entityType);
      formData.append("uploadedBy", "M. García");
      
      if (controlId) formData.append("controlId", controlId);
      if (findingId) formData.append("findingId", findingId);
      if (auditId) formData.append("auditId", auditId);
      if (businessEntityId) formData.append("businessEntityId", businessEntityId);

      const res = await fetch(`${API_BASE}/evidencias/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Error al subir archivo." }));
        setError(data.error || "Error al subir archivo.");
        return;
      }

      toast.success(`Evidencia "${file.name}" cargada correctamente`);
      await fetchEvidences();
    } catch {
      setError("Error de conexión al subir archivo.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────────────
  const removeFile = async (id: string) => {
    if (usingFallback) {
      setFiles(prev => prev.filter(f => f.id !== id));
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/evidencias/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Error al eliminar evidencia.");
        return;
      }
      toast.success("Evidencia eliminada.");
      await fetchEvidences();
    } catch {
      toast.error("Error de conexión al eliminar evidencia.");
    }
  };

  const handleHashUpdate = (fileId: string, newHash: string, newVersion: number) => {
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, hash: newHash, version: newVersion } : f));
  };

  const iconClass = (t: string) => t === "pdf" ? "text-red-500" : t === "xlsx" ? "text-emerald-600" : "text-blue-500";

  return (
    <>
      {xlsxTarget && (
        <SpreadsheetEditor
          filename={xlsxTarget.name}
          fileVersion={xlsxTarget.version ?? 3}
          entityId={entityId}
          onClose={() => setXlsxTarget(null)}
          onHashUpdate={(hash, ver) => { handleHashUpdate(xlsxTarget.id, hash, ver); setXlsxTarget(null); }}
        />
      )}
      {iaTarget && (
        <PanelAsistenteEvidencia
          key={iaTarget.id}
          evidencia={{ id: String(iaTarget.id), nombre: iaTarget.name }}
          onCerrar={() => setIaTarget(null)}
        />
      )}
      <Card className="p-5 mt-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileCheck2 size={15} className="text-primary" />
            <div className="text-sm font-semibold text-foreground">Evidencias Documentales</div>
            <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-semibold">{files.length}</span>
          </div>
          <label className={`inline-flex items-center gap-1.5 cursor-pointer px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-semibold rounded-md hover:bg-secondary/70 transition-colors ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />}
            {uploading ? "Subiendo…" : "Adjuntar archivo"}
            <input ref={inputRef} type="file" accept=".pdf,.xlsx" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
        {error && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
            <Ban size={12} className="flex-shrink-0" />{error}
          </div>
        )}
        {files.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground bg-secondary/20 rounded-lg border-2 border-dashed border-border">
            <UploadCloud size={20} className="mx-auto mb-2 text-muted-foreground/40" />
            Sin evidencias adjuntas. Sube archivos .pdf o .xlsx (máx. 50 MB).
          </div>
        ) : (
          <div className="space-y-2">
            {files.map(f => (
              <div key={f.id} className="flex items-center gap-3 px-3 py-2.5 bg-secondary/20 border border-border rounded-lg hover:bg-secondary/40 transition-colors group">
                <FileText size={14} className={`flex-shrink-0 ${iconClass(f.mimeType)}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate">{f.name}</div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-muted-foreground font-mono">{f.mimeType.toUpperCase()} · {f.size}{f.version ? ` · v${f.version}` : ""}</span>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                      <Hash size={9} /><span className="truncate max-w-[140px]">{f.hash}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[10px] text-muted-foreground">{f.uploadedBy}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{f.uploadDate}</div>
                </div>
                {puedeUsarAsistente && (
                  <button
                    onClick={() => setIaTarget(f)}
                    aria-label={`Analizar ${f.name} con IA`}
                    className="flex-shrink-0 flex items-center gap-1 text-[10px] px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded-md hover:bg-primary/15 font-semibold transition-colors whitespace-nowrap"
                  >
                    <Sparkles size={10} /> Analizar con IA
                  </button>
                )}
                {f.mimeType === "xlsx" && (
                  <button
                    onClick={() => setXlsxTarget(f)}
                    className="flex-shrink-0 flex items-center gap-1 text-[10px] px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md hover:bg-emerald-100 font-semibold transition-colors whitespace-nowrap"
                  >
                    <FileSpreadsheet size={10} /> Editar en Expedite
                  </button>
                )}
                <button onClick={() => removeFile(f.id)} className="p-1 text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 pt-3 border-t border-border text-[10px] text-muted-foreground">
          Formatos aceptados: PDF, XLSX · Máx. 50 MB · Hash SHA-256 · Los archivos .xlsx se pueden editar directamente en Expedite
        </div>
      </Card>
    </>
  );
}