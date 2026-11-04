// Catálogos editables de la estructura organizacional (SF-03).
// Opciones de nombre de área y de país o región de la subdivisión: solo el Administrador las
// edita y los formularios del Catálogo solo aceptan valores de aquí. Se comparan sin distinguir
// mayúsculas pero sí acentos, igual que los nombres únicos (claveNombre, `sin_mayusculas`).

export type TipoCatalogo = "area" | "pais";
export const TIPOS_CATALOGO: readonly TipoCatalogo[] = ["area", "pais"];

export interface OpcionCatalogo {
  id: number;
  valor: string;
  /** Áreas (por su nombre) o subdivisiones (por su país) que usan la opción. */
  usos: number;
}

/** Mismos topes que los campos que alimentan: `area.area_name` y `business.country`. */
export const MAX_VALOR: Record<TipoCatalogo, number> = { area: 150, pais: 100 };

/** Mensaje cuando un formulario envía un valor que no está en el catálogo. */
export const MENSAJE_FUERA_DE_CATALOGO: Record<TipoCatalogo, string> = {
  area: "Elige un área del catálogo. Si falta, pide al Administrador que la agregue en Ajustes.",
  pais: "Elige un país o región del catálogo. Si falta, pide al Administrador que lo agregue en Ajustes.",
};

export function esTipoCatalogo(valor: unknown): valor is TipoCatalogo {
  return TIPOS_CATALOGO.includes(valor as TipoCatalogo);
}

/** Valida el valor de una opción. Devuelve mensaje de error o null si todo bien. */
export function validarValorOpcion(tipo: TipoCatalogo, valor: unknown): string | null {
  if (typeof valor !== "string" || valor.trim().length === 0) return "El valor es obligatorio.";
  if (valor.trim().length > MAX_VALOR[tipo]) return `El valor no puede superar los ${MAX_VALOR[tipo]} caracteres.`;
  return null;
}
