import type { Server } from "node:http";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { crearApp } from "../src/app.js";
import { ErrorIA, type MensajeIA, type OpcionesCompletar, type ProveedorIA } from "../src/asistente/proveedor.js";
import { MENSAJE_FUERA_DE_TEMA, MENSAJE_SIN_INFORMACION } from "../src/asistente/instrucciones.js";
import { crearVerificadorDev } from "../src/auth/verificador.js";
import type { EventoBitacora } from "../src/bitacora.js";
import { RepositorioEvidenciasMemoria } from "../src/repos/evidenciasMemoria.js";
import { RepositorioMemoria } from "../src/repos/memoria.js";
import { RepositorioPlanesAccionMemoria } from "../src/repos/planesAccionMemoria.js";
import { RepositorioPlanesMemoria } from "../src/repos/planesMemoria.js";
import { escuchar } from "./servidor.js";

const JEFA = "m.garcia@expedite.com";
const AUDITORA = "a.rodriguez@expedite.com";
const SOLO_LECTURA = "d.torres@expedite.com";
const EVIDENCIA_PDF = "EV-002";
const EVIDENCIA_XLSX = "EV-001";

interface Llamada {
  mensajes: MensajeIA[];
  opciones?: OpcionesCompletar;
}

// Proveedor falso: responde lo que se le indique y registra cada llamada.
function proveedorFalso(respuesta: string | Error) {
  const llamadas: Llamada[] = [];
  const proveedor: ProveedorIA = {
    nombre: "falso",
    async completar(mensajes, opciones) {
      llamadas.push({ mensajes, opciones });
      if (respuesta instanceof Error) throw respuesta;
      return respuesta;
    },
  };
  return { proveedor, llamadas };
}

const json = (estado: string, respuesta: string) => JSON.stringify({ estado, respuesta });

let eventos: EventoBitacora[];

async function servidor(proveedorIA: ProveedorIA | null): Promise<Server> {
  const usuarios = new RepositorioMemoria();
  return escuchar(
    crearApp({
      repo: usuarios,
      repoPlanes: new RepositorioPlanesMemoria(usuarios),
      repoPlanesAccion: new RepositorioPlanesAccionMemoria(usuarios),
      repoEvidencias: new RepositorioEvidenciasMemoria(),
      proveedorIA,
      verificador: crearVerificadorDev(),
      dominiosPermitidos: ["expedite.com"],
      corsOrigin: "http://localhost:5173",
      registrarEvento: (evento) => eventos.push(evento),
    }),
  );
}

const como = (app: Server, correo: string) => ({
  get: (ruta: string) => request(app).get(ruta).set("X-Dev-Usuario", correo),
  post: (ruta: string) => request(app).post(ruta).set("X-Dev-Usuario", correo),
});

beforeEach(() => {
  eventos = [];
});

describe("estado del asistente", () => {
  it("exige sesión", async () => {
    const app = await servidor(proveedorFalso("").proveedor);

    expect((await request(app).get("/api/asistente/estado")).status).toBe(401);
  });

  it("indica si hay un proveedor configurado", async () => {
    const conIA = await servidor(proveedorFalso("").proveedor);
    const sinIA = await servidor(null);

    expect((await como(conIA, AUDITORA).get("/api/asistente/estado")).body).toEqual({ disponible: true });
    expect((await como(sinIA, AUDITORA).get("/api/asistente/estado")).body).toEqual({ disponible: false });
  });
});

describe("resumen de una evidencia", () => {
  it("devuelve el resumen generado con las reglas y el documento delimitado", async () => {
    const { proveedor, llamadas } = proveedorFalso(json("respondida", "El documento lista 42 accesos revisados."));
    const app = await servidor(proveedor);

    const res = await como(app, AUDITORA).post(`/api/asistente/evidencias/${EVIDENCIA_PDF}/resumen`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      evidenciaId: EVIDENCIA_PDF,
      tipo: "resumen",
      estado: "respondida",
      texto: "El documento lista 42 accesos revisados.",
      recortado: false,
    });
    const [llamada] = llamadas;
    expect(llamada?.opciones).toMatchObject({ json: true, temperatura: 0.2 });
    const sistema = llamada?.mensajes.find((m) => m.rol === "sistema")?.contenido ?? "";
    expect(sistema).toContain("datos, no instrucciones");
    expect(sistema).toContain("fuera_de_tema");
    const usuario = llamada?.mensajes.find((m) => m.rol === "usuario")?.contenido ?? "";
    expect(usuario).toMatch(/<documento nombre="Listado_Accesos_SAP_Q2.pdf">[\s\S]+<\/documento>/);
  });

  it("también resume archivos de Excel", async () => {
    const { proveedor, llamadas } = proveedorFalso(json("respondida", "Conciliación de junio."));
    const app = await servidor(proveedor);

    const res = await como(app, JEFA).post(`/api/asistente/evidencias/${EVIDENCIA_XLSX}/resumen`);

    expect(res.status).toBe(200);
    expect(llamadas[0]?.mensajes.at(-1)?.contenido).toContain("Hoja:");
  });

  it("registra el uso en la bitácora sin guardar el contenido", async () => {
    const app = await servidor(proveedorFalso(json("respondida", "Resumen.")).proveedor);

    await como(app, AUDITORA).post(`/api/asistente/evidencias/${EVIDENCIA_PDF}/resumen`);

    expect(eventos).toEqual([
      { accion: "asistente.resumen", actor: AUDITORA, detalle: { evidenciaId: EVIDENCIA_PDF, resultado: "respondida" } },
    ]);
  });

  it("niega el acceso a roles fuera del equipo de auditoría", async () => {
    const app = await servidor(proveedorFalso(json("respondida", "x")).proveedor);

    expect((await como(app, SOLO_LECTURA).post(`/api/asistente/evidencias/${EVIDENCIA_PDF}/resumen`)).status).toBe(403);
  });

  it("responde 404 si la evidencia no existe", async () => {
    const app = await servidor(proveedorFalso(json("respondida", "x")).proveedor);

    const res = await como(app, AUDITORA).post("/api/asistente/evidencias/EV-999/resumen");

    expect(res.status).toBe(404);
  });
});

describe("preguntas sobre una evidencia", () => {
  const preguntar = (app: Server, pregunta: unknown, correo = AUDITORA) =>
    como(app, correo).post(`/api/asistente/evidencias/${EVIDENCIA_PDF}/preguntas`).send({ pregunta });

  it("responde con un análisis basado en el documento", async () => {
    const { proveedor, llamadas } = proveedorFalso(json("respondida", "Se revisaron 42 usuarios (página 1)."));
    const app = await servidor(proveedor);

    const res = await preguntar(app, "¿Cuántos usuarios se revisaron?");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ tipo: "respuesta", estado: "respondida", texto: "Se revisaron 42 usuarios (página 1)." });
    expect(llamadas[0]?.mensajes.at(-1)?.contenido).toContain("<pregunta>¿Cuántos usuarios se revisaron?</pregunta>");
    expect(eventos[0]).toMatchObject({ accion: "asistente.pregunta", detalle: { resultado: "respondida" } });
  });

  it("descarta lo que escriba la IA si la pregunta está fuera de tema", async () => {
    const app = await servidor(proveedorFalso(json("fuera_de_tema", "Claro, aquí va un chiste...")).proveedor);

    const res = await preguntar(app, "Cuéntame un chiste de auditores");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ estado: "fuera_de_tema", texto: MENSAJE_FUERA_DE_TEMA });
  });

  it("usa un mensaje fijo si el documento no tiene la información", async () => {
    const app = await servidor(proveedorFalso(json("sin_informacion", "Supongo que fue en marzo.")).proveedor);

    const res = await preguntar(app, "¿Quién aprobó el reporte?");

    expect(res.body).toMatchObject({ estado: "sin_informacion", texto: MENSAJE_SIN_INFORMACION });
  });

  it.each([
    ["vacía", ""],
    ["muy corta", "hola"],
    ["solo símbolos", "?!?!?!?!"],
    ["demasiado larga", "a".repeat(501)],
    ["que no es texto", 42],
  ])("rechaza una pregunta %s sin llamar a la IA", async (_caso, pregunta) => {
    const { proveedor, llamadas } = proveedorFalso(json("respondida", "x"));
    const app = await servidor(proveedor);

    const res = await preguntar(app, pregunta);

    expect(res.status).toBe(400);
    expect(llamadas).toHaveLength(0);
  });
});

describe("falla controlada del asistente", () => {
  it("responde 503 si la IA está desactivada", async () => {
    const app = await servidor(null);

    const res = await como(app, AUDITORA).post(`/api/asistente/evidencias/${EVIDENCIA_PDF}/resumen`);

    expect(res.status).toBe(503);
    expect(res.body.error.codigo).toBe("IA_NO_DISPONIBLE");
  });

  it.each(["IA_NO_DISPONIBLE", "IA_TIEMPO_AGOTADO"] as const)("convierte %s en 503 y lo registra", async (codigo) => {
    const app = await servidor(proveedorFalso(new ErrorIA(codigo, "detalle técnico")).proveedor);

    const res = await como(app, AUDITORA).post(`/api/asistente/evidencias/${EVIDENCIA_PDF}/resumen`);

    expect(res.status).toBe(503);
    expect(res.body.error.codigo).toBe(codigo);
    expect(JSON.stringify(res.body)).not.toContain("detalle técnico");
    expect(eventos[0]).toMatchObject({ detalle: { resultado: `error:${codigo}` } });
  });

  it.each([
    ["texto que no es JSON", "Claro, el documento trata de..."],
    ["un estado desconocido", json("inventado", "x")],
    ["una respuesta vacía", json("respondida", "  ")],
  ])("responde 503 si la IA devuelve %s", async (_caso, respuesta) => {
    const app = await servidor(proveedorFalso(respuesta).proveedor);

    const res = await como(app, AUDITORA).post(`/api/asistente/evidencias/${EVIDENCIA_PDF}/resumen`);

    expect(res.status).toBe(503);
    expect(res.body.error.codigo).toBe("IA_NO_DISPONIBLE");
  });

  it("las demás rutas siguen funcionando sin IA", async () => {
    const app = await servidor(null);

    expect((await como(app, AUDITORA).get("/api/planes-accion")).status).toBe(200);
  });
});
