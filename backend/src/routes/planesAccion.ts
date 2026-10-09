import { Router } from "express";
import type { RegistrarEvento } from "../bitacora.js";
import { normalizarPlanAccion, validarFechaCompromiso, validarPlanAccion } from "../domain/planesAccion.js";
import { ROL_ADMINISTRADOR } from "../domain/tipos.js";
import { ErrorApi } from "../errores.js";
import { usuarioEnSesion } from "../middleware/autenticar.js";
import { autorizar } from "../middleware/autorizar.js";
import { ErrorPlanDuplicado, type RepositorioPlanesAccion } from "../repos/planesAccion.js";
import type { RepositorioUsuarios } from "../repos/repositorio.js";

// Roles que crean planes de acción (el equipo de auditoría). Todos los usuarios con sesión los consultan.
const ROLES_EDICION = [ROL_ADMINISTRADOR, "Jefe de Auditoría", "Auditor Senior", "Auditor"];

interface Dependencias {
  repo: RepositorioPlanesAccion;
  usuarios: RepositorioUsuarios;
  registrarEvento: RegistrarEvento;
}

function campos(cuerpo: unknown): Record<string, unknown> {
  return typeof cuerpo === "object" && cuerpo !== null ? (cuerpo as Record<string, unknown>) : {};
}

export function rutasPlanesAccion({ repo, usuarios, registrarEvento }: Dependencias): Router {
  const rutas = Router();

  rutas.get("/planes-accion", async (_req, res) => {
    res.json(await repo.listar());
  });

  // Planes asignados al usuario en sesión (portal del auditado).
  rutas.get("/planes-accion/mios", async (_req, res) => {
    res.json(await repo.listarPorResponsable(usuarioEnSesion(res).id));
  });

  // Usuarios activos que pueden ser responsables de un plan. Solo los datos necesarios para elegirlos.
  rutas.get("/planes-accion/responsables", autorizar(...ROLES_EDICION), async (_req, res) => {
    const activos = (await usuarios.listarUsuarios()).filter((u) => u.estado === "active");
    res.json(activos.map(({ id, nombre, correo }) => ({ id, nombre, correo })));
  });

  // Datos del hallazgo que el formulario necesita (fecha de cierre de la auditoría).
  rutas.get("/planes-accion/hallazgos/:id", async (req, res) => {
    const hallazgo = await repo.buscarHallazgo(String(req.params.id));
    if (!hallazgo) throw new ErrorApi(404, "NO_ENCONTRADO", "El hallazgo no existe.");
    res.json(hallazgo);
  });

  rutas.post("/planes-accion", autorizar(...ROLES_EDICION), async (req, res) => {
    const datos = campos(req.body);
    const error = validarPlanAccion(datos);
    if (error) throw new ErrorApi(400, "DATOS_INVALIDOS", error);
    const plan = normalizarPlanAccion(datos);

    const hallazgo = await repo.buscarHallazgo(plan.hallazgoId);
    if (!hallazgo) throw new ErrorApi(404, "NO_ENCONTRADO", "El hallazgo no existe.");

    const errorFecha = validarFechaCompromiso(plan.fechaCompromiso, hallazgo.fechaCierreAuditoria);
    if (errorFecha) throw new ErrorApi(400, "DATOS_INVALIDOS", errorFecha);

    const responsable = await usuarios.buscarPorId(plan.responsableId);
    if (!responsable || responsable.estado !== "active") {
      throw new ErrorApi(400, "DATOS_INVALIDOS", "El responsable auditado no existe o está inactivo.");
    }

    let creado;
    try {
      creado = await repo.crear(plan, usuarioEnSesion(res).id);
    } catch (e) {
      if (e instanceof ErrorPlanDuplicado) throw new ErrorApi(409, "PLAN_DUPLICADO", "Este hallazgo ya tiene un plan de acción.");
      throw e;
    }

    registrarEvento({
      accion: "plan_accion.alta",
      actor: usuarioEnSesion(res).correo,
      detalle: {
        planAccionId: creado.id,
        hallazgoId: creado.hallazgo.id,
        folio: creado.hallazgo.folio,
        responsableId: creado.responsable.id,
        fechaCompromiso: creado.fechaCompromiso,
      },
    });
    res.status(201).json(creado);
  });

  return rutas;
}
