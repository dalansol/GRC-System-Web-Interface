import { useEffect, useRef } from "react";
import { suscribirCambiosPlanes } from "../../api/cambiosPlanes";

/** Varios avisos seguidos (un envío y su notificación, por ejemplo) se juntan en una sola recarga. */
const AGRUPAR_AVISOS_MS = 300;

/**
 * Recarga la vista cuando cambia algún plan de acción o cuando la pestaña vuelve a estar visible,
 * sin que el usuario pulse "Actualizar". `recargar` debe hacerlo en silencio (sin indicador de carga).
 */
export function useCambiosPlanes(recargar: () => void) {
  const ultimaRecarga = useRef(recargar);
  ultimaRecarga.current = recargar;

  useEffect(() => {
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const cancelar = suscribirCambiosPlanes(() => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => ultimaRecarga.current(), AGRUPAR_AVISOS_MS);
    });
    return () => {
      clearTimeout(temporizador);
      cancelar();
    };
  }, []);
}
