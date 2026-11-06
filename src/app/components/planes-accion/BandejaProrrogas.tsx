import { useEffect, useRef, useState } from "react";
import { CheckCheck, Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Card } from "../ComponentesCompartidos";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { desplazarAElemento } from "../desplazarAElemento";
import {
  aprobarProrroga,
  listarProrrogasPendientes,
  rechazarProrroga,
  type SolicitudDestinoPlan,
  type SolicitudProrroga,
} from "../../api/planesAccion";

const mensajeDe = (error: unknown, respaldo: string) => (error instanceof Error ? error.message : respaldo);

/** Solicitudes de prórroga por decidir (SF-11). Las decide el Jefe de Auditoría. */
export default function BandejaProrrogas({ destino }: { destino?: SolicitudDestinoPlan | null }) {
  const [solicitudes, setSolicitudes] = useState<SolicitudProrroga[]>([]);
  const [cargando, setCargando] = useState(true);
  const [enProceso, setEnProceso] = useState(false);
  const [rechazando, setRechazando] = useState<SolicitudProrroga | null>(null);
  const [motivo, setMotivo] = useState("");
  const [errorMotivo, setErrorMotivo] = useState(false);
  // Evita una segunda decisión con un doble clic: la solicitud sigue en pantalla hasta que termina la recarga.
  const decidiendo = useRef(false);
  const [destacadaPlanId, setDestacadaPlanId] = useState<number | null>(null);

  const cargar = async () => {
    setCargando(true);
    try {
      const lista = await listarProrrogasPendientes();
      setSolicitudes(lista);
      return lista;
    } catch (error) {
      toast.error(mensajeDe(error, "No se pudieron cargar las solicitudes de prórroga."));
      return null;
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void cargar().then((lista) => {
      if (!destino || !lista) return;
      if (lista.some((solicitud) => solicitud.planAccionId === destino.planId)) {
        setDestacadaPlanId(destino.planId);
        desplazarAElemento(`prorroga-plan-${destino.planId}`);
      } else {
        toast.error("Esa solicitud de prórroga ya se decidió.");
      }
    });
  }, [destino?.solicitud]);

  const cerrarRechazo = () => {
    setRechazando(null);
    setMotivo("");
    setErrorMotivo(false);
  };

  const decidir = async (accion: () => Promise<unknown>, exito: string, respaldo: string) => {
    if (decidiendo.current) return;
    decidiendo.current = true;
    setEnProceso(true);
    try {
      await accion();
      toast.success(exito);
    } catch (error) {
      toast.error(mensajeDe(error, respaldo));
    } finally {
      cerrarRechazo();
      await cargar();
      decidiendo.current = false;
      setEnProceso(false);
    }
  };

  const rechazar = (solicitud: SolicitudProrroga) => {
    const texto = motivo.trim();
    if (!texto) {
      setErrorMotivo(true);
      return;
    }
    void decidir(() => rechazarProrroga(solicitud.id, texto), "Prórroga rechazada.", "No se pudo rechazar la prórroga.");
  };

  if (cargando && solicitudes.length === 0) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="mr-2 animate-spin" size={20} />
        Cargando solicitudes de prórroga...
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

      <Card>
        {solicitudes.length === 0 ? (
          <p className="p-8 text-center text-xs text-muted-foreground">No hay solicitudes de prórroga pendientes.</p>
        ) : (
          <ul className="divide-y divide-border">
            {solicitudes.map((solicitud) => (
              <li
                key={solicitud.id}
                id={`prorroga-plan-${solicitud.planAccionId}`}
                data-destacado={solicitud.planAccionId === destacadaPlanId ? "true" : undefined}
                className={`flex flex-wrap items-start justify-between gap-3 p-4 ${
                  solicitud.planAccionId === destacadaPlanId ? "bg-primary/5 ring-2 ring-inset ring-primary" : ""
                }`}
              >
                <div className="min-w-0 flex-1 space-y-1 text-xs">
                  <div className="font-mono font-medium text-primary">{solicitud.folioPlan}</div>
                  <p className="text-muted-foreground">Solicita: {solicitud.solicitadaPor.nombre}</p>
                  <p className="text-muted-foreground">
                    Fecha actual: <span className="font-mono">{solicitud.fechaActual}</span>
                  </p>
                  <p className="font-medium text-foreground">
                    Fecha propuesta: <span className="font-mono">{solicitud.fechaPropuesta}</span>
                  </p>
                  <p className="break-words text-foreground">Justificación: {solicitud.justificacion}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setRechazando(solicitud)}
                    disabled={enProceso}
                    className="inline-flex items-center gap-2 rounded-md border border-destructive px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    <XCircle size={14} />
                    Rechazar prórroga
                  </button>
                  <button
                    type="button"
                    onClick={() => void decidir(() => aprobarProrroga(solicitud.id), "Prórroga aprobada: la fecha del plan cambió.", "No se pudo aprobar la prórroga.")}
                    disabled={enProceso}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    <CheckCheck size={14} />
                    Aprobar prórroga
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {rechazando && (
        <Dialog open onOpenChange={(abierto) => !abierto && !enProceso && cerrarRechazo()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rechazar prórroga</DialogTitle>
              <DialogDescription>
                El responsable de {rechazando.folioPlan} verá este motivo. La fecha del plan no cambia.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1">
              <label htmlFor="motivo-prorroga" className="block text-xs font-semibold text-muted-foreground">
                Motivo del rechazo
              </label>
              <textarea
                id="motivo-prorroga"
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
                onClick={() => rechazar(rechazando)}
                disabled={enProceso}
                className="rounded-md bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                Confirmar rechazo
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
