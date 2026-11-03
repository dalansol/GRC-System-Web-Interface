import type { Server } from "node:http";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { crearApp } from "../src/app.js";
import { crearVerificadorDev } from "../src/auth/verificador.js";
import type { EventoBitacora } from "../src/bitacora.js";
import { RepositorioConflictosMemoria } from "../src/repos/conflictosMemoria.js";
import { RepositorioEvaluacionesMemoria } from "../src/repos/evaluacionesMemoria.js";
import { RepositorioEvidenciasMemoria } from "../src/repos/evidenciasMemoria.js";
import { RepositorioMemoria } from "../src/repos/memoria.js";
import { RepositorioPlanesAccionMemoria } from "../src/repos/planesAccionMemoria.js";
import { RepositorioPlanesMemoria } from "../src/repos/planesMemoria.js";
import { escuchar } from "./servidor.js";

const JEFA = "m.garcia@expedite.com";
const ADMIN = "s.ramirez@expedite.com";
const AUDITORA = "a.rodriguez@expedite.com"; // Asignada al plan 2.
const SENIOR = "c.morales@expedite.com"; // También en el plan 2, pero no tiene este control.
const SOLO_LECTURA = "d.torres@expedite.com";
const PLAN = 2;
const CONTROL = "CTR-001";
const CODIGO = "CP-001";
const RUTA = `/api/planes/${PLAN}/controles/${CONTROL}/evaluacion`;

let app: Server;
let eventos: EventoBitacora[];
let repoEvaluaciones: RepositorioEvaluacionesMemoria;

beforeEach(async () => {
  eventos = [];
  const usuarios = new RepositorioMemoria();
  const planes = new RepositorioPlanesMemoria(usuarios);
  const auditora = (await usuarios.buscarPorCorreo(AUDITORA))!;
  const senior = (await usuarios.buscarPorCorreo(SENIOR))!;
  repoEvaluaciones = new RepositorioEvaluacionesMemoria(usuarios, [
    { planId: PLAN, controlId: CONTROL, codigo: CODIGO, auditorId: auditora.id, asignadoPor: senior.id, status: "En Progreso" },
  ]);
  app = await escuchar(
    crearApp({
      repo: usuarios,
      repoPlanes: planes,
      repoPlanesAccion: new RepositorioPlanesAccionMemoria(usuarios),
      repoConflictos: new RepositorioConflictosMemoria(usuarios, planes),
      repoEvaluaciones,
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
  put: (ruta: string) => request(app).put(ruta).set("X-Dev-Usuario", correo),
  post: (ruta: string) => request(app).post(ruta).set("X-Dev-Usuario", correo),
});

const declararSinConflicto = () =>
  como(AUDITORA).post(`/api/planes/${PLAN}/conflictos`).send({ tieneConflicto: false }).expect(201);

async function responderTodos(valor: (tipo: string) => number) {
  const { criterios } = (await como(AUDITORA).get(RUTA).expect(200)).body as {
    criterios: { id: number; tipo: string }[];
  };
  return criterios.map((c) => ({ criterioId: c.id, valor: valor(c.tipo) }));
}

describe("consulta de la evaluación", () => {
  it("el auditor asignado recibe los 8 criterios y aún no hay evaluación", async () => {
    await declararSinConflicto();

    const respuesta = await como(AUDITORA).get(RUTA).expect(200);

    expect(respuesta.body.criterios).toHaveLength(8);
    expect(respuesta.body.evaluacion).toBeNull();
    expect(respuesta.body.puedeEvaluar).toBe(true);
    expect(respuesta.body.motivoBloqueo).toBeNull();
  });

  it("acepta el código del control en la ruta", async () => {
    await como(AUDITORA).get(`/api/planes/${PLAN}/controles/${CODIGO}/evaluacion`).expect(200);
  });

  it("la Jefa de Auditoría y el Administrador consultan sin poder evaluar", async () => {
    for (const correo of [JEFA, ADMIN]) {
      const respuesta = await como(correo).get(RUTA).expect(200);

      expect(respuesta.body.puedeEvaluar).toBe(false);
    }
  });

  it("quien asignó el control lo consulta sin poder evaluar", async () => {
    const respuesta = await como(SENIOR).get(RUTA).expect(200);

    expect(respuesta.body.puedeEvaluar).toBe(false);
  });

  it("otro rol no la consulta", async () => {
    const respuesta = await como(SOLO_LECTURA).get(RUTA).expect(403);

    expect(respuesta.body.error.codigo).toBe("ROL_NO_AUTORIZADO");
  });

  it("responde 404 si el control no está en el plan", async () => {
    await como(JEFA).get(`/api/planes/${PLAN}/controles/CTR-999/evaluacion`).expect(404);
  });

  it("sin sesión responde 401", async () => {
    await request(app).get(RUTA).expect(401);
  });

  it("avisa por qué no se puede evaluar sin la declaración de conflictos", async () => {
    const respuesta = await como(AUDITORA).get(RUTA).expect(200);

    expect(respuesta.body.puedeEvaluar).toBe(false);
    expect(respuesta.body.motivoBloqueo).toMatch(/conflictos de interés/);
  });
});

describe("criterio 1: cálculo automático de la calificación y el estatus", () => {
  beforeEach(declararSinConflicto);

  it("calcula la calificación, el estatus y deja constancia de quién evaluó", async () => {
    const respuestas = await responderTodos((tipo) => (tipo === "diseno" ? 5 : 4));

    const respuesta = await como(AUDITORA).put(RUTA).send({ respuestas }).expect(200);

    expect(respuesta.body).toMatchObject({
      planId: PLAN,
      controlId: CONTROL,
      promedioDiseno: 5,
      promedioEfectividad: 4,
      calificacion: 4,
      resultado: "Efectivo",
      deficiencia: false,
      evaluadoPor: { nombre: "Ana Rodríguez" },
    });
    expect(eventos.at(-1)).toMatchObject({
      accion: "control.evaluacion",
      actor: AUDITORA,
      detalle: { planId: PLAN, controlId: CONTROL, calificacion: 4, resultado: "Efectivo", deficiencia: false },
    });
  });

  it("no acepta una calificación enviada por el cliente", async () => {
    const respuestas = await responderTodos(() => 1);

    const respuesta = await como(AUDITORA).put(RUTA).send({ respuestas, calificacion: 5 }).expect(200);

    expect(respuesta.body.calificacion).toBe(1);
  });

  it("volver a guardar reemplaza la evaluación anterior", async () => {
    await como(AUDITORA).put(RUTA).send({ respuestas: await responderTodos(() => 2) }).expect(200);
    await como(AUDITORA).put(RUTA).send({ respuestas: await responderTodos(() => 5) }).expect(200);

    const consulta = await como(AUDITORA).get(RUTA).expect(200);

    expect(consulta.body.evaluacion.calificacion).toBe(5);
    expect(consulta.body.evaluacion.respuestas).toHaveLength(8);
  });

  it("la evaluación guardada se puede consultar por la jefatura", async () => {
    await como(AUDITORA).put(RUTA).send({ respuestas: await responderTodos(() => 3) }).expect(200);

    const consulta = await como(JEFA).get(RUTA).expect(200);

    expect(consulta.body.evaluacion.resultado).toBe("Parcialmente efectivo");
  });
});

describe("criterio 2: bloqueo al faltar un criterio obligatorio", () => {
  beforeEach(declararSinConflicto);

  it("impide guardar y señala el criterio que falta", async () => {
    const todas = await responderTodos(() => 3);
    const { criterios } = (await como(AUDITORA).get(RUTA)).body as { criterios: { id: number; nombre: string }[] };
    const omitido = criterios.at(-1)!;

    const respuesta = await como(AUDITORA)
      .put(RUTA)
      .send({ respuestas: todas.filter((r) => r.criterioId !== omitido.id) })
      .expect(400);

    expect(respuesta.body.error.codigo).toBe("CRITERIOS_FALTANTES");
    expect(respuesta.body.error.mensaje).toContain(omitido.nombre);
    expect(eventos.filter((e) => e.accion === "control.evaluacion")).toEqual([]);
    expect((await como(AUDITORA).get(RUTA)).body.evaluacion).toBeNull();
  });

  it("rechaza un cuerpo sin respuestas", async () => {
    const respuesta = await como(AUDITORA).put(RUTA).send({}).expect(400);

    expect(respuesta.body.error.codigo).toBe("DATOS_INVALIDOS");
  });

  it("rechaza un valor fuera de la escala", async () => {
    const respuestas = await responderTodos(() => 6);

    const respuesta = await como(AUDITORA).put(RUTA).send({ respuestas }).expect(400);

    expect(respuesta.body.error.mensaje).toMatch(/1 a 5/);
  });
});

describe("criterio 3: marca de deficiencia con nivel de madurez bajo", () => {
  beforeEach(declararSinConflicto);

  it("marca Deficiente al control con calificación menor a 3", async () => {
    const respuestas = await responderTodos((tipo) => (tipo === "diseno" ? 5 : 2));

    const respuesta = await como(AUDITORA).put(RUTA).send({ respuestas }).expect(200);

    expect(respuesta.body).toMatchObject({ calificacion: 2, resultado: "Deficiente", deficiencia: true });
  });

  it("una calificación de 3 no marca deficiencia", async () => {
    const respuesta = await como(AUDITORA)
      .put(RUTA)
      .send({ respuestas: await responderTodos(() => 3) })
      .expect(200);

    expect(respuesta.body.deficiencia).toBe(false);
  });

  it("subir la calificación quita la marca", async () => {
    await como(AUDITORA).put(RUTA).send({ respuestas: await responderTodos(() => 1) }).expect(200);

    const respuesta = await como(AUDITORA)
      .put(RUTA)
      .send({ respuestas: await responderTodos(() => 4) })
      .expect(200);

    expect(respuesta.body.deficiencia).toBe(false);
  });
});

describe("quién puede evaluar", () => {
  it("sin declaración de conflictos no se guarda", async () => {
    const respuestas = await responderTodos(() => 3);

    const respuesta = await como(AUDITORA).put(RUTA).send({ respuestas }).expect(403);

    expect(respuesta.body.error.codigo).toBe("DECLARACION_PENDIENTE");
  });

  it.each([JEFA, ADMIN, SENIOR, SOLO_LECTURA])("%s no asignado no evalúa", async (correo) => {
    await declararSinConflicto();
    const respuestas = await responderTodos(() => 3);

    const respuesta = await como(correo).put(RUTA).send({ respuestas }).expect(403);

    expect(respuesta.body.error.codigo).toBe("ROL_NO_AUTORIZADO");
  });

  it.each(["En Revision", "Completado"] as const)("con el control en %s ya no se edita", async (status) => {
    await declararSinConflicto();
    const respuestas = await responderTodos(() => 3);
    repoEvaluaciones.cambiarStatus(PLAN, CONTROL, status);

    const respuesta = await como(AUDITORA).put(RUTA).send({ respuestas }).expect(409);

    expect(respuesta.body.error.codigo).toBe("EVALUACION_CERRADA");
    expect((await como(AUDITORA).get(RUTA)).body.puedeEvaluar).toBe(false);
  });

  it("responde 400 si el plan no es un número", async () => {
    await como(AUDITORA).get(`/api/planes/abc/controles/${CONTROL}/evaluacion`).expect(400);
  });
});
