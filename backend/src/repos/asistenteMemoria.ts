import type { EstadoRespuesta } from "../asistente/asistente.js";
import type {
  EntidadConversacion,
  ExpedienteControl,
  ExpedienteEvidencia,
  ExpedienteHallazgo,
  MensajeConversacion,
  RepositorioAsistente,
} from "./asistente.js";
import { EVIDENCIAS_EJEMPLO } from "./evidenciasEjemplo.js";

/** Expedientes de prueba; las claves de control son "<planId>:<controlId>". */
export interface ExpedientesMemoria {
  hallazgos?: Record<string, ExpedienteHallazgo>;
  controles?: Record<string, ExpedienteControl>;
  evidencias?: Record<string, ExpedienteEvidencia>;
}

// Modo en memoria: sin base no hay hallazgos, controles en planes ni evidencias subidas, así
// que solo existen los expedientes que se le entreguen (pruebas). Las conversaciones se pierden al reiniciar el servidor.
export class RepositorioAsistenteMemoria implements RepositorioAsistente {
  private readonly conversaciones = new Map<string, MensajeConversacion[]>();

  constructor(private readonly expedientes: ExpedientesMemoria = {}) {}

  private clave(usuarioId: number, entidad: EntidadConversacion, entidadId: string) {
    return `${usuarioId}|${entidad}|${entidadId}`;
  }

  async expedienteHallazgo(hallazgoId: string) {
    return this.expedientes.hallazgos?.[hallazgoId] ?? null;
  }

  async expedienteControl(planId: number, controlId: string) {
    return this.expedientes.controles?.[`${planId}:${controlId}`] ?? null;
  }

  async expedienteEvidencia(evidenciaId: string) {
    return this.expedientes.evidencias?.[evidenciaId] ?? null;
  }

  async historial(usuarioId: number, entidad: EntidadConversacion, entidadId: string, limite: number) {
    return (this.conversaciones.get(this.clave(usuarioId, entidad, entidadId)) ?? []).slice(-limite);
  }

  async guardarTurno(
    usuarioId: number,
    entidad: EntidadConversacion,
    entidadId: string,
    pregunta: string,
    respuesta: { estado: EstadoRespuesta; texto: string },
  ) {
    const clave = this.clave(usuarioId, entidad, entidadId);
    const fecha = new Date().toISOString();
    this.conversaciones.set(clave, [
      ...(this.conversaciones.get(clave) ?? []),
      { rol: "usuario", texto: pregunta, estado: null, fecha },
      { rol: "asistente", texto: respuesta.texto, estado: respuesta.estado, fecha },
    ]);
  }

  async borrarConversacion(usuarioId: number, entidad: EntidadConversacion, entidadId: string) {
    this.conversaciones.delete(this.clave(usuarioId, entidad, entidadId));
  }
}

/** Documentos de ejemplo (EV-001…EV-004) del modo en memoria, sin control ni plan reales. */
export function expedientesDeEjemplo(): ExpedientesMemoria {
  return {
    evidencias: Object.fromEntries(
      EVIDENCIAS_EJEMPLO.map((ejemplo) => [
        ejemplo.id,
        {
          evidencia: {
            id: ejemplo.id,
            nombre: ejemplo.nombre,
            formato: ejemplo.tipo,
            subidaPor: null,
            fecha: new Date(0).toISOString(),
            hash: null,
            leer: () => ejemplo.crearContenido(),
          },
          contexto: {
            tipo: "hallazgo" as const,
            etiqueta: "Documento de ejemplo",
            datos: { nota: "Documento de ejemplo del modo en memoria; no pertenece a un control ni a un hallazgo." },
          },
        },
      ]),
    ),
  };
}
