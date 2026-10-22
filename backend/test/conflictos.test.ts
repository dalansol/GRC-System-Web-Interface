import type { Server } from "node:http";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { crearApp } from "../src/app.js";
import { crearVerificadorDev } from "../src/auth/verificador.js";
import type { EventoBitacora } from "../src/bitacora.js";
import {
  evaluacionBloqueada,
  MENSAJE_JUSTIFICACION_OBLIGATORIA,
  normalizarDeclaracion,
  validarDeclaracion,
} from "../src/domain/conflictos.js";
import { RepositorioConflictosMemoria } from "../src/repos/conflictosMemoria.js";
import { RepositorioEvidenciasMemoria } from "../src/repos/evidenciasMemoria.js";
import { RepositorioMemoria } from "../src/repos/memoria.js";
import { RepositorioPlanesAccionMemoria } from "../src/repos/planesAccionMemoria.js";
import { RepositorioPlanesMemoria } from "../src/repos/planesMemoria.js";
import { escuchar } from "./servidor.js";

const JEFA = "m.garcia@expedite.com";
const ADMIN = "s.ramirez@expedite.com";
// Ana Rodríguez tiene controles en los planes 2 (PAI-2025-002) y 3 (PAI-2025-003); Carlos Morales solo en el 2.
const AUDITORA = "a.rodriguez@expedite.com";
const AUDITOR_SENIOR = "c.morales@expedite.com";
const SOLO_LECTURA = "d.torres@expedite.com";
const PLAN = 2;

let app: Server;
let eventos: EventoBitacora[];

beforeEach(async () => {
  eventos = [];
  const usuarios = new RepositorioMemoria();
  const planes = new RepositorioPlanesMemoria(usuarios);
  app = await escuchar(
    crearApp({
      repo: usuarios,
      repoPlanes: planes,
      repoPlanesAccion: new RepositorioPlanesAccionMemoria(usuarios),
      repoConflictos: new RepositorioConflictosMemoria(usuarios, planes),
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
});

const declarar = (correo: string, cuerpo: Record<string, unknown>, plan = PLAN) =>
  como(correo).post(`/api/planes/${plan}/conflictos`).send(cuerpo);

describe("reglas de la declaración (dominio)", () => {
  it("exige indicar si hay conflicto", () => {
    expect(validarDeclaracion({})).toBe("Indica si tienes o no un conflicto de interés.");
    expect(validarDeclaracion({ tieneConflicto: "sí" })).toBe("Indica si tienes o no un conflicto de interés.");
  });

  it("exige justificación cuando hay conflicto, aunque venga solo con espacios", () => {
    expect(validarDeclaracion({ tieneConflicto: true })).toBe(MENSAJE_JUSTIFICACION_OBLIGATORIA);
    expect(validarDeclaracion({ tieneConflicto: true, justificacion: "   " })).toBe(MENSAJE_JUSTIFICACION_OBLIGATORIA);
    expect(validarDeclaracion({ tieneConflicto: true, justificacion: "Mi hermano trabaja en el área." })).toBeNull();
  });

  it("sin conflicto la justificación es opcional y una vacía se guarda como null", () => {
    expect(validarDeclaracion({ tieneConflicto: false })).toBeNull();
    expect(normalizarDeclaracion({ tieneConflicto: false, justificacion: "  " })).toEqual({ tieneConflicto: false, justificacion: null });
  });

  it("limita la justificación a 2000 caracteres", () => {
    expect(validarDeclaracion({ tieneConflicto: true, justificacion: "x".repeat(2001) })).toMatch(/2000/);
  });

  it("bloquea la evaluación solo al auditor asignado que no ha declarado", () => {
    const declaracion = {
      id: 1,
      plan: { id: PLAN, codigo: "PAI-2025-002", nombre: "Plan" },
      auditor: { id: 4, nombre: "Ana" },
      tieneConflicto: false,
      justificacion: null,
      declaradoEn: "",
    };
    expect(evaluacionBloqueada(true, null)).toBe(true);
    expect(evaluacionBloqueada(true, declaracion)).toBe(false);
    expect(evaluacionBloqueada(false, null)).toBe(false);
  });
});

describe("registro de la declaración", () => {
  it("exige sesión", async () => {
    expect((await request(app).post(`/api/planes/${PLAN}/conflictos`).send({ tieneConflicto: false })).status).toBe(401);
  });

  it("el auditor asignado declara sin conflicto y queda en la bitácora sin aviso a la jefatura", async () => {
    const res = await declarar(AUDITORA, { tieneConflicto: false });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(
      expect.objectContaining({
        plan: { id: PLAN, codigo: "PAI-2025-002", nombre: "Plan Auditoría TI & Ciberseguridad" },
        auditor: expect.objectContaining({ nombre: "Ana Rodríguez" }),
        tieneConflicto: false,
        justificacion: null,
      }),
    );
    expect(eventos.map((e) => e.accion)).toEqual(["conflicto.declaracion"]);
    expect(eventos[0]).toMatchObject({ actor: AUDITORA, detalle: { planId: PLAN, tieneConflicto: false } });
  });

  it("con conflicto guarda la justificación, la registra y avisa a la jefatura", async () => {
    const res = await declarar(AUDITORA, { tieneConflicto: true, justificacion: "  Mi hermano dirige el área auditada.  " });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ tieneConflicto: true, justificacion: "Mi hermano dirige el área auditada." });
    expect(eventos.map((e) => e.accion)).toEqual(["conflicto.declaracion", "conflicto.aviso_jefatura"]);
    expect(eventos[1]!.detalle).toMatchObject({ planId: PLAN, plan: "PAI-2025-002", auditor: "Ana Rodríguez" });

    const aviso = await como(JEFA).get("/api/conflictos");
    expect(aviso.status).toBe(200);
    expect(aviso.body).toEqual([expect.objectContaining({ id: res.body.id, tieneConflicto: true })]);
  });

  it("rechaza un conflicto sin justificación (400) y no guarda nada", async () => {
    const res = await declarar(AUDITORA, { tieneConflicto: true, justificacion: "" });

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ codigo: "DATOS_INVALIDOS", mensaje: MENSAJE_JUSTIFICACION_OBLIGATORIA });
    expect(eventos).toEqual([]);
    expect((await como(AUDITORA).get(`/api/planes/${PLAN}/conflictos/mia`)).body.declaracion).toBeNull();
  });

  it("solo se declara una vez por plan (409)", async () => {
    await declarar(AUDITORA, { tieneConflicto: false });
    const res = await declarar(AUDITORA, { tieneConflicto: true, justificacion: "Cambié de opinión." });

    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe("DECLARACION_DUPLICADA");
  });

  it("la misma persona declara por separado en cada plan donde está asignada", async () => {
    expect((await declarar(AUDITORA, { tieneConflicto: false }, 2)).status).toBe(201);
    expect((await declarar(AUDITORA, { tieneConflicto: false }, 3)).status).toBe(201);
  });

  it("quien no tiene controles asignados en el plan no declara (403)", async () => {
    const res = await declarar(AUDITOR_SENIOR, { tieneConflicto: false }, 3);

    expect(res.status).toBe(403);
    expect(res.body.error.codigo).toBe("NO_ASIGNADO");
    expect((await declarar(JEFA, { tieneConflicto: false })).status).toBe(403);
  });

  it("devuelve 404 si el plan no existe o el id no es válido", async () => {
    for (const plan of ["999", "abc"]) {
      const res = await como(AUDITORA).post(`/api/planes/${plan}/conflictos`).send({ tieneConflicto: false });
      expect(res.status).toBe(404);
      expect(res.body.error.codigo).toBe("NO_ENCONTRADO");
    }
  });
});

describe("consulta de declaraciones", () => {
  it("el auditor ve si está asignado, si ya declaró y si puede evaluar", async () => {
    const antes = await como(AUDITORA).get(`/api/planes/${PLAN}/conflictos/mia`);
    expect(antes.status).toBe(200);
    expect(antes.body).toEqual({
      plan: { id: PLAN, codigo: "PAI-2025-002", nombre: "Plan Auditoría TI & Ciberseguridad" },
      asignado: true,
      declaracion: null,
      puedeEvaluar: false,
    });

    await declarar(AUDITORA, { tieneConflicto: false });
    const despues = await como(AUDITORA).get(`/api/planes/${PLAN}/conflictos/mia`);
    expect(despues.body).toMatchObject({ asignado: true, puedeEvaluar: true, declaracion: { tieneConflicto: false } });
  });

  it("quien no está asignado puede consultar su estado y no queda bloqueado", async () => {
    const res = await como(JEFA).get(`/api/planes/${PLAN}/conflictos/mia`);
    expect(res.body).toMatchObject({ asignado: false, declaracion: null, puedeEvaluar: true });
  });

  it("lista los planes donde el auditor aún debe declarar", async () => {
    const antes = await como(AUDITORA).get("/api/conflictos/pendientes");
    expect(antes.body.map((p: { codigo: string }) => p.codigo)).toEqual(["PAI-2025-002", "PAI-2025-003"]);

    await declarar(AUDITORA, { tieneConflicto: false }, 2);
    const despues = await como(AUDITORA).get("/api/conflictos/pendientes");
    expect(despues.body.map((p: { codigo: string }) => p.codigo)).toEqual(["PAI-2025-003"]);
    expect((await como(JEFA).get("/api/conflictos/pendientes")).body).toEqual([]);
  });

  it("la jefatura y el administrador ven las declaraciones de un plan; otros roles no", async () => {
    await declarar(AUDITORA, { tieneConflicto: true, justificacion: "Relación familiar con el responsable." });

    for (const correo of [JEFA, ADMIN]) {
      const res = await como(correo).get(`/api/planes/${PLAN}/conflictos`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    }
    expect((await como(AUDITORA).get(`/api/planes/${PLAN}/conflictos`)).status).toBe(403);
    expect((await como(SOLO_LECTURA).get("/api/conflictos")).status).toBe(403);
  });

  it("el aviso a la jefatura solo incluye declaraciones con conflicto", async () => {
    await declarar(AUDITORA, { tieneConflicto: false }, 3);
    await declarar(AUDITOR_SENIOR, { tieneConflicto: true, justificacion: "Fui gerente del área hace un año." }, 2);

    const res = await como(JEFA).get("/api/conflictos");
    expect(res.body).toEqual([expect.objectContaining({ plan: expect.objectContaining({ id: 2 }), tieneConflicto: true })]);
  });
});
