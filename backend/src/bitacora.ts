// Punto único de registro de eventos (SF-15 / SF-18).
// La bitácora inmutable aún no existe; por ahora los eventos salen como logs estructurados.

export interface EventoBitacora {
  accion:
    | "usuario.alta"
    | "usuario.cambio_rol"
    | "plan.alta"
    | "plan.edicion"
    | "plan_accion.alta"
    | "plan_accion.edicion"
    | "plan_accion.envio_revision"
    | "plan_accion.apertura_revision"
    | "plan_accion.aprobacion"
    | "plan_accion.rechazo"
    | "plan_accion.solicitud_prorroga"
    | "plan_accion.decision_prorroga"
    | "conflicto.declaracion"
    | "conflicto.aviso_jefatura"
    | "asistente.resumen"
    | "asistente.pregunta"
    | "asistente.consulta"
    | "estructura.alta"
    | "estructura.edicion"
    | "estructura.baja"
    | "periodo.alta"
    | "periodo.edicion"
    | "catalogo.alta"
    | "catalogo.edicion"
    | "catalogo.baja";
  actor: string;
  detalle: Record<string, unknown>;
}

export type RegistrarEvento = (evento: EventoBitacora) => void;

export const registrarEnConsola: RegistrarEvento = (evento) => {
  console.log(JSON.stringify({ fecha: new Date().toISOString(), ...evento }));
};
