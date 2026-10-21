// Nombres de la estructura organizacional (SF-03).
// `nombre` es el código del Consolidado (UDN-0003, DIVISION-0002…) y sigue siendo el
// identificador; `nombreReal` (KOF, Brasil…) es opcional. Mostrar siempre con nombreVisible.

export interface ConNombre {
  nombre: string;
  nombreReal?: string | null;
}

/** El nombre real si lo hay; si no, el código. */
export function nombreVisible(nodo: ConNombre): string {
  return nodo.nombreReal?.trim() || nodo.nombre;
}

/** True si el nodo tiene un nombre real distinto de su código (para mostrar el código aparte). */
export function tieneNombreReal(nodo: ConNombre): boolean {
  return nombreVisible(nodo) !== nodo.nombre;
}
