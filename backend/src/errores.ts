export type CodigoError =
  | "NO_AUTENTICADO"
  | "USUARIO_NO_AUTORIZADO"
  | "ROL_NO_AUTORIZADO"
  | "DATOS_INVALIDOS"
  | "DOMINIO_NO_AUTORIZADO"
  | "CORREO_DUPLICADO"
  | "ULTIMO_ADMINISTRADOR"
  | "NO_ENCONTRADO"
  | "CODIGO_DUPLICADO"
  | "PLAN_DUPLICADO"
  | "ASIGNACION_DUPLICADA"
  | "RESPONSABLE_NO_EDITA"
  | "NOMBRE_DUPLICADO"
  | "PERIODO_ACTIVO_NO_CONFIGURADO"
  | "AUDITORIAS_ACTIVAS"
  | "HIJOS_EXISTENTES"
  | "ERROR_INTERNO";

export class ErrorApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: CodigoError,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = "ErrorApi";
  }
}
