import { Router, type Response } from "express";
import { crearAsistente, type ResultadoAsistente } from "../asistente/asistente.js";
import { prepararEvidencias } from "../asistente/expediente.js";
import { extraerTexto } from "../asistente/extraerTexto.js";
import {
  HISTORIAL_MAX,
  PREGUNTA_RESUMEN_CONTROL,
  PREGUNTA_RESUMEN_EVIDENCIA,
  PREGUNTA_RESUMEN_HALLAZGO,
  PREGUNTA_VALIDAR_CONTROL,
  validarConsultaVista,
  validarPregunta,
  type DocumentoParaIA,
} from "../asistente/instrucciones.js";
import { ErrorIA, type ProveedorIA } from "../asistente/proveedor.js";
import type { RegistrarEvento } from "../bitacora.js";
import { ROL_ADMINISTRADOR } from "../domain/tipos.js";
import { ErrorApi } from "../errores.js";
import { usuarioEnSesion } from "../middleware/autenticar.js";
import { autorizar } from "../middleware/autorizar.js";
import type { EvidenciaExpediente, RepositorioAsistente } from "../repos/asistente.js";
import type { LectorEvidencia, RepositorioEvidencias } from "../repos/evidencias.js";

// Roles del equipo de auditoría que usan el asistente (HU #105).
const ROLES_ASISTENTE = [ROL_ADMINISTRADOR, "Jefe de Auditoría", "Auditor Senior", "Auditor"];

interface Dependencias {
  proveedor: ProveedorIA | null;
  evidencias: RepositorioEvidencias;
  /** Expedientes y memoria de las conversaciones. */
  conversaciones: RepositorioAsistente;
  registrarEvento: RegistrarEvento;
}

const IA_DESACTIVADA = new ErrorApi(503, "IA_NO_DISPONIBLE", "El asistente de IA no está disponible en este momento.");

function campos(cuerpo: unknown): Record<string, unknown> {
  return typeof cuerpo === "object" && cuerpo !== null ? (cuerpo as Record<string, unknown>) : {};
}

// Asistente de IA sobre evidencias (SF-19). Si la IA falla, solo esta función responde 503.
export function rutasAsistente({ proveedor, evidencias, conversaciones, registrarEvento }: Dependencias): Router {
  const rutas = Router();
  const asistente = proveedor ? crearAsistente(proveedor) : null;

  rutas.get("/asistente/estado", (_req, res) => {
    res.json({ disponible: asistente !== null });
  });

  // Una evidencia que el usuario no puede ver responde igual que una que no existe.
  async function documento(id: string, lector: LectorEvidencia): Promise<DocumentoParaIA> {
    const archivo = await evidencias.leerArchivo(id, lector);
    if (!archivo) throw new ErrorApi(404, "NO_ENCONTRADO", "La evidencia no existe.");
    const { texto, recortado } = await extraerTexto(archivo);
    if (!texto.trim()) {
      throw new ErrorApi(422, "SIN_TEXTO", "No se pudo leer texto de este documento (puede ser un PDF escaneado).");
    }
    return { nombre: archivo.nombre, texto, recortado };
  }

  async function consultar(
    res: Response,
    accion:
      | "asistente.resumen"
      | "asistente.pregunta"
      | "asistente.consulta"
      | "asistente.hallazgo"
      | "asistente.control"
      | "asistente.evidencia",
    detalle: Record<string, unknown>,
    llamar: () => Promise<ResultadoAsistente>,
  ): Promise<ResultadoAsistente> {
    const registrar = (resultado: string) =>
      registrarEvento({ accion, actor: usuarioEnSesion(res).correo, detalle: { ...detalle, resultado } });
    try {
      const resultado = await llamar();
      registrar(resultado.estado);
      return resultado;
    } catch (error) {
      if (!(error instanceof ErrorIA)) throw error;
      registrar(`error:${error.codigo}`);
      console.error(`[asistente] ${accion} ${JSON.stringify(detalle)}: ${error.codigo} - ${error.detalle}`);
      throw new ErrorApi(503, error.codigo, error.message);
    }
  }

  rutas.post("/asistente/evidencias/:id/resumen", autorizar(...ROLES_ASISTENTE), async (req, res) => {
    if (!asistente) throw IA_DESACTIVADA;
    const evidenciaId = String(req.params.id);
    const doc = await documento(evidenciaId, usuarioEnSesion(res));
    const resultado = await consultar(res, "asistente.resumen", { evidenciaId }, () => asistente.resumir(doc));
    res.json({ evidenciaId, tipo: "resumen", ...resultado, recortado: doc.recortado });
  });

  rutas.post("/asistente/evidencias/:id/preguntas", autorizar(...ROLES_ASISTENTE), async (req, res) => {
    const validacion = validarPregunta(campos(req.body).pregunta);
    if ("error" in validacion) throw new ErrorApi(400, "DATOS_INVALIDOS", validacion.error);
    if (!asistente) throw IA_DESACTIVADA;
    const evidenciaId = String(req.params.id);
    const doc = await documento(evidenciaId, usuarioEnSesion(res));
    const resultado = await consultar(res, "asistente.pregunta", { evidenciaId }, () =>
      asistente.preguntar(doc, validacion.pregunta),
    );
    res.json({ evidenciaId, tipo: "respuesta", ...resultado, recortado: doc.recortado });
  });

  // Asistente Copilot general: responde con los datos de la vista que envía el frontend.
  // Son datos que el usuario ya ve; el cuerpo admite hasta 100 kB (ver app.ts).
  rutas.post("/asistente/consultas", autorizar(...ROLES_ASISTENTE), async (req, res) => {
    const consulta = validarConsultaVista(campos(req.body));
    if ("error" in consulta) throw new ErrorApi(400, "DATOS_INVALIDOS", consulta.error);
    if (!asistente) throw IA_DESACTIVADA;
    const tipo = consulta.pregunta === undefined ? "resumen" : "pregunta";
    const resultado = await consultar(res, "asistente.consulta", { vista: consulta.vista, tipo }, () =>
      asistente.consultarVista(consulta),
    );
    res.json({ vista: consulta.vista, tipo: tipo === "resumen" ? "resumen" : "respuesta", ...resultado });
  });

  /** Pregunta del cuerpo, si la hay; sin pregunta la consulta es un resumen. */
  function preguntaOpcional(cuerpo: unknown): string | undefined {
    const { pregunta } = campos(cuerpo);
    if (pregunta === undefined || pregunta === null) return undefined;
    const validacion = validarPregunta(pregunta);
    if ("error" in validacion) throw new ErrorApi(400, "DATOS_INVALIDOS", validacion.error);
    return validacion.pregunta;
  }

  // ─── Conversación sobre un hallazgo (UF-16) ────────────────────────────────
  // El expediente se arma aquí desde la base y el almacenamiento (R2); el navegador solo
  // indica el hallazgo. La conversación es privada de cada usuario.

  async function expediente(hallazgoId: string, res: Response) {
    const datos = await conversaciones.expedienteHallazgo(hallazgoId, usuarioEnSesion(res));
    if (!datos) throw new ErrorApi(404, "NO_ENCONTRADO", "El hallazgo no existe.");
    return datos;
  }

  rutas.get("/asistente/hallazgos/:id/conversacion", autorizar(...ROLES_ASISTENTE), async (req, res) => {
    const hallazgoId = String(req.params.id);
    const { hallazgo } = await expediente(hallazgoId, res);
    const mensajes = await conversaciones.historial(usuarioEnSesion(res).id, "hallazgo", hallazgoId, HISTORIAL_MAX * 5);
    res.json({ hallazgo: { id: hallazgo.id, folio: hallazgo.folio, titulo: hallazgo.titulo }, mensajes });
  });

  rutas.post("/asistente/hallazgos/:id/consultas", autorizar(...ROLES_ASISTENTE), async (req, res) => {
    const pregunta = preguntaOpcional(req.body);
    if (!asistente) throw IA_DESACTIVADA;

    const hallazgoId = String(req.params.id);
    const usuarioId = usuarioEnSesion(res).id;
    const { evidencias: archivos, ...datos } = await expediente(hallazgoId, res);
    const [evidenciasIA, historial] = await Promise.all([
      prepararEvidencias(archivos),
      conversaciones.historial(usuarioId, "hallazgo", hallazgoId, HISTORIAL_MAX),
    ]);
    const tipo = pregunta === undefined ? "resumen" : "pregunta";
    const resultado = await consultar(
      res,
      "asistente.hallazgo",
      { hallazgoId, tipo, evidencias: evidenciasIA.length },
      () => asistente.consultarHallazgo({ expediente: datos, evidencias: evidenciasIA, historial, pregunta }),
    );
    // Solo se recuerda lo que la IA contestó; si falló, la conversación queda como estaba.
    await conversaciones.guardarTurno(usuarioId, "hallazgo", hallazgoId, pregunta ?? PREGUNTA_RESUMEN_HALLAZGO, resultado);
    res.json({
      hallazgoId,
      tipo: tipo === "resumen" ? "resumen" : "respuesta",
      ...resultado,
      evidenciasRecortadas: evidenciasIA.filter((e) => e.recortado).map((e) => e.nombre),
    });
  });

  rutas.delete("/asistente/hallazgos/:id/conversacion", autorizar(...ROLES_ASISTENTE), async (req, res) => {
    const hallazgoId = String(req.params.id);
    const usuario = usuarioEnSesion(res);
    await conversaciones.borrarConversacion(usuario.id, "hallazgo", hallazgoId);
    registrarEvento({ accion: "asistente.conversacion_borrada", actor: usuario.correo, detalle: { entidad: "hallazgo", hallazgoId } });
    res.status(204).end();
  });

  // ─── Conversación sobre un control dentro de un plan (Planes de Auditoría) ──
  // Mismo esquema que el hallazgo: expediente armado aquí y memoria privada por usuario.
  // La clave de la conversación es "<planId>:<controlId>".

  async function expedienteControl(req: { params: Record<string, unknown> }, res: Response) {
    const planTexto = String(req.params.planId);
    const controlId = String(req.params.controlId);
    const datos = /^\d+$/.test(planTexto)
      ? await conversaciones.expedienteControl(Number(planTexto), controlId, usuarioEnSesion(res))
      : null;
    if (!datos) throw new ErrorApi(404, "NO_ENCONTRADO", "El control no existe en este plan o no tienes acceso.");
    return { datos, clave: `${datos.plan.id}:${datos.control.id}` };
  }

  rutas.get("/asistente/planes/:planId/controles/:controlId/conversacion", autorizar(...ROLES_ASISTENTE), async (req, res) => {
    const { datos, clave } = await expedienteControl(req, res);
    const mensajes = await conversaciones.historial(usuarioEnSesion(res).id, "control", clave, HISTORIAL_MAX * 5);
    res.json({
      control: { id: datos.control.id, codigo: datos.control.codigo, nombre: datos.control.nombre },
      plan: { id: datos.plan.id, codigo: datos.plan.codigo, nombre: datos.plan.nombre },
      mensajes,
    });
  });

  rutas.post("/asistente/planes/:planId/controles/:controlId/consultas", autorizar(...ROLES_ASISTENTE), async (req, res) => {
    const pregunta = preguntaOpcional(req.body);
    if (!asistente) throw IA_DESACTIVADA;

    const { datos, clave } = await expedienteControl(req, res);
    const usuarioId = usuarioEnSesion(res).id;
    const { evidencias: archivos, ...expediente } = datos;
    const [evidenciasIA, historial] = await Promise.all([
      prepararEvidencias(archivos),
      conversaciones.historial(usuarioId, "control", clave, HISTORIAL_MAX),
    ]);
    const tipo = pregunta === undefined ? "resumen" : "pregunta";
    const resultado = await consultar(
      res,
      "asistente.control",
      { planId: datos.plan.id, controlId: datos.control.id, tipo, evidencias: evidenciasIA.length },
      () => asistente.consultarControl({ expediente, evidencias: evidenciasIA, historial, pregunta }),
    );
    await conversaciones.guardarTurno(usuarioId, "control", clave, pregunta ?? PREGUNTA_RESUMEN_CONTROL, resultado);
    res.json({
      planId: datos.plan.id,
      controlId: datos.control.id,
      tipo: tipo === "resumen" ? "resumen" : "respuesta",
      ...resultado,
      evidenciasRecortadas: evidenciasIA.filter((e) => e.recortado).map((e) => e.nombre),
    });
  });

  rutas.delete("/asistente/planes/:planId/controles/:controlId/conversacion", autorizar(...ROLES_ASISTENTE), async (req, res) => {
    const { datos, clave } = await expedienteControl(req, res);
    const usuario = usuarioEnSesion(res);
    await conversaciones.borrarConversacion(usuario.id, "control", clave);
    registrarEvento({
      accion: "asistente.conversacion_borrada",
      actor: usuario.correo,
      detalle: { entidad: "control", planId: datos.plan.id, controlId: datos.control.id },
    });
    res.status(204).end();
  });

  // ─── Conversación sobre una evidencia, con su control y plan (o su hallazgo) ─
  // El archivo es el documento principal; el contexto lo arma el backend. Memoria por
  // usuario y por archivo.

  async function expedienteEvidencia(evidenciaId: string, res: Response) {
    const datos = await conversaciones.expedienteEvidencia(evidenciaId, usuarioEnSesion(res));
    if (!datos) throw new ErrorApi(404, "NO_ENCONTRADO", "La evidencia no existe.");
    return datos;
  }

  async function documentoDe(evidencia: EvidenciaExpediente): Promise<DocumentoParaIA> {
    if (evidencia.formato !== "pdf" && evidencia.formato !== "xlsx") {
      throw new ErrorApi(422, "SIN_TEXTO", "El asistente solo puede leer evidencias PDF o Excel.");
    }
    let contenido: Buffer | null = null;
    try {
      contenido = await evidencia.leer();
    } catch (error) {
      console.error(`[asistente] no se pudo leer la evidencia ${evidencia.id}: ${(error as Error).message}`);
    }
    if (!contenido) throw new ErrorApi(404, "NO_ENCONTRADO", "No se encontró el archivo de la evidencia.");
    const { texto, recortado } = await extraerTexto({ tipo: evidencia.formato, contenido });
    if (!texto.trim()) {
      throw new ErrorApi(422, "SIN_TEXTO", "No se pudo leer texto de este documento (puede ser un PDF escaneado).");
    }
    return { nombre: evidencia.nombre, texto, recortado };
  }

  rutas.get("/asistente/evidencias/:id/conversacion", autorizar(...ROLES_ASISTENTE), async (req, res) => {
    const evidenciaId = String(req.params.id);
    const { evidencia, contexto } = await expedienteEvidencia(evidenciaId, res);
    const mensajes = await conversaciones.historial(usuarioEnSesion(res).id, "evidencia", evidenciaId, HISTORIAL_MAX * 5);
    res.json({
      evidencia: { id: evidencia.id, nombre: evidencia.nombre },
      contexto: { tipo: contexto.tipo, etiqueta: contexto.etiqueta },
      mensajes,
    });
  });

  rutas.post("/asistente/evidencias/:id/consultas", autorizar(...ROLES_ASISTENTE), async (req, res) => {
    const validar = campos(req.body).accion === "validar";
    const pregunta = validar ? undefined : preguntaOpcional(req.body);
    if (!asistente) throw IA_DESACTIVADA;

    const evidenciaId = String(req.params.id);
    const usuarioId = usuarioEnSesion(res).id;
    const { evidencia, contexto } = await expedienteEvidencia(evidenciaId, res);
    if (validar && contexto.tipo !== "control") {
      throw new ErrorApi(400, "DATOS_INVALIDOS", "Solo las evidencias de un control se pueden validar contra él.");
    }
    const [documento, historial] = await Promise.all([
      documentoDe(evidencia),
      conversaciones.historial(usuarioId, "evidencia", evidenciaId, HISTORIAL_MAX),
    ]);
    const tipo = validar ? "validacion" : pregunta === undefined ? "resumen" : "pregunta";
    const resultado = await consultar(res, "asistente.evidencia", { evidenciaId, contexto: contexto.tipo, tipo }, () =>
      asistente.consultarEvidencia({ documento, contexto, historial, pregunta, validar }),
    );
    const guardada = validar ? PREGUNTA_VALIDAR_CONTROL : pregunta ?? PREGUNTA_RESUMEN_EVIDENCIA;
    await conversaciones.guardarTurno(usuarioId, "evidencia", evidenciaId, guardada, resultado);
    res.json({ evidenciaId, tipo, ...resultado, recortado: documento.recortado });
  });

  rutas.delete("/asistente/evidencias/:id/conversacion", autorizar(...ROLES_ASISTENTE), async (req, res) => {
    const evidenciaId = String(req.params.id);
    await expedienteEvidencia(evidenciaId, res);
    const usuario = usuarioEnSesion(res);
    await conversaciones.borrarConversacion(usuario.id, "evidencia", evidenciaId);
    registrarEvento({ accion: "asistente.conversacion_borrada", actor: usuario.correo, detalle: { entidad: "evidencia", evidenciaId } });
    res.status(204).end();
  });

  return rutas;
}
