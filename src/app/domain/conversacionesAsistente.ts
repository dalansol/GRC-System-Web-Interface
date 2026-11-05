import {
  borrarConversacionControl,
  borrarConversacionHallazgo,
  consultarControl,
  consultarHallazgo,
  obtenerConversacionControl,
  obtenerConversacionHallazgo,
  type EstadoRespuesta,
  type MensajeConversacion,
} from "../api/asistente";

// Conversaciones con memoria del asistente Copilot (UF-16, SF-19). El backend arma el
// expediente de la entidad y guarda la conversación, privada de cada usuario; aquí solo se
// adapta cada entidad a lo que necesita el panel.

export interface ConversacionAsistente {
  /** Cambia al cambiar de entidad: el panel empieza otra conversación. */
  clave: string;
  etiqueta: string;
  sugerencias: string[];
  /** Texto del panel vacío. */
  mensajeVacio: string;
  placeholder: string;
  pie: string;
  obtener(): Promise<MensajeConversacion[]>;
  consultar(pregunta: string): Promise<{ estado: EstadoRespuesta; texto: string; evidenciasRecortadas: string[] }>;
  borrar(): Promise<void>;
}

export function conversacionHallazgo(hallazgo: { id: string; folio: string | null }): ConversacionAsistente {
  return {
    clave: `hallazgo:${hallazgo.id}`,
    etiqueta: `Hallazgo ${hallazgo.folio ?? hallazgo.id}`,
    sugerencias: ["¿A quién le corresponde y cómo va su plan de acción?", "Resume las evidencias del hallazgo", "¿Qué falta para poder cerrarlo?"],
    mensajeVacio:
      "Conozco este hallazgo: a quién le corresponde, su plan de acción y el contenido de tus evidencias. Recuerdo lo que hablemos aquí.",
    placeholder: "Pregunta sobre este hallazgo…",
    pie: "Respuestas generadas por IA con el expediente del hallazgo; verifícalas antes de usarlas.",
    obtener: async () => (await obtenerConversacionHallazgo(hallazgo.id)).mensajes,
    consultar: (pregunta) => consultarHallazgo(hallazgo.id, pregunta),
    borrar: () => borrarConversacionHallazgo(hallazgo.id),
  };
}

/** Control dentro de un plan de auditoría: el mismo control en otro plan es otra conversación. */
export function conversacionControl(planId: string, controlId: string): ConversacionAsistente {
  return {
    clave: `control:${planId}:${controlId}`,
    etiqueta: `Control ${controlId} · plan de auditoría`,
    sugerencias: ["Evalúa si las evidencias cubren el control", "¿Qué falta para enviarlo a revisión?", "Resume la retroalimentación de la revisión"],
    mensajeVacio:
      "Conozco este control en su plan: lo que exige, quién lo trabaja, su avance, la retroalimentación y el contenido de las evidencias que puedes ver. Recuerdo lo que hablemos aquí.",
    placeholder: "Pregunta sobre este control…",
    pie: "Respuestas generadas por IA con el expediente del control; verifícalas antes de usarlas.",
    obtener: async () => (await obtenerConversacionControl(planId, controlId)).mensajes,
    consultar: (pregunta) => consultarControl(planId, controlId, pregunta),
    borrar: () => borrarConversacionControl(planId, controlId),
  };
}
