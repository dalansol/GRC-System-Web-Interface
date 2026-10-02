// Validación del correo corporativo (SF-16).

const FORMATO_CORREO = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export function normalizarCorreo(correo: string): string {
  return correo.trim().toLowerCase();
}

export function correoValido(correo: string): boolean {
  return FORMATO_CORREO.test(correo);
}

// La comparación es exacta: un subdominio no cuenta como dominio autorizado.
export function dominioPermitido(correo: string, dominios: readonly string[]): boolean {
  const dominio = correo.slice(correo.lastIndexOf("@") + 1).toLowerCase();
  return dominios.some((permitido) => permitido.toLowerCase() === dominio);
}
