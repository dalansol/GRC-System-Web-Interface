// Aviso dentro del proceso de que cambió algún plan de acción (SF-10, SF-11, SF-12), para que las pantallas
// abiertas se recarguen sin que el usuario lo pida. El aviso no lleva datos: cada pantalla vuelve a pedir su
// lista con sus propios permisos, así que un suscriptor no se entera de nada que no pudiera consultar.
// Solo funciona con un proceso del backend (hoy server.ts es el único); con varios habría que pasar a
// LISTEN/NOTIFY de PostgreSQL.

type Oyente = () => void;

const oyentes = new Set<Oyente>();

/** Registra un oyente y devuelve la función que lo da de baja. */
export function suscribirCambiosPlanes(oyente: Oyente): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

/** Avisa a todos los oyentes. Un oyente que falla (conexión ya cerrada) no impide avisar a los demás. */
export function publicarCambioPlanes(): void {
  for (const oyente of [...oyentes]) {
    try {
      oyente();
    } catch {
      // La conexión se limpia sola al cerrarse.
    }
  }
}

export function cantidadSuscriptoresPlanes(): number {
  return oyentes.size;
}
