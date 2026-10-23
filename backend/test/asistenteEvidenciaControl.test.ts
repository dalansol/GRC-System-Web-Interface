import type { Server } from "node:http";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { crearApp } from "../src/app.js";
import { contextoDeControl } from "../src/asistente/expediente.js";
import {
  INSTRUCCIONES_CONTROL,
  INSTRUCCIONES_EVIDENCIA,
  MENSAJE_FUERA_DE_TEMA_EVIDENCIA,
  PREGUNTA_RESUMEN_CONTROL,
  PREGUNTA_VALIDAR_CONTROL,
} from "../src/asistente/instrucciones.js";
import { ErrorIA, type MensajeIA, type ProveedorIA } from "../src/asistente/proveedor.js";
import { crearVerificadorDev } from "../src/auth/verificador.js";
import type { EventoBitacora } from "../src/bitacora.js";
import type { EvidenciaExpediente, ExpedienteControl } from "../src/repos/asistente.js";
import { RepositorioAsistenteMemoria } from "../src/repos/asistenteMemoria.js";
import { crearPdfSencillo, EVIDENCIAS_EJEMPLO } from "../src/repos/evidenciasEjemplo.js";
import { RepositorioEvidenciasMemoria } from "../src/repos/evidenciasMemoria.js";
import { RepositorioMemoria } from "../src/repos/memoria.js";
import { RepositorioPlanesAccionMemoria } from "../src/repos/planesAccionMemoria.js";
import { RepositorioPlanesMemoria } from "../src/repos/planesMemoria.js";
import { escuchar } from "./servidor.js";

const JEFA = "m.garcia@expedite.com";
const AUDITORA = "a.rodriguez@expedite.com";
const SOLO_LECTURA = "d.torres@expedite.com";
const RUTA_CONTROL = "/api/asistente/planes/7/controles/CTR-002";
const XLSX = "EV-XLSX";
const MSG = "EV-MSG";

function evidencia(id: string, nombre: string, formato: string, contenido: () => Promise<Buffer | null>): EvidenciaExpediente {
  return { id, nombre, formato, subidaPor: "Ana Rodríguez", fecha: "2026-10-23T09:00:00.000Z", hash: "abc", leer: contenido };
}

const pdfRevision = async () => crearPdfSencillo([["Revision de accesos: 5 usuarios revisados en julio 2026."]]);
const xlsxEjemplo = async () => EVIDENCIAS_EJEMPLO.find((e) => e.tipo === "xlsx")!.crearContenido();

function expedienteControl(evidencias: EvidenciaExpediente[]): ExpedienteControl {
  return {
    control: {
      id: "CTR-002",
      codigo: "CTR-002",
      nombre: "Segregación de Funciones",
      actividad: "Verificación semestral de que ningún usuario tiene acceso simultáneo a registro y autorización en el ERP.",
      tipo: "Detectivo",
      frecuencia: "Semestral",
      tamanoMuestra: "25",
      rotacion: "Trimestral",
    },
    plan: {
      id: 7,
      codigo: "PAA-2026-001",
      nombre: "Plan anual de Tecnología 2026",
      tipo: "Anual",
      periodo: null,
      fechaInicio: "2026-07-01",
      fechaFin: "2026-12-31",
      estado: "En Ejecución",
      alcance: "Accesos a sistemas financieros.",
      horasEstimadas: 120,
      responsable: "Carlos Senior",
    },
    asignaciones: [
      {
        auditor: "Ana Rodríguez",
        rol: "Auditor",
        lider: false,
        asignadoPor: "Carlos Senior",
        estado: "En Progreso",
        horas: 4,
        retroalimentacion: "Falta la evidencia de julio.",
        conflictoDeInteres: "sin_conflicto",
      },
    ],
    hallazgos: [{ folio: "HAL-2026-002", titulo: "Accesos privilegiados sin revisión", severidad: "Crítico", estado: "En Proceso" }],
    evidencias,
  };
}

function repositorio() {
  const archivos = [
    evidencia(XLSX, "Revision_accesos_Q3.xlsx", "xlsx", xlsxEjemplo),
    evidencia("EV-PDF", "Revision_julio.pdf", "pdf", pdfRevision),
    evidencia(MSG, "Correo_aprobacion.msg", "msg", async () => Buffer.from("x")),
  ];
  const control = expedienteControl(archivos);
  return new RepositorioAsistenteMemoria({
    controles: { "7:CTR-002": control },
    evidencias: Object.fromEntries(archivos.map((a) => [a.id, { evidencia: a, contexto: contextoDeControl(control, a.id) }])),
  });
}

function proveedorFalso(...respuestas: (string | Error)[]) {
  const llamadas: MensajeIA[][] = [];
  const proveedor: ProveedorIA = {
    nombre: "falso",
    async completar(mensajes) {
      llamadas.push(mensajes);
      const respuesta = respuestas[Math.min(llamadas.length - 1, respuestas.length - 1)] ?? "";
      if (respuesta instanceof Error) throw respuesta;
      return respuesta;
    },
  };
  return { proveedor, llamadas };
}

const json = (estado: string, respuesta: string) => JSON.stringify({ estado, respuesta });
const ultimo = (mensajes: MensajeIA[] | undefined) => mensajes?.at(-1)?.contenido ?? "";

let eventos: EventoBitacora[];

async function servidor(proveedorIA: ProveedorIA | null, repoAsistente = repositorio()): Promise<Server> {
  const usuarios = new RepositorioMemoria();
  return escuchar(
    crearApp({
      repo: usuarios,
      repoPlanes: new RepositorioPlanesMemoria(usuarios),
      repoPlanesAccion: new RepositorioPlanesAccionMemoria(usuarios),
      repoEvidencias: new RepositorioEvidenciasMemoria(),
      repoAsistente,
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
  delete: (ruta: string) => request(app).delete(ruta).set("X-Dev-Usuario", correo),
});

beforeEach(() => {
  eventos = [];
});

describe("conversación sobre una evidencia de control", () => {
  it("manda el archivo como documento y el control y el plan como contexto", async () => {
    const { proveedor, llamadas } = proveedorFalso(json("respondida", "La muestra tiene 5 usuarios."));
    const app = await servidor(proveedor);

    const respuesta = await como(app, AUDITORA).post("/api/asistente/evidencias/EV-PDF/consultas").send({ pregunta: "¿Cuántos usuarios se revisaron?" });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ evidenciaId: "EV-PDF", tipo: "pregunta", estado: "respondida", recortado: false });
    const [mensajes] = llamadas;
    expect(mensajes?.[0]).toEqual({ rol: "sistema", contenido: INSTRUCCIONES_EVIDENCIA });
    const contenido = ultimo(mensajes);
    expect(contenido).toContain("<contexto_control>");
    expect(contenido).toContain('"tamanoMuestra": "25"');
    expect(contenido).toContain("PAA-2026-001");
    expect(contenido).toContain("Falta la evidencia de julio.");
    expect(contenido).toContain("HAL-2026-002");
    expect(contenido).toContain('<documento nombre="Revision_julio.pdf">');
    expect(contenido).toContain("5 usuarios revisados");
    // Las demás evidencias van solo por nombre; el archivo analizado no se repite en la lista.
    expect(contenido).toContain("Revision_accesos_Q3.xlsx");
    expect(contenido).toContain("Correo_aprobacion.msg");
    expect(contenido).not.toContain('<documento nombre="Revision_accesos_Q3.xlsx"');
    expect(contenido.match(/Revision_julio\.pdf/g)).toHaveLength(1);
  });

  it("describe el contexto y recuerda la conversación de cada usuario por archivo", async () => {
    const { proveedor, llamadas } = proveedorFalso(json("respondida", "Primera."), json("respondida", "Segunda."));
    const app = await servidor(proveedor);

    await como(app, AUDITORA).post("/api/asistente/evidencias/EV-PDF/consultas").send({ pregunta: "¿Qué periodo cubre?" });
    await como(app, AUDITORA).post("/api/asistente/evidencias/EV-PDF/consultas").send({ pregunta: "¿Y alcanza la muestra?" });

    expect(llamadas[1]?.map((m) => m.rol)).toEqual(["sistema", "usuario", "asistente", "usuario"]);
    const conversacion = await como(app, AUDITORA).get("/api/asistente/evidencias/EV-PDF/conversacion");
    expect(conversacion.status).toBe(200);
    expect(conversacion.body.evidencia).toEqual({ id: "EV-PDF", nombre: "Revision_julio.pdf" });
    expect(conversacion.body.contexto).toEqual({ tipo: "control", etiqueta: "Control CTR-002 · Plan PAA-2026-001" });
    expect(conversacion.body.mensajes).toHaveLength(4);
    // Otro archivo y otro usuario empiezan de cero.
    expect((await como(app, AUDITORA).get(`/api/asistente/evidencias/${XLSX}/conversacion`)).body.mensajes).toEqual([]);
    expect((await como(app, JEFA).get("/api/asistente/evidencias/EV-PDF/conversacion")).body.mensajes).toEqual([]);
  });

  it("valida el archivo contra el control y lo guarda como validación", async () => {
    const { proveedor, llamadas } = proveedorFalso(json("respondida", "Borrador: la muestra de 5 no alcanza los 25 requeridos."));
    const app = await servidor(proveedor);

    const respuesta = await como(app, AUDITORA).post("/api/asistente/evidencias/EV-PDF/consultas").send({ accion: "validar" });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.tipo).toBe("validacion");
    expect(ultimo(llamadas[0])).toContain("Tarea: evalúa si el documento cubre el control.");
    const { body } = await como(app, AUDITORA).get("/api/asistente/evidencias/EV-PDF/conversacion");
    expect(body.mensajes[0].texto).toBe(PREGUNTA_VALIDAR_CONTROL);
    expect(eventos).toEqual([
      {
        accion: "asistente.evidencia",
        actor: AUDITORA,
        detalle: { evidenciaId: "EV-PDF", contexto: "control", tipo: "validacion", resultado: "respondida" },
      },
    ]);
    expect(JSON.stringify(eventos)).not.toContain("muestra");
  });

  it("lee evidencias Excel y rechaza las que no tienen texto", async () => {
    const { proveedor, llamadas } = proveedorFalso(json("respondida", "Resumen."));
    const app = await servidor(proveedor);

    expect((await como(app, AUDITORA).post(`/api/asistente/evidencias/${XLSX}/consultas`).send({})).status).toBe(200);
    expect(ultimo(llamadas[0])).toContain("## Hoja:");
    expect(ultimo(llamadas[0])).toContain("Tarea: resume el documento.");
    const msg = await como(app, AUDITORA).post(`/api/asistente/evidencias/${MSG}/consultas`).send({});
    expect(msg.status).toBe(422);
    expect(llamadas).toHaveLength(1);
  });

  it("sustituye fuera de tema por el mensaje fijo de la evidencia", async () => {
    const { proveedor } = proveedorFalso(json("fuera_de_tema", "Un chiste"));
    const app = await servidor(proveedor);

    const respuesta = await como(app, AUDITORA).post("/api/asistente/evidencias/EV-PDF/consultas").send({ pregunta: "Cuéntame un chiste" });

    expect(respuesta.body.texto).toBe(MENSAJE_FUERA_DE_TEMA_EVIDENCIA);
  });

  it("si la IA falla responde 503 y no guarda el turno", async () => {
    const app = await servidor(proveedorFalso(new ErrorIA("IA_NO_DISPONIBLE", "caída")).proveedor);

    expect((await como(app, AUDITORA).post("/api/asistente/evidencias/EV-PDF/consultas").send({})).status).toBe(503);
    expect((await como(app, AUDITORA).get("/api/asistente/evidencias/EV-PDF/conversacion")).body.mensajes).toEqual([]);
  });

  it("borra la conversación del archivo", async () => {
    const app = await servidor(proveedorFalso(json("respondida", "Ok.")).proveedor);
    await como(app, AUDITORA).post("/api/asistente/evidencias/EV-PDF/consultas").send({});

    expect((await como(app, AUDITORA).delete("/api/asistente/evidencias/EV-PDF/conversacion")).status).toBe(204);

    expect((await como(app, AUDITORA).get("/api/asistente/evidencias/EV-PDF/conversacion")).body.mensajes).toEqual([]);
    expect(eventos.at(-1)).toMatchObject({ accion: "asistente.conversacion_borrada", detalle: { entidad: "evidencia", evidenciaId: "EV-PDF" } });
  });

  it("404 si no existe o no se ve, 403 para roles sin asistente y 400 al validar una evidencia de hallazgo", async () => {
    const pdf = evidencia("EV-HAL", "Hallazgo.pdf", "pdf", pdfRevision);
    const repoAsistente = new RepositorioAsistenteMemoria({
      evidencias: { "EV-HAL": { evidencia: pdf, contexto: { tipo: "hallazgo", etiqueta: "Hallazgo HAL-1", datos: {} } } },
    });
    const { proveedor, llamadas } = proveedorFalso(json("respondida", "Ok."));
    const app = await servidor(proveedor, repoAsistente);

    expect((await como(app, AUDITORA).post("/api/asistente/evidencias/EV-AJENA/consultas").send({})).status).toBe(404);
    expect((await como(app, AUDITORA).get("/api/asistente/evidencias/EV-AJENA/conversacion")).status).toBe(404);
    expect((await como(app, SOLO_LECTURA).get("/api/asistente/evidencias/EV-HAL/conversacion")).status).toBe(403);
    expect((await como(app, AUDITORA).post("/api/asistente/evidencias/EV-HAL/consultas").send({ accion: "validar" })).status).toBe(400);
    expect(llamadas).toHaveLength(0);
  });
});

describe("conversación sobre un control dentro de un plan", () => {
  it("manda el expediente del control con el texto de sus evidencias", async () => {
    const { proveedor, llamadas } = proveedorFalso(json("respondida", "Resumen de CTR-002."));
    const app = await servidor(proveedor);

    const respuesta = await como(app, AUDITORA).post(`${RUTA_CONTROL}/consultas`).send({});

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ planId: 7, controlId: "CTR-002", tipo: "resumen", texto: "Resumen de CTR-002." });
    const [mensajes] = llamadas;
    expect(mensajes?.[0]).toEqual({ rol: "sistema", contenido: INSTRUCCIONES_CONTROL });
    const contenido = ultimo(mensajes);
    expect(contenido).toContain("<expediente_control>");
    expect(contenido).toContain("Plan anual de Tecnología 2026");
    expect(contenido).toContain('<evidencia nombre="Revision_julio.pdf"');
    expect(contenido).toContain("5 usuarios revisados");
    expect(contenido).toContain("Formato sin lectura de texto");
    expect(contenido).toContain("Tarea: resume el control.");
    expect(eventos.at(-1)).toMatchObject({ accion: "asistente.control", detalle: { planId: 7, controlId: "CTR-002", tipo: "resumen", evidencias: 3 } });
  });

  it("recuerda la conversación por plan y control", async () => {
    const { proveedor, llamadas } = proveedorFalso(json("respondida", "Ok."));
    const app = await servidor(proveedor);

    await como(app, AUDITORA).post(`${RUTA_CONTROL}/consultas`).send({});
    await como(app, AUDITORA).post(`${RUTA_CONTROL}/consultas`).send({ pregunta: "¿Quién lo trabaja?" });

    expect(llamadas[1]?.[1]?.contenido).toBe(`<pregunta>${PREGUNTA_RESUMEN_CONTROL}</pregunta>`);
    const { body } = await como(app, AUDITORA).get(`${RUTA_CONTROL}/conversacion`);
    expect(body.control).toEqual({ id: "CTR-002", codigo: "CTR-002", nombre: "Segregación de Funciones" });
    expect(body.plan).toEqual({ id: 7, codigo: "PAA-2026-001", nombre: "Plan anual de Tecnología 2026" });
    expect(body.mensajes).toHaveLength(4);

    expect((await como(app, AUDITORA).delete(`${RUTA_CONTROL}/conversacion`)).status).toBe(204);
    expect((await como(app, AUDITORA).get(`${RUTA_CONTROL}/conversacion`)).body.mensajes).toEqual([]);
  });

  it("404 si el control no está en el plan o el plan no es numérico", async () => {
    const app = await servidor(proveedorFalso(json("respondida", "Ok.")).proveedor);

    expect((await como(app, AUDITORA).get("/api/asistente/planes/8/controles/CTR-002/conversacion")).status).toBe(404);
    expect((await como(app, AUDITORA).post("/api/asistente/planes/abc/controles/CTR-002/consultas").send({})).status).toBe(404);
  });
});
