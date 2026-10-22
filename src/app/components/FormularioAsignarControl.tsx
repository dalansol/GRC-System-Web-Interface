import { useEffect, useState } from "react";
import { Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import {
  crearAsignacionControl,
  listarAuditoresAsignables,
  listarControlesAsignables,
  type AuditorAsignable,
  type ControlAsignable,
} from "../api/auditControls";

interface Props {
  planId: string;
  onCreated: () => void;
  onCancel: () => void;
}

export default function FormularioAsignarControl({ planId, onCreated, onCancel }: Props) {
  const [controles, setControles] = useState<ControlAsignable[]>([]);
  const [auditores, setAuditores] = useState<AuditorAsignable[]>([]);
  const [controlId, setControlId] = useState("");
  const [auditorId, setAuditorId] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    Promise.all([listarControlesAsignables(), listarAuditoresAsignables()])
      .then(([controlesCargados, auditoresCargados]) => {
        setControles(controlesCargados);
        setAuditores(auditoresCargados);
      })
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "No se pudieron cargar los catálogos."))
      .finally(() => setCargando(false));
  }, []);

  const guardar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!controlId || !auditorId) {
      toast.error("Selecciona un control y un auditor.");
      return;
    }
    setGuardando(true);
    try {
      await crearAsignacionControl(planId, { controlId, auditorId: Number(auditorId) });
      toast.success("Control asignado correctamente.");
      onCreated();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "No se pudo asignar el control.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={guardar} className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between">
          <h2 className="text-lg font-bold text-foreground">Asignar control al plan</h2>
          <button type="button" onClick={onCancel} disabled={guardando} className="rounded-md p-1 text-muted-foreground hover:bg-secondary">
            <X size={16} />
          </button>
        </div>
        {cargando ? (
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            <Loader2 className="mr-2 animate-spin" size={18} /> Cargando opciones...
          </div>
        ) : (
          <>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Control</label>
            <select value={controlId} onChange={(event) => setControlId(event.target.value)} className="mb-4 w-full rounded-md border border-border bg-white px-3 py-2 text-sm">
              <option value="">Seleccionar control</option>
              {controles.map((control) => <option key={control.id} value={control.id}>{control.code} — {control.name}</option>)}
            </select>
            <label className="mb-1 block text-xs font-semibold text-muted-foreground">Auditor responsable</label>
            <select value={auditorId} onChange={(event) => setAuditorId(event.target.value)} className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm">
              <option value="">Seleccionar auditor</option>
              {auditores.map((auditor) => <option key={auditor.id} value={auditor.id}>{auditor.name} ({auditor.role})</option>)}
            </select>
          </>
        )}
        <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
          <button type="button" onClick={onCancel} disabled={guardando} className="rounded-md bg-secondary px-4 py-2 text-sm">Cancelar</button>
          <button type="submit" disabled={cargando || guardando} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {guardando ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
            {guardando ? "Guardando..." : "Asignar control"}
          </button>
        </div>
      </form>
    </div>
  );
}
