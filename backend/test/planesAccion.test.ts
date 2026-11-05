import type { Server } from "node:http";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { crearApp } from "../src/app.js";
import { crearVerificadorDev } from "../src/auth/verificador.js";
import type { EventoBitacora } from "../src/bitacora.js";
import { MENSAJE_FECHA_ANTERIOR_AL_CIERRE } from "../src/domain/planesAccion.js";
import { RepositorioMemoria } from "../src/repos/memoria.js";
import { RepositorioEvidenciasMemoria } from "../src/repos/evidenciasMemoria.js";
import { RepositorioPlanesAccionMemoria } from "../src/repos/planesAccionMemoria.js";
import { RepositorioPlanesMemoria } from "../src/repos/planesMemoria.js";
import { escuchar } from "./servidor.js";

const JEFA = "m.garcia@expedite.com";
const AUDITORA = "a.rodriguez@expedite.com";
const AUDITADO = "j.ejemplo@expedite.com";
const SOLO_LECTURA = "d.torres@expedite.com";
const INACTIVO = "p.sanchez@expedite.com";

// HAL-2025-003 pertenece a AUD-003, cuya fecha de cierre es 2025-11-30.
const HALLAZGO = "HAL-2025-003";

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

async function planNuevo(cambios: Record<string, unknown> = {}) {
  return {
    hallazgoId: HALLAZGO,
    descripcion: "Actualizar el calendario normativo y asignar un responsable de seguimiento mensual.",
    responsableId: await idDe(AUDITADO),
    fechaCompromiso: "2025-12-15",
    ...cambios,
  };
}

describe("consulta de planes de acción", () => {
  it("exige sesión", async () => {
    expect((await request(app).get("/api/planes-accion")).status).toBe(401);
  });

  it("cualquier usuario con sesión ve los planes con el hallazgo y el responsable", async () => {
    const res = await como(SOLO_LECTURA).get("/api/planes-accion");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      expect.objectContaining({
        estado: "Asignado",
        fechaCompromiso: "2025-09-15",
        hallazgo: expect.objectContaining({ id: "HAL-2025-001", folio: "HAL-2025-001", fechaCierreAuditoria: "2025-08-31" }),
        responsable: { id: expect.any(Number), nombre: "Carlos Morales" },
      }),
    ]);
  });

  it("devuelve el hallazgo con la fecha de cierre de su auditoría, y 404 si no existe", async () => {
    const res = await como(AUDITORA).get(`/api/planes-accion/hallazgos/${HALLAZGO}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: HALLAZGO, auditoriaId: "AUD-003", fechaCierreAuditoria: "2025-11-30" });
    expect((await como(AUDITORA).get("/api/planes-accion/hallazgos/HAL-9999")).status).toBe(404);
  });

  it("lista solo auditados activos como posibles responsables", async () => {
    const res = await como(AUDITORA).get("/api/planes-accion/responsables");
    expect(res.status).toBe(200);
    expect(res.body).toContainEqual({ id: expect.any(Number), nombre: "Javier Ejemplo", correo: AUDITADO });
    expect(res.body.map((u: { correo: string }) => u.correo)).not.toContain(INACTIVO);
    expect(res.body.map((u: { correo: string }) => u.correo)).not.toContain(AUDITORA);
  });
});

describe("alta de planes de acción (criterio 1)", () => {
  it("una Auditora crea el plan en Borrador con su fecha límite y queda en la bitácora", async () => {
    const res = await como(AUDITORA).post("/api/planes-accion").send(await planNuevo());

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      estado: "Borrador",
      etapa: "definicion",
      fechaCompromiso: "2025-12-15",
      descripcion: "Actualizar el calendario normativo y asignar un responsable de seguimiento mensual.",
      hallazgo: expect.objectContaining({ id: HALLAZGO }),
      responsable: { id: await idDe(AUDITADO), nombre: "Javier Ejemplo" },
    });
    expect(eventos).toEqual([
      expect.objectContaining({ accion: "plan_accion.alta", actor: AUDITORA, detalle: expect.objectContaining({ hallazgoId: HALLAZGO }) }),
    ]);
    expect((await como(AUDITORA).get("/api/planes-accion")).body).toHaveLength(2);
  });

  it("la Jefa de Auditoría no crea planes: los valida", async () => {
    expect((await como(JEFA).post("/api/planes-accion").send(await planNuevo())).status).toBe(403);
  });

  it("un usuario de Solo Lectura no crea planes", async () => {
    const res = await como(SOLO_LECTURA).post("/api/planes-accion").send(await planNuevo());
    expect(res.status).toBe(403);
    expect(eventos).toEqual([]);
  });

  it("permite un segundo plan para el mismo hallazgo", async () => {
    const res = await como(AUDITORA).post("/api/planes-accion").send(await planNuevo({ hallazgoId: "HAL-2025-001" }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ hallazgo: { id: "HAL-2025-001" }, estado: "Borrador" });
  });

  it("responde 404 si el hallazgo no existe", async () => {
    expect((await como(AUDITORA).post("/api/planes-accion").send(await planNuevo({ hallazgoId: "HAL-9999" }))).status).toBe(404);
  });

  it.each([
    ["sin descripción", { descripcion: "  " }],
    ["sin responsable", { responsableId: undefined }],
    ["con fecha en formato inválido", { fechaCompromiso: "15/12/2025" }],
  ])("rechaza un plan %s", async (_caso, cambios) => {
    const res = await como(AUDITORA).post("/api/planes-accion").send(await planNuevo(cambios));
    expect(res.status).toBe(400);
    expect(res.body.error.codigo).toBe("DATOS_INVALIDOS");
  });

  it("rechaza un responsable inactivo", async () => {
    const res = await como(AUDITORA).post("/api/planes-accion").send(await planNuevo({ responsableId: await idDe(INACTIVO) }));
    expect(res.status).toBe(400);
  });
});

describe("fecha de compromiso contra el cierre de la auditoría (criterio 2)", () => {
  it("rechaza una fecha anterior al cierre con un mensaje explícito", async () => {
    const res = await como(AUDITORA).post("/api/planes-accion").send(await planNuevo({ fechaCompromiso: "2025-11-29" }));

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ codigo: "DATOS_INVALIDOS", mensaje: MENSAJE_FECHA_ANTERIOR_AL_CIERRE });
    expect(eventos).toEqual([]);
  });

  it("acepta una fecha igual al cierre de la auditoría", async () => {
    const res = await como(AUDITORA).post("/api/planes-accion").send(await planNuevo({ fechaCompromiso: "2025-11-30" }));
    expect(res.status).toBe(201);
  });
});

describe("portal del auditado (criterio 3)", () => {
  it("un usuario sin planes asignados recibe una lista vacía", async () => {
    expect((await como(SOLO_LECTURA).get("/api/planes-accion/mios")).body).toEqual([]);
  });
});

describe("edición de planes de acción por el equipo de auditoría", () => {
  // Plan de prueba: HAL-2025-001, auditoría con cierre 2025-08-31, fecha de compromiso 2025-09-15.
  const planSembrado = async () => (await como(AUDITORA).get("/api/planes-accion")).body[0];

  it("una Auditora cambia el responsable y el estado de un plan validado, y queda en la bitácora con valores anterior y nuevo", async () => {
    const plan = await planSembrado();
    const javier = await idDe(AUDITADO);

    const res = await como(AUDITORA)
      .patch(`/api/planes-accion/${plan.id}`)
      .send({ responsableId: javier, estado: "En Progreso" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: plan.id,
      responsable: { id: javier, nombre: "Javier Ejemplo" },
      fechaCompromiso: "2025-09-15",
      estado: "En Progreso",
      hallazgo: expect.objectContaining({ id: "HAL-2025-001" }),
    });
    expect(eventos).toEqual([
      expect.objectContaining({
        accion: "plan_accion.edicion",
        actor: AUDITORA,
        detalle: expect.objectContaining({
          planAccionId: plan.id,
          cambios: {
            responsableId: { anterior: plan.responsable.id, nuevo: javier },
            estado: { anterior: "Asignado", nuevo: "En Progreso" },
          },
        }),
      }),
    ]);
    expect((await como(AUDITORA).get("/api/planes-accion")).body[0].estado).toBe("En Progreso");
  });

  it("permite cambiar un solo campo sin tocar los demás", async () => {
    const plan = await planSembrado();
    const res = await como(AUDITORA).patch(`/api/planes-accion/${plan.id}`).send({ estado: "Completado" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ estado: "Completado", descripcion: plan.descripcion, fechaCompromiso: plan.fechaCompromiso });
    expect(eventos[0]!.detalle.cambios).toEqual({ estado: { anterior: "Asignado", nuevo: "Completado" } });
  });

  it("el responsable no puede editar su plan aunque su rol sea Auditor", async () => {
    const laura = await idDe("l.fernandez@expedite.com");
    const propio = await planes.crear(await planNuevo({ responsableId: laura }), await idDe(AUDITORA));

    const res = await como("l.fernandez@expedite.com").patch(`/api/planes-accion/${propio.id}`).send({ estado: "Completado" });

    expect(res.status).toBe(403);
    expect(res.body.error.codigo).toBe("RESPONSABLE_NO_EDITA");
    expect(eventos.filter((e) => e.accion === "plan_accion.edicion")).toEqual([]);
  });

  it("un usuario de Solo Lectura no puede editar", async () => {
    const plan = await planSembrado();
    expect((await como(SOLO_LECTURA).patch(`/api/planes-accion/${plan.id}`).send({ estado: "Completado" })).status).toBe(403);
  });

  it("rechaza una fecha anterior al cierre de la auditoría con el mismo mensaje del alta", async () => {
    const plan = (await como(AUDITORA).post("/api/planes-accion").send(await planNuevo())).body;
    eventos.length = 0;
    const res = await como(AUDITORA).patch(`/api/planes-accion/${plan.id}`).send({ fechaCompromiso: "2025-08-30" });

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ codigo: "DATOS_INVALIDOS", mensaje: MENSAJE_FECHA_ANTERIOR_AL_CIERRE });
    expect(eventos).toEqual([]);
  });

  it.each([
    ["un estado inexistente", { estado: "Cancelado" }],
    ["una descripción vacía", { descripcion: "  " }],
    ["una fecha con formato inválido", { fechaCompromiso: "01/10/2025" }],
    ["ningún campo editable", { hallazgoId: "HAL-2025-003" }],
  ])("rechaza %s", async (_caso, cambios) => {
    const plan = (await como(AUDITORA).post("/api/planes-accion").send(await planNuevo())).body;
    const res = await como(AUDITORA).patch(`/api/planes-accion/${plan.id}`).send(cambios);
    expect(res.status).toBe(400);
    expect(res.body.error.codigo).toBe("DATOS_INVALIDOS");
  });

  it("rechaza un responsable inactivo", async () => {
    const plan = await planSembrado();
    const res = await como(AUDITORA).patch(`/api/planes-accion/${plan.id}`).send({ responsableId: await idDe(INACTIVO) });
    expect(res.status).toBe(400);
  });

  it("no registra evento si los valores no cambian", async () => {
    const plan = await planSembrado();
    const res = await como(AUDITORA).patch(`/api/planes-accion/${plan.id}`).send({ estado: "Asignado" });
    expect(res.status).toBe(200);
    expect(eventos).toEqual([]);
  });

  it("responde 404 si el plan no existe", async () => {
    expect((await como(AUDITORA).patch("/api/planes-accion/9999").send({ estado: "Completado" })).status).toBe(404);
    expect((await como(AUDITORA).patch("/api/planes-accion/abc").send({ estado: "Completado" })).status).toBe(404);
  });
});
