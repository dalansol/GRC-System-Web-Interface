import type { Server } from "node:http";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { crearApp } from "../src/app.js";
import { crearVerificadorDev } from "../src/auth/verificador.js";
import type { EventoBitacora } from "../src/bitacora.js";
import { RepositorioEstructuraMemoria } from "../src/repos/estructuraMemoria.js";
import { RepositorioMemoria } from "../src/repos/memoria.js";
import { RepositorioPlanesAccionMemoria } from "../src/repos/planesAccionMemoria.js";
import { RepositorioPlanesMemoria } from "../src/repos/planesMemoria.js";
import { escuchar } from "./servidor.js";

const ADMIN = "s.ramirez@expedite.com";
const JEFA = "m.garcia@expedite.com";
const AUDITOR_SENIOR = "c.morales@expedite.com";

let app: Server;
let usuarios: RepositorioMemoria;
let estructura: RepositorioEstructuraMemoria;
let eventos: EventoBitacora[];

beforeEach(async () => {
  eventos = [];
  usuarios = new RepositorioMemoria();
  estructura = new RepositorioEstructuraMemoria(usuarios);
  app = await escuchar(
    crearApp({
      repo: usuarios,
      repoPlanes: new RepositorioPlanesMemoria(usuarios),
      repoPlanesAccion: new RepositorioPlanesAccionMemoria(usuarios),
      repoEstructura: estructura,
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
  patch: (ruta: string) => request(app).patch(ruta).set("X-Dev-Usuario", correo),
  delete: (ruta: string) => request(app).delete(ruta).set("X-Dev-Usuario", correo),
});

const idDe = async (correo: string) => (await usuarios.buscarPorCorreo(correo))!.id;

describe("Parametrización de la Estructura Organizacional (SF-03)", () => {
  describe("Periodos de auditoría", () => {
    it("permite consultar el periodo fiscal activo actual", async () => {
      const res = await como(JEFA).get("/api/periodos/activo");
      expect(res.status).toBe(200);
      expect(res.body.nombre).toBe("Fiscal 2026");
      expect(res.body.activo).toBe(true);
    });

    it("permite listar todos los periodos fiscales", async () => {
      const res = await como(JEFA).get("/api/periodos");
      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("CP-EST-01 y CP-EST-02: Alta de unidad de negocio con proceso inicial (AC1)", () => {
    it("como Jefe de Auditoría crea una unidad con proceso inicial y periodo activo", async () => {
      const jefaId = await idDe(JEFA);
      const res = await como(JEFA).post("/api/unidades-negocio").send({
        nombre: "Banca Minorista",
        proceso: "Originación de Créditos",
        responsableId: jefaId,
      });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.nombre).toBe("Banca Minorista");
      expect(res.body.periodoFiscalNombre).toBe("Fiscal 2026");
      expect(res.body.responsableId).toBe(jefaId);
      expect(res.body.procesos).toHaveLength(1);
      expect(res.body.procesos[0].nombre).toBe("Originación de Créditos");

      // Trazabilidad y bitácora
      const evento = eventos.find((e) => e.accion === "unidad_negocio.alta");
      expect(evento).toBeDefined();
      expect(evento?.actor).toBe(JEFA);
    });

    it("como Administrador crea una unidad de negocio válida", async () => {
      const jefaId = await idDe(JEFA);
      const res = await como(ADMIN).post("/api/unidades-negocio").send({
        nombre: "Tesorería Global",
        proceso: "Gestión de Liquidez",
        responsableId: jefaId,
      });

      expect(res.status).toBe(201);
      expect(res.body.nombre).toBe("Tesorería Global");
    });
  });

  describe("CP-EST-03: Control de acceso por roles (Seguridad / SNF-05)", () => {
    it("un auditor sin rol de gestión no puede dar de alta una unidad de negocio (403)", async () => {
      const jefaId = await idDe(JEFA);
      const res = await como(AUDITOR_SENIOR).post("/api/unidades-negocio").send({
        nombre: "Operaciones",
        proceso: "Conciliaciones",
        responsableId: jefaId,
      });

      expect(res.status).toBe(403);
      expect(res.body.error.codigo).toBe("ROL_NO_AUTORIZADO");
    });

    it("un auditor sin rol de gestión no puede eliminar una unidad de negocio (403)", async () => {
      const res = await como(AUDITOR_SENIOR).delete("/api/unidades-negocio/1");
      expect(res.status).toBe(403);
      expect(res.body.error.codigo).toBe("ROL_NO_AUTORIZADO");
    });
  });

  describe("CP-EST-04: Validación cuando no existe periodo activo (AC1)", () => {
    it("rechaza la creación de unidad con 400 si no hay ningún periodo activo", async () => {
      estructura.limpiarPeriodos();
      const jefaId = await idDe(JEFA);

      const res = await como(JEFA).post("/api/unidades-negocio").send({
        nombre: "Nueva Unidad",
        proceso: "Proceso Inicial",
        responsableId: jefaId,
      });

      expect(res.status).toBe(400);
      expect(res.body.error.codigo).toBe("PERIODO_ACTIVO_NO_CONFIGURADO");
    });
  });

  describe("CP-EST-05 y CP-EST-06: Bloqueo de nombres duplicados (AC2)", () => {
    it("rechaza crear una unidad con nombre duplicado con 409 NOMBRE_DUPLICADO", async () => {
      const jefaId = await idDe(JEFA);
      const cuerpo = {
        nombre: "Riesgos Corporativos",
        proceso: "Monitoreo",
        responsableId: jefaId,
      };

      const primera = await como(JEFA).post("/api/unidades-negocio").send(cuerpo);
      expect(primera.status).toBe(201);

      const segunda = await como(JEFA).post("/api/unidades-negocio").send(cuerpo);
      expect(segunda.status).toBe(409);
      expect(segunda.body.error.codigo).toBe("NOMBRE_DUPLICADO");
    });

    it("rechaza crear un proceso con nombre duplicado en la misma unidad con 409 NOMBRE_DUPLICADO", async () => {
      const jefaId = await idDe(JEFA);
      const altaUnidad = await como(JEFA).post("/api/unidades-negocio").send({
        nombre: "Finanzas",
        proceso: "Facturación",
        responsableId: jefaId,
      });
      const unidadId = altaUnidad.body.id;

      // Intentar agregar otro proceso con el mismo nombre "Facturación" a la misma unidad
      const res = await como(JEFA).post("/api/procesos").send({
        unidadNegocioId: unidadId,
        nombre: "Facturación",
      });

      expect(res.status).toBe(409);
      expect(res.body.error.codigo).toBe("NOMBRE_DUPLICADO");
    });
  });

  describe("CP-EST-07 y CP-EST-08: Bloqueo y eliminación de unidades y procesos (AC3)", () => {
    it("bloquea con 409 AUDITORIAS_ACTIVAS la eliminación de una unidad con auditorías activas", async () => {
      const jefaId = await idDe(JEFA);
      const resAlta = await como(JEFA).post("/api/unidades-negocio").send({
        nombre: "Ciberseguridad",
        proceso: "Gestión de Vulnerabilidades",
        responsableId: jefaId,
      });
      const unidadId = resAlta.body.id;

      // Simular auditorías activas vinculadas
      estructura.marcarUnidadConAuditoriaActiva(unidadId, true);

      const resDel = await como(JEFA).delete(`/api/unidades-negocio/${unidadId}`);
      expect(resDel.status).toBe(409);
      expect(resDel.body.error.codigo).toBe("AUDITORIAS_ACTIVAS");
    });

    it("permite eliminar una unidad sin auditorías activas y registra en bitácora", async () => {
      const jefaId = await idDe(JEFA);
      const resAlta = await como(JEFA).post("/api/unidades-negocio").send({
        nombre: "Soporte Técnico",
        proceso: "Mesa de Ayuda",
        responsableId: jefaId,
      });
      const unidadId = resAlta.body.id;

      const resDel = await como(JEFA).delete(`/api/unidades-negocio/${unidadId}`);
      expect(resDel.status).toBe(204);

      // Verificar que ya no existe
      const resGet = await como(JEFA).get(`/api/unidades-negocio/${unidadId}`);
      expect(resGet.status).toBe(404);

      // Evento en bitácora
      const evento = eventos.find((e) => e.accion === "unidad_negocio.baja");
      expect(evento).toBeDefined();
      expect(evento?.actor).toBe(JEFA);
    });

    it("bloquea con 409 AUDITORIAS_ACTIVAS la eliminación de un proceso con auditorías activas", async () => {
      const jefaId = await idDe(JEFA);
      const resAlta = await como(JEFA).post("/api/unidades-negocio").send({
        nombre: "Logística",
        proceso: "Despacho",
        responsableId: jefaId,
      });
      const procesoId = resAlta.body.procesos[0].id;

      estructura.marcarProcesoConAuditoriaActiva(procesoId, true);

      const resDel = await como(JEFA).delete(`/api/procesos/${procesoId}`);
      expect(resDel.status).toBe(409);
      expect(resDel.body.error.codigo).toBe("AUDITORIAS_ACTIVAS");
    });

    it("permite eliminar un proceso sin auditorías activas", async () => {
      const jefaId = await idDe(JEFA);
      const resAlta = await como(JEFA).post("/api/unidades-negocio").send({
        nombre: "Marketing",
        proceso: "Campañas",
        responsableId: jefaId,
      });
      const procesoId = resAlta.body.procesos[0].id;

      const resDel = await como(JEFA).delete(`/api/procesos/${procesoId}`);
      expect(resDel.status).toBe(204);

      const evento = eventos.find((e) => e.accion === "proceso.baja");
      expect(evento).toBeDefined();
    });
  });

  describe("Edición de unidades y procesos", () => {
    it("permite editar el nombre de una unidad de negocio", async () => {
      const jefaId = await idDe(JEFA);
      const resAlta = await como(JEFA).post("/api/unidades-negocio").send({
        nombre: "Recursos Humanos",
        proceso: "Nómina",
        responsableId: jefaId,
      });
      const unidadId = resAlta.body.id;

      const resEdit = await como(JEFA).patch(`/api/unidades-negocio/${unidadId}`).send({
        nombre: "Gestión del Talento",
      });

      expect(resEdit.status).toBe(200);
      expect(resEdit.body.nombre).toBe("Gestión del Talento");
    });

    it("permite editar el nombre de un proceso", async () => {
      const jefaId = await idDe(JEFA);
      const resAlta = await como(JEFA).post("/api/unidades-negocio").send({
        nombre: "Compras",
        proceso: "Licitaciones",
        responsableId: jefaId,
      });
      const procesoId = resAlta.body.procesos[0].id;

      const resEdit = await como(JEFA).patch(`/api/procesos/${procesoId}`).send({
        nombre: "Adjudicaciones",
      });

      expect(resEdit.status).toBe(200);
      expect(resEdit.body.nombre).toBe("Adjudicaciones");
    });
  });
});
