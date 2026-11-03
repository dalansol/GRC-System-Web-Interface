import { Router } from "express";
import type { RegistrarEvento } from "../bitacora.js";
import { MENSAJE_DECLARACION_PENDIENTE } from "../domain/conflictos.js";
import {
  calcularEvaluacion,
  criteriosFaltantes,
  type RespuestaCriterio,
  validarRespuestas,
} from "../domain/evaluaciones.js";
import { ErrorApi } from "../errores.js";
import { usuarioEnSesion } from "../middleware/autenticar.js";
import type { RepositorioConflictos } from "../repos/conflictos.js";
import type { AsignacionEvaluable, RepositorioEvaluaciones } from "../repos/evaluaciones.js";

// Evaluación de diseño y efectividad de controles (historia #98, SF-07).
// Evalúa el auditor asignado; la jefatura la consulta y sigue aprobando o rechazando el control.
const ROLES_CONSULTA = ["Jefe de Auditoría", "Supervisor", "Administrador"];
const MENSAJE_CERRADA = "La evaluación solo se puede editar con el control En Progreso.";

interface Dependencias {
  repo: RepositorioEvaluaciones;
  conflictos: RepositorioConflictos;
  registrarEvento: RegistrarEvento;
}

export function rutasEvaluaciones({ repo, conflictos, registrarEvento }: Dependencias): Router {
  const rutas = Router();

  async function asignacionesDe(plan: string | undefined, control: string | undefined) {
    if (!plan || !/^[1-9]\d*$/.test(plan)) {
      throw new ErrorApi(400, "DATOS_INVALIDOS", "El plan no es válido.");
    }
    const asignaciones = await repo.listarAsignaciones(Number(plan), control ?? "");
    if (asignaciones.length === 0) {
      throw new ErrorApi(404, "NO_ENCONTRADO", "El control no está asignado en este plan.");
    }
    return asignaciones;
  }

  /** Por qué el auditor asignado no puede evaluar ahora; null si puede. */
  async function bloqueo(asignacion: AsignacionEvaluable) {
    if (asignacion.status !== "En Progreso") return { codigo: "cerrada", mensaje: MENSAJE_CERRADA };
    const declaracion = await conflictos.buscarDeclaracion(asignacion.planId, asignacion.auditorId);
    return declaracion ? null : { codigo: "conflictos", mensaje: MENSAJE_DECLARACION_PENDIENTE };
  }

  rutas.get("/planes/:planId/controles/:controlId/evaluacion", async (req, res) => {
    const asignaciones = await asignacionesDe(req.params.planId, req.params.controlId);
    const usuario = usuarioEnSesion(res);
    const mia = asignaciones.find((a) => a.auditorId === usuario.id);
    const puedeConsultar =
      mia || ROLES_CONSULTA.includes(usuario.rol) || asignaciones.some((a) => a.asignadoPor === usuario.id);
    if (!puedeConsultar) throw new ErrorApi(403, "ROL_NO_AUTORIZADO", "No puedes consultar esta evaluación.");

    const { planId, controlId } = asignaciones[0]!;
    const motivo = mia ? await bloqueo(mia) : null;
    res.json({
      criterios: await repo.listarCriterios(),
      evaluacion: await repo.buscar(planId, controlId),
      puedeEvaluar: Boolean(mia) && !motivo,
      motivoBloqueo: motivo?.mensaje ?? null,
    });
  });

  rutas.put("/planes/:planId/controles/:controlId/evaluacion", async (req, res) => {
    const asignaciones = await asignacionesDe(req.params.planId, req.params.controlId);
    const usuario = usuarioEnSesion(res);
    const mia = asignaciones.find((a) => a.auditorId === usuario.id);
    if (!mia) throw new ErrorApi(403, "ROL_NO_AUTORIZADO", "Solo el auditor asignado puede evaluar este control.");
    const motivo = await bloqueo(mia);
    if (motivo?.codigo === "cerrada") throw new ErrorApi(409, "EVALUACION_CERRADA", motivo.mensaje);
    if (motivo) throw new ErrorApi(403, "DECLARACION_PENDIENTE", motivo.mensaje);

    const criterios = await repo.listarCriterios();
    const { respuestas: enviadas } = (req.body ?? {}) as { respuestas?: unknown };
    const error = validarRespuestas(criterios, enviadas);
    if (error) throw new ErrorApi(400, "DATOS_INVALIDOS", error);
    const respuestas = (enviadas as RespuestaCriterio[]).map(({ criterioId, valor }) => ({ criterioId, valor }));

    const faltantes = criteriosFaltantes(criterios, respuestas);
    if (faltantes.length > 0) {
      const nombres = faltantes.map((c) => c.nombre).join(", ");
      throw new ErrorApi(400, "CRITERIOS_FALTANTES", `Falta responder: ${nombres}.`);
    }

    const calculo = calcularEvaluacion(criterios, respuestas);
    const evaluacion = await repo.guardar({
      ...calculo,
      planId: mia.planId,
      controlId: mia.controlId,
      respuestas,
      evaluadorId: usuario.id,
    });
    registrarEvento({
      accion: "control.evaluacion",
      actor: usuario.correo,
      detalle: {
        planId: mia.planId,
        controlId: mia.controlId,
        calificacion: calculo.calificacion,
        resultado: calculo.resultado,
        deficiencia: calculo.deficiencia,
      },
    });
    res.json(evaluacion);
  });

  return rutas;
}
