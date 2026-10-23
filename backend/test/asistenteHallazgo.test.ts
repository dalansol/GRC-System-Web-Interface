import type { Server } from "node:http";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { crearApp } from "../src/app.js";
import { prepararEvidencias } from "../src/asistente/expediente.js";
import {
  INSTRUCCIONES_HALLAZGO,
  MENSAJE_FUERA_DE_TEMA_HALLAZGO,
  MENSAJE_SIN_INFORMACION_HALLAZGO,
  PREGUNTA_RESUMEN_HALLAZGO,
} from "../src/asistente/instrucciones.js";
import { ErrorIA, type MensajeIA, type ProveedorIA } from "../src/asistente/proveedor.js";
import { crearVerificadorDev } from "../src/auth/verificador.js";
import type { EventoBitacora } from "../src/bitacora.js";
import type { EvidenciaExpediente, ExpedienteHallazgo } from "../src/repos/asistente.js";
import { RepositorioAsistenteMemoria } from "../src/repos/asistenteMemoria.js";
import type { LectorEvidencia, RepositorioEvidencias } from "../src/repos/evidencias.js";
import { crearPdfSencillo } from "../src/repos/evidenciasEjemplo.js";
import { RepositorioEvidenciasMemoria } from "../src/repos/evidenciasMemoria.js";
import { RepositorioMemoria } from "../src/repos/memoria.js";
import { RepositorioPlanesAccionMemoria } from "../src/repos/planesAccionMemoria.js";
import { RepositorioPlanesMemoria } from "../src/repos/planesMemoria.js";
import { escuchar } from "./servidor.js";

const JEFA = "m.garcia@expedite.com";
const AUDITORA = "a.rodriguez@expedite.com";
const SOLO_LECTURA = "d.torres@expedite.com";
const HALLAZGO = "FND-TEST-001";
const RUTA = `/api/asistente/hallazgos/${HALLAZGO}`;

function evidencia(nombre: string, formato: string, contenido: Buffer | null | Error): EvidenciaExpediente {
  return {
    id: `EV-${nombre}`,
    nombre,
    formato,
    subidaPor: "Ana Rodríguez",
    fecha: "2026-10-01T09:00:00.000Z",
    hash: "abc123",
    leer: async () => {
      if (contenido instanceof Error) throw contenido;
      return contenido;
    },
  };
}

function expedientePrueba(evidencias: EvidenciaExpediente[] = []): ExpedienteHallazgo {
  return {
    hallazgo: {
      id: HALLAZGO,
      folio: "HAL-2026-001",
      titulo: "Conciliaciones bancarias sin evidencia de aprobación",
      descripcion: "La muestra revisada no contiene evidencia suficiente de aprobación dual.",
      tipo: "Deficiencia de control",
      severidad: "Alto",
      estado: "Asignado",
      riesgoResidual: "Alto",
      controlFallido: "Conciliación Bancaria Mensual",
      responsable: "Laura Méndez",
      creadoEn: "2026-10-01T09:00:00.000Z",
    },
    auditoria: { id: "AUD-001", nombre: "Auditoría de Tesorería 2026", fechaCierre: "2026-12-15" },
    control: { id: "CTR-001", codigo: "CTR-001", nombre: "Conciliación Bancaria Mensual" },
    planAccion: {
      descripcion: "Implementar aprobación dual en el ERP.",
      responsable: "Laura Méndez",
      fechaCompromiso: "2027-01-31",
      estado: "Asignado",
    },
    evidencias,
  };
}

// Proveedor falso: responde en orden lo que se le indique y registra cada llamada.
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

let eventos: EventoBitacora[];

async function servidor(
  proveedorIA: ProveedorIA | null,
  {
    repoAsistente = new RepositorioAsistenteMemoria({ hallazgos: { [HALLAZGO]: expedientePrueba() } }),
    repoEvidencias = new RepositorioEvidenciasMemoria() as RepositorioEvidencias,
  } = {},
): Promise<Server> {
  const usuarios = new RepositorioMemoria();
  return escuchar(
    crearApp({
      repo: usuarios,
      repoPlanes: new RepositorioPlanesMemoria(usuarios),
      repoPlanesAccion: new RepositorioPlanesAccionMemoria(usuarios),
      repoEvidencias,
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

const ultimo = (mensajes: MensajeIA[] | undefined) => mensajes?.at(-1)?.contenido ?? "";

beforeEach(() => {
  eventos = [];
});

describe("conversación sobre un hallazgo", () => {
  it("manda las reglas y el expediente del backend delimitado como datos", async () => {
    const { proveedor, llamadas } = proveedorFalso(json("respondida", "Le corresponde a Laura Méndez."));
    const app = await servidor(proveedor);

    const respuesta = await como(app, AUDITORA).post(`${RUTA}/consultas`).send({ pregunta: "¿A quién le corresponde?" });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({
      hallazgoId: HALLAZGO,
      tipo: "respuesta",
      estado: "respondida",
      texto: "Le corresponde a Laura Méndez.",
      evidenciasRecortadas: [],
    });
    const [mensajes] = llamadas;
    expect(mensajes?.[0]).toEqual({ rol: "sistema", contenido: INSTRUCCIONES_HALLAZGO });
    expect(mensajes).toHaveLength(2);
    expect(ultimo(mensajes)).toContain("<expediente_hallazgo>");
    expect(ultimo(mensajes)).toContain("HAL-2026-001");
    expect(ultimo(mensajes)).toContain("2027-01-31");
    expect(ultimo(mensajes)).toContain("<pregunta>¿A quién le corresponde?</pregunta>");
  });

  it("recuerda los turnos anteriores del mismo usuario", async () => {
    const { proveedor, llamadas } = proveedorFalso(
      json("respondida", "El plan está Asignado."),
      json("respondida", "Vence el 2027-01-31."),
    );
    const app = await servidor(proveedor);

    await como(app, AUDITORA).post(`${RUTA}/consultas`).send({ pregunta: "¿Cómo va el plan de acción?" });
    await como(app, AUDITORA).post(`${RUTA}/consultas`).send({ pregunta: "¿Y cuándo vence?" });

    const segunda = llamadas[1]!;
    expect(segunda.map((m) => m.rol)).toEqual(["sistema", "usuario", "asistente", "usuario"]);
    expect(segunda[1]?.contenido).toBe("<pregunta>¿Cómo va el plan de acción?</pregunta>");
    expect(JSON.parse(segunda[2]!.contenido)).toEqual({ estado: "respondida", respuesta: "El plan está Asignado." });

    const conversacion = await como(app, AUDITORA).get(`${RUTA}/conversacion`);
    expect(conversacion.status).toBe(200);
    expect(conversacion.body.hallazgo).toEqual({
      id: HALLAZGO,
      folio: "HAL-2026-001",
      titulo: "Conciliaciones bancarias sin evidencia de aprobación",
    });
    expect(conversacion.body.mensajes.map((m: { rol: string; texto: string }) => [m.rol, m.texto])).toEqual([
      ["usuario", "¿Cómo va el plan de acción?"],
      ["asistente", "El plan está Asignado."],
      ["usuario", "¿Y cuándo vence?"],
      ["asistente", "Vence el 2027-01-31."],
    ]);
  });

  it("la conversación es privada de cada usuario", async () => {
    const { proveedor, llamadas } = proveedorFalso(json("respondida", "Respuesta."));
    const app = await servidor(proveedor);

    await como(app, AUDITORA).post(`${RUTA}/consultas`).send({ pregunta: "¿Cómo va el plan de acción?" });
    await como(app, JEFA).post(`${RUTA}/consultas`).send({ pregunta: "¿Qué severidad tiene?" });

    expect(llamadas[1]).toHaveLength(2);
    expect((await como(app, JEFA).get(`${RUTA}/conversacion`)).body.mensajes).toHaveLength(2);
  });

  it("sin pregunta resume el hallazgo y lo guarda como resumen", async () => {
    const { proveedor, llamadas } = proveedorFalso(json("respondida", "Resumen del hallazgo HAL-2026-001."));
    const app = await servidor(proveedor);

    const respuesta = await como(app, AUDITORA).post(`${RUTA}/consultas`).send({});

    expect(respuesta.body.tipo).toBe("resumen");
    expect(ultimo(llamadas[0])).toContain("Tarea: resume el hallazgo.");
    const { body } = await como(app, AUDITORA).get(`${RUTA}/conversacion`);
    expect(body.mensajes[0].texto).toBe(PREGUNTA_RESUMEN_HALLAZGO);
  });

  it("incluye el texto de las evidencias leídas del almacenamiento", async () => {
    const pdf = crearPdfSencillo([["Conciliacion firmada por Tesoreria el 12 de junio."]]);
    const repoAsistente = new RepositorioAsistenteMemoria({
      hallazgos: {
        [HALLAZGO]: expedientePrueba([
          evidencia("Conciliacion.pdf", "pdf", pdf),
          evidencia("Correo.msg", "msg", Buffer.from("x")),
          evidencia("Perdido.pdf", "pdf", null),
        ]),
      },
    });
    const { proveedor, llamadas } = proveedorFalso(json("respondida", "Ok."));
    const app = await servidor(proveedor, { repoAsistente });

    await como(app, AUDITORA).post(`${RUTA}/consultas`).send({ pregunta: "¿Qué dicen las evidencias?" });

    const contenido = ultimo(llamadas[0]);
    expect(contenido).toContain('<evidencia nombre="Conciliacion.pdf" subida_por="Ana Rodríguez">');
    expect(contenido).toContain("Conciliacion firmada por Tesoreria el 12 de junio.");
    expect(contenido).not.toContain('<evidencia nombre="Correo.msg"');
    expect(contenido).toContain("Formato sin lectura de texto");
    expect(contenido).toContain("No se pudo leer el archivo.");
    expect(eventos.at(-1)?.detalle).toMatchObject({ evidencias: 3 });
  });

  it("sustituye fuera de tema y sin información por mensajes fijos", async () => {
    const { proveedor } = proveedorFalso(json("fuera_de_tema", "Un chiste"), json("sin_informacion", "Inventado"));
    const app = await servidor(proveedor);

    const fuera = await como(app, AUDITORA).post(`${RUTA}/consultas`).send({ pregunta: "Cuéntame un chiste" });
    const sin = await como(app, AUDITORA).post(`${RUTA}/consultas`).send({ pregunta: "¿Cuánto costó la remediación?" });

    expect(fuera.body.texto).toBe(MENSAJE_FUERA_DE_TEMA_HALLAZGO);
    expect(sin.body.texto).toBe(MENSAJE_SIN_INFORMACION_HALLAZGO);
  });

  it("registra en la bitácora sin guardar preguntas ni respuestas", async () => {
    const { proveedor } = proveedorFalso(json("respondida", "Respuesta secreta."));
    const app = await servidor(proveedor);

    await como(app, AUDITORA).post(`${RUTA}/consultas`).send({ pregunta: "¿A quién le corresponde?" });

    expect(eventos).toEqual([
      {
        accion: "asistente.hallazgo",
        actor: AUDITORA,
        detalle: { hallazgoId: HALLAZGO, tipo: "pregunta", evidencias: 0, resultado: "respondida" },
      },
    ]);
    expect(JSON.stringify(eventos)).not.toContain("corresponde");
    expect(JSON.stringify(eventos)).not.toContain("secreta");
  });

  it("si la IA falla responde 503 y no guarda el turno", async () => {
    const { proveedor } = proveedorFalso(new ErrorIA("IA_TIEMPO_AGOTADO", "timeout"));
    const app = await servidor(proveedor);

    const respuesta = await como(app, AUDITORA).post(`${RUTA}/consultas`).send({ pregunta: "¿A quién le corresponde?" });

    expect(respuesta.status).toBe(503);
    expect((await como(app, AUDITORA).get(`${RUTA}/conversacion`)).body.mensajes).toEqual([]);
  });

  it("responde 503 si la IA está desactivada, pero deja leer la conversación", async () => {
    const app = await servidor(null);

    expect((await como(app, AUDITORA).post(`${RUTA}/consultas`).send({ pregunta: "¿A quién le corresponde?" })).status).toBe(503);
    expect((await como(app, AUDITORA).get(`${RUTA}/conversacion`)).status).toBe(200);
  });

  it("borra la conversación del usuario y lo registra", async () => {
    const { proveedor, llamadas } = proveedorFalso(json("respondida", "Respuesta."));
    const app = await servidor(proveedor);
    await como(app, AUDITORA).post(`${RUTA}/consultas`).send({ pregunta: "¿Cómo va el plan de acción?" });

    expect((await como(app, AUDITORA).delete(`${RUTA}/conversacion`)).status).toBe(204);

    expect((await como(app, AUDITORA).get(`${RUTA}/conversacion`)).body.mensajes).toEqual([]);
    await como(app, AUDITORA).post(`${RUTA}/consultas`).send({ pregunta: "¿Qué severidad tiene?" });
    expect(llamadas.at(-1)).toHaveLength(2);
    expect(eventos.map((e) => e.accion)).toContain("asistente.conversacion_borrada");
  });

  it("valida la pregunta, responde 404 si el hallazgo no existe y niega a roles sin asistente", async () => {
    const { proveedor, llamadas } = proveedorFalso(json("respondida", "Respuesta."));
    const app = await servidor(proveedor);

    expect((await como(app, AUDITORA).post(`${RUTA}/consultas`).send({ pregunta: "¿?" })).status).toBe(400);
    expect((await como(app, AUDITORA).post("/api/asistente/hallazgos/NO-EXISTE/consultas").send({})).status).toBe(404);
    expect((await como(app, AUDITORA).get("/api/asistente/hallazgos/NO-EXISTE/conversacion")).status).toBe(404);
    expect((await como(app, SOLO_LECTURA).post(`${RUTA}/consultas`).send({})).status).toBe(403);
    expect((await como(app, SOLO_LECTURA).get(`${RUTA}/conversacion`)).status).toBe(403);
    expect(llamadas).toHaveLength(0);
  });

  it("exige sesión", async () => {
    const app = await servidor(proveedorFalso("").proveedor);

    expect((await request(app).get(`${RUTA}/conversacion`)).status).toBe(401);
  });
});

describe("evidencias para el asistente", () => {
  it("el asistente de evidencias pide el archivo con el usuario en sesión", async () => {
    const lectores: LectorEvidencia[] = [];
    // Simula la regla de acceso: nadie puede ver esta evidencia.
    const repoEvidencias: RepositorioEvidencias = {
      async leerArchivo(_id, lector) {
        lectores.push(lector);
        return null;
      },
    };
    const app = await servidor(proveedorFalso(json("respondida", "x")).proveedor, { repoEvidencias });

    const respuesta = await como(app, AUDITORA).post("/api/asistente/evidencias/EV-AJENA/resumen");

    expect(respuesta.status).toBe(404);
    expect(lectores[0]).toMatchObject({ rol: "Auditor" });
    expect(typeof lectores[0]?.id).toBe("number");
  });

  it("reparte el tope: los archivos cortos van completos y los largos se recortan", async () => {
    const corto = crearPdfSencillo([["Texto corto."]]);
    const largo = crearPdfSencillo([Array.from({ length: 40 }, (_, i) => `Renglon largo numero ${i} con datos de auditoria.`)]);

    const [a, b] = await prepararEvidencias([evidencia("corto.pdf", "pdf", corto), evidencia("largo.pdf", "pdf", largo)], 500);

    expect(a?.recortado).toBe(false);
    expect(a?.texto).toContain("Texto corto.");
    expect(b?.recortado).toBe(true);
    expect((a?.texto?.length ?? 0) + (b?.texto?.length ?? 0)).toBeLessThanOrEqual(500);
  });

  it("un archivo que falla al leerse no detiene a los demás", async () => {
    const [a, b] = await prepararEvidencias([
      evidencia("roto.pdf", "pdf", new Error("R2 caído")),
      evidencia("bien.pdf", "pdf", crearPdfSencillo([["Contenido valido."]])),
    ]);

    expect(a).toMatchObject({ texto: null, nota: "No se pudo leer el archivo." });
    expect(b?.texto).toContain("Contenido valido.");
  });
});
