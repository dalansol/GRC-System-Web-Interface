import { Router, type Response } from "express";
import { crearAsistente, type ResultadoAsistente } from "../asistente/asistente.js";
import { extraerTexto } from "../asistente/extraerTexto.js";
import { validarConsultaVista, validarPregunta, type DocumentoParaIA } from "../asistente/instrucciones.js";
import { ErrorIA, type ProveedorIA } from "../asistente/proveedor.js";
import type { RegistrarEvento } from "../bitacora.js";
import { ROL_ADMINISTRADOR } from "../domain/tipos.js";
import { ErrorApi } from "../errores.js";
import { usuarioEnSesion } from "../middleware/autenticar.js";
import { autorizar } from "../middleware/autorizar.js";
import type { RepositorioEvidencias } from "../repos/evidencias.js";

// Roles del equipo de auditoría que usan el asistente (HU #105).
const ROLES_ASISTENTE = [ROL_ADMINISTRADOR, "Jefe de Auditoría", "Auditor Senior", "Auditor"];

interface Dependencias {
  proveedor: ProveedorIA | null;
  evidencias: RepositorioEvidencias;
  registrarEvento: RegistrarEvento;
}

const IA_DESACTIVADA = new ErrorApi(503, "IA_NO_DISPONIBLE", "El asistente de IA no está disponible en este momento.");

function campos(cuerpo: unknown): Record<string, unknown> {
  return typeof cuerpo === "object" && cuerpo !== null ? (cuerpo as Record<string, unknown>) : {};
}

// Asistente de IA sobre evidencias (SF-19). Si la IA falla, solo esta función responde 503.
export function rutasAsistente({ proveedor, evidencias, registrarEvento }: Dependencias): Router {
  const rutas = Router();
  const asistente = proveedor ? crearAsistente(proveedor) : null;

  rutas.get("/asistente/estado", (_req, res) => {
    res.json({ disponible: asistente !== null });
  });

  async function documento(id: string): Promise<DocumentoParaIA> {
    const archivo = await evidencias.leerArchivo(id);
    if (!archivo) throw new ErrorApi(404, "NO_ENCONTRADO", "La evidencia no existe.");
    const { texto, recortado } = await extraerTexto(archivo);
    if (!texto.trim()) {
      throw new ErrorApi(422, "SIN_TEXTO", "No se pudo leer texto de este documento (puede ser un PDF escaneado).");
    }
    return { nombre: archivo.nombre, texto, recortado };
  }

  async function consultar(
    res: Response,
    accion: "asistente.resumen" | "asistente.pregunta" | "asistente.consulta",
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
    const doc = await documento(evidenciaId);
    const resultado = await consultar(res, "asistente.resumen", { evidenciaId }, () => asistente.resumir(doc));
    res.json({ evidenciaId, tipo: "resumen", ...resultado, recortado: doc.recortado });
  });

  rutas.post("/asistente/evidencias/:id/preguntas", autorizar(...ROLES_ASISTENTE), async (req, res) => {
    const validacion = validarPregunta(campos(req.body).pregunta);
    if ("error" in validacion) throw new ErrorApi(400, "DATOS_INVALIDOS", validacion.error);
    if (!asistente) throw IA_DESACTIVADA;
    const evidenciaId = String(req.params.id);
    const doc = await documento(evidenciaId);
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

  return rutas;
}
