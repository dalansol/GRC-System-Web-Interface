import { Router, type RequestHandler } from "express";
import type { RegistrarEvento } from "../bitacora.js";
import {
  abiertoParaAuditado,
  destinatariosCambio,
  esAuditado,
  ESTADOS_BLOQUEADOS,
  ESTADOS_EDICION_MANUAL,
  estadosEnviables,
  huellaContenidoPlan,
  impedimentoEnvio,
  impedimentoRevision,
  ROLES_GESTION_PLAN,
  ROLES_REVISION,
  validarMotivoRechazo,
  validarSolicitudProrroga,
  vistaAuditadoPlan,
  type EvidenciaPlan,
} from "../domain/flujoPlanAccion.js";
import {
  CAMPOS_EDITABLES_PLAN_ACCION,
  normalizarEdicionPlanAccion,
  normalizarPlanAccion,
  validarEdicionPlanAccion,
  validarFechaCompromiso,
  validarPlanAccion,
  type DatosPasoPlanAccion,
  type EstadoPlanAccion,
  type PlanAccion,
} from "../domain/planesAccion.js";
import { ROL_ADMINISTRADOR } from "../domain/tipos.js";
import { ErrorApi } from "../errores.js";
import { usuarioEnSesion } from "../middleware/autenticar.js";
import { autorizar } from "../middleware/autorizar.js";
import type { RepositorioPlanesAccion } from "../repos/planesAccion.js";
import type { RepositorioUsuarios } from "../repos/repositorio.js";

// Equipo de auditoría: consulta el historial del flujo y la evidencia de cualquier plan.
export const ROLES_EDICION = [ROL_ADMINISTRADOR, "Jefe de Auditoría", "Auditor Senior", "Auditor"];

interface Dependencias {
  repo: RepositorioPlanesAccion;
  usuarios: RepositorioUsuarios;
  registrarEvento: RegistrarEvento;
}

const MENSAJE_BLOQUEADO = "El plan de acción está en revisión o aprobado y no puede modificarse.";
/** Lo que el Jefe de Auditoría validó no cambia; la fecha solo se mueve con una prórroga aprobada. */
const CAMPOS_FIJOS_TRAS_VALIDAR = ["titulo", "descripcion", "fechaCompromiso"] as const;
const MENSAJE_VALIDADO =
  "El plan de acción ya fue validado: solo se puede cambiar su responsable, y la fecha se mueve con una prórroga.";

/** Los auditados solo ven lo que se les asignó (SF-16). Consultor y Solo Lectura conservan la consulta. */
const sinAuditados: RequestHandler = (_req, res, next) => {
  if (esAuditado(usuarioEnSesion(res).rol)) {
    throw new ErrorApi(403, "ROL_NO_AUTORIZADO", "No tienes acceso a esta información.");
  }
  next();
};

function resumenPasos(pasos: readonly { descripcion: string; usuarioAsignadoId: number; fechaCompromiso: string | null }[]) {
  return JSON.stringify(pasos.map(({ descripcion, usuarioAsignadoId, fechaCompromiso }) => ({ descripcion, usuarioAsignadoId, fechaCompromiso })));
}

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

  /** La escritura no se aplicó: distingue un plan que acaba de bloquearse de uno que no existe. */
  async function errorEscrituraRechazada(id: number, noEncontrado: string): Promise<ErrorApi> {
    const reciente = await repo.buscarPorId(id);
    return reciente
      ? new ErrorApi(409, "PLAN_BLOQUEADO", MENSAJE_BLOQUEADO)
      : new ErrorApi(404, "NO_ENCONTRADO", noEncontrado);
  }

  /** Quién puede actuar como responsable o asignado: un auditado activo (SF-10). */
  async function exigirAuditadoActivo(usuarioId: number, mensaje: string) {
    const usuario = await usuarios.buscarPorId(usuarioId);
    if (!usuario || usuario.estado !== "active" || !esAuditado(usuario.rol)) {
      throw new ErrorApi(400, "DATOS_INVALIDOS", mensaje);
    }
  }

  async function revisoresDe(plan: PlanAccion): Promise<number[]> {
    const activos = (await usuarios.listarUsuarios()).filter(
      (candidato) => candidato.estado === "active" && impedimentoRevision(plan, candidato) === null,
    );
    return activos.map((revisor) => revisor.id);
  }

  /** A quién avisar de que el plan está listo: a quien lo creó si es Auditor, o a los Auditores Senior. */
  async function auditoresDe(plan: PlanAccion): Promise<number[]> {
    const creador = await usuarios.buscarPorId(plan.creadoPorId);
    if (creador?.estado === "active" && ROLES_GESTION_PLAN.includes(creador.rol)) return [creador.id];
    const seniors = (await usuarios.listarUsuarios()).filter((u) => u.estado === "active" && u.rol === "Auditor Senior");
    return seniors.map((u) => u.id);
  }

  /** Comprueba que los archivos señalados en un rechazo sean de este plan. */
  async function evidenciasObservadasDe(plan: PlanAccion, valor: unknown): Promise<EvidenciaPlan[]> {
    if (valor === undefined) return [];
    if (!Array.isArray(valor) || valor.some((id) => typeof id !== "string")) {
      throw new ErrorApi(400, "DATOS_INVALIDOS", "Los archivos señalados no son válidos.");
    }
    if (valor.length === 0) return [];
    if (plan.etapa !== "cierre") {
      throw new ErrorApi(400, "DATOS_INVALIDOS", "Solo se señalan archivos al revisar la evidencia del plan.");
    }
    const delPlan = new Map((await repo.evidenciasPlan(plan.id)).map((evidencia) => [evidencia.id, evidencia]));
    const ids = [...new Set(valor as string[])];
    const observadas = ids.map((id) => delPlan.get(id));
    if (observadas.some((evidencia) => !evidencia)) {
      throw new ErrorApi(400, "DATOS_INVALIDOS", "Uno de los archivos señalados no pertenece a este plan.");
    }
    return observadas as EvidenciaPlan[];
  }

  const conflictoConcurrente = () =>
    new ErrorApi(409, "ESTADO_INVALIDO", "Otro usuario ya actuó sobre este plan. Actualiza la lista.");

  rutas.get("/planes-accion", sinAuditados, async (_req, res) => {
    res.json(await repo.listar());
  });

  // Planes del usuario en sesión. Un auditado solo recibe la vista reducida de los planes ya validados (SF-16).
  rutas.get("/planes-accion/mios", async (_req, res) => {
    const usuario = usuarioEnSesion(res);
    if (!esAuditado(usuario.rol)) {
      res.json(await repo.listarPorResponsable(usuario.id));
      return;
    }
    const planes = await repo.listarPorResponsable(usuario.id, { soloValidados: true });
    res.json(
      await Promise.all(
        planes.map(async (plan) =>
          vistaAuditadoPlan(plan, usuario.id, await repo.ultimoRechazo(plan.id), await repo.ultimaProrroga(plan.id)),
        ),
      ),
    );
  });

  // Bandeja de revisión (SF-12): planes enviados, en revisión, aprobados o rechazados.
  rutas.get("/planes-accion/revision", autorizar(...ROLES_REVISION), async (_req, res) => {
    res.json(await repo.listarRevision());
  });

  // Historial del flujo: solo para el equipo de auditoría. El auditado recibe el motivo de rechazo en su vista.
  rutas.get("/planes-accion/:id/flujo", autorizar(...ROLES_EDICION), async (req, res) => {
    const plan = await planDeRuta(req.params.id);
    const eventos = await repo.listarFlujo(plan.id);
    // Se compara la firma contra el contenido actual para detectar cambios posteriores a la aprobación.
    const firma = plan.estado === "Aprobado" ? [...eventos].reverse().find((evento) => evento.accion === "aprobacion") : undefined;
    const firmaIntegra = firma
      ? firma.firmaHash === huellaContenidoPlan(plan, await repo.hashesEvidenciaPlan(plan.id))
      : null;
    res.json({ eventos, firmaIntegra });
  });

  // Archivos del plan, para señalarlos al rechazar.
  rutas.get("/planes-accion/:id/evidencias", autorizar(...ROLES_REVISION), async (req, res) => {
    const plan = await planDeRuta(req.params.id);
    res.json(await repo.evidenciasPlan(plan.id));
  });

  // Auditados activos que pueden ser responsables de un plan. Solo los datos necesarios para elegirlos.
  rutas.get("/planes-accion/responsables", sinAuditados, async (_req, res) => {
    const activos = (await usuarios.listarUsuarios()).filter((u) => u.estado === "active" && esAuditado(u.rol));
    res.json(activos.map(({ id, nombre, correo }) => ({ id, nombre, correo })));
  });

  // Datos del hallazgo que el formulario necesita (fecha de cierre de la auditoría).
  rutas.get("/planes-accion/hallazgos/:id", sinAuditados, async (req, res) => {
    const hallazgo = await repo.buscarHallazgo(String(req.params.id));
    if (!hallazgo) throw new ErrorApi(404, "NO_ENCONTRADO", "El hallazgo no existe.");
    res.json(hallazgo);
  });

  // El auditor define el plan y asigna a sus responsables (UF-08, SF-10). Empieza como borrador por validar.
  rutas.post("/planes-accion", autorizar(...ROLES_GESTION_PLAN), async (req, res) => {
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

    await exigirAuditadoActivo(plan.responsableId, "El responsable debe ser un usuario auditado activo.");
    for (const paso of plan.pasos ?? []) {
      await exigirAuditadoActivo(paso.usuarioAsignadoId, "Cada paso debe asignarse a un usuario auditado activo.");
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

  // Edición por el auditor. En la definición se edita todo; ya validado, solo el responsable y el estado manual.
  rutas.patch("/planes-accion/:id", autorizar(...ROLES_GESTION_PLAN), async (req, res) => {
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
    if (recibidos.length === 0 && !("pasos" in cuerpo)) {
      throw new ErrorApi(400, "DATOS_INVALIDOS", "No se indicó ningún campo a modificar.");
    }

    const anterior = {
      titulo: actual.titulo,
      descripcion: actual.descripcion,
      responsableId: actual.responsable.id,
      fechaCompromiso: actual.fechaCompromiso,
      estado: actual.estado,
    };
    const combinado: Record<string, unknown> = { hallazgoId: actual.hallazgo.id, pasos: cuerpo.pasos ?? [], ...anterior };
    for (const c of recibidos) combinado[c] = cuerpo[c];

    const error = validarEdicionPlanAccion(combinado);
    if (error) throw new ErrorApi(400, "DATOS_INVALIDOS", error);
    const datos = normalizarEdicionPlanAccion(combinado);
    const pasosNuevos: DatosPasoPlanAccion[] | undefined = "pasos" in cuerpo ? normalizarPlanAccion(combinado).pasos : undefined;
    const pasosActuales = actual.pasos.map((paso) => ({
      descripcion: paso.descripcion,
      usuarioAsignadoId: paso.usuarioAsignado?.id ?? 0,
      fechaCompromiso: paso.fechaCompromiso,
    }));
    const cambianPasos = pasosNuevos !== undefined && resumenPasos(pasosNuevos) !== resumenPasos(pasosActuales);

    const cambios = CAMPOS_EDITABLES_PLAN_ACCION.filter((c) => datos[c] !== anterior[c]);
    if (cambios.length === 0 && !cambianPasos) {
      res.json(actual);
      return;
    }

    if (actual.etapa === "cierre" && (cambianPasos || CAMPOS_FIJOS_TRAS_VALIDAR.some((c) => cambios.includes(c)))) {
      throw new ErrorApi(409, "PLAN_VALIDADO", MENSAJE_VALIDADO);
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
      await exigirAuditadoActivo(datos.responsableId, "El responsable debe ser un usuario auditado activo.");
    }
    for (const paso of cambianPasos ? pasosNuevos! : []) {
      await exigirAuditadoActivo(paso.usuarioAsignadoId, "Cada paso debe asignarse a un usuario auditado activo.");
    }

    const plan = await repo.actualizar(id, datos, cambianPasos ? pasosNuevos : undefined);
    if (!plan) throw await errorEscrituraRechazada(id, "El plan de acción no existe.");

    registrarEvento({
      accion: "plan_accion.edicion",
      actor: usuarioEnSesion(res).correo,
      detalle: {
        planAccionId: plan.id,
        hallazgoId: plan.hallazgo.id,
        folio: plan.hallazgo.folio,
        cambios: {
          ...Object.fromEntries(cambios.map((c) => [c, { anterior: anterior[c], nuevo: datos[c] }])),
          ...(cambianPasos ? { pasos: { anterior: pasosActuales.length, nuevo: pasosNuevos!.length } } : {}),
        },
      },
    });
    res.json(plan);
  });

  // El auditor envía la definición a validar o, cuando el auditado terminó, la evidencia a revisar.
  rutas.post("/planes-accion/:id/enviar-revision", autorizar(...ROLES_GESTION_PLAN), async (req, res) => {
    const actual = await planDeRuta(req.params.id);
    const usuario = usuarioEnSesion(res);
    const impedimento = impedimentoEnvio(actual, usuario);
    if (impedimento) throw new ErrorApi(403, "ENVIO_IMPEDIDO", impedimento);
    const enviables = estadosEnviables(actual.etapa);
    if (!enviables.includes(actual.estado)) {
      throw new ErrorApi(409, "ESTADO_INVALIDO", `El plan de acción está en estado "${actual.estado}" y no se puede enviar a revisión.`);
    }
    if (actual.pasos.length === 0) {
      throw new ErrorApi(400, "PASOS_PENDIENTES", "El plan de acción necesita al menos un paso.");
    }
    if (actual.etapa === "cierre") {
      if (!actual.pasos.every((paso) => paso.completado)) {
        throw new ErrorApi(400, "PASOS_PENDIENTES", "Todos los pasos deben estar completados antes de enviar el plan a revisión.");
      }
      const hashes = await repo.hashesEvidenciaPlan(actual.id);
      if (!actual.pasos.every((paso) => hashes[paso.id]?.length)) {
        throw new ErrorApi(400, "EVIDENCIA_PENDIENTE", "Todos los pasos deben tener evidencia antes de enviar el plan a revisión.");
      }
      if ((await repo.ultimaProrroga(actual.id))?.estado === "Pendiente") {
        throw new ErrorApi(409, "PRORROGA_PENDIENTE", "El plan de acción tiene una prórroga por decidir.");
      }
    }

    const plan = await repo.transicionar(actual.id, {
      desde: enviables,
      hacia: "Pendiente",
      accion: "envio",
      actor: actorDe(usuario),
      notificar: {
        usuarioIds: await revisoresDe(actual),
        mensaje:
          actual.etapa === "definicion"
            ? `El plan de acción ${actual.publicId} está pendiente de validación.`
            : `El plan de acción ${actual.publicId} está pendiente de revisión.`,
      },
    });
    if (!plan) throw conflictoConcurrente();
    registrarEvento({
      accion: "plan_accion.envio_revision",
      actor: usuario.correo,
      detalle: { planAccionId: plan.id, hallazgoId: plan.hallazgo.id, folio: plan.hallazgo.folio, etapa: actual.etapa },
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
  // En la definición valida el plan y el auditado empieza a trabajar; en el cierre es la aprobación final.
  rutas.post("/planes-accion/:id/aprobar", autorizar(...ROLES_REVISION), async (req, res) => {
    const actual = await planDeRuta(req.params.id);
    const usuario = usuarioEnSesion(res);
    exigirRevisor(actual, usuario);
    exigirEstado(actual, "En Revisión", "aprobar");

    const firmaHash = huellaContenidoPlan(actual, await repo.hashesEvidenciaPlan(actual.id));
    const esDefinicion = actual.etapa === "definicion";
    const plan = await repo.transicionar(actual.id, {
      desde: ["En Revisión"],
      hacia: esDefinicion ? "Asignado" : "Aprobado",
      accion: "aprobacion",
      actor: actorDe(usuario),
      firmaHash,
      ...(esDefinicion ? { etapaNueva: "cierre" as const, asignarHallazgos: true } : {}),
      notificar: {
        usuarioIds: destinatariosCambio(actual, usuario.id, "aprobacion"),
        mensaje: esDefinicion
          ? `El plan de acción ${actual.publicId} fue validado por ${usuario.nombre} y ya se puede trabajar en él.`
          : `El plan de acción ${actual.publicId} fue aprobado por ${usuario.nombre}.`,
      },
    });
    if (!plan) throw conflictoConcurrente();
    registrarEvento({
      accion: "plan_accion.aprobacion",
      actor: usuario.correo,
      detalle: { planAccionId: plan.id, hallazgoId: plan.hallazgo.id, folio: plan.hallazgo.folio, firmaHash, etapa: actual.etapa },
    });
    res.json(plan);
  });

  rutas.post("/planes-accion/:id/rechazar", autorizar(...ROLES_REVISION), async (req, res) => {
    const actual = await planDeRuta(req.params.id);
    const usuario = usuarioEnSesion(res);
    exigirRevisor(actual, usuario);
    exigirEstado(actual, "En Revisión", "rechazar");

    const { motivo: valor, evidenciasObservadas: observadas } = campos(req.body);
    const error = validarMotivoRechazo(valor);
    if (error) throw new ErrorApi(400, "MOTIVO_OBLIGATORIO", error);
    const motivo = (valor as string).trim();
    const evidenciasObservadas = await evidenciasObservadasDe(actual, observadas);

    const plan = await repo.transicionar(actual.id, {
      desde: ["En Revisión"],
      hacia: "Rechazado",
      accion: "rechazo",
      actor: actorDe(usuario),
      motivo,
      evidenciasObservadas,
      notificar: {
        usuarioIds: destinatariosCambio(actual, usuario.id, "rechazo"),
        mensaje: `El plan de acción ${actual.publicId} fue rechazado por ${usuario.nombre}. Motivo: ${motivo}`,
      },
    });
    if (!plan) throw conflictoConcurrente();
    registrarEvento({
      accion: "plan_accion.rechazo",
      actor: usuario.correo,
      detalle: { planAccionId: plan.id, hallazgoId: plan.hallazgo.id, folio: plan.hallazgo.folio, etapa: actual.etapa },
    });
    res.json(plan);
  });

  // Solicitudes de prórroga (SF-11): el responsable propone otra fecha y el Jefe de Auditoría decide.
  rutas.get("/planes-accion/prorrogas", autorizar(...ROLES_REVISION), async (_req, res) => {
    res.json(await repo.listarProrrogasPendientes());
  });

  rutas.post("/planes-accion/:id/prorrogas", async (req, res) => {
    const plan = await planDeRuta(req.params.id);
    const usuario = usuarioEnSesion(res);
    if (plan.responsable.id !== usuario.id) {
      throw new ErrorApi(403, "NO_RESPONSABLE", "Solo el responsable del plan puede solicitar una prórroga.");
    }
    if (!abiertoParaAuditado(plan)) throw new ErrorApi(409, "PLAN_BLOQUEADO", MENSAJE_BLOQUEADO);
    const cuerpo = campos(req.body);
    const error = validarSolicitudProrroga(cuerpo, plan.fechaCompromiso, plan.hallazgo.fechaCierreAuditoria);
    if (error) throw new ErrorApi(400, "DATOS_INVALIDOS", error);

    const solicitud = await repo.solicitarProrroga(
      {
        planAccionId: plan.id,
        solicitadaPorId: usuario.id,
        fechaActual: plan.fechaCompromiso,
        fechaPropuesta: cuerpo.fechaPropuesta as string,
        justificacion: (cuerpo.justificacion as string).trim(),
      },
      {
        usuarioIds: await revisoresDe(plan),
        mensaje: `Hay una solicitud de prórroga del plan de acción ${plan.publicId}.`,
      },
    );
    if (!solicitud) throw new ErrorApi(409, "PRORROGA_PENDIENTE", "El plan de acción ya tiene una prórroga por decidir.");
    registrarEvento({
      accion: "plan_accion.solicitud_prorroga",
      actor: usuario.correo,
      detalle: { planAccionId: plan.id, fechaActual: plan.fechaCompromiso, fechaPropuesta: solicitud.fechaPropuesta },
    });
    res.status(201).json(solicitud);
  });

  async function decidirProrroga(idSolicitud: unknown, usuario: ReturnType<typeof usuarioEnSesion>, aprobar: boolean, motivo: string | null) {
    const id = Number(idSolicitud);
    const solicitud = Number.isInteger(id) && id > 0 ? await repo.buscarProrroga(id) : null;
    if (!solicitud) throw new ErrorApi(404, "NO_ENCONTRADO", "La solicitud de prórroga no existe.");
    const plan = await planDeRuta(solicitud.planAccionId);
    exigirRevisor(plan, usuario);
    // La fecha forma parte de lo que se firma: no se mueve con el plan en revisión o aprobado.
    if (aprobar && !abiertoParaAuditado(plan)) throw new ErrorApi(409, "PLAN_BLOQUEADO", MENSAJE_BLOQUEADO);

    const decidida = await repo.decidirProrroga(id, {
      decididaPorId: usuario.id,
      aprobar,
      motivo,
      notificar: {
        usuarioIds: [plan.responsable.id, plan.creadoPorId].filter((destino, i, lista) => destino !== usuario.id && lista.indexOf(destino) === i),
        mensaje: aprobar
          ? `Se aprobó la prórroga del plan de acción ${plan.publicId}: la nueva fecha es ${solicitud.fechaPropuesta}.`
          : `Se rechazó la prórroga del plan de acción ${plan.publicId}. Motivo: ${motivo}`,
      },
    });
    if (!decidida) throw new ErrorApi(409, "ESTADO_INVALIDO", "Esta solicitud de prórroga ya se decidió.");
    registrarEvento({
      accion: "plan_accion.decision_prorroga",
      actor: usuario.correo,
      detalle: { planAccionId: plan.id, prorrogaId: id, aprobada: aprobar },
    });
    return decidida;
  }

  rutas.post("/planes-accion/prorrogas/:id/aprobar", autorizar(...ROLES_REVISION), async (req, res) => {
    res.json(await decidirProrroga(req.params.id, usuarioEnSesion(res), true, null));
  });

  rutas.post("/planes-accion/prorrogas/:id/rechazar", autorizar(...ROLES_REVISION), async (req, res) => {
    const { motivo } = campos(req.body);
    const error = validarMotivoRechazo(motivo);
    if (error) throw new ErrorApi(400, "MOTIVO_OBLIGATORIO", error);
    res.json(await decidirProrroga(req.params.id, usuarioEnSesion(res), false, (motivo as string).trim()));
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
    if (!abiertoParaAuditado(plan)) {
      throw new ErrorApi(409, "PLAN_BLOQUEADO", MENSAJE_BLOQUEADO);
    }
    const paso = plan.pasos.find((item) => item.id === pasoId);
    if (!paso || paso.usuarioAsignado?.id !== usuarioEnSesion(res).id) {
      throw new ErrorApi(403, "NO_ASIGNADO", "Solo el responsable asignado puede actualizar este paso.");
    }

    const actualizado = await repo.actualizarPaso(planId, pasoId, completado);
    if (!actualizado) throw await errorEscrituraRechazada(planId, "El paso de acción no existe.");

    const quedoCompleto = completado && !paso.completado && plan.pasos.every((item) => item.id === pasoId || item.completado);
    if (quedoCompleto) {
      await repo.crearNotificaciones(
        await auditoresDe(plan),
        "plan_accion.pasos_completos",
        `Los pasos del plan de acción ${plan.publicId} están completos: revisa la evidencia y envíalo a revisión.`,
        plan.id,
      );
    }
    res.json(actualizado);
  });

  return rutas;
}
