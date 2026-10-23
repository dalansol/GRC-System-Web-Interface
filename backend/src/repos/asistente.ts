import type { EstadoRespuesta } from "../asistente/asistente.js";
import type { LectorEvidencia } from "./evidencias.js";

// Datos que el asistente necesita para conversar sobre una entidad (SF-19, UF-16):
// el expediente se arma en el backend desde la base, nunca con datos del navegador.

export interface EvidenciaExpediente {
  id: string;
  nombre: string;
  /** pdf, xlsx, eml, msg, zip o 7z. */
  formato: string;
  subidaPor: string | null;
  fecha: string;
  hash: string | null;
  /** Contenido del archivo (Cloudflare R2 o disco); null si no se pudo leer. */
  leer(): Promise<Buffer | null>;
}

export interface ExpedienteHallazgo {
  hallazgo: {
    id: string;
    folio: string | null;
    titulo: string;
    descripcion: string | null;
    tipo: string | null;
    severidad: string;
    estado: string;
    riesgoResidual: string | null;
    controlFallido: string | null;
    /** Nombre del usuario dueño del hallazgo o, si no es un usuario registrado, el valor guardado. */
    responsable: string | null;
    creadoEn: string;
  };
  auditoria: { id: string; nombre: string; fechaCierre: string | null } | null;
  control: { id: string; codigo: string | null; nombre: string } | null;
  planAccion: { descripcion: string; responsable: string; fechaCompromiso: string; estado: string } | null;
  /** Solo las evidencias que el usuario en sesión puede ver. */
  evidencias: EvidenciaExpediente[];
}

export interface ExpedienteControl {
  control: {
    id: string;
    codigo: string;
    nombre: string;
    actividad: string | null;
    tipo: string | null;
    frecuencia: string | null;
    tamanoMuestra: string | null;
    rotacion: string | null;
  };
  plan: {
    id: number;
    codigo: string;
    nombre: string;
    tipo: string;
    periodo: string | null;
    fechaInicio: string;
    fechaFin: string;
    estado: string;
    alcance: string | null;
    horasEstimadas: number | null;
    responsable: string | null;
  };
  /** Solo las asignaciones que el usuario puede ver (misma regla que GET /planes/:id/controles). */
  asignaciones: {
    auditor: string;
    rol: string;
    lider: boolean;
    asignadoPor: string | null;
    estado: string;
    horas: number;
    retroalimentacion: string | null;
    conflictoDeInteres: "sin_declarar" | "sin_conflicto" | "con_conflicto";
  }[];
  /** Hallazgos cuyo control es este; no se pueden filtrar por plan (findings."auditId" apunta a audits). */
  hallazgos: { folio: string | null; titulo: string; severidad: string; estado: string }[];
  /** Solo las evidencias que el usuario puede ver. */
  evidencias: EvidenciaExpediente[];
}

/** Evidencia que se analiza, con el marco de la entidad a la que pertenece. */
export interface ExpedienteEvidencia {
  evidencia: EvidenciaExpediente;
  contexto:
    | { tipo: "control"; etiqueta: string; datos: Record<string, unknown> }
    | { tipo: "hallazgo"; etiqueta: string; datos: Record<string, unknown> };
}

export type EntidadConversacion = "hallazgo" | "evidencia" | "control";

export interface MensajeConversacion {
  rol: "usuario" | "asistente";
  texto: string;
  /** Solo en mensajes del asistente. */
  estado: EstadoRespuesta | null;
  fecha: string;
}

// Memoria del asistente: cada conversación es privada de su usuario.
export interface RepositorioAsistente {
  expedienteHallazgo(hallazgoId: string, lector: LectorEvidencia): Promise<ExpedienteHallazgo | null>;
  /** null si el control no está en el plan o el usuario no ve ninguna de sus asignaciones. */
  expedienteControl(planId: number, controlId: string, lector: LectorEvidencia): Promise<ExpedienteControl | null>;
  /** null si la evidencia no existe o el usuario no la puede ver. */
  expedienteEvidencia(evidenciaId: string, lector: LectorEvidencia): Promise<ExpedienteEvidencia | null>;
  /** Los últimos `limite` mensajes, del más antiguo al más reciente. */
  historial(usuarioId: number, entidad: EntidadConversacion, entidadId: string, limite: number): Promise<MensajeConversacion[]>;
  /** Guarda la pregunta y la respuesta juntas. */
  guardarTurno(
    usuarioId: number,
    entidad: EntidadConversacion,
    entidadId: string,
    pregunta: string,
    respuesta: { estado: EstadoRespuesta; texto: string },
  ): Promise<void>;
  borrarConversacion(usuarioId: number, entidad: EntidadConversacion, entidadId: string): Promise<void>;
}
