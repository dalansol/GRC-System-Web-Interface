import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Calendar, CalendarClock, CheckCircle2, ChevronDown, ChevronRight, Loader2, Paperclip, RefreshCw, ShieldAlert, User } from "lucide-react";
import { toast } from "sonner";

import { Card } from "../ComponentesCompartidos";
import EvidenciasSection from "../EvidenciasSection";
import InsigniaEstadoPlan from "./InsigniaEstadoPlan";
import { useCambiosPlanes } from "./useCambiosPlanes";
import { desplazarAElemento } from "../desplazarAElemento";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import {
  actualizarPasoPlanAccion,
  listarPlanesAuditado,
  observacionesPendientes,
  planBloqueado,
  rechazoVigente,
  solicitarProrroga,
  type PasoAuditado,
  type PlanAuditado,
  type SolicitudDestinoPlan,
} from "../../api/planesAccion";

const mensajeDe = (error: unknown, respaldo: string) => (error instanceof Error ? error.message : respaldo);

/** Vista simplificada del auditado (UF-13, SF-16): solo lo que tiene asignado, su evidencia y el avance. */
export default function PortalPlanesAuditado({
  destino,
  onPlanNoEncontrado,
}: {
  destino?: SolicitudDestinoPlan | null;
  /** Si se indica, se llama en lugar de avisar cuando el plan del destino no está entre los asignados. */
  onPlanNoEncontrado?: () => void;
}) {
  const [planes, setPlanes] = useState<PlanAuditado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [pasoAbierto, setPasoAbierto] = useState<number | null>(null);
  const [planProrroga, setPlanProrroga] = useState<PlanAuditado | null>(null);
  const [destacadoId, setDestacadoId] = useState<number | null>(null);
  // Pasos con un cambio en curso: un doble clic no debe mandar otro.
  const pasosEnCurso = useRef(new Set<number>());

  // Solo se usa la respuesta de la última petición: una recarga en vivo no debe pisar otra más reciente.
  const ultimaPeticion = useRef(0);
  // `silencioso`: recarga en vivo, sin indicador de carga ni avisos de error.
  const cargar = async ({ silencioso = false } = {}) => {
    const peticion = ++ultimaPeticion.current;
    if (!silencioso) setCargando(true);
    try {
      const lista = await listarPlanesAuditado();
      if (peticion !== ultimaPeticion.current) return null;
      setPlanes(lista);
      return lista;
    } catch (error) {
      if (!silencioso && peticion === ultimaPeticion.current) toast.error(mensajeDe(error, "No se pudieron cargar tus planes de acción."));
      return null;
    } finally {
      if (peticion === ultimaPeticion.current) setCargando(false);
    }
  };

  useCambiosPlanes(() => void cargar({ silencioso: true }));

  useEffect(() => {
    void cargar().then((lista) => {
      if (!destino || !lista) return;
      if (lista.some((plan) => plan.id === destino.planId)) {
        setDestacadoId(destino.planId);
        desplazarAElemento(`plan-auditado-${destino.planId}`);
      } else if (onPlanNoEncontrado) {
        onPlanNoEncontrado();
      } else {
        toast.error("Ese plan ya no está entre tus planes.");
      }
    });
  }, [destino?.solicitud]);

  const fijarCompletado = (planId: number, pasoId: number, completado: boolean) => {
    setPlanes((previos) =>
      previos.map((plan) =>
        plan.id !== planId ? plan : { ...plan, pasos: plan.pasos.map((paso) => (paso.id === pasoId ? { ...paso, completado } : paso)) },
      ),
    );
  };

  // El paso cambia en pantalla de inmediato. Si el servidor lo rechaza, se deshace y se vuelve a leer el plan.
  const cambiarPaso = async (plan: PlanAuditado, paso: PasoAuditado) => {
    if (pasosEnCurso.current.has(paso.id)) return;
    if (!paso.completado && paso.evidenciasCount === 0) {
      toast.error("Sube la evidencia del paso antes de marcarlo como completado.");
      return;
    }
    pasosEnCurso.current.add(paso.id);
    fijarCompletado(plan.id, paso.id, !paso.completado);
    try {
      await actualizarPasoPlanAccion(plan.id, paso.id, !paso.completado);
    } catch (error) {
      fijarCompletado(plan.id, paso.id, paso.completado);
      toast.error(mensajeDe(error, "No se pudo actualizar el paso."));
      void cargar();
    } finally {
      pasosEnCurso.current.delete(paso.id);
    }
  };

  const avisarPasoNoEditable = (paso: PasoAuditado) => {
    toast.error(
      paso.esMio
        ? "El plan de acción está en revisión o aprobado y no puede modificarse."
        : `Solo ${paso.usuarioAsignado?.nombre ?? "la persona asignada"} puede marcar este paso.`,
    );
  };

  const contarEvidencia = (planId: number, pasoId: number, evidenciasCount: number) => {
    setPlanes((previos) =>
      previos.map((plan) =>
        plan.id !== planId
          ? plan
          : { ...plan, pasos: plan.pasos.map((paso) => (paso.id === pasoId ? { ...paso, evidenciasCount } : paso)) },
      ),
    );
  };

  if (cargando && planes.length === 0) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="mr-2 animate-spin" size={20} />
        Cargando tus planes de acción...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void cargar()}
          disabled={cargando}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
        >
          <RefreshCw size={14} className={cargando ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>

      {planes.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center gap-2 p-12 text-center text-xs text-muted-foreground">
            <ShieldAlert size={28} className="text-muted-foreground/50" />
            <p>No tienes planes de acción asignados.</p>
          </div>
        </Card>
      ) : (
        planes.map((plan) => {
          const abierto = !planBloqueado(plan);
          const prorrogaAbierta = plan.prorroga?.estado === "Pendiente";
          // Los avisos del rechazo se van conforme se corrige cada paso señalado (se vuelve a marcar como completado).
          const pendientes = plan.rechazo ? observacionesPendientes(plan.rechazo.evidenciasObservadas, plan.pasos) : [];
          const mostrarRechazo = Boolean(plan.rechazo && rechazoVigente(plan.rechazo.evidenciasObservadas, plan.pasos));
          return (
            <div
              key={plan.id}
              id={`plan-auditado-${plan.id}`}
              data-destacado={plan.id === destacadoId ? "true" : undefined}
              className={plan.id === destacadoId ? "rounded-xl ring-2 ring-primary" : undefined}
            >
            <Card>
              <div className="space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-medium text-primary">{plan.publicId}</div>
                    <h3 className="break-words text-base font-semibold text-foreground">{plan.titulo}</h3>
                    <p className="break-words text-xs text-muted-foreground">
                      Hallazgo: <span className="font-mono">{plan.hallazgo.folio ?? "Sin folio"}</span> {plan.hallazgo.titulo}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar size={13} />
                      Compromiso: <span className="font-mono">{plan.fechaCompromiso}</span>
                    </p>
                  </div>
                  <InsigniaEstadoPlan estado={plan.estado} />
                </div>

                {plan.rechazo && mostrarRechazo && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
                    <div className="mb-1 flex items-center gap-1.5 font-bold">
                      <AlertTriangle size={14} />
                      La evidencia fue rechazada
                    </div>
                    <p className="break-words">Motivo: {plan.rechazo.motivo}</p>
                  </div>
                )}

                <ul className="space-y-2.5">
                  {plan.pasos.map((paso) => {
                    const observados = pendientes.filter((evidencia) => evidencia.pasoId === paso.id);
                    const expandido = pasoAbierto === paso.id;
                    const editable = paso.esMio && abierto;
                    const etiquetaMarca = editable
                      ? paso.completado
                        ? "Marcar como pendiente"
                        : "Marcar como completado"
                      : paso.esMio
                        ? "Paso bloqueado"
                        : `Paso asignado a ${paso.usuarioAsignado?.nombre ?? "otra persona"}`;
                    return (
                      <li
                        key={paso.id}
                        className={`rounded-lg border transition-colors duration-200 ${
                          paso.completado ? "border-emerald-200 bg-emerald-50/60" : "border-border"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 p-3">
                          <div className="flex min-w-0 flex-1 items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => (editable ? void cambiarPaso(plan, paso) : avisarPasoNoEditable(paso))}
                              aria-label={etiquetaMarca}
                              title={etiquetaMarca}
                              className="shrink-0 rounded-full transition-transform hover:scale-110 focus:outline-none active:scale-90"
                            >
                              {paso.completado ? (
                                <CheckCircle2 size={18} className="fill-green-100 text-green-600 animate-in zoom-in duration-200" />
                              ) : (
                                <div className={`h-[18px] w-[18px] rounded-full border-2 ${editable ? "border-muted-foreground" : "border-muted-foreground/40"}`} />
                              )}
                            </button>
                            <span
                              className={`break-words text-sm font-semibold transition-colors duration-200 ${
                                paso.completado ? "text-muted-foreground line-through" : "text-foreground"
                              }`}
                            >
                              {paso.descripcion}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1 font-medium">
                              <User size={12} className="text-primary" />
                              <span>{paso.usuarioAsignado?.nombre ?? "Sin asignar"}</span>
                            </span>
                            <span className="flex items-center gap-1 font-mono">
                              <Calendar size={13} />
                              {paso.fechaCompromiso ?? "Sin fecha"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Paperclip size={12} className="text-primary" />
                              Evidencias: {paso.evidenciasCount}
                            </span>
                            <button
                              type="button"
                              onClick={() => setPasoAbierto(expandido ? null : paso.id)}
                              aria-label="Ver evidencia"
                              title="Ver evidencia"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-foreground hover:bg-secondary"
                            >
                              {expandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                          </div>
                        </div>
                        {observados.length > 0 && (
                          <div data-testid={`observados-${paso.id}`} className="border-t border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                            Archivos observados: {observados.map((evidencia) => evidencia.nombre).join(", ")}.
                            {paso.esMio && " Corrígelos y vuelve a marcar el paso."}
                          </div>
                        )}
                        {expandido && (
                          <div className="border-t border-border p-3">
                            <EvidenciasSection
                              entityId={String(paso.id)}
                              entityType="action_plan_step"
                              puedeSubir={paso.esMio && abierto}
                              onEvidenceCountChange={(cantidad: number) => contarEvidencia(plan.id, paso.id, cantidad)}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {plan.esResponsable && (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-xs">
                    <div className="min-w-0 text-muted-foreground">
                      {prorrogaAbierta && (
                        <p className="break-words">Prórroga solicitada para el {plan.prorroga!.fechaPropuesta}: está por decidirse.</p>
                      )}
                      {plan.prorroga?.estado === "Aprobada" && (
                        <p className="break-words">Prórroga aprobada: la fecha cambió de {plan.prorroga.fechaActual} a {plan.prorroga.fechaPropuesta}.</p>
                      )}
                      {plan.prorroga?.estado === "Rechazada" && (
                        <p className="break-words">Prórroga rechazada. Motivo: {plan.prorroga.motivoDecision}</p>
                      )}
                    </div>
                    {abierto && !prorrogaAbierta && (
                      <button
                        type="button"
                        onClick={() => setPlanProrroga(plan)}
                        className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
                      >
                        <CalendarClock size={14} />
                        Solicitar prórroga
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Card>
            </div>
          );
        })
      )}

      {planProrroga && (
        <DialogoProrroga
          plan={planProrroga}
          onCerrar={() => setPlanProrroga(null)}
          onEnviada={() => {
            setPlanProrroga(null);
            void cargar();
          }}
        />
      )}
    </div>
  );
}

function DialogoProrroga({ plan, onCerrar, onEnviada }: { plan: PlanAuditado; onCerrar: () => void; onEnviada: () => void }) {
  const [fechaPropuesta, setFechaPropuesta] = useState("");
  const [justificacion, setJustificacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    const texto = justificacion.trim();
    if (!fechaPropuesta || !texto) {
      setError("Indica la nueva fecha y la justificación.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await solicitarProrroga(plan.id, { fechaPropuesta, justificacion: texto });
      toast.success("Solicitud de prórroga enviada.");
      onEnviada();
    } catch (err) {
      setError(mensajeDe(err, "No se pudo enviar la solicitud."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && !enviando && onCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Solicitar prórroga</DialogTitle>
          <DialogDescription>
            La fecha de {plan.publicId} ({plan.fechaCompromiso}) solo cambia si el Jefe de Auditoría aprueba la solicitud.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="prorroga-fecha" className="block text-xs font-semibold text-muted-foreground">
              Nueva fecha propuesta
            </label>
            <input
              id="prorroga-fecha"
              type="date"
              value={fechaPropuesta}
              min={plan.fechaCompromiso}
              onChange={(evento) => setFechaPropuesta(evento.target.value)}
              className="w-full rounded-md border border-border bg-input-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="prorroga-justificacion" className="block text-xs font-semibold text-muted-foreground">
              Justificación
            </label>
            <textarea
              id="prorroga-justificacion"
              value={justificacion}
              maxLength={2000}
              rows={4}
              onChange={(evento) => setJustificacion(evento.target.value)}
              className="w-full rounded-md border border-border bg-input-background px-3 py-2 text-sm"
            />
          </div>
          {error && (
            <p role="alert" className="text-xs font-medium text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <button
            type="button"
            onClick={onCerrar}
            disabled={enviando}
            className="rounded-md border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void enviar()}
            disabled={enviando}
            className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Enviar solicitud
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
