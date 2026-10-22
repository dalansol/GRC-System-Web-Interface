// Nombres de la estructura organizacional (SF-03).
// Unidad, división y subdivisión tienen `codigo` (UDN-0003, DIVISION-0002…), que las
// identifica y no cambia, y `nombre` (KOF, Brasil…), opcional. El área solo tiene nombre.
// Mostrar siempre con nombreVisible.

export interface ConNombre {
  codigo?: string | null;
  nombre?: string | null;
}

/** El nombre si lo hay; si no, el código. */
export function nombreVisible(nodo: ConNombre): string {
  return nodo.nombre?.trim() || nodo.codigo || "";
}

/** True si el nodo tiene código y un nombre distinto de él (para mostrar el código aparte). */
export function tieneNombre(nodo: ConNombre): boolean {
  return Boolean(nodo.codigo) && nombreVisible(nodo) !== nodo.codigo;
}
