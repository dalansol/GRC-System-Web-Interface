import { useEffect, useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { obtenerFlujoPlan, type AccionFlujoPlan, type FlujoPlan } from "../api/planesAccion";

const ETIQUETA_ACCION: Record<AccionFlujoPlan, string> = {
  envio: "Enviado a revisión",
  apertura: "Abierto para revisión",
  aprobacion: "Aprobado",
  rechazo: "Rechazado",
};

const ETIQUETA_DEFINICION: Partial<Record<AccionFlujoPlan, string>> = {
  envio: "Enviado a validación",
  apertura: "Abierto para validación",
  aprobacion: "Plan validado",
  rechazo: "Validación rechazada",
};

const formatearFecha = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });

/** Historial de la bitácora del flujo de aprobación de un plan (SF-12). `recarga` lo vuelve a consultar al cambiar. */
export default function HistorialFlujoPlan({ planId, recarga }: { planId: number; recarga: number }) {
  const [flujo, setFlujo] = useState<FlujoPlan | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vigente = true;
    setError(false);
    obtenerFlujoPlan(planId)
      .then((datos) => {
        if (vigente) setFlujo(datos);
      })
      .catch(() => {
        if (vigente) setError(true);
      });
    return () => {
      vigente = false;
    };
  }, [planId, recarga]);

  if (error) return <p className="text-xs text-destructive">No se pudo cargar el historial del flujo.</p>;
  if (!flujo) return <p className="text-xs text-muted-foreground">Cargando historial…</p>;
  if (flujo.eventos.length === 0) {
    return <p className="text-xs text-muted-foreground italic">Todavía no hay movimientos en el flujo.</p>;
  }

  return (
    <ol className="space-y-2">
      {flujo.eventos.map((evento) => (
        <li key={evento.id} className="rounded-md border border-border bg-card p-3 text-xs space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-foreground">
              {(evento.etapa === "definicion" && ETIQUETA_DEFINICION[evento.accion]) || ETIQUETA_ACCION[evento.accion]}
            </span>
            <span className="font-mono text-muted-foreground">{formatearFecha(evento.fecha)}</span>
          </div>
          {evento.firmaHash ? (
            <div className="space-y-1">
              <p className="text-muted-foreground">
                Firmado por {evento.actor.nombre} ({evento.actor.rol})
              </p>
              <p className="text-muted-foreground">
                Huella:{" "}
                <span className="font-mono text-foreground" title={evento.firmaHash}>
                  {evento.firmaHash.slice(0, 12)}
                </span>
              </p>
              {evento.etapa !== "definicion" && flujo.firmaIntegra === true && (
                <p className="flex items-center gap-1 font-medium text-emerald-700">
                  <ShieldCheck size={13} />
                  <span>Integridad verificada</span>
                </p>
              )}
              {evento.etapa !== "definicion" && flujo.firmaIntegra === false && (
                <p role="alert" className="flex items-center gap-1 font-medium text-destructive">
                  <AlertTriangle size={13} />
                  El contenido cambió después de la firma
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">
              {evento.actor.nombre} ({evento.actor.rol})
            </p>
          )}
          {evento.motivo && <p className="break-words text-foreground">Motivo: {evento.motivo}</p>}
          {Boolean(evento.evidenciasObservadas?.length) && (
            <p className="break-words text-foreground">
              Archivos señalados: {evento.evidenciasObservadas!.map((evidencia) => evidencia.nombre).join(", ")}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
