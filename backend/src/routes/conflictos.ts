import { Router } from "express";
import type { RegistrarEvento } from "../bitacora.js";
import {
  evaluacionBloqueada,
  normalizarDeclaracion,
  validarDeclaracion,
} from "../domain/conflictos.js";
import { ROL_ADMINISTRADOR } from "../domain/tipos.js";
import { ErrorApi } from "../errores.js";
import { usuarioEnSesion } from "../middleware/autenticar.js";
import { autorizar } from "../middleware/autorizar.js";
import { ErrorDeclaracionDuplicada, type RepositorioConflictos } from "../repos/conflictos.js";

// Declaración de conflictos de interés por plan de auditoría (historia #96, tareas #128-#130; SF-04).
// Roles que reciben el aviso de conflictos y consultan todas las declaraciones (la jefatura).
export const ROLES_JEFATURA = [ROL_ADMINISTRADOR, "Jefe de Auditoría"];

interface Dependencias {
  repo: RepositorioConflictos;
  registrarEvento: RegistrarEvento;
}

function campos(cuerpo: unknown): Record<string, unknown> {
  return typeof cuerpo === "object" && cuerpo !== null ? (cuerpo as Record<string, unknown>) : {};
}

async function planExistente(repo: RepositorioConflictos, valor: unknown) {
  const texto = String(valor);
  const plan = /^[1-9]\d*$/.test(texto) ? await repo.buscarPlan(Number(texto)) : null;
  if (!plan) throw new ErrorApi(404, "NO_ENCONTRADO", "El plan de auditoría no existe.");
  return plan;
}

export function rutasConflictos({ repo, registrarEvento }: Dependencias): Router {
  const rutas = Router();

  // Planes donde el usuario en sesión tiene controles asignados y aún no declara.
  rutas.get("/conflictos/pendientes", async (_req, res) => {
    res.json(await repo.listarPendientes(usuarioEnSesion(res).id));
  });

  // Conflictos declarados en todos los planes: el aviso a la jefatura.
  rutas.get("/conflictos", autorizar(...ROLES_JEFATURA), async (_req, res) => {
    res.json(await repo.listarConConflicto());
  });

  // Estado del usuario en sesión: si está asignado, si ya declaró y si puede evaluar controles.
  rutas.get("/planes/:id/conflictos/mia", async (req, res) => {
    const plan = await planExistente(repo, req.params.id);
    const usuario = usuarioEnSesion(res);
    const asignado = await repo.estaAsignado(plan.id, usuario.id);
    const declaracion = await repo.buscarDeclaracion(plan.id, usuario.id);
    res.json({ plan, asignado, declaracion, puedeEvaluar: !evaluacionBloqueada(asignado, declaracion) });
  });

  // Declaraciones de un plan, para la jefatura (alerta visual en el plan).
  rutas.get("/planes/:id/conflictos", autorizar(...ROLES_JEFATURA), async (req, res) => {
    const plan = await planExistente(repo, req.params.id);
    res.json(await repo.listarPorPlan(plan.id));
  });

  // El auditor asignado presenta su declaración. Solo una por plan; no se edita.
  rutas.post("/planes/:id/conflictos", async (req, res) => {
    const plan = await planExistente(repo, req.params.id);
    const usuario = usuarioEnSesion(res);
    if (!(await repo.estaAsignado(plan.id, usuario.id))) {
      throw new ErrorApi(403, "NO_ASIGNADO", "Solo los auditores con controles asignados en este plan pueden declarar conflictos.");
    }

    const cuerpo = campos(req.body);
    const error = validarDeclaracion(cuerpo);
    if (error) throw new ErrorApi(400, "DATOS_INVALIDOS", error);
    const datos = normalizarDeclaracion(cuerpo);

    let declaracion;
    try {
      declaracion = await repo.crear(plan.id, usuario.id, datos);
    } catch (e) {
      if (e instanceof ErrorDeclaracionDuplicada) {
        throw new ErrorApi(409, "DECLARACION_DUPLICADA", "Ya presentaste tu declaración de conflictos en este plan.");
      }
      throw e;
    }

    registrarEvento({
      accion: "conflicto.declaracion",
      actor: usuario.correo,
      detalle: { planId: plan.id, plan: plan.codigo, declaracionId: declaracion.id, tieneConflicto: declaracion.tieneConflicto },
    });
    if (declaracion.tieneConflicto) {
      // Aviso a la jefatura. Hoy queda en la bitácora y en GET /conflictos; el envío por correo está pendiente (TBD).
      registrarEvento({
        accion: "conflicto.aviso_jefatura",
        actor: usuario.correo,
        detalle: {
          planId: plan.id,
          plan: plan.codigo,
          declaracionId: declaracion.id,
          auditor: declaracion.auditor.nombre,
          justificacion: declaracion.justificacion,
        },
      });
    }
    res.status(201).json(declaracion);
  });

  return rutas;
}
