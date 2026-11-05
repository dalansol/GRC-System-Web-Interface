import { useEffect, useState } from "react";
import { CheckCheck, Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Card } from "./SharedComponents";
import EvidenciasSection from "./EvidenciasSection";
import HistorialFlujoPlan from "./HistorialFlujoPlan";
import InsigniaEstadoPlan from "./InsigniaEstadoPlan";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { useSesion } from "../auth/SesionContext";
import {
  abrirRevisionPlan,
  aprobarPlanAccion,
  listarBandejaRevision,
  puedeRevisarPlan,
  rechazarPlanAccion,
  type EstadoPlanAccion,
  type PlanAccion,
} from "../api/planesAccion";

const FILTROS: EstadoPlanAccion[] = ["Pendiente", "En Revisión", "Aprobado", "Rechazado"];

const mensajeDe = (error: unknown, respaldo: string) => (error instanceof Error ? error.message : respaldo);

/** Bandeja de revisión y aprobación de planes de acción (SF-12). */
export default function BandejaRevisionPlanes() {
  const { usuario } = useSesion();
  const [planes, setPlanes] = useState<PlanAccion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<EstadoPlanAccion>("Pendiente");
  const [seleccionadoId, setSeleccionadoId] = useState<number | null>(null);
  const [recargaFlujo, setRecargaFlujo] = useState(0);
  const [enProceso, setEnProceso] = useState(false);
  const [confirmandoAprobacion, setConfirmandoAprobacion] = useState(false);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [errorMotivo, setErrorMotivo] = useState(false);

  const cargar = async () => {
    setCargando(true);
    try {
      setPlanes(await listarBandejaRevision());
    } catch (error) {
      toast.error(mensajeDe(error, "No se pudo cargar la bandeja de revisión."));
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  const reemplazarPlan = (actualizado: PlanAccion) => {
    setPlanes((previos) => previos.map((plan) => (plan.id === actualizado.id ? actualizado : plan)));
    setRecargaFlujo((valor) => valor + 1);
  };

  // Abrir un plan pendiente lo pasa a En Revisión. Va en el clic y no en un efecto para que se llame una sola vez.
  const abrirPlan = async (plan: PlanAccion) => {
    setSeleccionadoId(plan.id);
    if (plan.estado !== "Pendiente" || !puedeRevisarPlan(plan, usuario)) return;
    try {
      reemplazarPlan(await abrirRevisionPlan(plan.id));
    } catch (error) {
      toast.error(mensajeDe(error, "No se pudo abrir el plan para revisión."));
      void cargar();
    }
  };

  const aprobar = async (plan: PlanAccion) => {
    setEnProceso(true);
    try {
      reemplazarPlan(await aprobarPlanAccion(plan.id));
      toast.success("Plan de acción aprobado y firmado.");
    } catch (error) {
      toast.error(mensajeDe(error, "No se pudo aprobar el plan de acción."));
      void cargar();
    } finally {
      setEnProceso(false);
      setConfirmandoAprobacion(false);
    }
  };

  const rechazar = async (plan: PlanAccion) => {
    const texto = motivo.trim();
    if (!texto) {
      setErrorMotivo(true);
      return;
    }
    setEnProceso(true);
    try {
      reemplazarPlan(await rechazarPlanAccion(plan.id, texto));
      toast.success("Plan de acción rechazado.");
      cerrarRechazo();
    } catch (error) {
      toast.error(mensajeDe(error, "No se pudo rechazar el plan de acción."));
      cerrarRechazo();
      void cargar();
    } finally {
      setEnProceso(false);
    }
  };

  const cerrarRechazo = () => {
    setRechazando(false);
    setMotivo("");
    setErrorMotivo(false);
  };

  const visibles = planes.filter((plan) => plan.estado === filtro);
  const seleccionado = planes.find((plan) => plan.id === seleccionadoId) ?? null;
  const puedeRevisar = seleccionado ? puedeRevisarPlan(seleccionado, usuario) : false;

  if (cargando && planes.length === 0) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="mr-2 animate-spin" size={20} />
        Cargando bandeja de revisión...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Estado del plan" className="flex flex-wrap gap-2">
          {FILTROS.map((estado) => (
            <button
              key={estado}
              type="button"
              role="tab"
              aria-selected={filtro === estado}
              onClick={() => setFiltro(estado)}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                filtro === estado
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-secondary"
              }`}
            >
              {estado} ({planes.filter((plan) => plan.estado === estado).length})
            </button>
          ))}
        </div>
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

      <Card>
        {visibles.length === 0 ? (
          <p className="p-8 text-center text-xs text-muted-foreground">No hay planes en este estado.</p>
        ) : (
          <ul className="divide-y divide-border">
            {visibles.map((plan) => (
              <li key={plan.id}>
                <button
                  type="button"
                  onClick={() => void abrirPlan(plan)}
                  aria-current={plan.id === seleccionadoId}
                  className={`flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-muted/30 ${
                    plan.id === seleccionadoId ? "bg-primary/5" : ""
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="mr-2 font-mono text-xs font-medium text-primary">{plan.publicId}</span>
                    <span className="font-medium text-foreground">{plan.titulo}</span>
                    <span className="block text-xs text-muted-foreground">
                      {plan.responsable.nombre} · Fecha límite {plan.fechaCompromiso}
                    </span>
                  </span>
                  <InsigniaEstadoPlan estado={plan.estado} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {seleccionado && (
        <Card>
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-xs font-medium text-primary">{seleccionado.publicId}</div>
                <h3 className="text-base font-semibold text-foreground">{seleccionado.titulo}</h3>
                <p className="text-xs text-muted-foreground">
                  Responsable: {seleccionado.responsable.nombre} · Fecha límite: {seleccionado.fechaCompromiso}
                </p>
              </div>
              <InsigniaEstadoPlan estado={seleccionado.estado} />
            </div>

            <section className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Análisis de causa raíz</h4>
              <p className="break-words text-xs text-muted-foreground">
                {seleccionado.causaRaiz || seleccionado.descripcion || "Sin documentar."}
              </p>
            </section>

            <section className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Hallazgos relacionados</h4>
              <ul className="space-y-1 text-xs">
                {seleccionado.hallazgosRelacionados.map((hallazgo) => (
                  <li key={hallazgo.id} className="text-muted-foreground">
                    <span className="font-mono font-bold text-primary">{hallazgo.folio || hallazgo.id}</span> {hallazgo.titulo}
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Pasos y evidencia</h4>
              {seleccionado.pasos.map((paso) => (
                <div key={paso.id} className="space-y-2 rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="break-words font-semibold text-foreground">{paso.descripcion}</span>
                    <span className="text-muted-foreground">
                      {paso.usuarioAsignado?.nombre ?? "Sin asignar"} · {paso.completado ? "Completado" : "Sin completar"}
                    </span>
                  </div>
                  <EvidenciasSection entityId={String(paso.id)} entityType="action_plan_step" puedeSubir={false} />
                </div>
              ))}
            </section>

            <section className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Historial del flujo</h4>
              <HistorialFlujoPlan planId={seleccionado.id} recarga={recargaFlujo} />
            </section>

            {!puedeRevisar && (
              <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                No puedes revisar este plan porque eres su responsable o tienes pasos asignados.
              </p>
            )}

            {puedeRevisar && seleccionado.estado === "En Revisión" && (
              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setRechazando(true)}
                  disabled={enProceso}
                  className="inline-flex items-center gap-2 rounded-md border border-destructive px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  <XCircle size={15} />
                  Rechazar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmandoAprobacion(true)}
                  disabled={enProceso}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <CheckCheck size={15} />
                  Aprobar
                </button>
              </div>
            )}

            <Dialog open={confirmandoAprobacion} onOpenChange={(abierto) => !enProceso && setConfirmandoAprobacion(abierto)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Aprobar plan de acción</DialogTitle>
                  <DialogDescription>
                    Tu nombre, tu rol y la fecha quedarán registrados como firma electrónica de {seleccionado.publicId}, y
                    el plan ya no podrá modificarse.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <button
                    type="button"
                    onClick={() => setConfirmandoAprobacion(false)}
                    disabled={enProceso}
                    className="rounded-md border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void aprobar(seleccionado)}
                    disabled={enProceso}
                    className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    Confirmar y firmar
                  </button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={rechazando} onOpenChange={(abierto) => !abierto && !enProceso && cerrarRechazo()}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Rechazar plan de acción</DialogTitle>
                  <DialogDescription>
                    El responsable verá este motivo y podrá corregir el plan {seleccionado.publicId} para reenviarlo.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-1">
                  <label htmlFor="motivo-rechazo" className="block text-xs font-semibold text-muted-foreground">
                    Motivo del rechazo
                  </label>
                  <textarea
                    id="motivo-rechazo"
                    value={motivo}
                    maxLength={2000}
                    rows={4}
                    aria-required="true"
                    aria-invalid={errorMotivo}
                    onChange={(evento) => {
                      setMotivo(evento.target.value);
                      setErrorMotivo(false);
                    }}
                    className="w-full rounded-md border border-border bg-input-background px-3 py-2 text-sm"
                  />
                  {errorMotivo && (
                    <p role="alert" className="text-xs font-medium text-destructive">
                      Escribe el motivo del rechazo.
                    </p>
                  )}
                </div>
                <DialogFooter>
                  <button
                    type="button"
                    onClick={cerrarRechazo}
                    disabled={enProceso}
                    className="rounded-md border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void rechazar(seleccionado)}
                    disabled={enProceso}
                    className="rounded-md bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                  >
                    Confirmar rechazo
                  </button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </Card>
      )}
    </div>
  );
}
