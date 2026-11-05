import { Router } from "express";
import type { RegistrarEvento } from "../bitacora.js";
import {
  destinatariosCambio,
  ESTADOS_BLOQUEADOS,
  ESTADOS_EDICION_MANUAL,
  ESTADOS_ENVIABLES,
  huellaContenidoPlan,
  impedimentoRevision,
  ROLES_REVISION,
  validarMotivoRechazo,
} from "../domain/flujoPlanAccion.js";
import {
  CAMPOS_EDITABLES_PLAN_ACCION,
  normalizarEdicionPlanAccion,
  normalizarPlanAccion,
  validarEdicionPlanAccion,
  validarFechaCompromiso,
  validarPlanAccion,
  type EstadoPlanAccion,
  type PlanAccion,
} from "../domain/planesAccion.js";
import { ROL_ADMINISTRADOR } from "../domain/tipos.js";
import { ErrorApi } from "../errores.js";
import { usuarioEnSesion } from "../middleware/autenticar.js";
import { autorizar } from "../middleware/autorizar.js";
import type { RepositorioPlanesAccion } from "../repos/planesAccion.js";
import type { RepositorioUsuarios } from "../repos/repositorio.js";

// Roles que crean planes de acción (el equipo de auditoría). Todos los usuarios con sesión los consultan.
export const ROLES_EDICION = [ROL_ADMINISTRADOR, "Jefe de Auditoría", "Auditor Senior", "Auditor"];

interface Dependencias {
  repo: RepositorioPlanesAccion;
  usuarios: RepositorioUsuarios;
  registrarEvento: RegistrarEvento;
}

const MENSAJE_BLOQUEADO = "El plan de acción está en revisión o aprobado y no puede modificarse.";

function actorDe(usuario: { id: number; nombre: string; rol: string }) {
  return { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol };
}

function campos(cuerpo: unknown): Record<string, unknown> {
  return typeof cuerpo === "object" && cuerpo !== null ? (cuerpo as Record<string, unknown>) : {};
}

export function rutasPlanesAccion({ repo, usuarios, registrarEvento }: Dependencias): Router {
  const rutas = Router();

  async function planDeRuta(valor: unknown): Promise<PlanAccion> {
    const id = Number(valor);
    const plan = Number.isInteger(id) && id > 0 ? await repo.buscarPorId(id) : null;
    if (!plan) throw new ErrorApi(404, "NO_ENCONTRADO", "El plan de acción no existe.");
    return plan;
  }

  /** Plan que el usuario en sesión puede revisar y que está en el estado esperado para esta acción. */
  function exigirRevisor(plan: PlanAccion, usuario: { id: number; rol: string }) {
    const impedimento = impedimentoRevision(plan, usuario);
    if (impedimento) throw new ErrorApi(403, "REVISOR_IMPEDIDO", impedimento);
  }

  function exigirEstado(plan: PlanAccion, estado: EstadoPlanAccion, accion: string) {
    if (plan.estado !== estado) {
      throw new ErrorApi(409, "ESTADO_INVALIDO", `El plan de acción está en estado "${plan.estado}" y no se puede ${accion}.`);
    }
  }

  const conflictoConcurrente = () =>
    new ErrorApi(409, "ESTADO_INVALIDO", "Otro usuario ya actuó sobre este plan. Actualiza la lista.");

  rutas.get("/planes-accion", async (_req, res) => {
    res.json(await repo.listar());
  });

  // Planes asignados al usuario en sesión (portal del auditado).
  rutas.get("/planes-accion/mios", async (_req, res) => {
    res.json(await repo.listarPorResponsable(usuarioEnSesion(res).id));
  });

  // Bandeja de revisión (SF-12): planes enviados, en revisión, aprobados o rechazados.
  rutas.get("/planes-accion/revision", autorizar(...ROLES_REVISION), async (_req, res) => {
    res.json(await repo.listarRevision());
  });

  // Historial del flujo. Lo consultan el equipo de auditoría y quienes participan en el plan.
  rutas.get("/planes-accion/:id/flujo", async (req, res) => {
    const plan = await planDeRuta(req.params.id);
    const usuario = usuarioEnSesion(res);
    const participa =
      plan.responsable.id === usuario.id || plan.pasos.some((paso) => paso.usuarioAsignado?.id === usuario.id);
    if (!participa && !ROLES_EDICION.includes(usuario.rol)) {
      throw new ErrorApi(403, "ROL_NO_AUTORIZADO", "No tienes acceso al historial de este plan de acción.");
    }
    const eventos = await repo.listarFlujo(plan.id);
    // Se compara la firma contra el contenido actual para detectar cambios posteriores a la aprobación.
    const firma = plan.estado === "Aprobado" ? [...eventos].reverse().find((evento) => evento.accion === "aprobacion") : undefined;
    const firmaIntegra = firma
      ? firma.firmaHash === huellaContenidoPlan(plan, await repo.hashesEvidenciaPlan(plan.id))
      : null;
    res.json({ eventos, firmaIntegra });
  });

  // Usuarios activos que pueden ser responsables de un plan. Solo los datos necesarios para elegirlos.
  rutas.get("/planes-accion/responsables", async (_req, res) => {
    const activos = (await usuarios.listarUsuarios()).filter((u) => u.estado === "active");
    res.json(activos.map(({ id, nombre, correo }) => ({ id, nombre, correo })));
  });

  // Datos del hallazgo que el formulario necesita (fecha de cierre de la auditoría).
  rutas.get("/planes-accion/hallazgos/:id", async (req, res) => {
    const hallazgo = await repo.buscarHallazgo(String(req.params.id));
    if (!hallazgo) throw new ErrorApi(404, "NO_ENCONTRADO", "El hallazgo no existe.");
    res.json(hallazgo);
  });

  // Temporalmente cualquier usuario autenticado puede crear un plan de acción.
  rutas.post("/planes-accion", async (req, res) => {
    const datos = campos(req.body);
    const error = validarPlanAccion(datos);
    if (error) throw new ErrorApi(400, "DATOS_INVALIDOS", error);
    const plan = normalizarPlanAccion(datos);

    const hallazgoIds = plan.hallazgoIds?.length ? plan.hallazgoIds : [plan.hallazgoId];
    const hallazgos = await Promise.all(hallazgoIds.map((id) => repo.buscarHallazgo(id)));
    if (hallazgos.some((item) => !item)) throw new ErrorApi(404, "NO_ENCONTRADO", "Uno de los hallazgos no existe.");
    const hallazgo = hallazgos[0]!;

    const errorFecha = validarFechaCompromiso(plan.fechaCompromiso, hallazgo.fechaCierreAuditoria);
    if (errorFecha) throw new ErrorApi(400, "DATOS_INVALIDOS", errorFecha);

    const responsable = await usuarios.buscarPorId(plan.responsableId);
    if (!responsable || responsable.estado !== "active") {
      throw new ErrorApi(400, "DATOS_INVALIDOS", "El responsable auditado no existe o está inactivo.");
    }
    for (const paso of plan.pasos ?? []) {
      const usuarioPaso = await usuarios.buscarPorId(paso.usuarioAsignadoId);
      if (!usuarioPaso || usuarioPaso.estado !== "active") {
        throw new ErrorApi(400, "DATOS_INVALIDOS", "Uno de los responsables de los pasos no existe o está inactivo.");
      }
    }

    const creado = await repo.crear(plan, usuarioEnSesion(res).id);

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

  // Edición por el equipo de auditoría. Solo se toman los campos editables; el hallazgo del plan no cambia.
  rutas.patch("/planes-accion/:id", autorizar(...ROLES_EDICION), async (req, res) => {
    const id = Number(req.params.id);
    const actual = Number.isInteger(id) && id > 0 ? await repo.buscarPorId(id) : null;
    if (!actual) throw new ErrorApi(404, "NO_ENCONTRADO", "El plan de acción no existe.");
    if (ESTADOS_BLOQUEADOS.includes(actual.estado)) {
      throw new ErrorApi(409, "PLAN_BLOQUEADO", MENSAJE_BLOQUEADO);
    }
    // El auditado no modifica su plan, aunque su rol pertenezca al equipo de auditoría.
    if (actual.responsable.id === usuarioEnSesion(res).id) {
      throw new ErrorApi(403, "RESPONSABLE_NO_EDITA", "El responsable auditado no puede modificar su propio plan de acción.");
    }

    const cuerpo = campos(req.body);
    const recibidos = CAMPOS_EDITABLES_PLAN_ACCION.filter((c) => c in cuerpo);
    if (recibidos.length === 0) throw new ErrorApi(400, "DATOS_INVALIDOS", "No se indicó ningún campo a modificar.");

    const anterior = {
      titulo: actual.titulo,
      descripcion: actual.descripcion,
      responsableId: actual.responsable.id,
      fechaCompromiso: actual.fechaCompromiso,
      estado: actual.estado,
    };
    const combinado: Record<string, unknown> = { hallazgoId: actual.hallazgo.id, pasos: [], ...anterior };
    for (const c of recibidos) combinado[c] = cuerpo[c];

    const error = validarEdicionPlanAccion(combinado);
    if (error) throw new ErrorApi(400, "DATOS_INVALIDOS", error);
    const datos = normalizarEdicionPlanAccion(combinado);

    const cambios = CAMPOS_EDITABLES_PLAN_ACCION.filter((c) => datos[c] !== anterior[c]);
    if (cambios.length === 0) {
      res.json(actual);
      return;
    }

    if (
      cambios.includes("estado") &&
      !(ESTADOS_EDICION_MANUAL.includes(actual.estado) && ESTADOS_EDICION_MANUAL.includes(datos.estado))
    ) {
      throw new ErrorApi(409, "ESTADO_CONTROLADO_POR_FLUJO", "Este estado solo cambia con el flujo de aprobación.");
    }

    if (cambios.includes("fechaCompromiso")) {
      const errorFecha = validarFechaCompromiso(datos.fechaCompromiso, actual.hallazgo.fechaCierreAuditoria);
      if (errorFecha) throw new ErrorApi(400, "DATOS_INVALIDOS", errorFecha);
    }
    if (cambios.includes("responsableId")) {
      const responsable = await usuarios.buscarPorId(datos.responsableId);
      if (!responsable || responsable.estado !== "active") {
        throw new ErrorApi(400, "DATOS_INVALIDOS", "El responsable auditado no existe o está inactivo.");
      }
    }

    const plan = await repo.actualizar(id, datos);
    if (!plan) throw new ErrorApi(404, "NO_ENCONTRADO", "El plan de acción no existe.");

    registrarEvento({
      accion: "plan_accion.edicion",
      actor: usuarioEnSesion(res).correo,
      detalle: {
        planAccionId: plan.id,
        hallazgoId: plan.hallazgo.id,
        folio: plan.hallazgo.folio,
        cambios: Object.fromEntries(cambios.map((c) => [c, { anterior: anterior[c], nuevo: datos[c] }])),
      },
    });
    res.json(plan);
  });

  // El responsable envía el plan completo a revisión; también lo reenvía después de un rechazo.
  rutas.post("/planes-accion/:id/enviar-revision", async (req, res) => {
    const actual = await planDeRuta(req.params.id);
    const usuario = usuarioEnSesion(res);
    if (actual.responsable.id !== usuario.id) {
      throw new ErrorApi(403, "NO_RESPONSABLE", "Solo el responsable puede enviar el plan de acción a revisión.");
    }
    if (!ESTADOS_ENVIABLES.includes(actual.estado)) {
      throw new ErrorApi(409, "ESTADO_INVALIDO", `El plan de acción está en estado "${actual.estado}" y no se puede enviar a revisión.`);
    }
    if (actual.pasos.length === 0 || !actual.pasos.every((paso) => paso.completado)) {
      throw new ErrorApi(400, "PASOS_PENDIENTES", "Todos los pasos deben estar completados antes de enviar el plan a revisión.");
    }

    const revisores = (await usuarios.listarUsuarios()).filter(
      (candidato) => candidato.estado === "active" && impedimentoRevision(actual, candidato) === null,
    );
    const plan = await repo.transicionar(actual.id, {
      desde: ESTADOS_ENVIABLES,
      hacia: "Pendiente",
      accion: "envio",
      actor: actorDe(usuario),
      notificar: {
        usuarioIds: revisores.map((revisor) => revisor.id),
        mensaje: `El plan de acción ${actual.publicId} está pendiente de revisión.`,
      },
    });
    if (!plan) throw conflictoConcurrente();
    registrarEvento({
      accion: "plan_accion.envio_revision",
      actor: usuario.correo,
      detalle: { planAccionId: plan.id, hallazgoId: plan.hallazgo.id, folio: plan.hallazgo.folio },
    });
    res.json(plan);
  });

  // Al abrir un plan pendiente pasa a En Revisión. Si ya está en revisión no cambia nada.
  rutas.post("/planes-accion/:id/abrir-revision", autorizar(...ROLES_REVISION), async (req, res) => {
    const actual = await planDeRuta(req.params.id);
    const usuario = usuarioEnSesion(res);
    exigirRevisor(actual, usuario);
    if (actual.estado === "En Revisión") {
      res.json(actual);
      return;
    }
    exigirEstado(actual, "Pendiente", "abrir para revisión");

    const plan = await repo.transicionar(actual.id, {
      desde: ["Pendiente"],
      hacia: "En Revisión",
      accion: "apertura",
      actor: actorDe(usuario),
    });
    if (!plan) {
      // Otro revisor lo abrió al mismo tiempo: el resultado es el que se pidió.
      const reciente = await planDeRuta(actual.id);
      if (reciente.estado !== "En Revisión") throw conflictoConcurrente();
      res.json(reciente);
      return;
    }
    registrarEvento({
      accion: "plan_accion.apertura_revision",
      actor: usuario.correo,
      detalle: { planAccionId: plan.id, hallazgoId: plan.hallazgo.id, folio: plan.hallazgo.folio },
    });
    res.json(plan);
  });

  // Aprobar registra la firma: firmante, rol y fecha en el evento, y la huella del contenido aprobado.
  rutas.post("/planes-accion/:id/aprobar", autorizar(...ROLES_REVISION), async (req, res) => {
    const actual = await planDeRuta(req.params.id);
    const usuario = usuarioEnSesion(res);
    exigirRevisor(actual, usuario);
    exigirEstado(actual, "En Revisión", "aprobar");

    const firmaHash = huellaContenidoPlan(actual, await repo.hashesEvidenciaPlan(actual.id));
    const plan = await repo.transicionar(actual.id, {
      desde: ["En Revisión"],
      hacia: "Aprobado",
      accion: "aprobacion",
      actor: actorDe(usuario),
      firmaHash,
      notificar: {
        usuarioIds: destinatariosCambio(actual, usuario.id),
        mensaje: `El plan de acción ${actual.publicId} fue aprobado por ${usuario.nombre}.`,
      },
    });
    if (!plan) throw conflictoConcurrente();
    registrarEvento({
      accion: "plan_accion.aprobacion",
      actor: usuario.correo,
      detalle: { planAccionId: plan.id, hallazgoId: plan.hallazgo.id, folio: plan.hallazgo.folio, firmaHash },
    });
    res.json(plan);
  });

  rutas.post("/planes-accion/:id/rechazar", autorizar(...ROLES_REVISION), async (req, res) => {
    const actual = await planDeRuta(req.params.id);
    const usuario = usuarioEnSesion(res);
    exigirRevisor(actual, usuario);
    exigirEstado(actual, "En Revisión", "rechazar");

    const { motivo: valor } = campos(req.body);
    const error = validarMotivoRechazo(valor);
    if (error) throw new ErrorApi(400, "MOTIVO_OBLIGATORIO", error);
    const motivo = (valor as string).trim();

    const plan = await repo.transicionar(actual.id, {
      desde: ["En Revisión"],
      hacia: "Rechazado",
      accion: "rechazo",
      actor: actorDe(usuario),
      motivo,
      notificar: {
        usuarioIds: destinatariosCambio(actual, usuario.id),
        mensaje: `El plan de acción ${actual.publicId} fue rechazado por ${usuario.nombre}. Motivo: ${motivo}`,
      },
    });
    if (!plan) throw conflictoConcurrente();
    registrarEvento({
      accion: "plan_accion.rechazo",
      actor: usuario.correo,
      detalle: { planAccionId: plan.id, hallazgoId: plan.hallazgo.id, folio: plan.hallazgo.folio },
    });
    res.json(plan);
  });

  rutas.patch("/planes-accion/:planId/pasos/:pasoId", async (req, res) => {
    const planId = Number(req.params.planId);
    const pasoId = Number(req.params.pasoId);
    const completado = campos(req.body).completado;
    if (!Number.isInteger(planId) || !Number.isInteger(pasoId) || typeof completado !== "boolean") {
      throw new ErrorApi(400, "DATOS_INVALIDOS", "El paso y su estado de completado son obligatorios.");
    }

    const plan = await repo.buscarPorId(planId);
    if (!plan) throw new ErrorApi(404, "NO_ENCONTRADO", "El plan de acción no existe.");
    if (ESTADOS_BLOQUEADOS.includes(plan.estado)) {
      throw new ErrorApi(409, "PLAN_BLOQUEADO", MENSAJE_BLOQUEADO);
    }
    const paso = plan.pasos.find((item) => item.id === pasoId);
    if (!paso || paso.usuarioAsignado?.id !== usuarioEnSesion(res).id) {
      throw new ErrorApi(403, "NO_ASIGNADO", "Solo el responsable asignado puede actualizar este paso.");
    }

    const actualizado = await repo.actualizarPaso(planId, pasoId, completado);
    if (!actualizado) throw new ErrorApi(404, "NO_ENCONTRADO", "El paso de acción no existe.");
    res.json(actualizado);
  });

  return rutas;
}
