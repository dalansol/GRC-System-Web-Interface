import { useEffect, useState } from "react";
import { Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";
import {
  crearAsignacionControl,
  listarAuditoresAsignables,
  listarControlesAsignables,
  type AuditorAsignable,
  type ControlAsignable,
} from "../../api/auditControls";
import { pedir } from "../../api/cliente"; // Cliente para consultar la tabla 'processes'

export interface ProcesoAsignable {
  id: number;
  control_id: string;
  business_unit_id: number;
  title: string;
  description?: string;
}

interface Props {
  planId: string;
  onCreated: () => void;
  onCancel: () => void;
}

export default function FormularioAsignarControl({ planId, onCreated, onCancel }: Props) {
  const [controles, setControles] = useState<ControlAsignable[]>([]);
  const [procesos, setProcesos] = useState<ProcesoAsignable[]>([]);
  const [auditores, setAuditores] = useState<AuditorAsignable[]>([]);

  const [controlId, setControlId] = useState("");
  const [processId, setProcessId] = useState("");
  const [auditorId, setAuditorId] = useState("");

  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);
  const [cargandoProcesos, setCargandoProcesos] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Carga inicial de controles y auditores
  useEffect(() => {
    Promise.all([listarControlesAsignables(), listarAuditoresAsignables()])
      .then(([controlesCargados, auditoresCargados]) => {
        setControles(controlesCargados);
        setAuditores(auditoresCargados);
      })
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : "No se pudieron cargar los catálogos.")
      )
      .finally(() => setCargandoCatalogos(false));
  }, []);

  // Cargar procesos filtrados por el control seleccionado
  useEffect(() => {
    if (!controlId) {
      setProcesos([]);
      setProcessId("");
      return;
    }

    setCargandoProcesos(true);
    setProcessId(""); // Limpiar proceso seleccionado previamente

    pedir<ProcesoAsignable[]>(`/processes?controlId=${encodeURIComponent(controlId)}`)
      .then((data) => setProcesos(data))
      .catch(() => {
        toast.error("No se pudieron cargar los procesos del control seleccionado.");
        setProcesos([]);
      })
      .finally(() => setCargandoProcesos(false));
  }, [controlId]);

  const guardar = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!controlId || !processId || !auditorId) {
      toast.error("Selecciona un control, un proceso y un auditor.");
      return;
    }

    setGuardando(true);
    try {
      await crearAsignacionControl(planId, {
        controlId,
        processId: Number(processId),
        auditorId: Number(auditorId),
      });
      toast.success("Control y proceso asignados correctamente.");
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
          <div>
            <h2 className="text-lg font-bold text-foreground">Asignar control al plan</h2>
            <p className="text-xs text-muted-foreground">Selecciona el control, el proceso específico a revisar y el auditor.</p>
          </div>
          <button type="button" onClick={onCancel} disabled={guardando} className="rounded-md p-1 text-muted-foreground hover:bg-secondary">
            <X size={16} />
          </button>
        </div>

        {cargandoCatalogos ? (
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            <Loader2 className="mr-2 animate-spin" size={18} /> Cargando opciones...
          </div>
        ) : (
          <div className="space-y-4">
            {/* Paso 1: Selección de Control */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">1. Control</label>
              <select
                value={controlId}
                onChange={(event) => setControlId(event.target.value)}
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Seleccionar control</option>
                {controles.map((control) => (
                  <option key={control.id} value={control.id}>
                    {control.code} — {control.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Paso 2: Selección de Proceso asociado al Control */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">2. Proceso asociado</label>
              {cargandoProcesos ? (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="animate-spin" size={14} /> Cargando procesos asociados...
                </div>
              ) : (
                <select
                  value={processId}
                  onChange={(event) => setProcessId(event.target.value)}
                  disabled={!controlId || procesos.length === 0}
                  className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm disabled:bg-muted disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">
                    {!controlId
                      ? "Primero selecciona un control"
                      : procesos.length === 0
                      ? "Sin procesos asociados a este control"
                      : "Seleccionar proceso"}
                  </option>
                  {procesos.map((proceso) => (
                    <option key={proceso.id} value={proceso.id}>
                      {proceso.title}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Paso 3: Selección de Auditor */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">3. Auditor responsable</label>
              <select
                value={auditorId}
                onChange={(event) => setAuditorId(event.target.value)}
                disabled={!processId}
                className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm disabled:bg-muted disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Seleccionar auditor</option>
                {auditores.map((auditor) => (
                  <option key={auditor.id} value={auditor.id}>
                    {auditor.name} ({auditor.role})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3 border-t border-border pt-4">
          <button type="button" onClick={onCancel} disabled={guardando} className="rounded-md bg-secondary px-4 py-2 text-sm font-medium">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={cargandoCatalogos || cargandoProcesos || guardando || !controlId || !processId || !auditorId}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {guardando ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
            {guardando ? "Guardando..." : "Asignar control"}
          </button>
        </div>
      </form>
    </div>
  );
}