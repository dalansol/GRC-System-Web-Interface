import { Router } from "express";
import type { RegistrarEvento } from "../bitacora.js";
import { normalizarPlan, validarPlan, type PlanAuditoria } from "../domain/planes.js";
import { ROL_ADMINISTRADOR } from "../domain/tipos.js";
import { ErrorApi } from "../errores.js";
import { usuarioEnSesion } from "../middleware/autenticar.js";
import { autorizar } from "../middleware/autorizar.js";
import { ErrorCodigoDuplicado, type RepositorioPlanes } from "../repos/planes.js";
import type { RepositorioUsuarios } from "../repos/repositorio.js";

// Roles que crean y editan planes. Todos los usuarios con sesión los consultan.
const ROLES_EDICION = [ROL_ADMINISTRADOR, "Jefe de Auditoría"];

interface Dependencias {
  repo: RepositorioPlanes;
  usuarios: RepositorioUsuarios;
  registrarEvento: RegistrarEvento;
}

function campos(cuerpo: unknown): Record<string, unknown> {
  return typeof cuerpo === "object" && cuerpo !== null ? (cuerpo as Record<string, unknown>) : {};
}

function idDePlan(valor: unknown): number {
  const texto = String(valor);
  if (!/^[1-9]\d{0,8}$/.test(texto)) throw new ErrorApi(400, "DATOS_INVALIDOS", "El identificador del plan no es válido.");
  return Number(texto);
}

export function rutasPlanes({ repo, usuarios, registrarEvento }: Dependencias): Router {
  const rutas = Router();

  async function validar(datos: Record<string, unknown>) {
    const error = validarPlan(datos);
    if (error) throw new ErrorApi(400, "DATOS_INVALIDOS", error);
    const responsable = await usuarios.buscarPorId(datos.responsableId as number);
    if (!responsable || responsable.estado !== "active") {
      throw new ErrorApi(400, "DATOS_INVALIDOS", "El responsable no existe o está inactivo.");
    }
    return normalizarPlan(datos);
  }

  async function guardar(operacion: () => Promise<PlanAuditoria | null>) {
    try {
      return await operacion();
    } catch (error) {
      if (error instanceof ErrorCodigoDuplicado) {
        throw new ErrorApi(409, "CODIGO_DUPLICADO", "Ya existe un plan con ese código.");
      }
      throw error;
    }
  }

  rutas.get("/planes", async (_req, res) => {
    res.json(await repo.listar());
  });

  rutas.get("/planes/:id", async (req, res) => {
    const plan = await repo.buscarPorId(idDePlan(req.params.id));
    if (!plan) throw new ErrorApi(404, "NO_ENCONTRADO", "El plan de auditoría no existe.");
    res.json(plan);
  });

  rutas.post("/planes", autorizar(...ROLES_EDICION), async (req, res) => {
    const datos = await validar({ estado: "Borrador", ...campos(req.body) });
    const plan = (await guardar(() => repo.crear(datos, usuarioEnSesion(res).id)))!;
    registrarEvento({
      accion: "plan.alta",
      actor: usuarioEnSesion(res).correo,
      detalle: { planId: plan.id, codigo: plan.codigo },
    });
    res.status(201).json(plan);
  });

  // Edición parcial: solo se envían los campos que cambian.
  rutas.patch("/planes/:id", autorizar(...ROLES_EDICION), async (req, res) => {
    const id = idDePlan(req.params.id);
    const actual = await repo.buscarPorId(id);
    if (!actual) throw new ErrorApi(404, "NO_ENCONTRADO", "El plan de auditoría no existe.");

    const { responsable, ...resto } = actual;
    const datos = await validar({ ...resto, responsableId: responsable.id, ...campos(req.body) });
    const plan = await guardar(() => repo.actualizar(id, datos));
    if (!plan) throw new ErrorApi(404, "NO_ENCONTRADO", "El plan de auditoría no existe.");

    registrarEvento({
      accion: "plan.edicion",
      actor: usuarioEnSesion(res).correo,
      detalle: { planId: id, codigo: plan.codigo, campos: Object.keys(campos(req.body)) },
    });
    res.json(plan);
  });

  return rutas;
}
