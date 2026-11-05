import type { Server } from "node:http";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { crearApp } from "../src/app.js";
import { crearVerificadorDev } from "../src/auth/verificador.js";
import { RepositorioEvidenciasMemoria } from "../src/repos/evidenciasMemoria.js";
import { RepositorioMemoria } from "../src/repos/memoria.js";
import { RepositorioPlanesAccionMemoria } from "../src/repos/planesAccionMemoria.js";
import { RepositorioPlanesMemoria } from "../src/repos/planesMemoria.js";
import { escuchar } from "./servidor.js";

const JEFA = "m.garcia@expedite.com";
const AUDITORA = "a.rodriguez@expedite.com";
const RESPONSABLE = "c.morales@expedite.com";

let app: Server;
let usuarios: RepositorioMemoria;
let planes: RepositorioPlanesAccionMemoria;

const como = (correo: string) => ({
  get: (ruta: string) => request(app).get(ruta).set("X-Dev-Usuario", correo),
  post: (ruta: string) => request(app).post(ruta).set("X-Dev-Usuario", correo),
});
const idDe = async (correo: string) => (await usuarios.buscarPorCorreo(correo))!.id;

beforeEach(async () => {
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
    }),
  );
  // El plan sembrado tiene a Carlos Morales como responsable; cada transición deja un aviso.
  const [plan] = await planes.listar();
  const actor = { id: await idDe(JEFA), nombre: "María García", rol: "Jefe de Auditoría" };
  const notificar = { usuarioIds: [await idDe(RESPONSABLE)], mensaje: "Primer aviso" };
  await planes.transicionar(plan!.id, { desde: ["Asignado"], hacia: "Pendiente", accion: "envio", actor, notificar });
  await planes.transicionar(plan!.id, {
    desde: ["Pendiente"],
    hacia: "En Revisión",
    accion: "apertura",
    actor,
    notificar: { ...notificar, mensaje: "Segundo aviso" },
  });
});

describe("notificaciones", () => {
  it("exige sesión", async () => {
    expect((await request(app).get("/api/notificaciones")).status).toBe(401);
  });

  it("cada usuario ve solo las suyas, de la más reciente a la más antigua", async () => {
    const res = await como(RESPONSABLE).get("/api/notificaciones");

    expect(res.status).toBe(200);
    expect(res.body.noLeidas).toBe(2);
    expect(res.body.items.map((aviso: { mensaje: string }) => aviso.mensaje)).toEqual(["Segundo aviso", "Primer aviso"]);

    expect((await como(AUDITORA).get("/api/notificaciones")).body).toEqual({ noLeidas: 0, items: [] });
  });

  it("marcar una como leída baja el conteo", async () => {
    const [primera] = (await como(RESPONSABLE).get("/api/notificaciones")).body.items;

    expect((await como(RESPONSABLE).post(`/api/notificaciones/${primera.id}/leida`)).status).toBe(204);

    const res = await como(RESPONSABLE).get("/api/notificaciones");
    expect(res.body.noLeidas).toBe(1);
    expect(res.body.items[0].leida).toBe(true);
  });

  it("no se puede marcar la de otro usuario", async () => {
    const [primera] = (await como(RESPONSABLE).get("/api/notificaciones")).body.items;

    expect((await como(AUDITORA).post(`/api/notificaciones/${primera.id}/leida`)).status).toBe(404);

    expect((await como(RESPONSABLE).get("/api/notificaciones")).body.noLeidas).toBe(2);
  });

  it("responde 404 con un id que no es válido", async () => {
    expect((await como(RESPONSABLE).post("/api/notificaciones/abc/leida")).status).toBe(404);
  });

  it("marca todas las del usuario", async () => {
    expect((await como(RESPONSABLE).post("/api/notificaciones/leidas")).status).toBe(204);
    expect((await como(RESPONSABLE).get("/api/notificaciones")).body.noLeidas).toBe(0);
  });
});
