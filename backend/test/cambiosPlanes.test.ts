import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { crearApp } from "../src/app.js";
import { crearVerificadorDev } from "../src/auth/verificador.js";
import { cantidadSuscriptoresPlanes } from "../src/cambiosPlanes.js";
import { RepositorioMemoria } from "../src/repos/memoria.js";
import { RepositorioEvidenciasMemoria } from "../src/repos/evidenciasMemoria.js";
import { RepositorioPlanesAccionMemoria } from "../src/repos/planesAccionMemoria.js";
import { RepositorioPlanesMemoria } from "../src/repos/planesMemoria.js";
import { escuchar } from "./servidor.js";

const AUDITORA = "a.rodriguez@expedite.com";
const SOLO_LECTURA = "d.torres@expedite.com";

let app: Server;
let planes: RepositorioPlanesAccionMemoria;
const abiertas: AbortController[] = [];

beforeEach(async () => {
  const usuarios = new RepositorioMemoria();
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
      registrarEvento: () => {},
    }),
  );
});

afterEach(() => {
  for (const control of abiertas.splice(0)) control.abort();
});

/** Abre la conexión de avisos y devuelve una función que espera el siguiente texto que contenga `buscado`. */
async function abrirAvisos(correo = SOLO_LECTURA) {
  const { port } = app.address() as AddressInfo;
  const control = new AbortController();
  abiertas.push(control);
  const respuesta = await fetch(`http://127.0.0.1:${port}/api/planes-accion/eventos`, {
    headers: { "X-Dev-Usuario": correo },
    signal: control.signal,
  });
  const lector = respuesta.body!.getReader();
  const decodificador = new TextDecoder();
  let recibido = "";
  const esperar = async (buscado: string, tiempoMs = 2000) => {
    const limite = Date.now() + tiempoMs;
    while (!recibido.includes(buscado)) {
      if (Date.now() > limite) return false;
      const lectura = await Promise.race([
        lector.read(),
        new Promise<null>((listo) => setTimeout(() => listo(null), Math.max(0, limite - Date.now()))),
      ]);
      if (!lectura) return false;
      if (lectura.done) return false;
      recibido += decodificador.decode(lectura.value, { stream: true });
    }
    recibido = recibido.slice(recibido.indexOf(buscado) + buscado.length);
    return true;
  };
  return { respuesta, esperar, cerrar: () => control.abort() };
}

const planSembrado = async () => (await planes.listar())[0]!;

describe("avisos en vivo de planes de acción", () => {
  it("exige sesión", async () => {
    expect((await request(app).get("/api/planes-accion/eventos")).status).toBe(401);
  });

  it("abre un flujo de eventos y avisa cuando un plan cambia", async () => {
    const avisos = await abrirAvisos();
    expect(avisos.respuesta.headers.get("content-type")).toContain("text/event-stream");
    expect(await avisos.esperar(": conectado")).toBe(true);

    const plan = await planSembrado();
    const res = await request(app)
      .patch(`/api/planes-accion/${plan.id}`)
      .set("X-Dev-Usuario", AUDITORA)
      .send({ estado: "En Progreso" });
    expect(res.status).toBe(200);

    expect(await avisos.esperar("event: planes")).toBe(true);
  });

  it("el aviso no lleva datos del plan", async () => {
    const avisos = await abrirAvisos();
    await avisos.esperar(": conectado");
    const plan = await planSembrado();
    await request(app).patch(`/api/planes-accion/${plan.id}`).set("X-Dev-Usuario", AUDITORA).send({ estado: "En Progreso" });

    expect(await avisos.esperar("event: planes\ndata: {}\n\n")).toBe(true);
  });

  it("no avisa por consultas ni por escrituras rechazadas", async () => {
    const avisos = await abrirAvisos();
    await avisos.esperar(": conectado");
    const plan = await planSembrado();

    await request(app).get("/api/planes-accion").set("X-Dev-Usuario", AUDITORA);
    const rechazada = await request(app)
      .patch(`/api/planes-accion/${plan.id}`)
      .set("X-Dev-Usuario", SOLO_LECTURA)
      .send({ estado: "En Progreso" });
    expect(rechazada.status).toBe(403);

    expect(await avisos.esperar("event: planes", 300)).toBe(false);
  });

  it("al cerrar la conexión deja de estar suscrita", async () => {
    // Las conexiones de las pruebas anteriores se cierran de forma asíncrona.
    await expect.poll(() => cantidadSuscriptoresPlanes()).toBe(0);
    const avisos = await abrirAvisos();
    await avisos.esperar(": conectado");
    expect(cantidadSuscriptoresPlanes()).toBe(1);

    avisos.cerrar();

    await expect.poll(() => cantidadSuscriptoresPlanes()).toBe(0);
  });
});
