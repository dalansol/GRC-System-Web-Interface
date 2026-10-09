// Contrato común de los proveedores de IA (Copilot API Gateway, SF-19).
// Las rutas solo conocen esta interfaz; cambiar de proveedor es cambiar IA_PROVEEDOR.

export interface MensajeIA {
  rol: "sistema" | "usuario";
  contenido: string;
}

export interface OpcionesCompletar {
  /** Entre 0 y 1; más bajo es más predecible. */
  temperatura?: number;
  /** Longitud máxima de la respuesta, en tokens. */
  maxTokens?: number;
  /** Obliga al modelo a responder con un objeto JSON. */
  json?: boolean;
}

export interface ProveedorIA {
  readonly nombre: string;
  /** Devuelve el texto generado o lanza ErrorIA. */
  completar(mensajes: MensajeIA[], opciones?: OpcionesCompletar): Promise<string>;
}

export type CodigoErrorIA = "IA_NO_DISPONIBLE" | "IA_TIEMPO_AGOTADO";

const MENSAJES: Record<CodigoErrorIA, string> = {
  IA_NO_DISPONIBLE: "El asistente de IA no está disponible en este momento.",
  IA_TIEMPO_AGOTADO: "El asistente de IA tardó demasiado en responder.",
};

// El mensaje es apto para el usuario; el detalle técnico es solo para los logs del servidor.
export class ErrorIA extends Error {
  constructor(
    readonly codigo: CodigoErrorIA,
    readonly detalle: string,
  ) {
    super(MENSAJES[codigo]);
    this.name = "ErrorIA";
  }
}
