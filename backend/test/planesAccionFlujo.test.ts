import type { Server } from "node:http";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
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
const RESPONSABLE = "l.fernandez@expedite.com";
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

const idDe = async (correo: string) => (await usuarios.buscarPorCorreo(correo))!.id;
const ruta = (id: number, accion: string) => `/api/planes-accion/${id}/${accion}`;
const estadoDe = async (id: number) => (await planes.buscarPorId(id))!.estado;
const flujoDe = async (id: number) => (await como(JEFA).get(ruta(id, "flujo"))).body;

/** Plan de la Auditora: responsable Laura, con un paso de Laura y otro de Charlie, en estado Asignado. */
async function planNuevo(cambios: Record<string, unknown> = {}) {
  const res = await como(AUDITORA)
    .post("/api/planes-accion")
    .send({
      hallazgoId: "HAL-2025-003",
      titulo: "Actualizar calendario",
      descripcion: "Calendario normativo desactualizado.",
      responsableId: await idDe(RESPONSABLE),
      fechaCompromiso: "2025-12-15",
      pasos: [
        { descripcion: "Revisar normas", usuarioAsignadoId: await idDe(RESPONSABLE), fechaCompromiso: "2025-12-01" },
        { descripcion: "Publicar calendario", usuarioAsignadoId: await idDe(ASIGNADO), fechaCompromiso: "2025-12-10" },
      ],
      ...cambios,
    });
  expect(res.status).toBe(201);
  return res.body as { id: number; publicId: string; pasos: { id: number; usuarioAsignado: { id: number } }[] };
}

async function completarPasos(plan: Awaited<ReturnType<typeof planNuevo>>) {
  for (const paso of plan.pasos) {
    const correo = paso.usuarioAsignado.id === (await idDe(RESPONSABLE)) ? RESPONSABLE : ASIGNADO;
    const res = await como(correo).patch(`/api/planes-accion/${plan.id}/pasos/${paso.id}`).send({ completado: true });
    expect(res.status).toBe(200);
  }
}

async function planPendiente() {
  const plan = await planNuevo();
  await completarPasos(plan);
  const res = await como(RESPONSABLE).post(ruta(plan.id, "enviar-revision"));
  expect(res.status).toBe(200);
  return plan;
}

async function planEnRevision() {
  const plan = await planPendiente();
  expect((await como(JEFA).post(ruta(plan.id, "abrir-revision"))).status).toBe(200);
  return plan;
}

describe("envío a revisión", () => {
  it("el responsable envía el plan completo y queda Pendiente con su evento", async () => {
    const plan = await planNuevo();
    await completarPasos(plan);

    const res = await como(RESPONSABLE).post(ruta(plan.id, "enviar-revision"));

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("Pendiente");
    expect((await flujoDe(plan.id)).eventos).toEqual([
      expect.objectContaining({ accion: "envio", estadoAnterior: "Asignado", estadoNuevo: "Pendiente" }),
    ]);
    expect(eventos.map((e) => e.accion)).toContain("plan_accion.envio_revision");
  });

  it("avisa a los revisores activos", async () => {
    const plan = await planPendiente();

    expect(await planes.listarNotificaciones(await idDe(JEFA))).toEqual([
      expect.objectContaining({ mensaje: expect.stringContaining(plan.publicId), leida: false }),
    ]);
    expect(await planes.listarNotificaciones(await idDe(ADMIN))).toHaveLength(1);
    expect(await planes.listarNotificaciones(await idDe(AUDITORA))).toEqual([]);
  });

  it("no avisa a un revisor que está impedido en ese plan", async () => {
    const plan = await planNuevo({ responsableId: await idDe(JEFA), pasos: [
      { descripcion: "Único paso", usuarioAsignadoId: await idDe(JEFA), fechaCompromiso: "2025-12-01" },
    ] });
    await como(JEFA).patch(`/api/planes-accion/${plan.id}/pasos/${plan.pasos[0]!.id}`).send({ completado: true });

    expect((await como(JEFA).post(ruta(plan.id, "enviar-revision"))).status).toBe(200);

    expect(await planes.listarNotificaciones(await idDe(JEFA))).toEqual([]);
    expect(await planes.listarNotificaciones(await idDe(ADMIN))).toHaveLength(1);
  });

  it("solo el responsable puede enviarlo", async () => {
    const plan = await planNuevo();
    await completarPasos(plan);

    const res = await como(ASIGNADO).post(ruta(plan.id, "enviar-revision"));

    expect(res.status).toBe(403);
    expect(res.body.error.codigo).toBe("NO_RESPONSABLE");
    expect(await estadoDe(plan.id)).toBe("Asignado");
  });

  it("rechaza el envío con pasos incompletos", async () => {
    const plan = await planNuevo();

    const res = await como(RESPONSABLE).post(ruta(plan.id, "enviar-revision"));

    expect(res.status).toBe(400);
    expect(res.body.error.codigo).toBe("PASOS_PENDIENTES");
  });

  it("rechaza el envío de un plan sin pasos", async () => {
    const plan = await planNuevo({ pasos: [] });
    expect((await como(RESPONSABLE).post(ruta(plan.id, "enviar-revision"))).status).toBe(400);
  });

  it("no se envía dos veces", async () => {
    const plan = await planPendiente();

    const res = await como(RESPONSABLE).post(ruta(plan.id, "enviar-revision"));

    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe("ESTADO_INVALIDO");
  });

  it("responde 404 si el plan no existe", async () => {
    expect((await como(RESPONSABLE).post(ruta(9999, "enviar-revision"))).status).toBe(404);
  });
});

describe("criterio 1: abrir un plan pendiente", () => {
  it("cambia a En Revisión y lo registra en la bitácora del flujo", async () => {
    const plan = await planPendiente();

    const res = await como(JEFA).post(ruta(plan.id, "abrir-revision"));

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("En Revisión");
    expect((await flujoDe(plan.id)).eventos.at(-1)).toMatchObject({
      accion: "apertura",
      estadoAnterior: "Pendiente",
      estadoNuevo: "En Revisión",
      actor: { id: await idDe(JEFA), nombre: "María García", rol: "Jefe de Auditoría" },
    });
    expect(eventos.map((e) => e.accion)).toContain("plan_accion.apertura_revision");
  });

  it("abrirlo otra vez no agrega eventos", async () => {
    const plan = await planEnRevision();
    const antes = (await flujoDe(plan.id)).eventos.length;

    const res = await como(ADMIN).post(ruta(plan.id, "abrir-revision"));

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("En Revisión");
    expect((await flujoDe(plan.id)).eventos).toHaveLength(antes);
  });

  it("de dos aperturas simultáneas queda un solo evento y ambas responden 200", async () => {
    const plan = await planPendiente();

    const respuestas = await Promise.all([
      como(JEFA).post(ruta(plan.id, "abrir-revision")),
      como(ADMIN).post(ruta(plan.id, "abrir-revision")),
    ]);

    expect(respuestas.map((r) => r.status)).toEqual([200, 200]);
    expect((await flujoDe(plan.id)).eventos.filter((e: { accion: string }) => e.accion === "apertura")).toHaveLength(1);
  });

  it("no abre un plan que no se ha enviado", async () => {
    const plan = await planNuevo();

    const res = await como(JEFA).post(ruta(plan.id, "abrir-revision"));

    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe("ESTADO_INVALIDO");
  });
});

describe("criterio 2: aprobar", () => {
  it("cambia a Aprobado y registra la firma con firmante, rol, fecha y huella", async () => {
    const plan = await planEnRevision();

    const res = await como(JEFA).post(ruta(plan.id, "aprobar"));

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("Aprobado");
    const { eventos: historial, firmaIntegra } = await flujoDe(plan.id);
    expect(historial.at(-1)).toMatchObject({
      accion: "aprobacion",
      estadoAnterior: "En Revisión",
      estadoNuevo: "Aprobado",
      actor: { id: await idDe(JEFA), nombre: "María García", rol: "Jefe de Auditoría" },
      firmaHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      fecha: expect.any(String),
    });
    expect(firmaIntegra).toBe(true);
    expect(eventos.find((e) => e.accion === "plan_accion.aprobacion")?.detalle.firmaHash).toBe(historial.at(-1).firmaHash);
  });

  it("avisa una vez al responsable, a los asignados y a quien creó el plan, pero no a quien aprobó", async () => {
    const plan = await planEnRevision();
    await planes.marcarTodasLeidas(await idDe(JEFA));

    await como(JEFA).post(ruta(plan.id, "aprobar"));

    for (const correo of [RESPONSABLE, ASIGNADO, AUDITORA]) {
      const avisos = await planes.listarNotificaciones(await idDe(correo));
      expect(avisos.filter((a) => a.tipo === "plan_accion.aprobacion")).toEqual([
        expect.objectContaining({ mensaje: expect.stringContaining(plan.publicId), leida: false }),
      ]);
    }
    const propios = await planes.listarNotificaciones(await idDe(JEFA));
    expect(propios.filter((a) => a.tipo === "plan_accion.aprobacion")).toEqual([]);
  });

  it("no aprueba un plan que no se ha abierto", async () => {
    const plan = await planPendiente();

    const res = await como(JEFA).post(ruta(plan.id, "aprobar"));

    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe("ESTADO_INVALIDO");
    expect(await estadoDe(plan.id)).toBe("Pendiente");
  });

  it("no aprueba dos veces", async () => {
    const plan = await planEnRevision();
    await como(JEFA).post(ruta(plan.id, "aprobar"));

    expect((await como(ADMIN).post(ruta(plan.id, "aprobar"))).status).toBe(409);
  });

  it("de dos aprobaciones simultáneas solo una se aplica", async () => {
    const plan = await planEnRevision();

    const respuestas = await Promise.all([
      como(JEFA).post(ruta(plan.id, "aprobar")),
      como(ADMIN).post(ruta(plan.id, "aprobar")),
    ]);

    expect(respuestas.map((r) => r.status).sort()).toEqual([200, 409]);
    const historial = (await flujoDe(plan.id)).eventos;
    expect(historial.filter((e: { accion: string }) => e.accion === "aprobacion")).toHaveLength(1);
    const avisos = await planes.listarNotificaciones(await idDe(RESPONSABLE));
    expect(avisos.filter((a) => a.tipo === "plan_accion.aprobacion")).toHaveLength(1);
  });

  it("firmaIntegra es null si el plan no se ha aprobado", async () => {
    const plan = await planEnRevision();
    expect((await flujoDe(plan.id)).firmaIntegra).toBeNull();
  });

  it("firmaIntegra es falso si el contenido cambia después de la firma", async () => {
    const plan = await planEnRevision();
    await como(JEFA).post(ruta(plan.id, "aprobar"));
    // Cambio directo en el repositorio: simula una modificación que no pasó por las rutas.
    await planes.actualizarPaso(plan.id, plan.pasos[0]!.id, false);

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
    const plan = await planEnRevision();
    const antes = (await flujoDe(plan.id)).eventos.length;
    const avisosAntes = (await planes.listarNotificaciones(await idDe(RESPONSABLE))).length;

    const res = await como(JEFA).post(ruta(plan.id, "rechazar")).send(cuerpo);

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ codigo: "MOTIVO_OBLIGATORIO", mensaje: "El motivo de rechazo es obligatorio." });
    expect(await estadoDe(plan.id)).toBe("En Revisión");
    expect((await flujoDe(plan.id)).eventos).toHaveLength(antes);
    expect(await planes.listarNotificaciones(await idDe(RESPONSABLE))).toHaveLength(avisosAntes);
  });

  it("rechaza un motivo demasiado largo", async () => {
    const plan = await planEnRevision();
    const res = await como(JEFA).post(ruta(plan.id, "rechazar")).send({ motivo: "a".repeat(2001) });
    expect(res.status).toBe(400);
    expect(res.body.error.codigo).toBe("MOTIVO_OBLIGATORIO");
  });

  it("con motivo cambia a Rechazado, guarda el motivo sin espacios y avisa con él", async () => {
    const plan = await planEnRevision();

    const res = await como(JEFA).post(ruta(plan.id, "rechazar")).send({ motivo: "  Falta evidencia  " });

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("Rechazado");
    expect((await flujoDe(plan.id)).eventos.at(-1)).toMatchObject({
      accion: "rechazo",
      estadoNuevo: "Rechazado",
      motivo: "Falta evidencia",
      firmaHash: null,
    });
    const avisos = await planes.listarNotificaciones(await idDe(RESPONSABLE));
    expect(avisos.find((a) => a.tipo === "plan_accion.rechazo")?.mensaje).toContain("Falta evidencia");
    expect(eventos.map((e) => e.accion)).toContain("plan_accion.rechazo");
  });

  it("no rechaza un plan pendiente sin abrir", async () => {
    const plan = await planPendiente();
    const res = await como(JEFA).post(ruta(plan.id, "rechazar")).send({ motivo: "Falta evidencia" });
    expect(res.status).toBe(409);
  });
});

describe("corrección y reenvío tras un rechazo", () => {
  async function planRechazado() {
    const plan = await planEnRevision();
    await como(JEFA).post(ruta(plan.id, "rechazar")).send({ motivo: "Falta evidencia" });
    return plan;
  }

  it("permite cambiar pasos y reenviar, y conserva todo el historial en orden", async () => {
    const plan = await planRechazado();
    const paso = plan.pasos[0]!;

    expect((await como(RESPONSABLE).patch(`/api/planes-accion/${plan.id}/pasos/${paso.id}`).send({ completado: false })).status).toBe(200);
    expect((await como(RESPONSABLE).post(ruta(plan.id, "enviar-revision"))).status).toBe(400);
    expect((await como(RESPONSABLE).patch(`/api/planes-accion/${plan.id}/pasos/${paso.id}`).send({ completado: true })).status).toBe(200);

    const res = await como(RESPONSABLE).post(ruta(plan.id, "enviar-revision"));

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("Pendiente");
    expect((await flujoDe(plan.id)).eventos.map((e: { accion: string }) => e.accion)).toEqual(["envio", "apertura", "rechazo", "envio"]);
  });

  it("se puede aprobar tras el reenvío", async () => {
    const plan = await planRechazado();
    await como(RESPONSABLE).post(ruta(plan.id, "enviar-revision"));
    await como(JEFA).post(ruta(plan.id, "abrir-revision"));

    const res = await como(JEFA).post(ruta(plan.id, "aprobar"));

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe("Aprobado");
  });

  it("en Rechazado el equipo edita los datos pero no el estado", async () => {
    const plan = await planRechazado();

    expect((await como(JEFA).patch(`/api/planes-accion/${plan.id}`).send({ titulo: "Título corregido" })).status).toBe(200);

    const res = await como(JEFA).patch(`/api/planes-accion/${plan.id}`).send({ estado: "Asignado" });
    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe("ESTADO_CONTROLADO_POR_FLUJO");
    expect(await estadoDe(plan.id)).toBe("Rechazado");
  });
});

describe("quién puede revisar", () => {
  it.each([
    ["abrir-revision", planPendiente],
    ["aprobar", planEnRevision],
    ["rechazar", planEnRevision],
  ] as const)("un Auditor Senior no puede %s", async (accion, preparar) => {
    const plan = await preparar();
    const antes = await estadoDe(plan.id);

    const res = await como(SENIOR).post(ruta(plan.id, accion)).send({ motivo: "Falta evidencia" });

    expect(res.status).toBe(403);
    expect(res.body.error.codigo).toBe("ROL_NO_AUTORIZADO");
    expect(await estadoDe(plan.id)).toBe(antes);
  });

  it("el Administrador también revisa", async () => {
    const plan = await planPendiente();
    expect((await como(ADMIN).post(ruta(plan.id, "abrir-revision"))).status).toBe(200);
    expect((await como(ADMIN).post(ruta(plan.id, "aprobar"))).status).toBe(200);
  });

  it("una Jefa responsable del plan está impedida y el plan sigue Pendiente", async () => {
    const plan = await planNuevo({ responsableId: await idDe(JEFA), pasos: [
      { descripcion: "Único paso", usuarioAsignadoId: await idDe(ASIGNADO), fechaCompromiso: "2025-12-01" },
    ] });
    await completarPasos(plan);
    await como(JEFA).post(ruta(plan.id, "enviar-revision"));

    const res = await como(JEFA).post(ruta(plan.id, "abrir-revision"));

    expect(res.status).toBe(403);
    expect(res.body.error.codigo).toBe("REVISOR_IMPEDIDO");
    expect(await estadoDe(plan.id)).toBe("Pendiente");
  });

  it("una Jefa con un paso asignado está impedida para aprobar", async () => {
    const plan = await planNuevo({ pasos: [
      { descripcion: "Paso de la jefa", usuarioAsignadoId: await idDe(JEFA), fechaCompromiso: "2025-12-01" },
    ] });
    await como(JEFA).patch(`/api/planes-accion/${plan.id}/pasos/${plan.pasos[0]!.id}`).send({ completado: true });
    await como(RESPONSABLE).post(ruta(plan.id, "enviar-revision"));
    await como(ADMIN).post(ruta(plan.id, "abrir-revision"));

    const res = await como(JEFA).post(ruta(plan.id, "aprobar"));

    expect(res.status).toBe(403);
    expect(res.body.error.codigo).toBe("REVISOR_IMPEDIDO");
    expect(await estadoDe(plan.id)).toBe("En Revisión");
  });
});

describe("bandeja de revisión", () => {
  it("lista los planes en estados de revisión y no los demás", async () => {
    const pendiente = await planPendiente();
    const sinEnviar = await planNuevo();

    const res = await como(JEFA).get("/api/planes-accion/revision");

    expect(res.status).toBe(200);
    const ids = res.body.map((p: { id: number }) => p.id);
    expect(ids).toContain(pendiente.id);
    expect(ids).not.toContain(sinEnviar.id);
  });

  it("un Auditor no la consulta", async () => {
    expect((await como(AUDITORA).get("/api/planes-accion/revision")).status).toBe(403);
  });
});

describe("consulta del flujo", () => {
  it("la consultan el equipo de auditoría, el responsable y los asignados", async () => {
    const plan = await planPendiente();
    for (const correo of [AUDITORA, RESPONSABLE, ASIGNADO, JEFA]) {
      expect((await como(correo).get(ruta(plan.id, "flujo"))).status).toBe(200);
    }
  });

  it("no la consulta un usuario ajeno al plan", async () => {
    const plan = await planPendiente();
    expect((await como(AJENO).get(ruta(plan.id, "flujo"))).status).toBe(403);
  });

  it("responde 404 si el plan no existe", async () => {
    expect((await como(JEFA).get(ruta(9999, "flujo"))).status).toBe(404);
  });
});

describe("el flujo no se puede saltar", () => {
  it.each(["Pendiente", "En Revisión", "Aprobado", "Rechazado"])("PATCH no fija el estado %s", async (estado) => {
    const plan = await planNuevo();

    const res = await como(JEFA).patch(`/api/planes-accion/${plan.id}`).send({ estado });

    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe("ESTADO_CONTROLADO_POR_FLUJO");
    expect(await estadoDe(plan.id)).toBe("Asignado");
  });

  it("PATCH sigue fijando los estados manuales", async () => {
    const plan = await planNuevo();
    const res = await como(JEFA).patch(`/api/planes-accion/${plan.id}`).send({ estado: "En Progreso" });
    expect(res.status).toBe(200);
  });

  describe.each([
    ["Pendiente", planPendiente],
    ["En Revisión", planEnRevision],
    [
      "Aprobado",
      async () => {
        const plan = await planEnRevision();
        await como(JEFA).post(ruta(plan.id, "aprobar"));
        return plan;
      },
    ],
  ] as const)("con el plan %s", (_estado, preparar) => {
    it("no se edita el plan", async () => {
      const plan = await preparar();
      const res = await como(JEFA).patch(`/api/planes-accion/${plan.id}`).send({ titulo: "Otro" });
      expect(res.status).toBe(409);
      expect(res.body.error.codigo).toBe("PLAN_BLOQUEADO");
    });

    it("no se cambia un paso", async () => {
      const plan = await preparar();
      const paso = plan.pasos[0]!;
      const res = await como(RESPONSABLE).patch(`/api/planes-accion/${plan.id}/pasos/${paso.id}`).send({ completado: false });
      expect(res.status).toBe(409);
      expect(res.body.error.codigo).toBe("PLAN_BLOQUEADO");
    });
  });
});
