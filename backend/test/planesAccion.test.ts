import type { Server } from "node:http";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { crearApp } from "../src/app.js";
import { crearVerificadorDev } from "../src/auth/verificador.js";
import type { EventoBitacora } from "../src/bitacora.js";
import { MENSAJE_FECHA_ANTERIOR_AL_CIERRE } from "../src/domain/planesAccion.js";
import { RepositorioMemoria } from "../src/repos/memoria.js";
import { RepositorioPlanesAccionMemoria } from "../src/repos/planesAccionMemoria.js";
import { RepositorioPlanesMemoria } from "../src/repos/planesMemoria.js";
import { escuchar } from "./servidor.js";

const JEFA = "m.garcia@expedite.com";
const AUDITORA = "a.rodriguez@expedite.com";
const AUDITADO = "l.fernandez@expedite.com";
const SOLO_LECTURA = "d.torres@expedite.com";
const INACTIVO = "p.sanchez@expedite.com";

// HAL-2025-003 pertenece a AUD-003, cuya fecha de cierre es 2025-11-30.
const HALLAZGO = "HAL-2025-003";

let app: Server;
let usuarios: RepositorioMemoria;
let eventos: EventoBitacora[];

beforeEach(async () => {
  eventos = [];
  usuarios = new RepositorioMemoria();
  app = await escuchar(
    crearApp({
      repo: usuarios,
      repoPlanes: new RepositorioPlanesMemoria(usuarios),
      repoPlanesAccion: new RepositorioPlanesAccionMemoria(usuarios),
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

  it("lista solo usuarios activos como posibles responsables", async () => {
    const res = await como(AUDITORA).get("/api/planes-accion/responsables");
    expect(res.status).toBe(200);
    expect(res.body).toContainEqual({ id: expect.any(Number), nombre: "Laura Fernández", correo: AUDITADO });
    expect(res.body.map((u: { correo: string }) => u.correo)).not.toContain(INACTIVO);
  });
});

describe("alta de planes de acción (criterio 1)", () => {
  it("una Auditora crea el plan en estado Asignado con su fecha límite y queda en la bitácora", async () => {
    const res = await como(AUDITORA).post("/api/planes-accion").send(await planNuevo());

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      estado: "Asignado",
      fechaCompromiso: "2025-12-15",
      descripcion: "Actualizar el calendario normativo y asignar un responsable de seguimiento mensual.",
      hallazgo: expect.objectContaining({ id: HALLAZGO }),
      responsable: { id: await idDe(AUDITADO), nombre: "Laura Fernández" },
    });
    expect(eventos).toEqual([
      expect.objectContaining({ accion: "plan_accion.alta", actor: AUDITORA, detalle: expect.objectContaining({ hallazgoId: HALLAZGO }) }),
    ]);
    expect((await como(AUDITORA).get("/api/planes-accion")).body).toHaveLength(2);
  });

  it("la Jefa de Auditoría también puede crear", async () => {
    expect((await como(JEFA).post("/api/planes-accion").send(await planNuevo())).status).toBe(201);
  });

  it("un usuario de Solo Lectura no puede crear", async () => {
    const res = await como(SOLO_LECTURA).post("/api/planes-accion").send(await planNuevo());
    expect(res.status).toBe(403);
    expect(eventos).toEqual([]);
  });

  it("rechaza un segundo plan para el mismo hallazgo", async () => {
    const res = await como(AUDITORA).post("/api/planes-accion").send(await planNuevo({ hallazgoId: "HAL-2025-001" }));
    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe("PLAN_DUPLICADO");
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
  it("el responsable ve solo los planes que le fueron asignados, con descripción, fecha límite y estado", async () => {
    await como(AUDITORA).post("/api/planes-accion").send(await planNuevo());

    const res = await como(AUDITADO).get("/api/planes-accion/mios");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      expect.objectContaining({
        descripcion: "Actualizar el calendario normativo y asignar un responsable de seguimiento mensual.",
        fechaCompromiso: "2025-12-15",
        estado: "Asignado",
        hallazgo: expect.objectContaining({ folio: HALLAZGO }),
      }),
    ]);
  });

  it("un usuario sin planes asignados recibe una lista vacía", async () => {
    expect((await como(SOLO_LECTURA).get("/api/planes-accion/mios")).body).toEqual([]);
  });
});
