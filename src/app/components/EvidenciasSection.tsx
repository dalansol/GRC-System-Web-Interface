import React, { useRef, useState } from "react";
import {
  Ban,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Hash,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";

import { Card } from "./SharedComponents";
import SpreadsheetEditor from "./SpreadsheetEditor.tsx";

// ─── Evidencias Section ───────────────────────────────────────────────────────
const BLOCKED_EXTENSIONS = [".exe", ".bat", ".js", ".msi", ".sh", ".cmd", ".vbs", ".ps1"];

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

// ─── Evidence Files Data ───────────────────────────────────────────────────────
const INITIAL_EVIDENCES: EvidenceFile[] = [
  { id: "EV-001", name: "Conciliacion_Bancaria_Jun2025.xlsx", size: "2.1 MB", mimeType: "xlsx", hash: "sha256:a3f9c12e…4f2a1c0e", uploadDate: "2025-07-12", uploadedBy: "M. García", entityId: "CTR-001" },
  { id: "EV-002", name: "Listado_Accesos_SAP_Q2.pdf", size: "890 KB", mimeType: "pdf", hash: "sha256:b8e4d7c9…e1c8d4b7", uploadDate: "2025-07-15", uploadedBy: "C. Morales", entityId: "CTR-002" },
  { id: "EV-003", name: "Reporte_Accesos_Privilegiados_Jul.pdf", size: "1.4 MB", mimeType: "pdf", hash: "sha256:c9f5e2a8…c1e4f7a0", uploadDate: "2025-07-18", uploadedBy: "L. Fernández", entityId: "CTR-003" },
  { id: "EV-004", name: "Hallazgo_Segregacion_Evidencia.pdf", size: "560 KB", mimeType: "pdf", hash: "sha256:d7a3b9e1…f8c2d5b4", uploadDate: "2025-07-11", uploadedBy: "M. García", entityId: "FND-001" },
];


export default function EvidenciasSection({ entityId }: { entityId: string }) {
  const [files, setFiles] = useState<EvidenceFile[]>(
    () => INITIAL_EVIDENCES.filter(e => e.entityId === entityId).map(e => ({ ...e, version: e.version ?? 3 }))
  );
  const [error, setError] = useState<string | null>(null);
  const [xlsxTarget, setXlsxTarget] = useState<EvidenceFile | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    const fakeHash = "sha256:" + Math.random().toString(36).slice(2,10) + "…" + Math.random().toString(36).slice(2,10);
    const newEv: EvidenceFile = {
      id: `EV-${Date.now()}`, name: file.name,
      size: sizeMB < 1 ? `${Math.round(file.size / 1024)} KB` : `${sizeMB.toFixed(1)} MB`,
      mimeType: file.name.split(".").pop()?.toLowerCase() ?? "bin",
      hash: fakeHash, uploadDate: new Date().toISOString().slice(0,10),
      uploadedBy: "M. García", entityId, version: 1,
    };
    setFiles(prev => [newEv, ...prev]);
    toast.success(`Evidencia "${file.name}" cargada correctamente`);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));

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
      <Card className="p-5 mt-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileCheck2 size={15} className="text-primary" />
            <div className="text-sm font-semibold text-foreground">Evidencias Documentales</div>
            <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-semibold">{files.length}</span>
          </div>
          <label className="inline-flex items-center gap-1.5 cursor-pointer px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-semibold rounded-md hover:bg-secondary/70 transition-colors">
            <UploadCloud size={12} /> Adjuntar archivo
            <input ref={inputRef} type="file" accept=".pdf,.xlsx" className="hidden" onChange={handleUpload} />
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