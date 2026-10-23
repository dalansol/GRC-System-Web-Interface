import { useEffect, useState } from "react";
import { ClipboardCheck, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";

import {
  AISummaryCard,
  Card,
  DetailField,
} from "./SharedComponents";
import type { ControlRecord } from "./SharedComponents";
import EvidenciasSection from "./EvidenciasSection";
import { listarControles, registrarHoras, actualizarstatusControl } from "../api/controles";
import { AvisoDeclaracionesPendientes, useDeclaracionesPendientes } from "./ConflictosPlan";
import { actualizarAsignacionStatus, consultarMiAsignacionControl, consultarRevisionControl, type RevisionControl } from "../api/auditControls";
import { obtenerPlanAuditoria, type PlanAuditoria } from "../api/planes";

// Solo se muestran datos del backend: lo que la pantalla enseña es lo mismo que recibe el
// asistente de IA (expediente del control en su plan).
const valorODefecto = (valor: string | null | undefined) => (valor && valor.trim() ? valor : "No definido");

export default function VistaControlDetallado({
  id,
  auditId,
  crumbs,
}: {
  id: string;
  auditId?: string;
  crumbs: React.ReactNode;
}) {
  const [backendControl, setBackendControl] = useState<ControlRecord | null>(null);
  const [plan, setPlan] = useState<PlanAuditoria | null>(null);
  // Historia #96: sin declaración de conflictos no se evalúan los controles del plan.
  const { pendientes: planesPendientes } = useDeclaracionesPendientes();
  const [puedeSubirEvidencia, setPuedeSubirEvidencia] = useState(false);
  const [miAsignacionStatus, setMiAsignacionStatus] = useState<string | null>(null);
  const [revision, setRevision] = useState<RevisionControl | null>(null);
  const [feedbackRevision, setFeedbackRevision] = useState("");
  const [rechazando, setRechazando] = useState(false);
  const [guardandoRevision, setGuardandoRevision] = useState(false);
  const [horas, setHoras] = useState("");
  const [guardandoHoras, setGuardandoHoras] = useState(false);
  const [enviandoRevision, setEnviandoRevision] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  // El plan en el que se abrió el control; si no se puede leer, la tarjeta no se muestra.
  useEffect(() => {
    if (!auditId) return;
    let active = true;
    obtenerPlanAuditoria(auditId)
      .then((datos) => {
        if (active) setPlan(datos);
      })
      .catch(() => {
        if (active) setPlan(null);
      });
    return () => {
      active = false;
    };
  }, [auditId]);

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
      toast.success(status === "Completado" ? "Control aprobado." : "Control rechazado y devuelto a En Progreso.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la revisión.");
    } finally {
      setGuardandoRevision(false);
    }
  };

  const guardarHoras = async () => {
    const valor = Number(horas);
    if (!Number.isFinite(valor) || valor <= 0 || valor >= 24) {
      toast.error("Las horas deben ser mayores que 0 y menores que 24.");
      return;
    }

    setGuardandoHoras(true);
    try {
      const resultado = await registrarHoras(id, { horas: valor });
      setBackendControl((actual) =>
        actual
          ? { ...actual, horasInvertidas: Number(resultado.hours_spent) }
          : actual,
      );
      setHoras("");
      toast.success("Horas registradas correctamente.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "No se pudieron registrar las horas.");
    } finally {
      setGuardandoHoras(false);
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
    setMiAsignacionStatus(null);
    consultarMiAsignacionControl(id, auditId)
      .then((resultado) => {
        if (active) {
          setPuedeSubirEvidencia(resultado.asignado);
          setMiAsignacionStatus(resultado.asignacion?.status ?? null);
        }
      })
      .catch(() => {
        if (active) {
          setPuedeSubirEvidencia(false);
          setMiAsignacionStatus(null);
        }
      });
    return () => {
      active = false;
    };
  }, [id, auditId]);

  const ctrl = backendControl;
  const pendientesDelControl = planesPendientes.filter((plan) =>
    (ctrl?.auditIds ?? []).some((planId) => String(planId) === String(plan.id)),
  );
  const evaluacionBloqueada = pendientesDelControl.length > 0;
  const puedeEnviarARevision =
    puedeSubirEvidencia &&
    !evaluacionBloqueada &&
    !enviandoRevision &&
    !guardandoHoras &&
    miAsignacionStatus === "En Progreso";
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
            </div>
            <h1 className="text-xl font-bold text-foreground leading-tight">
              {ctrl.controlProcedureName}
            </h1>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 pt-3 border-t border-border mb-4">
          <DetailField label="ID Control" value={ctrl.id} />
          <DetailField label="Código" value={ctrl.businessControlNumber} />
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
            { label: "Tamaño de Muestra", value: valorODefecto(ctrl.sampleSize) },
            { label: "Rotación", value: valorODefecto(ctrl.rotation) },
            { label: "Estatus", value: ctrl.status ?? "En Progreso" },
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

      {plan && (
        <Card className="mb-5 p-5">
          <div className="text-sm font-bold text-foreground mb-3">Plan de auditoría</div>
          <div className="grid grid-cols-4 gap-4">
            <DetailField label="Código" value={plan.codigo} />
            <DetailField label="Nombre" value={plan.nombre} />
            <DetailField label="Periodo" value={`${plan.fechaInicio} a ${plan.fechaFin}${plan.periodo ? ` (${plan.periodo})` : ""}`} />
            <DetailField label="Responsable" value={plan.responsable.nombre} />
          </div>
          {plan.alcance && (
            <div className="pt-3 mt-3 border-t border-border">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Alcance</div>
              <p className="text-sm text-foreground leading-relaxed">{plan.alcance}</p>
            </div>
          )}
        </Card>
      )}
      <EvidenciasSection
        entityId={ctrl.id}
        entityType="control"
        controlId={ctrl.id}
        auditId={auditId}
        businessEntityId={ctrl.auditEntityId}
        puedeSubir={Boolean(auditId) && puedeEnviarARevision}
      />
      {puedeSubirEvidencia && (
        <Card className="mb-5 p-5">
          {evaluacionBloqueada && (
            <div className="mb-4">
              <AvisoDeclaracionesPendientes pendientes={pendientesDelControl} />
            </div>
          )}
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-foreground">Avance del control</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Registra las horas trabajadas y envía el control a revisión cuando hayas terminado.
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <label className="block text-xs font-semibold text-foreground">
              Horas trabajadas
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  min="0.01"
                  max="23.99"
                  step="0.01"
                  value={horas}
                  onChange={(event) => setHoras(event.target.value)}
                  disabled={guardandoHoras || enviandoRevision || evaluacionBloqueada || ctrl.status === "En Revision" || ctrl.status === "Completado"}
                  className="w-32 rounded-md border border-border bg-white px-3 py-2 text-sm font-normal"
                  placeholder="Ej. 2.5"
                />
                <button
                  type="button"
                  onClick={guardarHoras}
                  disabled={guardandoHoras || enviandoRevision || evaluacionBloqueada || ctrl.status === "En Revision" || ctrl.status === "Completado"}
                  className="rounded-md border border-primary px-3 py-2 text-xs font-semibold text-primary disabled:opacity-50"
                >
                  {guardandoHoras ? "Guardando..." : "Registrar horas"}
                </button>
              </div>
              <span className="mt-1 block font-normal text-muted-foreground">
                Total registrado: {ctrl.horasInvertidas ?? 0} h
              </span>
            </label>
            <button
              type="button"
              onClick={enviarARevision}
              disabled={enviandoRevision || guardandoHoras || evaluacionBloqueada || !auditId || miAsignacionStatus !== "En Progreso"}
              className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-white disabled:bg-gray-400 disabled:opacity-100"
            >
              {enviandoRevision ? "Enviando..." : "Enviar a revisión"}
            </button>
          </div>
        </Card>
      )}
      <AISummaryCard entityId={ctrl.id} entityType="Control" planId={auditId} />
    </div>
  );
}
