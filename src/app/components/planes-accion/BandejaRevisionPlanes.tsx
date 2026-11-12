import { useEffect, useRef, useState } from "react";
import { CheckCheck, Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Card } from "../ComponentesCompartidos";
import EvidenciasSection from "../EvidenciasSection";
import HistorialFlujoPlan from "./HistorialFlujoPlan";
import InsigniaEstadoPlan from "./InsigniaEstadoPlan";
import { useCambiosPlanes } from "./useCambiosPlanes";
import { desplazarAElemento } from "../desplazarAElemento";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { useSesion } from "../../auth/SesionContext";
import {
  abrirRevisionPlan,
  aprobarPlanAccion,
  ETIQUETA_ETAPA,
  listarBandejaRevision,
  listarEvidenciasPlan,
  puedeRevisarPlan,
  rechazarPlanAccion,
  type EstadoPlanAccion,
  type EvidenciaPlan,
  type PlanAccion,
  type SolicitudDestinoPlan,
} from "../../api/planesAccion";

const FILTROS: EstadoPlanAccion[] = ["Pendiente", "En Revisión", "Aprobado", "Rechazado"];

const mensajeDe = (error: unknown, respaldo: string) => (error instanceof Error ? error.message : respaldo);

/** Bandeja de revisión y aprobación de planes de acción (SF-12). */
export default function BandejaRevisionPlanes({ destino }: { destino?: SolicitudDestinoPlan | null }) {
  const { usuario } = useSesion();
  const [planes, setPlanes] = useState<PlanAccion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<EstadoPlanAccion>("Pendiente");
  const [seleccionadoId, setSeleccionadoId] = useState<number | null>(null);
  const [destacadoId, setDestacadoId] = useState<number | null>(null);
  const [recargaFlujo, setRecargaFlujo] = useState(0);
  const [enProceso, setEnProceso] = useState(false);
  const [confirmandoAprobacion, setConfirmandoAprobacion] = useState(false);
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [errorMotivo, setErrorMotivo] = useState(false);
  const [evidenciasPlan, setEvidenciasPlan] = useState<EvidenciaPlan[]>([]);
  const [observadas, setObservadas] = useState<string[]>([]);

  // Solo se usa la respuesta de la última petición: una recarga en vivo no debe pisar otra más reciente.
  const ultimaPeticion = useRef(0);
  // `silencioso`: recarga en vivo, sin indicador de carga ni avisos de error.
  const cargar = async ({ silencioso = false } = {}) => {
    const peticion = ++ultimaPeticion.current;
    if (!silencioso) setCargando(true);
    try {
      const lista = await listarBandejaRevision();
      if (peticion !== ultimaPeticion.current) return null;
      setPlanes(lista);
      return lista;
    } catch (error) {
      if (!silencioso && peticion === ultimaPeticion.current) toast.error(mensajeDe(error, "No se pudo cargar la bandeja de revisión."));
      return null;
    } finally {
      if (peticion === ultimaPeticion.current) setCargando(false);
    }
  };

  useCambiosPlanes(() => {
    void cargar({ silencioso: true });
    setRecargaFlujo((valor) => valor + 1);
  });

  // Desde una notificación se llega al plan. Uno pendiente solo se resalta: abrirlo lo pasa a En Revisión,
  // y eso le toca decidirlo al Jefe de Auditoría.
  useEffect(() => {
    void cargar().then((lista) => {
      if (!destino || !lista) return;
      const plan = lista.find((item) => item.id === destino.planId);
      if (!plan) {
        toast.error("Ese plan ya no está en la bandeja de revisión.");
        return;
      }
      setFiltro(plan.estado);
      if (plan.estado === "Pendiente") {
        setSeleccionadoId(null);
        setDestacadoId(plan.id);
      } else {
        setDestacadoId(null);
        setSeleccionadoId(plan.id);
      }
      desplazarAElemento(`plan-revision-${plan.id}`);
    });
  }, [destino?.solicitud]);

  // El detalle pertenece al filtro en el que se abrió: al cambiar de filtro se cierra.
  const cambiarFiltro = (estado: EstadoPlanAccion) => {
    if (estado === filtro) return;
    setFiltro(estado);
    setSeleccionadoId(null);
    setDestacadoId(null);
  };

  const reemplazarPlan = (actualizado: PlanAccion) => {
    setPlanes((previos) => previos.map((plan) => (plan.id === actualizado.id ? actualizado : plan)));
    setRecargaFlujo((valor) => valor + 1);
  };

  // Abrir un plan pendiente lo pasa a En Revisión. Va en el clic y no en un efecto para que se llame una sola vez.
  const abrirPlan = async (plan: PlanAccion) => {
    setSeleccionadoId(plan.id);
    setDestacadoId(null);
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
      toast.success(plan.etapa === "definicion" ? "Plan de acción validado y firmado." : "Plan de acción aprobado y firmado.");
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
      reemplazarPlan(await rechazarPlanAccion(plan.id, texto, observadas));
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
    setObservadas([]);
  };

  // Solo el cierre revisa archivos. Si no se pueden leer, aún se puede rechazar con el motivo.
  const abrirRechazo = async (plan: PlanAccion) => {
    setEvidenciasPlan([]);
    setRechazando(true);
    if (plan.etapa !== "cierre") return;
    try {
      setEvidenciasPlan(await listarEvidenciasPlan(plan.id));
    } catch {
      setEvidenciasPlan([]);
    }
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
              onClick={() => cambiarFiltro(estado)}
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
              <li
                key={plan.id}
                id={`plan-revision-${plan.id}`}
                data-destacado={plan.id === destacadoId ? "true" : undefined}
                className={plan.id === destacadoId ? "ring-2 ring-inset ring-primary" : undefined}
              >
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
                  <span className="text-xs text-muted-foreground">{ETIQUETA_ETAPA[plan.etapa]}</span>
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
                <p className="text-xs font-medium text-foreground">{ETIQUETA_ETAPA[seleccionado.etapa]}</p>
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
                No puedes revisar este plan porque eres su responsable, lo creaste o tienes pasos asignados.
              </p>
            )}

            {puedeRevisar && seleccionado.estado === "En Revisión" && (
              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => void abrirRechazo(seleccionado)}
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
                  <DialogTitle>{seleccionado.etapa === "definicion" ? "Validar plan de acción" : "Aprobar plan de acción"}</DialogTitle>
                  <DialogDescription>
                    Tu nombre, tu rol y la fecha quedarán registrados como firma electrónica de {seleccionado.publicId}.{" "}
                    {seleccionado.etapa === "definicion"
                      ? "El plan ya no podrá cambiar de contenido y el auditado podrá empezar a trabajar."
                      : "El plan ya no podrá modificarse."}
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
                    {seleccionado.etapa === "definicion"
                      ? `El auditor verá este motivo y podrá corregir el plan ${seleccionado.publicId} para reenviarlo.`
                      : `El auditado y el auditor verán este motivo y los archivos señalados de ${seleccionado.publicId}. Sus pasos se reabren para que el auditado los corrija.`}
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
                {seleccionado.etapa === "cierre" && evidenciasPlan.length > 0 && (
                  <fieldset className="space-y-1">
                    <legend className="text-xs font-semibold text-muted-foreground">Archivos que hay que corregir (opcional)</legend>
                    {evidenciasPlan.map((evidencia) => (
                      <label key={evidencia.id} className="flex items-center gap-2 text-xs text-foreground">
                        <input
                          type="checkbox"
                          checked={observadas.includes(evidencia.id)}
                          onChange={(evento) =>
                            setObservadas((previas) =>
                              evento.target.checked ? [...previas, evidencia.id] : previas.filter((id) => id !== evidencia.id),
                            )
                          }
                        />
                        <span className="break-all">
                          {evidencia.nombre} ({seleccionado.pasos.find((paso) => paso.id === evidencia.pasoId)?.descripcion ?? "Paso"})
                        </span>
                      </label>
                    ))}
                  </fieldset>
                )}
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
