import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  listarNotificaciones,
  marcarNotificacionLeida,
  marcarTodasLeidas,
  type Notificacion,
} from "../api/notificaciones";

const INTERVALO_CONSULTA_MS = 60_000;

const formatearFecha = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });

/** Campana de la barra superior. Un fallo al consultar no interrumpe la aplicación: se reintenta en la siguiente consulta. */
export default function CampanaNotificaciones({ onAbrir }: { onAbrir?: (aviso: Notificacion) => void }) {
  const [avisos, setAvisos] = useState<Notificacion[]>([]);
  const [abierta, setAbierta] = useState(false);

  useEffect(() => {
    let vigente = true;
    const consultar = () => {
      listarNotificaciones()
        .then(({ items }) => {
          if (vigente) setAvisos(items);
        })
        .catch(() => {});
    };
    consultar();
    const intervalo = window.setInterval(consultar, INTERVALO_CONSULTA_MS);
    window.addEventListener("focus", consultar);
    return () => {
      vigente = false;
      window.clearInterval(intervalo);
      window.removeEventListener("focus", consultar);
    };
  }, []);

  const noLeidas = avisos.filter((aviso) => !aviso.leida).length;

  const marcarLeida = (aviso: Notificacion) => {
    if (aviso.leida) return;
    setAvisos((previos) => previos.map((item) => (item.id === aviso.id ? { ...item, leida: true } : item)));
    marcarNotificacionLeida(aviso.id).catch(() => {
      setAvisos((previos) => previos.map((item) => (item.id === aviso.id ? { ...item, leida: false } : item)));
    });
  };

  const abrirAviso = (aviso: Notificacion) => {
    marcarLeida(aviso);
    setAbierta(false);
    onAbrir?.(aviso);
  };

  const marcarTodas = () => {
    const anteriores = avisos;
    setAvisos((previos) => previos.map((item) => ({ ...item, leida: true })));
    marcarTodasLeidas().catch(() => setAvisos(anteriores));
  };

  return (
    <Popover open={abierta} onOpenChange={setAbierta}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={noLeidas > 0 ? `Notificaciones: ${noLeidas} sin leer` : "Notificaciones"}
          className="relative p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
        >
          <Bell size={16} />
          {noLeidas > 0 && (
            <span data-testid="notificaciones-sin-leer" className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <span className="text-xs font-semibold text-foreground">Notificaciones</span>
          {noLeidas > 0 && (
            <button type="button" onClick={marcarTodas} className="text-xs font-medium text-primary hover:underline">
              Marcar todas como leídas
            </button>
          )}
        </div>
        {avisos.length === 0 ? (
          <p className="p-4 text-center text-xs text-muted-foreground">No tienes notificaciones.</p>
        ) : (
          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {avisos.map((aviso) => (
              <li key={aviso.id}>
                <button
                  type="button"
                  onClick={() => abrirAviso(aviso)}
                  className={`w-full px-3 py-2 text-left text-xs hover:bg-muted/40 ${aviso.leida ? "text-muted-foreground" : "bg-primary/5 font-medium text-foreground"}`}
                >
                  <span className="block break-words">{aviso.mensaje}</span>
                  <span className="mt-0.5 block font-mono text-[10px] font-normal text-muted-foreground">{formatearFecha(aviso.fecha)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
