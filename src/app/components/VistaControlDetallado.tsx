import { useEffect, useState } from "react";
import { ClipboardCheck, Loader2, Check, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import {
  AISummaryCard,
  Breadcrumbs,
  Card,
  DetailField,
  ValidityBadge,
} from "./SharedComponents";
import type { ControlRecord } from "./SharedComponents";
import EvidenciasSection from "./EvidenciasSection";
import { listarControles, actualizarstatusControl } from "../api/controles";
import { AvisoDeclaracionesPendientes, useDeclaracionesPendientes } from "./ConflictosPlan";
import { actualizarAsignacionStatus, consultarMiAsignacionControl, consultarRevisionControl, type RevisionControl } from "../api/auditControls";
import { CONTROLS, PROCEDURE_TRACKING } from "../data/mock_data";
import FormularioHallazgo, { type FindingControlOption } from "./FormularioHallazgo";
import { useSesion } from "../auth/SesionContext";
import { listarHallazgos, type HallazgoApi } from "../api/hallazgos";
import VistaHallazgoDetallado from "./VistaHallazgoDetallado";

export default function VistaControlDetallado({
  id,
  auditId,
  crumbs,
}: {
  id: string;
  auditId?: string;
  crumbs: React.ReactNode;
}) {
  const { usuario } = useSesion();
  const [backendControl, setBackendControl] = useState<ControlRecord | null>(null);
  const [miAsignacionId, setMiAsignacionId] = useState<number | null>(null);
  const { pendientes: planesPendientes } = useDeclaracionesPendientes();
  const [puedeSubirEvidencia, setPuedeSubirEvidencia] = useState(false);
  const [miAsignacionStatus, setMiAsignacionStatus] = useState<string | null>(null);
  const [revision, setRevision] = useState<RevisionControl | null>(null);
  const [feedbackRevision, setFeedbackRevision] = useState("");
  const [rechazando, setRechazando] = useState(false);
  const [guardandoRevision, setGuardandoRevision] = useState(false);
  const [enviandoRevision, setEnviandoRevision] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showHallazgoForm, setShowHallazgoForm] = useState(false);

  // Selected finding state for detail view navigation
  const [selectedHallazgoId, setSelectedHallazgoId] = useState<string | null>(null);

  // List of findings matching this control
  const [hallazgos, setHallazgos] = useState<HallazgoApi[]>([]);
  const [loadingHallazgos, setLoadingHallazgos] = useState(false);

  const cargarHallazgos = () => {
    setLoadingHallazgos(true);
    listarHallazgos()
      .then((todos) => {
        const filtrados = todos.filter((item) => {
          const matchControl =
            String(item.controlId) === String(id) ||
            String(item.failedControlId) === String(id);
          const matchAudit = auditId ? String(item.auditId) === String(auditId) : true;
          return matchControl && matchAudit;
        });
        setHallazgos(filtrados);
      })
      .catch(() => toast.error("No se pudieron cargar los hallazgos del control."))
      .finally(() => setLoadingHallazgos(false));
  };

  useEffect(() => {
    cargarHallazgos();
  }, [id, auditId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    listarControles()
      .then((controls) => {
        if (!active) return;
        const control = controls.find((item) => String(item.id) === String(id));
        if (control) setBackendControl(control);
        else setLoadError("No se encontró el control seleccionado.");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "No se pudo cargar el control.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    let active = true;
    consultarRevisionControl(id, auditId)
      .then((resultado) => {
        if (active) {
          setRevision(resultado);
          setFeedbackRevision(resultado.feedback ?? "");
        }
      })
      .catch(() => {
        if (active) setRevision(null);
      });
    return () => {
      active = false;
    };
  }, [id, auditId]);

  const actualizarRevision = async (status: "Completado" | "En Progreso") => {
    if (!revision?.plan_id) return;
    if (status === "En Progreso" && !feedbackRevision.trim()) {
      toast.error("Escribe la retroalimentación del rechazo.");
      return;
    }
    setGuardandoRevision(true);
    try {
      await actualizarAsignacionStatus(String(revision.plan_id), id, {
        status,
        feedback: feedbackRevision.trim(),
      });
      setRevision((actual) => actual ? { ...actual, status, feedback: feedbackRevision.trim() } : actual);
      setRechazando(false);
      toast.success(status === "Completado" ? "Control approved." : "Control rechazado y devuelto a En Progreso.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la revisión.");
    } finally {
      setGuardandoRevision(false);
    }
  };

  const enviarARevision = async () => {
    setEnviandoRevision(true);
    try {
      if (!auditId) {
        toast.error("No se puede enviar el control a revisión sin un plan de auditoría.");
        return;
      }
      const resultado = await actualizarstatusControl(id, { status: "En Revision", auditId });
      setBackendControl((actual) =>
        actual
          ? { ...actual, status: resultado.status, horasInvertidas: Number(resultado.hours_spent), feedback: resultado.feedback }
          : actual,
      );
      setRevision((actual) =>
        actual
          ? { ...actual, status: resultado.status }
          : actual,
      );
      setMiAsignacionStatus("En Revision");
      toast.success(
        resultado.todos_en_revision
          ? `Todos los auditores han terminado. Control ${id} en revisión.`
          : "Confirmación recibida, esperando para los otros auditores.",
      );
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "No se pudo enviar el control a revisión.");
    } finally {
      setEnviandoRevision(false);
    }
  };

  useEffect(() => {
    let active = true;
    setPuedeSubirEvidencia(false);
    setMiAsignacionId(null);
    setMiAsignacionStatus(null);
    consultarMiAsignacionControl(id, auditId)
      .then((resultado) => {
        if (active) {
          setPuedeSubirEvidencia(resultado.asignado);
          setMiAsignacionId(resultado.asignacion?.id ?? null);
          setMiAsignacionStatus(resultado.asignacion?.status ?? null);
        }
      })
      .catch(() => {
        if (active) {
          setPuedeSubirEvidencia(false);
          setMiAsignacionId(null);
          setMiAsignacionStatus(null);
        }
      });
    return () => {
      active = false;
    };
  }, [id, auditId]);

  const ctrl = backendControl ?? CONTROLS.find((control) => control.id === id);
  const pendientesDelControl = planesPendientes.filter((plan) =>
    (ctrl?.auditIds ?? []).some((planId) => String(planId) === String(plan.id)),
  );
  const evaluacionBloqueada = pendientesDelControl.length > 0;
  const puedeEnviarARevision =
    puedeSubirEvidencia &&
    !evaluacionBloqueada &&
    !enviandoRevision &&
    miAsignacionStatus === "En Progreso";

  const controlParaHallazgo: FindingControlOption[] = ctrl
    ? [
        {
          id: ctrl.id,
          name: ctrl.controlProcedureName,
          vulnerability: (ctrl as any).currentVulnerability ?? "Media",
        },
      ]
    : [];

  const procedure = PROCEDURE_TRACKING.find(
    (p) => p.controlId === id,
  );

  const entidadAuditada = procedure
    ? `${procedure.businessName} (${procedure.area})`
    : (ctrl as any)?.business_unit_name ?? "Unidad de Negocio N/A";

  const procedimientoNombre = procedure
    ? procedure.procedureName
    : (ctrl as any)?.process_title ?? ctrl?.controlProcedureName ?? "Procedimiento N/A";

  // Conditional render for detailed finding view with dynamic breadcrumb
  if (selectedHallazgoId) {
    const selectedHallazgo = hallazgos.find((item) => String(item.id) === String(selectedHallazgoId));
    const hallazgoLabel = selectedHallazgo?.folio || selectedHallazgoId;

    return (
      <VistaHallazgoDetallado
        hallazgoId={selectedHallazgoId}
        onBack={() => setSelectedHallazgoId(null)}
        crumbs={<Breadcrumbs items={["Inicio", "Planes de Auditoría", id, hallazgoLabel]} />}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex-1 overflow-auto p-6">
        {crumbs}
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          <Loader2 className="mr-2 animate-spin" size={18} />
          Cargando control...
        </div>
      </div>
    );
  }

  if (!ctrl) {
    return (
      <div className="flex-1 overflow-auto p-6">
        {crumbs}
        <Card className="p-6 text-sm text-muted-foreground">
          {loadError ?? "No se encontró el control seleccionado."}
        </Card>
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-auto p-6"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {crumbs}
      {revision?.feedback && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="font-semibold">Retroalimentación de la revisión</div>
          <p className="mt-1">{revision.feedback}</p>
        </div>
      )}
      {revision?.puede_revisar && (
        <div className="mb-5 rounded-md border border-blue-200 bg-blue-50 p-4">
          <div className="mb-3">
            <div className="text-sm font-semibold text-blue-900">Control listo para revisión</div>
            <p className="mt-1 text-xs text-blue-800">Aprueba el control o recházalo con retroalimentación para devolverlo a En Progreso.</p>
          </div>
          <div className="flex items-center justify-start gap-2">
            <button type="button" onClick={() => actualizarRevision("Completado")} disabled={guardandoRevision} className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
              <Check size={13} /> Aprobar
            </button>
            <button type="button" onClick={() => setRechazando((actual) => !actual)} disabled={guardandoRevision} className="inline-flex items-center gap-1 rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50">
              <X size={13} /> Rechazar
            </button>
          </div>
        </div>
      )}
      {revision?.puede_revisar && rechazando && (
        <Card className="mb-5 border-red-200 p-4">
          <label className="block text-xs font-semibold text-foreground">
            Retroalimentación del rechazo
            <textarea
              value={feedbackRevision}
              onChange={(event) => setFeedbackRevision(event.target.value)}
              rows={3}
              className="mt-2 block w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              placeholder="Indica qué falta para aprobar el control."
            />
          </label>
          <button type="button" onClick={() => actualizarRevision("En Progreso")} disabled={guardandoRevision} className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
            Confirmar rechazo
          </button>
        </Card>
      )}
      <Card className="mb-5 p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 bg-emerald-100 rounded-lg flex-shrink-0">
            <ClipboardCheck size={18} className="text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-primary bg-primary/8 px-2.5 py-1 rounded-md">
                {ctrl.id}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground bg-muted px-2 py-0.5 rounded">
                Procedimiento de Control
              </span>
              <ValidityBadge status={ctrl.validityStatus} />
            </div>
            <h1 className="text-xl font-bold text-foreground leading-tight">
              {ctrl.controlProcedureName}
            </h1>
          </div>
        </div>

        {/* ── Entidad Auditada and Procedimiento Side-by-Side ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-border mb-4">
          <DetailField label="ID Control" value={ctrl.id} />
          <DetailField label="Entidad Auditada" value={entidadAuditada} />
          <DetailField label="Procedimiento" value={procedimientoNombre} />
        </div>

        <div className="pt-3 border-t border-border">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
            Actividad de Control
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            {ctrl.controlActivity}
          </p>
        </div>
      </Card>

      <Card className="mb-5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="text-sm font-bold text-foreground">
            Procedimientos de Control Transversal
          </div>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
            {ctrl.controlType}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-4">
          {[
            { label: "Tipo de Control", value: ctrl.controlType },
            { label: "Frecuencia de Operación", value: ctrl.frequency },
            { label: "Tamaño de Muestra", value: ctrl.sampleSize },
            { label: "Rotación", value: ctrl.rotation },
            { label: "Estatus", value: ctrl.controlStatus },
          ].map((field) => (
            <div key={field.label} className="bg-muted/40 rounded-lg p-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                {field.label}
              </div>
              <div className="text-sm font-bold text-foreground">
                {field.value}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <EvidenciasSection
        entityId={String(miAsignacionId ?? ctrl.id)}
        entityType="control"
        puedeSubir={Boolean(miAsignacionId) && puedeEnviarARevision}
      />

      {puedeSubirEvidencia && (
        <Card className="mb-5 p-5">
          {evaluacionBloqueada && (
            <div className="mb-4">
              <AvisoDeclaracionesPendientes pendientes={pendientesDelControl} />
            </div>
          )}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Avance del control</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Envía el control a revisión cuando hayas terminado su evaluación.
              </p>
            </div>
            <button
              type="button"
              onClick={enviarARevision}
              disabled={enviandoRevision || evaluacionBloqueada || !auditId || miAsignacionStatus !== "En Progreso"}
              className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-white disabled:bg-gray-400 disabled:opacity-100"
            >
              {enviandoRevision ? "Enviando..." : "Enviar a revisión"}
            </button>
          </div>

          {/* ── Hallazgos registrados ── */}
          <div className="mt-5 border-t border-border pt-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-amber-500" />
                  Hallazgos del control
                  <span className="ml-1 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
                    {hallazgos.length}
                  </span>
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Listado de hallazgos registrados para este control. Haz clic en un hallazgo para ver su detalle.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowHallazgoForm(true)}
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
              >
                + Nuevo hallazgo
              </button>
            </div>

            {loadingHallazgos ? (
              <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                <Loader2 className="mr-2 animate-spin" size={14} />
                Cargando hallazgos...
              </div>
            ) : hallazgos.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                No hay hallazgos registrados para este control.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                    <tr>
                      <th className="p-2">Folio</th>
                      <th className="p-2">Título</th>
                      <th className="p-2">Severidad</th>
                      <th className="p-2">Estatus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {hallazgos.map((hallazgo) => (
                      <tr
                        key={hallazgo.id}
                        onClick={() => setSelectedHallazgoId(String(hallazgo.id))}
                        className="hover:bg-muted/40 cursor-pointer transition-colors"
                        title="Haz clic para ver el detalle del hallazgo"
                      >
                        <td className="p-2 font-mono font-semibold text-primary hover:underline">
                          {hallazgo.folio || hallazgo.id}
                        </td>
                        <td className="p-2 font-medium text-foreground">{hallazgo.title}</td>
                        <td className="p-2">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                              hallazgo.severity === "Crítico"
                                ? "bg-red-100 text-red-800"
                                : hallazgo.severity === "Alto"
                                ? "bg-orange-100 text-orange-800"
                                : hallazgo.severity === "Medio"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {hallazgo.severity}
                          </span>
                        </td>
                        <td className="p-2 text-muted-foreground">{hallazgo.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}
      <AISummaryCard entityId={ctrl.id} entityType="Control" />

      {/* ── Modal: Formulario de hallazgo ── */}
      {showHallazgoForm && (
        <FormularioHallazgo
          controls={controlParaHallazgo}
          fixedControlId={ctrl.id}
          ownerId={usuario ? String(usuario.id) : undefined}
          nextFolio={`HAL-${Date.now()}`}
          auditId={auditId}
          onCreated={() => {
            setShowHallazgoForm(false);
            cargarHallazgos();
          }}
          onClose={() => setShowHallazgoForm(false)}
        />
      )}
    </div>
  );
}