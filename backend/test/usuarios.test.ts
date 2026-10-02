import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { crearApp } from "../src/app.js";
import { crearVerificadorDev } from "../src/auth/verificador.js";
import type { EventoBitacora } from "../src/bitacora.js";
import { RepositorioMemoria } from "../src/repos/memoria.js";

const ADMIN = "s.ramirez@expedite.com";
const JEFA = "m.garcia@expedite.com";
const AUDITORA = "a.rodriguez@expedite.com";
const INACTIVO = "p.sanchez@expedite.com";

let app: ReturnType<typeof crearApp>;
let eventos: EventoBitacora[];

beforeEach(() => {
  eventos = [];
  app = crearApp({
    repo: new RepositorioMemoria(),
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

async function idDe(correo: string): Promise<number> {
  const res = await como(ADMIN).get("/api/usuarios");
  return res.body.find((u: { correo: string }) => u.correo === correo).id;
}

describe("CA1: tabla de usuarios", () => {
  it("lista a todos los usuarios con nombre, correo, rol y estado", async () => {
    const res = await como(ADMIN).get("/api/usuarios");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(7);
    expect(res.body).toContainEqual(
      expect.objectContaining({
        nombre: "María García",
        correo: "m.garcia@expedite.com",
        rol: "Jefe de Auditoría",
        estado: "active",
      }),
    );
    expect(res.body).toContainEqual(
      expect.objectContaining({ nombre: "Pedro Sánchez", estado: "inactive" }),
    );
  });

  it("no expone el identificador de Entra", async () => {
    const res = await como(ADMIN).get("/api/usuarios");

    for (const usuario of res.body) {
      expect(Object.keys(usuario).sort()).toEqual(["correo", "estado", "id", "nombre", "rol", "ultimoAcceso"]);
    }
  });
});

describe("CA2: actualización inmediata de permisos al cambiar el rol", () => {
  it("devuelve al usuario con el rol y los permisos nuevos", async () => {
    const id = await idDe(AUDITORA);

    const res = await como(ADMIN).patch(`/api/usuarios/${id}/rol`).send({ rol: "Jefe de Auditoría" });

    expect(res.status).toBe(200);
    expect(res.body.rol).toBe("Jefe de Auditoría");
    expect(res.body.permisos).toContain("Aprobar Riesgos");
    expect(res.body.permisos).not.toContain("Gestionar Usuarios");
  });

  it("la siguiente petición del usuario afectado ya refleja sus permisos nuevos", async () => {
    const antes = await como(AUDITORA).get("/api/me");
    expect(antes.body.permisos).not.toContain("Aprobar Riesgos");

    const id = await idDe(AUDITORA);
    await como(ADMIN).patch(`/api/usuarios/${id}/rol`).send({ rol: "Jefe de Auditoría" });

    const despues = await como(AUDITORA).get("/api/me");
    expect(despues.body.rol).toBe("Jefe de Auditoría");
    expect(despues.body.permisos).toContain("Aprobar Riesgos");
  });

  it("otorga y retira el acceso de Administrador sin esperar un nuevo inicio de sesión", async () => {
    const id = await idDe(JEFA);
    expect((await como(JEFA).get("/api/usuarios")).status).toBe(403);

    await como(ADMIN).patch(`/api/usuarios/${id}/rol`).send({ rol: "Administrador" });
    expect((await como(JEFA).get("/api/usuarios")).status).toBe(200);

    await como(ADMIN).patch(`/api/usuarios/${id}/rol`).send({ rol: "Auditor" });
    expect((await como(JEFA).get("/api/usuarios")).status).toBe(403);
  });

  it("el cambio aparece en la lista de usuarios", async () => {
    const id = await idDe(AUDITORA);
    await como(ADMIN).patch(`/api/usuarios/${id}/rol`).send({ rol: "Consultor" });

    const res = await como(ADMIN).get("/api/usuarios");
    expect(res.body.find((u: { id: number }) => u.id === id).rol).toBe("Consultor");
  });

  it("registra el cambio en la bitácora", async () => {
    const id = await idDe(AUDITORA);
    await como(ADMIN).patch(`/api/usuarios/${id}/rol`).send({ rol: "Consultor" });

    expect(eventos).toEqual([
      expect.objectContaining({
        accion: "usuario.cambio_rol",
        actor: ADMIN,
        detalle: { usuarioId: id, rolAnterior: "Auditor", rolNuevo: "Consultor" },
      }),
    ]);
  });

  it("rechaza un rol que no existe", async () => {
    const id = await idDe(AUDITORA);
    const res = await como(ADMIN).patch(`/api/usuarios/${id}/rol`).send({ rol: "Superusuario" });

    expect(res.status).toBe(400);
    expect(res.body.error.codigo).toBe("DATOS_INVALIDOS");
  });

  it("responde 404 si el usuario no existe", async () => {
    const res = await como(ADMIN).patch("/api/usuarios/9999/rol").send({ rol: "Auditor" });

    expect(res.status).toBe(404);
    expect(res.body.error.codigo).toBe("NO_ENCONTRADO");
  });

  it.each(["abc", "0", "-1", "1.5"])("rechaza el identificador %s", async (id) => {
    const res = await como(ADMIN).patch(`/api/usuarios/${id}/rol`).send({ rol: "Auditor" });

    expect(res.status).toBe(400);
  });

  it("impide dejar el sistema sin un Administrador activo", async () => {
    const id = await idDe(ADMIN);
    const res = await como(ADMIN).patch(`/api/usuarios/${id}/rol`).send({ rol: "Auditor" });

    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe("ULTIMO_ADMINISTRADOR");
    expect((await como(ADMIN).get("/api/usuarios")).status).toBe(200);
  });
});

describe("CA3: alta de usuario con validación de dominio corporativo", () => {
  const nuevo = { nombre: "Luis Peña", correo: "l.pena@expedite.com", rol: "Auditor" };

  it("crea al usuario cuando el correo es del dominio corporativo", async () => {
    const res = await como(ADMIN).post("/api/usuarios").send(nuevo);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ...nuevo, estado: "active" });

    const lista = await como(ADMIN).get("/api/usuarios");
    expect(lista.body).toHaveLength(8);
  });

  it.each([
    "l.pena@gmail.com",
    "l.pena@mail.expedite.com",
    "l.pena@malexpedite.com",
    "l.pena@expedite.com.evil.com",
  ])("rechaza %s con un error explícito", async (correo) => {
    const res = await como(ADMIN).post("/api/usuarios").send({ ...nuevo, correo });

    expect(res.status).toBe(422);
    expect(res.body.error.codigo).toBe("DOMINIO_NO_AUTORIZADO");
    expect(res.body.error.mensaje).toContain("dominio corporativo");
    expect(res.body.error.mensaje).toContain("expedite.com");
  });

  it("no guarda al usuario rechazado", async () => {
    await como(ADMIN).post("/api/usuarios").send({ ...nuevo, correo: "l.pena@gmail.com" });

    const lista = await como(ADMIN).get("/api/usuarios");
    expect(lista.body).toHaveLength(7);
    expect(eventos).toHaveLength(0);
  });

  it("guarda el correo en minúsculas y sin espacios", async () => {
    const res = await como(ADMIN).post("/api/usuarios").send({ ...nuevo, correo: "  L.Pena@Expedite.COM " });

    expect(res.status).toBe(201);
    expect(res.body.correo).toBe("l.pena@expedite.com");
  });

  it("rechaza un correo ya registrado, aunque cambien las mayúsculas", async () => {
    const res = await como(ADMIN).post("/api/usuarios").send({ ...nuevo, correo: "M.Garcia@expedite.com" });

    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe("CORREO_DUPLICADO");
  });

  it.each([
    ["sin nombre", { correo: nuevo.correo, rol: nuevo.rol }],
    ["nombre vacío", { ...nuevo, nombre: "   " }],
    ["nombre demasiado largo", { ...nuevo, nombre: "a".repeat(151) }],
    ["correo mal formado", { ...nuevo, correo: "no-es-correo" }],
    ["correo no es texto", { ...nuevo, correo: 42 }],
    ["rol inexistente", { ...nuevo, rol: "Superusuario" }],
    ["sin rol", { nombre: nuevo.nombre, correo: nuevo.correo }],
  ])("rechaza datos inválidos: %s", async (_caso, cuerpo) => {
    const res = await como(ADMIN).post("/api/usuarios").send(cuerpo);

    expect(res.status).toBe(400);
    expect(res.body.error.codigo).toBe("DATOS_INVALIDOS");
  });

  it("rechaza un cuerpo que no es JSON válido", async () => {
    const res = await como(ADMIN)
      .post("/api/usuarios")
      .set("Content-Type", "application/json")
      .send("{esto no es json");

    expect(res.status).toBe(400);
    expect(res.body.error.codigo).toBe("DATOS_INVALIDOS");
  });

  it("registra el alta en la bitácora", async () => {
    const res = await como(ADMIN).post("/api/usuarios").send(nuevo);

    expect(eventos).toEqual([
      expect.objectContaining({
        accion: "usuario.alta",
        actor: ADMIN,
        detalle: { usuarioId: res.body.id, correo: nuevo.correo, rol: nuevo.rol },
      }),
    ]);
  });
});

describe("autenticación y autorización por rol", () => {
  it("rechaza peticiones sin identidad", async () => {
    const res = await request(app).get("/api/usuarios");

    expect(res.status).toBe(401);
    expect(res.body.error.codigo).toBe("NO_AUTENTICADO");
  });

  it("rechaza a quien no está registrado en el sistema", async () => {
    const res = await como("intruso@expedite.com").get("/api/me");

    expect(res.status).toBe(403);
    expect(res.body.error.codigo).toBe("USUARIO_NO_AUTORIZADO");
  });

  it("rechaza a un usuario inactivo", async () => {
    const res = await como(INACTIVO).get("/api/me");

    expect(res.status).toBe(403);
    expect(res.body.error.codigo).toBe("USUARIO_NO_AUTORIZADO");
  });

  it.each([
    ["GET", "/api/usuarios"],
    ["POST", "/api/usuarios"],
    ["PATCH", "/api/usuarios/2/rol"],
  ])("%s %s es solo para Administrador", async (metodo, ruta) => {
    const cliente = como(JEFA);
    const res =
      metodo === "GET"
        ? await cliente.get(ruta)
        : metodo === "POST"
          ? await cliente.post(ruta).send({ nombre: "X", correo: "x@expedite.com", rol: "Auditor" })
          : await cliente.patch(ruta).send({ rol: "Administrador" });

    expect(res.status).toBe(403);
    expect(res.body.error.codigo).toBe("ROL_NO_AUTORIZADO");
  });

  it("un usuario no puede elevar su propio rol", async () => {
    const id = await idDe(JEFA);
    await como(JEFA).patch(`/api/usuarios/${id}/rol`).send({ rol: "Administrador" });

    expect((await como(JEFA).get("/api/me")).body.rol).toBe("Jefe de Auditoría");
  });

  it("GET /api/me devuelve al usuario en sesión con su rol y permisos", async () => {
    const res = await como(ADMIN).get("/api/me");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ correo: ADMIN, rol: "Administrador" });
    expect(res.body.permisos).toContain("Gestionar Usuarios");
  });

  it("GET /api/roles devuelve los roles con sus permisos", async () => {
    const res = await como(AUDITORA).get("/api/roles");

    expect(res.status).toBe(200);
    expect(res.body.map((r: { nombre: string }) => r.nombre)).toEqual([
      "Administrador",
      "Jefe de Auditoría",
      "Auditor Senior",
      "Auditor",
      "Consultor",
      "Solo Lectura",
    ]);
    expect(res.body[3].permisos).toEqual(["Ver Dashboard", "Ver Auditorías"]);
  });

  it("responde 404 con el formato de error en rutas inexistentes", async () => {
    const res = await como(ADMIN).get("/api/no-existe");

    expect(res.status).toBe(404);
    expect(res.body.error.codigo).toBe("NO_ENCONTRADO");
  });
});
