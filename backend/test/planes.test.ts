import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { crearApp } from "../src/app.js";
import { crearVerificadorDev } from "../src/auth/verificador.js";
import type { EventoBitacora } from "../src/bitacora.js";
import { RepositorioMemoria } from "../src/repos/memoria.js";
import { RepositorioPlanesMemoria } from "../src/repos/planesMemoria.js";

const ADMIN = "s.ramirez@expedite.com";
const JEFA = "m.garcia@expedite.com";
const AUDITORA = "a.rodriguez@expedite.com";
const INACTIVO = "p.sanchez@expedite.com";

let app: ReturnType<typeof crearApp>;
let usuarios: RepositorioMemoria;
let eventos: EventoBitacora[];

beforeEach(() => {
  eventos = [];
  usuarios = new RepositorioMemoria();
  app = crearApp({
    repo: usuarios,
    repoPlanes: new RepositorioPlanesMemoria(usuarios),
    verificador: crearVerificadorDev(),
    dominiosPermitidos: ["expedite.com"],
    corsOrigin: "http://localhost:5173",
    registrarEvento: (evento) => eventos.push(evento),
  });
});

const como = (correo: string) => ({
  get: (ruta: string) => request(app).get(ruta).set("X-Dev-Usuario", correo),
  post: (ruta: string) => request(app).post(ruta).set("X-Dev-Usuario", correo),
  patch: (ruta: string) => request(app).patch(ruta).set("X-Dev-Usuario", correo),
});

const idDe = async (correo: string) => (await usuarios.buscarPorCorreo(correo))!.id;

async function planNuevo(cambios: Record<string, unknown> = {}) {
  return {
    codigo: "PAI-2026-001",
    nombre: "Plan Anual de Auditoría 2026",
    tipo: "Anual",
    periodo: "Anual 2026",
    fechaInicio: "2026-01-01",
    fechaFin: "2026-12-31",
    horasEstimadas: 1200,
    responsableId: await idDe(JEFA),
    alcance: "Finanzas, TI y cumplimiento regulatorio",
    ...cambios,
  };
}

describe("consulta de planes", () => {
  it("exige sesión", async () => {
    expect((await request(app).get("/api/planes")).status).toBe(401);
  });

  it("cualquier usuario con sesión ve la lista con el nombre del responsable", async () => {
    const res = await como(AUDITORA).get("/api/planes");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    expect(res.body).toContainEqual(
      expect.objectContaining({ codigo: "PAI-2025-002", responsable: { id: expect.any(Number), nombre: "Carlos Morales" } }),
    );
  });

  it("consulta un plan por id y responde 404 si no existe", async () => {
    const [primero] = (await como(AUDITORA).get("/api/planes")).body;

    expect((await como(AUDITORA).get(`/api/planes/${primero.id}`)).body.codigo).toBe(primero.codigo);
    expect((await como(AUDITORA).get("/api/planes/999")).status).toBe(404);
  });
});

describe("alta de planes", () => {
  it("la Jefa de Auditoría crea un plan en Borrador y queda en la bitácora", async () => {
    const res = await como(JEFA).post("/api/planes").send(await planNuevo());

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ codigo: "PAI-2026-001", tipo: "Anual", estado: "Borrador", responsable: { nombre: "María García" } });
    expect(eventos).toEqual([expect.objectContaining({ accion: "plan.alta", actor: JEFA })]);
    expect((await como(AUDITORA).get("/api/planes")).body).toHaveLength(5);
  });

  it("el Administrador también puede crear", async () => {
    expect((await como(ADMIN).post("/api/planes").send(await planNuevo())).status).toBe(201);
  });

  it("un Auditor no puede crear planes", async () => {
    const res = await como(AUDITORA).post("/api/planes").send(await planNuevo());
    expect(res.status).toBe(403);
    expect(eventos).toEqual([]);
  });

  it("rechaza un código repetido", async () => {
    const res = await como(JEFA).post("/api/planes").send(await planNuevo({ codigo: "pai-2025-001" }));
    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe("CODIGO_DUPLICADO");
  });

  it.each([
    ["sin nombre", { nombre: "" }],
    ["sin tipo", { tipo: undefined }],
    ["con un tipo que no es Anual ni Trimestral", { tipo: "Semestral" }],
    ["fecha de fin anterior al inicio", { fechaFin: "2025-12-31" }],
    ["fecha con formato inválido", { fechaInicio: "01/01/2026" }],
    ["horas en cero", { horasEstimadas: 0 }],
    ["estado inexistente", { estado: "Cancelado" }],
  ])("rechaza un plan %s", async (_caso, cambios) => {
    const res = await como(JEFA).post("/api/planes").send(await planNuevo(cambios));
    expect(res.status).toBe(400);
    expect(res.body.error.codigo).toBe("DATOS_INVALIDOS");
  });

  it("rechaza un responsable inactivo", async () => {
    const res = await como(JEFA).post("/api/planes").send(await planNuevo({ responsableId: await idDe(INACTIVO) }));
    expect(res.status).toBe(400);
  });
});

describe("edición de planes", () => {
  it("la Jefa de Auditoría edita solo los campos enviados y queda en la bitácora", async () => {
    const creado = (await como(JEFA).post("/api/planes").send(await planNuevo())).body;
    eventos = [];

    const res = await como(JEFA).patch(`/api/planes/${creado.id}`).send({ horasEstimadas: 1500, estado: "Aprobado" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ horasEstimadas: 1500, estado: "Aprobado", nombre: "Plan Anual de Auditoría 2026" });
    expect(eventos).toEqual([expect.objectContaining({ accion: "plan.edicion", detalle: expect.objectContaining({ campos: ["horasEstimadas", "estado"] }) })]);
  });

  it("cambia un plan de anual a trimestral", async () => {
    const creado = (await como(JEFA).post("/api/planes").send(await planNuevo())).body;
    const res = await como(JEFA).patch(`/api/planes/${creado.id}`).send({ tipo: "Trimestral", periodo: "Q1 2026", fechaFin: "2026-03-31" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ tipo: "Trimestral", periodo: "Q1 2026" });
  });

  it("valida contra las fechas que ya tiene el plan", async () => {
    const creado = (await como(JEFA).post("/api/planes").send(await planNuevo())).body;
    expect((await como(JEFA).patch(`/api/planes/${creado.id}`).send({ fechaFin: "2025-06-30" })).status).toBe(400);
  });

  it("un Auditor no puede editar", async () => {
    const [primero] = (await como(AUDITORA).get("/api/planes")).body;
    expect((await como(AUDITORA).patch(`/api/planes/${primero.id}`).send({ horasEstimadas: 1 })).status).toBe(403);
  });

  it("responde 404 si el plan no existe", async () => {
    expect((await como(JEFA).patch("/api/planes/999").send({ nombre: "X" })).status).toBe(404);
  });
});
