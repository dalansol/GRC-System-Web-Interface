import type { Server } from "node:http";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { crearApp } from "../src/app.js";
import { crearVerificadorDev } from "../src/auth/verificador.js";
import type { EventoBitacora } from "../src/bitacora.js";
import { RepositorioEvidenciasMemoria } from "../src/repos/evidenciasMemoria.js";
import { RepositorioMemoria } from "../src/repos/memoria.js";
import { RepositorioPlanesAccionMemoria } from "../src/repos/planesAccionMemoria.js";
import { RepositorioPlanesMemoria } from "../src/repos/planesMemoria.js";
import { escuchar } from "./servidor.js";

const ADMIN = "s.ramirez@expedite.com";
const JEFA = "m.garcia@expedite.com";
const SENIOR = "c.morales@expedite.com";
const AUDITORA = "a.rodriguez@expedite.com";
const RESPONSABLE = "j.ejemplo@expedite.com";
const ASIGNADO = "c.ejemplo@expedite.com";
const AJENO = "d.torres@expedite.com";

let app: Server;
let usuarios: RepositorioMemoria;
let planes: RepositorioPlanesAccionMemoria;
let eventos: EventoBitacora[];

beforeEach(async () => {
  eventos = [];
  usuarios = new RepositorioMemoria();
  planes = new RepositorioPlanesAccionMemoria(usuarios);
  app = await escuchar(
    crearApp({
      repo: usuarios,
      repoPlanes: new RepositorioPlanesMemoria(usuarios),
      repoPlanesAccion: planes,
      repoEvidencias: new RepositorioEvidenciasMemoria(),
      proveedorIA: null,
      verificador: crearVerificadorDev(),
      dominiosPermitidos: ["expedite.com"],
      corsOrigin: "http://localhost:5173",
      registrarEvento: (evento) => eventos.push(evento),
    }),
  );
});

const como = (correo: string) => ({
  get: (ruta: string) => request(app).get(ruta).set("X-Dev-Usuario", correo),
  post: (ruta: string) => request(app).post(ruta).set("X-Dev-Usuario", correo),
  patch: (ruta: string) => request(app).patch(ruta).set("X-Dev-Usuario", correo),
});

interface PlanCreado {
  id: number;
  publicId: string;
  pasos: { id: number; usuarioAsignado: { id: number } }[];
}

const idDe = async (correo: string) => (await usuarios.buscarPorCorreo(correo))!.id;
const ruta = (id: number, accion: string) => `/api/planes-accion/${id}/${accion}`;
const rutaPaso = (planId: number, pasoId: number) => `/api/planes-accion/${planId}/pasos/${pasoId}`;
const estadoDe = async (id: number) => (await planes.buscarPorId(id))!.estado;
const flujoDe = async (id: number) => (await como(JEFA).get(ruta(id, "flujo"))).body;
const avisosDe = async (correo: string) => planes.listarNotificaciones(await idDe(correo));
const acciones = async (id: number) => (await flujoDe(id)).eventos.map((e: { accion: string }) => e.accion);

async function datosPlan(cambios: Record<string, unknown> = {}) {
  return {
    hallazgoId: "HAL-2025-003",
    titulo: "Actualizar calendario",
    descripcion: "Causa interna del plan.",
    responsableId: await idDe(RESPONSABLE),
    fechaCompromiso: "2025-12-15",
    pasos: [
      { descripcion: "Revisar normas", usuarioAsignadoId: await idDe(RESPONSABLE), fechaCompromiso: "2025-12-01" },
      { descripcion: "Publicar calendario", usuarioAsignadoId: await idDe(ASIGNADO), fechaCompromiso: "2025-12-10" },
    ],
    ...cambios,
  };
}

/** Plan de la Auditora en Borrador: responsable Javier, con un paso de Javier y otro de Charlie. */
async function planBorrador(cambios: Record<string, unknown> = {}) {
  const res = await como(AUDITORA).post("/api/planes-accion").send(await datosPlan(cambios));
  expect(res.status).toBe(201);
  return res.body as PlanCreado;
}

async function enRevisionDeDefinicion(cambios: Record<string, unknown> = {}) {
  const plan = await planBorrador(cambios);
  expect((await como(AUDITORA).post(ruta(plan.id, "enviar-revision"))).status).toBe(200);
  expect((await como(JEFA).post(ruta(plan.id, "abrir-revision"))).status).toBe(200);
  return plan;
}

/** Plan ya validado por la Jefa: el auditado puede trabajar en él. */
async function planValidado(cambios: Record<string, unknown> = {}) {
  const plan = await enRevisionDeDefinicion(cambios);
  expect((await como(JEFA).post(ruta(plan.id, "aprobar"))).status).toBe(200);
  return (await planes.buscarPorId(plan.id))! as unknown as PlanCreado;
}

/** Cada asignado sube su evidencia y completa su paso. */
async function completarPasos(plan: PlanCreado) {
  const responsable = await idDe(RESPONSABLE);
  for (const paso of plan.pasos) {
    planes.registrarEvidencia({ id: `EV-${paso.id}`, pasoId: paso.id, nombre: `paso-${paso.id}.pdf`, hash: `hash-${paso.id}` });
    const correo = paso.usuarioAsignado.id === responsable ? RESPONSABLE : ASIGNADO;
    expect((await como(correo).patch(rutaPaso(plan.id, paso.id)).send({ completado: true })).status).toBe(200);
  }
}

async function planPendienteDeCierre() {
  const plan = await planValidado();
  await completarPasos(plan);
  expect((await como(AUDITORA).post(ruta(plan.id, "enviar-revision"))).status).toBe(200);
  return plan;
}

async function planEnRevisionDeCierre() {
  const plan = await planPendienteDeCierre();
  expect((await como(JEFA).post(ruta(plan.id, "abrir-revision"))).status).toBe(200);
  return plan;
}

async function planAprobado() {
  const plan = await planEnRevisionDeCierre();
  expect((await como(JEFA).post(ruta(plan.id, "aprobar"))).status).toBe(200);
  return plan;
}

async function planRechazadoEnCierre(cuerpo: Record<string, unknown> = { motivo: "Falta evidencia" }) {
  const plan = await planEnRevisionDeCierre();
  expect((await como(JEFA).post(ruta(plan.id, "rechazar")).send(cuerpo)).status).toBe(200);
  return plan;
}

describe("alta de un plan", () => {
  it.each([AUDITORA, SENIOR])("%s crea un plan en Borrador, en la etapa de definición", async (correo) => {
    const res = await como(correo).post("/api/planes-accion").send(await datosPlan());

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ estado: "Borrador", etapa: "definicion" });
    expect(eventos.map((e) => e.accion)).toContain("plan_accion.alta");
  });

  it.each([RESPONSABLE, ASIGNADO, JEFA, ADMIN, AJENO])("%s no puede crear planes", async (correo) => {
    const res = await como(correo).post("/api/planes-accion").send(await datosPlan());

    expect(res.status).toBe(403);
    expect(res.body.error.codigo).toBe("ROL_NO_AUTORIZADO");
  });

  it("el responsable debe tener un rol de auditado", async () => {
    const res = await como(AUDITORA).post("/api/planes-accion").send(await datosPlan({ responsableId: await idDe(SENIOR) }));

    expect(res.status).toBe(400);
    expect(res.body.error.codigo).toBe("DATOS_INVALIDOS");
  });

  it("cada asignado debe tener un rol de auditado", async () => {
    const res = await como(AUDITORA)
      .post("/api/planes-accion")
      .send(await datosPlan({ pasos: [{ descripcion: "Paso", usuarioAsignadoId: await idDe(SENIOR), fechaCompromiso: "2025-12-01" }] }));

    expect(res.status).toBe(400);
    expect(res.body.error.codigo).toBe("DATOS_INVALIDOS");
  });

  it("los posibles responsables son solo auditados activos", async () => {
    const res = await como(AUDITORA).get("/api/planes-accion/responsables");

    expect(res.status).toBe(200);
    expect(res.body.map((u: { correo: string }) => u.correo).sort()).toEqual([ASIGNADO, RESPONSABLE].sort());
  });
});

describe("revisión de la definición", () => {
  it("el Auditor envía el borrador y la Jefa recibe el aviso de validación", async () => {
    const plan = await planBorrador();

    const res = await como(AUDITORA).post(ruta(plan.id, "enviar-revision"));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ estado: "Pendiente", etapa: "definicion" });
    expect((await flujoDe(plan.id)).eventos).toEqual([
      expect.objectContaining({ accion: "envio", etapa: "definicion", estadoAnterior: "Borrador", estadoNuevo: "Pendiente" }),
    ]);
    expect(await avisosDe(JEFA)).toEqual([expect.objectContaining({ mensaje: expect.stringContaining("validación"), leida: false })]);
    expect(await avisosDe(ADMIN)).toEqual([]);
    expect(await avisosDe(RESPONSABLE)).toEqual([]);
  });

  it("un plan sin pasos no se envía a validación", async () => {
    const plan = await planBorrador({ pasos: [] });

    const res = await como(AUDITORA).post(ruta(plan.id, "enviar-revision"));

    expect(res.status).toBe(400);
    expect(res.body.error.codigo).toBe("PASOS_PENDIENTES");
  });

  it("los pasos no tienen que estar completos ni tener evidencia", async () => {
    const plan = await planBorrador();
    expect((await como(SENIOR).post(ruta(plan.id, "enviar-revision"))).status).toBe(200);
  });

  it("aprobar valida el plan: pasa a Asignado y a la etapa de cierre, sin llegar a Aprobado", async () => {
    const plan = await enRevisionDeDefinicion();

    const res = await como(JEFA).post(ruta(plan.id, "aprobar"));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ estado: "Asignado", etapa: "cierre" });
    expect((await flujoDe(plan.id)).eventos.at(-1)).toMatchObject({
      accion: "aprobacion",
      etapa: "definicion",
      estadoNuevo: "Asignado",
      firmaHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect((await flujoDe(plan.id)).firmaIntegra).toBeNull();
  });

  it("al validarse avisa a los auditados", async () => {
    const plan = await enRevisionDeDefinicion();

    await como(JEFA).post(ruta(plan.id, "aprobar"));

    for (const correo of [RESPONSABLE, ASIGNADO, AUDITORA]) {
      expect((await avisosDe(correo)).filter((a) => a.tipo === "plan_accion.aprobacion")).toEqual([
        expect.objectContaining({ mensaje: expect.stringContaining(plan.publicId) }),
      ]);
    }
  });

  it("un rechazo solo le avisa a quien creó el plan", async () => {
    const plan = await enRevisionDeDefinicion();

    const res = await como(JEFA).post(ruta(plan.id, "rechazar")).send({ motivo: "Los pasos no cubren el hallazgo" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ estado: "Rechazado", etapa: "definicion" });
    expect((await avisosDe(AUDITORA)).at(0)?.mensaje).toContain("Los pasos no cubren el hallazgo");
    expect(await avisosDe(RESPONSABLE)).toEqual([]);
    expect(await avisosDe(ASIGNADO)).toEqual([]);
  });

  it("tras un rechazo el Auditor corrige los pasos, reenvía y la Jefa valida", async () => {
    const plan = await enRevisionDeDefinicion();
    await como(JEFA).post(ruta(plan.id, "rechazar")).send({ motivo: "Falta un paso" });

    const edicion = await como(AUDITORA)
      .patch(`/api/planes-accion/${plan.id}`)
      .send({ pasos: [{ descripcion: "Paso corregido", usuarioAsignadoId: await idDe(ASIGNADO), fechaCompromiso: "2025-12-05" }] });
    expect(edicion.status).toBe(200);
    expect(edicion.body.pasos.map((p: { descripcion: string }) => p.descripcion)).toEqual(["Paso corregido"]);
    expect(edicion.body.estado).toBe("Rechazado");

    expect((await como(AUDITORA).post(ruta(plan.id, "enviar-revision"))).status).toBe(200);
    expect((await como(JEFA).post(ruta(plan.id, "abrir-revision"))).status).toBe(200);
    expect((await como(JEFA).post(ruta(plan.id, "aprobar"))).body).toMatchObject({ estado: "Asignado", etapa: "cierre" });
    expect(await acciones(plan.id)).toEqual(["envio", "apertura", "rechazo", "envio", "apertura", "aprobacion"]);
  });

  it("no acepta archivos señalados en la definición", async () => {
    const plan = await enRevisionDeDefinicion();

    const res = await como(JEFA).post(ruta(plan.id, "rechazar")).send({ motivo: "Falta", evidenciasObservadas: ["EV-1"] });

    expect(res.status).toBe(400);
    expect(res.body.error.codigo).toBe("DATOS_INVALIDOS");
    expect(await estadoDe(plan.id)).toBe("En Revisión");
  });
});

describe("edición según la etapa", () => {
  it("en definición se edita todo, incluso los pasos", async () => {
    const plan = await planBorrador();

    const res = await como(SENIOR)
      .patch(`/api/planes-accion/${plan.id}`)
      .send({ titulo: "Otro título", fechaCompromiso: "2025-12-20" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ titulo: "Otro título", fechaCompromiso: "2025-12-20", estado: "Borrador" });
    expect(res.body.pasos).toHaveLength(2);
  });

  it("los pasos nuevos deben ser de auditados", async () => {
    const plan = await planBorrador();

    const res = await como(AUDITORA)
      .patch(`/api/planes-accion/${plan.id}`)
      .send({ pasos: [{ descripcion: "Paso", usuarioAsignadoId: await idDe(SENIOR), fechaCompromiso: "2025-12-05" }] });

    expect(res.status).toBe(400);
  });

  it.each([JEFA, ADMIN, RESPONSABLE, AJENO])("%s no edita planes", async (correo) => {
    const plan = await planBorrador();

    const res = await como(correo).patch(`/api/planes-accion/${plan.id}`).send({ titulo: "Otro" });

    expect(res.status).toBe(403);
    expect(res.body.error.codigo).toBe("ROL_NO_AUTORIZADO");
  });

  it.each([
    ["el título", { titulo: "Otro" }],
    ["la causa", { descripcion: "Otra causa" }],
    ["la fecha", { fechaCompromiso: "2026-01-15" }],
  ])("tras validarse no cambia %s", async (_campo, cuerpo) => {
    const plan = await planValidado();

    const res = await como(AUDITORA).patch(`/api/planes-accion/${plan.id}`).send(cuerpo);

    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe("PLAN_VALIDADO");
  });

  it("tras validarse no cambian los pasos", async () => {
    const plan = await planValidado();

    const res = await como(AUDITORA)
      .patch(`/api/planes-accion/${plan.id}`)
      .send({ pasos: [{ descripcion: "Otro", usuarioAsignadoId: await idDe(ASIGNADO), fechaCompromiso: "2025-12-05" }] });

    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe("PLAN_VALIDADO");
  });

  it("tras validarse se puede reasignar el responsable a otro auditado", async () => {
    const plan = await planValidado();

    const res = await como(AUDITORA).patch(`/api/planes-accion/${plan.id}`).send({ responsableId: await idDe(ASIGNADO) });

    expect(res.status).toBe(200);
    expect(res.body.responsable.id).toBe(await idDe(ASIGNADO));
  });

  it("no se reasigna a quien no es auditado", async () => {
    const plan = await planValidado();

    const res = await como(AUDITORA).patch(`/api/planes-accion/${plan.id}`).send({ responsableId: await idDe(SENIOR) });

    expect(res.status).toBe(400);
  });

  it("enviar los mismos datos sin cambios no es un error", async () => {
    const plan = await planValidado();
    const actual = (await planes.buscarPorId(plan.id))!;

    const res = await como(AUDITORA)
      .patch(`/api/planes-accion/${plan.id}`)
      .send({ titulo: actual.titulo, descripcion: actual.descripcion, fechaCompromiso: actual.fechaCompromiso });

    expect(res.status).toBe(200);
  });

  it("un Auditor que es responsable de un plan anterior no lo edita", async () => {
    const creado = await planes.crear(
      { hallazgoId: "HAL-2025-003", descripcion: "Plan anterior", responsableId: await idDe(AUDITORA), fechaCompromiso: "2025-12-15" },
      await idDe(ADMIN),
    );

    const res = await como(AUDITORA).patch(`/api/planes-accion/${creado.id}`).send({ titulo: "Otro" });

    expect(res.status).toBe(403);
    expect(res.body.error.codigo).toBe("RESPONSABLE_NO_EDITA");
  });
});

describe("envío al cierre", () => {
  it("un Auditor envía el plan con todos los pasos completos y con evidencia", async () => {
    const plan = await planValidado();
    await completarPasos(plan);

    const res = await como(SENIOR).post(ruta(plan.id, "enviar-revision"));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ estado: "Pendiente", etapa: "cierre" });
    expect(await avisosDe(JEFA)).toEqual(
      expect.arrayContaining([expect.objectContaining({ mensaje: expect.stringContaining("pendiente de revisión") })]),
    );
    expect(eventos.map((e) => e.accion)).toContain("plan_accion.envio_revision");
  });

  it.each([RESPONSABLE, ASIGNADO, JEFA, ADMIN, AJENO])("%s no puede enviarlo", async (correo) => {
    const plan = await planValidado();
    await completarPasos(plan);

    const res = await como(correo).post(ruta(plan.id, "enviar-revision"));

    expect(res.status).toBe(403);
    expect(await estadoDe(plan.id)).toBe("Asignado");
  });

  it("no se envía con pasos incompletos", async () => {
    const plan = await planValidado();

    const res = await como(AUDITORA).post(ruta(plan.id, "enviar-revision"));

    expect(res.status).toBe(400);
    expect(res.body.error.codigo).toBe("PASOS_PENDIENTES");
  });

  it("no se envía si un paso completo no tiene evidencia", async () => {
    const plan = await planValidado();
    const responsable = await idDe(RESPONSABLE);
    for (const paso of plan.pasos) {
      await como(paso.usuarioAsignado.id === responsable ? RESPONSABLE : ASIGNADO)
        .patch(rutaPaso(plan.id, paso.id))
        .send({ completado: true });
    }

    const res = await como(AUDITORA).post(ruta(plan.id, "enviar-revision"));

    expect(res.status).toBe(400);
    expect(res.body.error.codigo).toBe("EVIDENCIA_PENDIENTE");
    expect(await estadoDe(plan.id)).toBe("Asignado");
  });

  it("no se envía dos veces", async () => {
    const plan = await planPendienteDeCierre();

    const res = await como(AUDITORA).post(ruta(plan.id, "enviar-revision"));

    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe("ESTADO_INVALIDO");
  });

  it("un plan existente, ya en cierre, va directo a la revisión de cierre", async () => {
    const [sembrado] = await planes.listar();
    expect(sembrado).toMatchObject({ estado: "Asignado", etapa: "cierre", pasos: [] });
    const conPasos = await planes.crear(await datosPlan(), await idDe(AUDITORA));
    await planes.transicionar(conPasos.id, {
      desde: ["Borrador"],
      hacia: "Asignado",
      accion: "aprobacion",
      actor: { id: await idDe(JEFA), nombre: "María García", rol: "Jefe de Auditoría" },
      firmaHash: "a".repeat(64),
      etapaNueva: "cierre",
    });
    await completarPasos(conPasos as unknown as PlanCreado);

    expect((await como(AUDITORA).post(ruta(conPasos.id, "enviar-revision"))).body).toMatchObject({ estado: "Pendiente", etapa: "cierre" });
  });

  it("responde 404 si el plan no existe", async () => {
    expect((await como(AUDITORA).post(ruta(9999, "enviar-revision"))).status).toBe(404);
  });

  it("avisa al Auditor que creó el plan cuando se completa el último paso", async () => {
    const plan = await planValidado();
    const antes = (await avisosDe(AUDITORA)).length;

    await completarPasos(plan);

    const avisos = await avisosDe(AUDITORA);
    expect(avisos).toHaveLength(antes + 1);
    expect(avisos[0]).toMatchObject({ tipo: "plan_accion.pasos_completos", mensaje: expect.stringContaining(plan.publicId) });
  });

  it("si un auditado creó el plan, avisa a los Auditores Senior", async () => {
    const creado = await planes.crear(await datosPlan(), await idDe(RESPONSABLE));
    await planes.transicionar(creado.id, {
      desde: ["Borrador"],
      hacia: "Asignado",
      accion: "aprobacion",
      actor: { id: await idDe(JEFA), nombre: "María García", rol: "Jefe de Auditoría" },
      firmaHash: "a".repeat(64),
      etapaNueva: "cierre",
    });

    await completarPasos(creado as unknown as PlanCreado);

    expect((await avisosDe(SENIOR)).map((a) => a.tipo)).toContain("plan_accion.pasos_completos");
  });
});

describe("criterio 1: abrir un plan pendiente", () => {
  it("cambia a En Revisión y lo registra en la bitácora del flujo", async () => {
    const plan = await planPendienteDeCierre();

    const res = await como(JEFA).post(ruta(plan.id, "abrir-revision"));

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("En Revisión");
    expect((await flujoDe(plan.id)).eventos.at(-1)).toMatchObject({
      accion: "apertura",
      etapa: "cierre",
      estadoAnterior: "Pendiente",
      estadoNuevo: "En Revisión",
      actor: { id: await idDe(JEFA), nombre: "María García", rol: "Jefe de Auditoría" },
    });
    expect(eventos.map((e) => e.accion)).toContain("plan_accion.apertura_revision");
  });

  it("abrirlo otra vez no agrega eventos", async () => {
    const plan = await planEnRevisionDeCierre();
    const antes = (await flujoDe(plan.id)).eventos.length;

    const res = await como(JEFA).post(ruta(plan.id, "abrir-revision"));

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("En Revisión");
    expect((await flujoDe(plan.id)).eventos).toHaveLength(antes);
  });

  it("de dos aperturas simultáneas queda un solo evento y ambas responden 200", async () => {
    const plan = await planPendienteDeCierre();
    const antes = (await acciones(plan.id)).filter((a: string) => a === "apertura").length;

    const respuestas = await Promise.all([
      como(JEFA).post(ruta(plan.id, "abrir-revision")),
      como(JEFA).post(ruta(plan.id, "abrir-revision")),
    ]);

    expect(respuestas.map((r) => r.status)).toEqual([200, 200]);
    expect((await acciones(plan.id)).filter((a: string) => a === "apertura")).toHaveLength(antes + 1);
  });

  it("no abre un plan que no se ha enviado", async () => {
    const plan = await planBorrador();

    const res = await como(JEFA).post(ruta(plan.id, "abrir-revision"));

    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe("ESTADO_INVALIDO");
  });
});

describe("criterio 2: aprobar el cierre", () => {
  it("cambia a Aprobado y registra la firma con firmante, rol, fecha y huella", async () => {
    const plan = await planEnRevisionDeCierre();

    const res = await como(JEFA).post(ruta(plan.id, "aprobar"));

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("Aprobado");
    const { eventos: historial, firmaIntegra } = await flujoDe(plan.id);
    expect(historial.at(-1)).toMatchObject({
      accion: "aprobacion",
      etapa: "cierre",
      estadoAnterior: "En Revisión",
      estadoNuevo: "Aprobado",
      actor: { id: await idDe(JEFA), nombre: "María García", rol: "Jefe de Auditoría" },
      firmaHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      fecha: expect.any(String),
    });
    expect(firmaIntegra).toBe(true);
    expect([...eventos].reverse().find((e) => e.accion === "plan_accion.aprobacion")?.detalle.firmaHash).toBe(historial.at(-1).firmaHash);
  });

  it("avisa una vez al responsable, a los asignados y a quien creó el plan, pero no a quien aprobó", async () => {
    const plan = await planEnRevisionDeCierre();
    const previos = async (correo: string) => (await avisosDe(correo)).filter((a) => a.tipo === "plan_accion.aprobacion").length;
    const antes = await Promise.all([RESPONSABLE, ASIGNADO, AUDITORA].map(previos));

    await como(JEFA).post(ruta(plan.id, "aprobar"));

    expect(await Promise.all([RESPONSABLE, ASIGNADO, AUDITORA].map(previos))).toEqual(antes.map((n) => n + 1));
    expect(await previos(JEFA)).toBe(0);
  });

  it("no aprueba un plan que no se ha abierto", async () => {
    const plan = await planPendienteDeCierre();

    const res = await como(JEFA).post(ruta(plan.id, "aprobar"));

    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe("ESTADO_INVALIDO");
    expect(await estadoDe(plan.id)).toBe("Pendiente");
  });

  it("no aprueba dos veces", async () => {
    const plan = await planAprobado();

    expect((await como(JEFA).post(ruta(plan.id, "aprobar"))).status).toBe(409);
  });

  it("de dos aprobaciones simultáneas solo una se aplica", async () => {
    const plan = await planEnRevisionDeCierre();
    const antes = (await acciones(plan.id)).filter((a: string) => a === "aprobacion").length;

    const respuestas = await Promise.all([
      como(JEFA).post(ruta(plan.id, "aprobar")),
      como(JEFA).post(ruta(plan.id, "aprobar")),
    ]);

    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await acciones(plan.id)).filter((a: string) => a === "aprobacion")).toHaveLength(antes + 1);
  });

  it("firmaIntegra es falso si el contenido cambia después de la firma", async () => {
    const plan = await planAprobado();
    // Simula una evidencia cambiada directamente, sin pasar por las rutas.
    vi.spyOn(planes, "hashesEvidenciaPlan").mockResolvedValue({ [plan.pasos[0]!.id]: ["alterado"] });

    expect((await flujoDe(plan.id)).firmaIntegra).toBe(false);
  });
});

describe("criterio 3: rechazar exige motivo", () => {
  it.each([
    ["sin motivo", {}],
    ["con un motivo vacío", { motivo: "" }],
    ["con un motivo de solo espacios", { motivo: "   " }],
    ["con un motivo que no es texto", { motivo: 42 }],
  ])("impide rechazar %s y no registra nada", async (_caso, cuerpo) => {
    const plan = await planEnRevisionDeCierre();
    const antes = (await flujoDe(plan.id)).eventos.length;
    const avisosAntes = (await avisosDe(RESPONSABLE)).length;

    const res = await como(JEFA).post(ruta(plan.id, "rechazar")).send(cuerpo);

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ codigo: "MOTIVO_OBLIGATORIO", mensaje: "El motivo de rechazo es obligatorio." });
    expect(await estadoDe(plan.id)).toBe("En Revisión");
    expect((await flujoDe(plan.id)).eventos).toHaveLength(antes);
    expect(await avisosDe(RESPONSABLE)).toHaveLength(avisosAntes);
  });

  it("rechaza un motivo demasiado largo", async () => {
    const plan = await planEnRevisionDeCierre();
    const res = await como(JEFA).post(ruta(plan.id, "rechazar")).send({ motivo: "a".repeat(2001) });
    expect(res.status).toBe(400);
    expect(res.body.error.codigo).toBe("MOTIVO_OBLIGATORIO");
  });

  it("con motivo cambia a Rechazado, guarda el motivo sin espacios y avisa con él", async () => {
    const plan = await planEnRevisionDeCierre();

    const res = await como(JEFA).post(ruta(plan.id, "rechazar")).send({ motivo: "  Falta evidencia  " });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ estado: "Rechazado", etapa: "cierre" });
    expect((await flujoDe(plan.id)).eventos.at(-1)).toMatchObject({
      accion: "rechazo",
      estadoNuevo: "Rechazado",
      motivo: "Falta evidencia",
      firmaHash: null,
    });
    for (const correo of [RESPONSABLE, ASIGNADO, AUDITORA]) {
      expect((await avisosDe(correo)).find((a) => a.tipo === "plan_accion.rechazo")?.mensaje).toContain("Falta evidencia");
    }
    expect(eventos.map((e) => e.accion)).toContain("plan_accion.rechazo");
  });

  it("no rechaza un plan pendiente sin abrir", async () => {
    const plan = await planPendienteDeCierre();
    const res = await como(JEFA).post(ruta(plan.id, "rechazar")).send({ motivo: "Falta evidencia" });
    expect(res.status).toBe(409);
  });
});

describe("archivos señalados en un rechazo", () => {
  it("la Jefa consulta los archivos del plan", async () => {
    const plan = await planEnRevisionDeCierre();

    const res = await como(JEFA).get(ruta(plan.id, "evidencias"));

    expect(res.status).toBe(200);
    expect(res.body.map((e: { id: string }) => e.id)).toEqual(plan.pasos.map((p) => `EV-${p.id}`));
  });

  it.each([AUDITORA, RESPONSABLE, AJENO])("%s no consulta esa lista", async (correo) => {
    const plan = await planEnRevisionDeCierre();
    expect((await como(correo).get(ruta(plan.id, "evidencias"))).status).toBe(403);
  });

  it("se guardan con el rechazo", async () => {
    const plan = await planEnRevisionDeCierre();
    const paso = plan.pasos[0]!;

    const res = await como(JEFA).post(ruta(plan.id, "rechazar")).send({ motivo: "Falta marzo", evidenciasObservadas: [`EV-${paso.id}`] });

    expect(res.status).toBe(200);
    expect((await flujoDe(plan.id)).eventos.at(-1).evidenciasObservadas).toEqual([
      { evidenciaId: `EV-${paso.id}`, pasoId: paso.id, nombre: `paso-${paso.id}.pdf` },
    ]);
  });

  it("un archivo de otro plan se rechaza y el plan no cambia", async () => {
    const plan = await planEnRevisionDeCierre();
    const otro = await planEnRevisionDeCierre();

    const res = await como(JEFA)
      .post(ruta(plan.id, "rechazar"))
      .send({ motivo: "Falta", evidenciasObservadas: [`EV-${otro.pasos[0]!.id}`] });

    expect(res.status).toBe(400);
    expect(res.body.error.codigo).toBe("DATOS_INVALIDOS");
    expect(await estadoDe(plan.id)).toBe("En Revisión");
  });

  it("una lista que no es de textos se rechaza", async () => {
    const plan = await planEnRevisionDeCierre();

    const res = await como(JEFA).post(ruta(plan.id, "rechazar")).send({ motivo: "Falta", evidenciasObservadas: [1, 2] });

    expect(res.status).toBe(400);
  });
});

describe("un archivo señalado reabre su paso", () => {
  async function rechazadoConArchivoDe(correo: string) {
    const plan = await planEnRevisionDeCierre();
    const usuarioId = await idDe(correo);
    const paso = plan.pasos.find((p) => p.usuarioAsignado.id === usuarioId)!;
    const res = await como(JEFA).post(ruta(plan.id, "rechazar")).send({ motivo: "Falta marzo", evidenciasObservadas: [`EV-${paso.id}`] });
    expect(res.status).toBe(200);
    return { plan, paso };
  }
  const pasosDe = async (id: number) => (await planes.buscarPorId(id))!.pasos;

  it("el paso del archivo queda sin completar y los demás no cambian", async () => {
    const { plan, paso } = await rechazadoConArchivoDe(ASIGNADO);

    const pasos = await pasosDe(plan.id);

    expect(pasos.find((p) => p.id === paso.id)!.completado).toBe(false);
    expect(pasos.filter((p) => p.id !== paso.id).every((p) => p.completado)).toBe(true);
  });

  it("el portal le muestra el paso sin completar", async () => {
    await rechazadoConArchivoDe(ASIGNADO);

    const [plan] = (await como(ASIGNADO).get("/api/planes-accion/mios")).body;

    expect(plan.pasos[0].completado).toBe(false);
    expect(plan.rechazo.evidenciasObservadas).toHaveLength(1);
  });

  it("un rechazo sin archivos señalados no reabre ningún paso", async () => {
    const plan = await planRechazadoEnCierre();
    expect((await pasosDe(plan.id)).every((p) => p.completado)).toBe(true);
  });

  it("el auditor no reenvía hasta que el auditado vuelve a marcarlo", async () => {
    const { plan, paso } = await rechazadoConArchivoDe(ASIGNADO);

    const antes = await como(AUDITORA).post(ruta(plan.id, "enviar-revision"));
    expect(antes.status).toBe(400);
    expect(antes.body.error.codigo).toBe("PASOS_PENDIENTES");

    expect((await como(ASIGNADO).patch(rutaPaso(plan.id, paso.id)).send({ completado: true })).status).toBe(200);

    expect((await como(AUDITORA).post(ruta(plan.id, "enviar-revision"))).status).toBe(200);
  });

  it("al volver a marcarlo se avisa otra vez al auditor", async () => {
    const { plan, paso } = await rechazadoConArchivoDe(ASIGNADO);
    const completos = async () => (await avisosDe(AUDITORA)).filter((a) => a.tipo === "plan_accion.pasos_completos").length;
    const antes = await completos();

    await como(ASIGNADO).patch(rutaPaso(plan.id, paso.id)).send({ completado: true });

    expect(await completos()).toBe(antes + 1);
  });
});

describe("corrección y reenvío tras un rechazo del cierre", () => {
  it("el auditado cambia su paso, el Auditor reenvía y se conserva el historial", async () => {
    const plan = await planRechazadoEnCierre();
    const responsable = await idDe(RESPONSABLE);
    const paso = plan.pasos.find((p) => p.usuarioAsignado.id === responsable)!;

    expect((await como(RESPONSABLE).patch(rutaPaso(plan.id, paso.id)).send({ completado: false })).status).toBe(200);
    expect((await como(AUDITORA).post(ruta(plan.id, "enviar-revision"))).status).toBe(400);
    expect((await como(RESPONSABLE).patch(rutaPaso(plan.id, paso.id)).send({ completado: true })).status).toBe(200);

    const res = await como(AUDITORA).post(ruta(plan.id, "enviar-revision"));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ estado: "Pendiente", etapa: "cierre" });
    expect((await acciones(plan.id)).slice(-4)).toEqual(["envio", "apertura", "rechazo", "envio"]);
  });

  it("se puede aprobar tras el reenvío", async () => {
    const plan = await planRechazadoEnCierre();
    await como(AUDITORA).post(ruta(plan.id, "enviar-revision"));
    await como(JEFA).post(ruta(plan.id, "abrir-revision"));

    const res = await como(JEFA).post(ruta(plan.id, "aprobar"));

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("Aprobado");
  });

  it("el auditado no reenvía", async () => {
    const plan = await planRechazadoEnCierre();
    expect((await como(RESPONSABLE).post(ruta(plan.id, "enviar-revision"))).status).toBe(403);
  });

  it("en Rechazado el estado no cambia a mano", async () => {
    const plan = await planRechazadoEnCierre();

    const res = await como(AUDITORA).patch(`/api/planes-accion/${plan.id}`).send({ estado: "Asignado" });

    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe("ESTADO_CONTROLADO_POR_FLUJO");
    expect(await estadoDe(plan.id)).toBe("Rechazado");
  });
});

describe("quién puede revisar", () => {
  it.each([
    ["abrir-revision", planPendienteDeCierre],
    ["aprobar", planEnRevisionDeCierre],
    ["rechazar", planEnRevisionDeCierre],
  ] as const)("el Administrador y los auditores no pueden %s", async (accion, preparar) => {
    const plan = await preparar();
    const antes = await estadoDe(plan.id);

    for (const correo of [ADMIN, SENIOR, AUDITORA, RESPONSABLE]) {
      const res = await como(correo).post(ruta(plan.id, accion)).send({ motivo: "Falta evidencia" });
      expect(res.status).toBe(403);
      expect(res.body.error.codigo).toBe("ROL_NO_AUTORIZADO");
    }
    expect(await estadoDe(plan.id)).toBe(antes);
  });

  it("una Jefa responsable de un plan anterior está impedida y el plan sigue Pendiente", async () => {
    const creado = await planes.crear(await datosPlan({ responsableId: await idDe(JEFA) }), await idDe(AUDITORA));
    await como(AUDITORA).post(ruta(creado.id, "enviar-revision"));

    const res = await como(JEFA).post(ruta(creado.id, "abrir-revision"));

    expect(res.status).toBe(403);
    expect(res.body.error.codigo).toBe("REVISOR_IMPEDIDO");
    expect(await estadoDe(creado.id)).toBe("Pendiente");
  });

  it("una Jefa con un paso asignado en un plan anterior está impedida y no recibe el aviso", async () => {
    const creado = await planes.crear(
      await datosPlan({ pasos: [{ descripcion: "Paso de la jefa", usuarioAsignadoId: await idDe(JEFA), fechaCompromiso: "2025-12-01" }] }),
      await idDe(AUDITORA),
    );
    await como(AUDITORA).post(ruta(creado.id, "enviar-revision"));

    expect((await como(JEFA).post(ruta(creado.id, "abrir-revision"))).body.error.codigo).toBe("REVISOR_IMPEDIDO");
    expect(await avisosDe(JEFA)).toEqual([]);
  });

  it("una Jefa que creó un plan anterior está impedida", async () => {
    const creado = await planes.crear(await datosPlan(), await idDe(JEFA));
    await como(AUDITORA).post(ruta(creado.id, "enviar-revision"));

    expect((await como(JEFA).post(ruta(creado.id, "abrir-revision"))).body.error.codigo).toBe("REVISOR_IMPEDIDO");
  });

  it("un Auditor responsable de un plan anterior no lo envía", async () => {
    const creado = await planes.crear(await datosPlan({ responsableId: await idDe(AUDITORA) }), await idDe(ADMIN));

    const res = await como(AUDITORA).post(ruta(creado.id, "enviar-revision"));

    expect(res.status).toBe(403);
    expect(res.body.error.codigo).toBe("ENVIO_IMPEDIDO");
  });
});

describe("bandeja de revisión", () => {
  it("lista los planes en estados de revisión de ambas etapas y no los borradores", async () => {
    const definicion = await planBorrador();
    await como(AUDITORA).post(ruta(definicion.id, "enviar-revision"));
    const cierre = await planPendienteDeCierre();
    const sinEnviar = await planBorrador();

    const res = await como(JEFA).get("/api/planes-accion/revision");

    expect(res.status).toBe(200);
    const ids = res.body.map((p: { id: number }) => p.id);
    expect(ids).toEqual(expect.arrayContaining([definicion.id, cierre.id]));
    expect(ids).not.toContain(sinEnviar.id);
    expect(res.body.find((p: { id: number }) => p.id === definicion.id).etapa).toBe("definicion");
  });

  it.each([AUDITORA, ADMIN, RESPONSABLE])("%s no la consulta", async (correo) => {
    expect((await como(correo).get("/api/planes-accion/revision")).status).toBe(403);
  });
});

describe("consulta del flujo", () => {
  it.each([AUDITORA, SENIOR, JEFA, ADMIN])("%s del equipo de auditoría lo consulta", async (correo) => {
    const plan = await planPendienteDeCierre();
    expect((await como(correo).get(ruta(plan.id, "flujo"))).status).toBe(200);
  });

  it.each([RESPONSABLE, ASIGNADO, AJENO])("%s no lo consulta, aunque participe en el plan", async (correo) => {
    const plan = await planPendienteDeCierre();
    expect((await como(correo).get(ruta(plan.id, "flujo"))).status).toBe(403);
  });

  it("responde 404 si el plan no existe", async () => {
    expect((await como(JEFA).get(ruta(9999, "flujo"))).status).toBe(404);
  });
});

describe("portal del auditado", () => {
  it("no ve un plan mientras sigue en definición", async () => {
    await planBorrador();
    expect((await como(RESPONSABLE).get("/api/planes-accion/mios")).body).toEqual([]);
    expect((await como(ASIGNADO).get("/api/planes-accion/mios")).body).toEqual([]);
  });

  it("ve el plan cuando se valida, solo con los campos acordados", async () => {
    const plan = await planValidado();

    const res = await como(RESPONSABLE).get("/api/planes-accion/mios");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(Object.keys(res.body[0]).sort()).toEqual(
      ["esResponsable", "estado", "fechaCompromiso", "hallazgo", "id", "pasos", "prorroga", "publicId", "rechazo", "titulo"].sort(),
    );
    expect(res.body[0]).toMatchObject({ id: plan.id, esResponsable: true });
    expect(res.body[0].hallazgo).toEqual({ folio: "HAL-2025-003", titulo: expect.any(String) });
    expect(JSON.stringify(res.body)).not.toContain("Causa interna del plan");
  });

  it("el responsable ve todos los pasos y un asignado solo los suyos", async () => {
    await planValidado();

    const delResponsable = (await como(RESPONSABLE).get("/api/planes-accion/mios")).body[0];
    const delAsignado = (await como(ASIGNADO).get("/api/planes-accion/mios")).body[0];

    expect(delResponsable.pasos.map((p: { descripcion: string }) => p.descripcion)).toEqual(["Revisar normas", "Publicar calendario"]);
    expect(delAsignado.esResponsable).toBe(false);
    expect(delAsignado.pasos.map((p: { descripcion: string }) => p.descripcion)).toEqual(["Publicar calendario"]);
  });

  it("ve el motivo del rechazo y los archivos observados de sus pasos", async () => {
    const plan = await planEnRevisionDeCierre();
    const ids = plan.pasos.map((p) => `EV-${p.id}`);
    await como(JEFA).post(ruta(plan.id, "rechazar")).send({ motivo: "Falta marzo", evidenciasObservadas: ids });

    const delResponsable = (await como(RESPONSABLE).get("/api/planes-accion/mios")).body[0];
    const delAsignado = (await como(ASIGNADO).get("/api/planes-accion/mios")).body[0];

    expect(delResponsable.rechazo.motivo).toBe("Falta marzo");
    expect(delResponsable.rechazo.evidenciasObservadas).toHaveLength(2);
    expect(delAsignado.rechazo.evidenciasObservadas).toHaveLength(1);
  });

  it("un usuario del equipo de auditoría sigue recibiendo el plan completo", async () => {
    const creado = await planes.crear(await datosPlan({ responsableId: await idDe(AUDITORA) }), await idDe(ADMIN));
    await planes.transicionar(creado.id, {
      desde: ["Borrador"],
      hacia: "Asignado",
      accion: "aprobacion",
      actor: { id: await idDe(JEFA), nombre: "María García", rol: "Jefe de Auditoría" },
      firmaHash: "a".repeat(64),
      etapaNueva: "cierre",
    });

    const [plan] = (await como(AUDITORA).get("/api/planes-accion/mios")).body;

    expect(plan).toHaveProperty("causaRaiz");
  });

  it.each([
    ["GET", "/api/planes-accion"],
    ["GET", "/api/planes-accion/responsables"],
    ["GET", "/api/planes-accion/hallazgos/HAL-2025-003"],
  ])("no puede consultar %s %s", async (_metodo, direccion) => {
    for (const correo of [RESPONSABLE, ASIGNADO]) {
      const res = await como(correo).get(direccion);
      expect(res.status).toBe(403);
      expect(res.body.error.codigo).toBe("ROL_NO_AUTORIZADO");
    }
  });

  it("Consultor y Solo Lectura conservan la consulta de planes", async () => {
    expect((await como(AJENO).get("/api/planes-accion")).status).toBe(200);
  });

  it("no cambia un paso de un plan en definición aunque lo intente por la API", async () => {
    const plan = await planBorrador();
    const responsable = await idDe(RESPONSABLE);
    const paso = plan.pasos.find((p) => p.usuarioAsignado.id === responsable)!;

    const res = await como(RESPONSABLE).patch(rutaPaso(plan.id, paso.id)).send({ completado: true });

    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe("PLAN_BLOQUEADO");
    expect((await planes.buscarPorId(plan.id))!.pasos.every((p) => !p.completado)).toBe(true);
  });

  it("solo cambia sus propios pasos", async () => {
    const plan = await planValidado();
    const responsable = await idDe(RESPONSABLE);
    const ajeno = plan.pasos.find((p) => p.usuarioAsignado.id !== responsable)!;

    const res = await como(RESPONSABLE).patch(rutaPaso(plan.id, ajeno.id)).send({ completado: true });

    expect(res.status).toBe(403);
    expect(res.body.error.codigo).toBe("NO_ASIGNADO");
  });
});

describe("prórrogas", () => {
  const solicitud = { fechaPropuesta: "2026-02-01", justificacion: "Depende de un proveedor" };
  const pedir = (plan: PlanCreado, correo = RESPONSABLE, cuerpo: Record<string, unknown> = solicitud) =>
    como(correo).post(ruta(plan.id, "prorrogas")).send(cuerpo);
  const fechaDe = async (id: number) => (await planes.buscarPorId(id))!.fechaCompromiso;

  it("el responsable la pide, la fecha no cambia y la Jefa recibe el aviso", async () => {
    const plan = await planValidado();

    const res = await pedir(plan);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      planAccionId: plan.id,
      folioPlan: plan.publicId,
      fechaActual: "2025-12-15",
      fechaPropuesta: "2026-02-01",
      justificacion: "Depende de un proveedor",
      estado: "Pendiente",
    });
    expect(await fechaDe(plan.id)).toBe("2025-12-15");
    expect((await avisosDe(JEFA)).map((a) => a.tipo)).toContain("plan_accion.solicitud_prorroga");
    expect(eventos.map((e) => e.accion)).toContain("plan_accion.solicitud_prorroga");
  });

  it.each([ASIGNADO, AUDITORA, JEFA])("%s no la puede pedir", async (correo) => {
    const plan = await planValidado();

    const res = await pedir(plan, correo);

    expect(res.status).toBe(403);
    expect(res.body.error.codigo).toBe("NO_RESPONSABLE");
  });

  it("no se pide para un plan en definición", async () => {
    const plan = await planBorrador();

    const res = await pedir(plan);

    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe("PLAN_BLOQUEADO");
  });

  it("no se pide para un plan en revisión", async () => {
    const plan = await planPendienteDeCierre();
    expect((await pedir(plan)).body.error.codigo).toBe("PLAN_BLOQUEADO");
  });

  it("se puede pedir con el plan rechazado", async () => {
    const plan = await planRechazadoEnCierre();
    expect((await pedir(plan)).status).toBe(201);
  });

  it.each([
    ["sin justificación", { fechaPropuesta: "2026-02-01" }],
    ["con fecha igual a la actual", { fechaPropuesta: "2025-12-15", justificacion: "Algo" }],
    ["con fecha anterior al cierre", { fechaPropuesta: "2025-11-01", justificacion: "Algo" }],
    ["con fecha inválida", { fechaPropuesta: "mañana", justificacion: "Algo" }],
  ])("rechaza una solicitud %s", async (_caso, cuerpo) => {
    const plan = await planValidado();

    const res = await pedir(plan, RESPONSABLE, cuerpo);

    expect(res.status).toBe(400);
    expect(res.body.error.codigo).toBe("DATOS_INVALIDOS");
  });

  it("no admite una segunda solicitud abierta", async () => {
    const plan = await planValidado();
    await pedir(plan);

    const res = await pedir(plan);

    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe("PRORROGA_PENDIENTE");
  });

  it("una solicitud abierta impide enviar el plan al cierre", async () => {
    const plan = await planValidado();
    await completarPasos(plan);
    await pedir(plan);

    const res = await como(AUDITORA).post(ruta(plan.id, "enviar-revision"));

    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe("PRORROGA_PENDIENTE");
    expect(await estadoDe(plan.id)).toBe("Asignado");
  });

  it("la Jefa lista las pendientes; los demás no", async () => {
    const plan = await planValidado();
    await pedir(plan);

    const res = await como(JEFA).get("/api/planes-accion/prorrogas");

    expect(res.status).toBe(200);
    expect(res.body.map((p: { planAccionId: number }) => p.planAccionId)).toEqual([plan.id]);
    for (const correo of [ADMIN, AUDITORA, RESPONSABLE]) {
      expect((await como(correo).get("/api/planes-accion/prorrogas")).status).toBe(403);
    }
  });

  it("aprobarla mueve la fecha, avisa y deja de estar pendiente", async () => {
    const plan = await planValidado();
    const { body: creada } = await pedir(plan);

    const res = await como(JEFA).post(`/api/planes-accion/prorrogas/${creada.id}/aprobar`);

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("Aprobada");
    expect(await fechaDe(plan.id)).toBe("2026-02-01");
    expect((await avisosDe(RESPONSABLE)).map((a) => a.tipo)).toContain("plan_accion.decision_prorroga");
    expect((await como(JEFA).get("/api/planes-accion/prorrogas")).body).toEqual([]);
    expect(eventos.map((e) => e.accion)).toContain("plan_accion.decision_prorroga");
  });

  it("rechazarla exige un motivo y conserva la fecha", async () => {
    const plan = await planValidado();
    const { body: creada } = await pedir(plan);

    const sinMotivo = await como(JEFA).post(`/api/planes-accion/prorrogas/${creada.id}/rechazar`).send({ motivo: "  " });
    expect(sinMotivo.status).toBe(400);
    expect(sinMotivo.body.error.codigo).toBe("MOTIVO_OBLIGATORIO");

    const res = await como(JEFA).post(`/api/planes-accion/prorrogas/${creada.id}/rechazar`).send({ motivo: "No procede" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ estado: "Rechazada", motivoDecision: "No procede" });
    expect(await fechaDe(plan.id)).toBe("2025-12-15");
  });

  it("de dos decisiones simultáneas solo una se aplica", async () => {
    const plan = await planValidado();
    const { body: creada } = await pedir(plan);

    const respuestas = await Promise.all([
      como(JEFA).post(`/api/planes-accion/prorrogas/${creada.id}/aprobar`),
      como(JEFA).post(`/api/planes-accion/prorrogas/${creada.id}/rechazar`).send({ motivo: "No procede" }),
    ]);

    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it("no se aprueba si el plan quedó en revisión: su fecha forma parte de lo que se firma", async () => {
    const plan = await planValidado();
    const { body: creada } = await pedir(plan);
    await planes.transicionar(plan.id, {
      desde: ["Asignado"],
      hacia: "Pendiente",
      accion: "envio",
      actor: { id: await idDe(AUDITORA), nombre: "Ana Rodríguez", rol: "Auditor" },
    });

    const res = await como(JEFA).post(`/api/planes-accion/prorrogas/${creada.id}/aprobar`);

    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe("PLAN_BLOQUEADO");
    expect(await fechaDe(plan.id)).toBe("2025-12-15");
    expect((await como(JEFA).get("/api/planes-accion/prorrogas")).body).toHaveLength(1);
  });

  it("sí se puede rechazar con el plan en revisión", async () => {
    const plan = await planValidado();
    const { body: creada } = await pedir(plan);
    await planes.transicionar(plan.id, {
      desde: ["Asignado"],
      hacia: "Pendiente",
      accion: "envio",
      actor: { id: await idDe(AUDITORA), nombre: "Ana Rodríguez", rol: "Auditor" },
    });

    const res = await como(JEFA).post(`/api/planes-accion/prorrogas/${creada.id}/rechazar`).send({ motivo: "No procede" });

    expect(res.status).toBe(200);
  });

  it.each([ADMIN, AUDITORA, RESPONSABLE])("%s no la decide", async (correo) => {
    const plan = await planValidado();
    const { body: creada } = await pedir(plan);

    expect((await como(correo).post(`/api/planes-accion/prorrogas/${creada.id}/aprobar`)).status).toBe(403);
    expect(await fechaDe(plan.id)).toBe("2025-12-15");
  });

  it("responde 404 si la solicitud no existe", async () => {
    expect((await como(JEFA).post("/api/planes-accion/prorrogas/999/aprobar")).status).toBe(404);
  });

  it("el portal le muestra su solicitud al responsable y no al asignado", async () => {
    const plan = await planValidado();
    await pedir(plan);

    expect((await como(RESPONSABLE).get("/api/planes-accion/mios")).body[0].prorroga).toMatchObject({ estado: "Pendiente" });
    expect((await como(ASIGNADO).get("/api/planes-accion/mios")).body[0].prorroga).toBeNull();
  });
});

describe("el flujo no se puede saltar", () => {
  it.each(["Pendiente", "En Revisión", "Aprobado", "Rechazado", "Borrador"])("PATCH no fija el estado %s en un plan validado", async (estado) => {
    const plan = await planValidado();

    const res = await como(AUDITORA).patch(`/api/planes-accion/${plan.id}`).send({ estado });

    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe("ESTADO_CONTROLADO_POR_FLUJO");
    expect(await estadoDe(plan.id)).toBe("Asignado");
  });

  it("un borrador no salta a un estado manual", async () => {
    const plan = await planBorrador();

    const res = await como(AUDITORA).patch(`/api/planes-accion/${plan.id}`).send({ estado: "En Progreso" });

    expect(res.status).toBe(409);
    expect(await estadoDe(plan.id)).toBe("Borrador");
  });

  it("PATCH sigue fijando los estados manuales en un plan validado", async () => {
    const plan = await planValidado();
    const res = await como(AUDITORA).patch(`/api/planes-accion/${plan.id}`).send({ estado: "En Progreso" });
    expect(res.status).toBe(200);
  });

  describe("si el plan se aprueba mientras llega una edición", () => {
    // La petición leyó el plan antes de la aprobación: buscarPorId entrega por una vez el plan anterior.
    async function planAprobadoConLecturaAnterior() {
      const plan = await planEnRevisionDeCierre();
      const anterior = (await planes.buscarPorId(plan.id))!;
      const editable = { ...anterior, estado: "Asignado" as const, status: "Asignado" as const };
      await como(JEFA).post(ruta(plan.id, "aprobar"));
      vi.spyOn(planes, "buscarPorId").mockResolvedValueOnce(editable);
      return plan;
    }

    it("la edición del plan responde 409 y no cambia el estado", async () => {
      const plan = await planAprobadoConLecturaAnterior();

      const res = await como(AUDITORA).patch(`/api/planes-accion/${plan.id}`).send({ estado: "En Progreso" });

      expect(res.status).toBe(409);
      expect(res.body.error.codigo).toBe("PLAN_BLOQUEADO");
      expect(await planes.buscarPorId(plan.id)).toMatchObject({ estado: "Aprobado", titulo: "Actualizar calendario" });
    });

    it("el cambio del paso responde 409 y no lo modifica", async () => {
      const plan = await planAprobadoConLecturaAnterior();
      const responsable = await idDe(RESPONSABLE);
      const paso = plan.pasos.find((p) => p.usuarioAsignado.id === responsable)!;

      const res = await como(RESPONSABLE).patch(rutaPaso(plan.id, paso.id)).send({ completado: false });

      expect(res.status).toBe(409);
      expect(res.body.error.codigo).toBe("PLAN_BLOQUEADO");
      expect((await planes.buscarPorId(plan.id))!.pasos.every((p) => p.completado)).toBe(true);
    });
  });

  describe.each([
    ["Pendiente", planPendienteDeCierre],
    ["En Revisión", planEnRevisionDeCierre],
    ["Aprobado", planAprobado],
  ] as const)("con el plan %s", (_estado, preparar) => {
    it("no se edita el plan", async () => {
      const plan = await preparar();
      const res = await como(AUDITORA).patch(`/api/planes-accion/${plan.id}`).send({ titulo: "Otro" });
      expect(res.status).toBe(409);
      expect(res.body.error.codigo).toBe("PLAN_BLOQUEADO");
    });

    it("no se cambia un paso", async () => {
      const plan = await preparar();
      const responsable = await idDe(RESPONSABLE);
      const paso = plan.pasos.find((p) => p.usuarioAsignado.id === responsable)!;
      const res = await como(RESPONSABLE).patch(rutaPaso(plan.id, paso.id)).send({ completado: false });
      expect(res.status).toBe(409);
      expect(res.body.error.codigo).toBe("PLAN_BLOQUEADO");
    });
  });
});
