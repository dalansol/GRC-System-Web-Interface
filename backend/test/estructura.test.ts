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
import { SEMILLA_ESTRUCTURA } from "../src/repos/semillaEstructura.js";
import { escuchar } from "./servidor.js";

const ADMIN = "s.ramirez@expedite.com";
const JEFA = "m.garcia@expedite.com";
const AUDITOR_SENIOR = "c.morales@expedite.com";
const AUDITOR = "a.rodriguez@expedite.com";
const INACTIVO = "p.sanchez@expedite.com";

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

async function altaUnidad(nombre: string, correo = JEFA) {
  return como(correo).post("/api/unidades-negocio").send({
    nombre,
    responsableId: await idDe(JEFA),
    departamentoAuditoriaId: 1,
  });
}

/** Crea una unidad con una rama completa y devuelve los ids de cada nivel. */
async function altaRama(nombre: string) {
  const unidadId = (await altaUnidad(nombre)).body.id as number;
  const divisionId = (await como(JEFA).post("/api/divisiones").send({ nombre: "DIVISION-0001", padreId: unidadId })).body
    .id as number;
  const subdivisionId = (
    await como(JEFA).post("/api/subdivisiones").send({ nombre: "SUBDIVISION-0001", padreId: divisionId, pais: "México" })
  ).body.id as number;
  const areaId = (await como(JEFA).post("/api/areas").send({ nombre: "Nómina", padreId: subdivisionId })).body
    .id as number;
  return { unidadId, divisionId, subdivisionId, areaId };
}

describe("Parametrización de la estructura organizacional (SF-03)", () => {
  describe("Periodos de auditoría", () => {
    it("consulta el periodo trimestral activo", async () => {
      const res = await como(AUDITOR).get("/api/periodos/activo");
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ nombre: "2026Q4", activo: true });
    });

    it("al activar un periodo nuevo desactiva el anterior y lo registra en bitácora", async () => {
      const res = await como(ADMIN).post("/api/periodos").send({
        nombre: "2027Q1",
        fechaInicio: "2027-01-01",
        fechaFin: "2027-03-31",
        activo: true,
      });
      expect(res.status).toBe(201);
      const periodos = (await como(JEFA).get("/api/periodos")).body as Array<{ nombre: string; activo: boolean }>;
      expect(periodos.filter((p) => p.activo).map((p) => p.nombre)).toEqual(["2027Q1"]);
      expect(eventos.some((e) => e.accion === "periodo.alta")).toBe(true);
    });

    it("rechaza fechas invertidas y nombres de periodo repetidos", async () => {
      const invertido = await como(JEFA).post("/api/periodos").send({
        nombre: "2027Q2",
        fechaInicio: "2027-06-30",
        fechaFin: "2027-04-01",
      });
      expect(invertido.status).toBe(400);

      const repetido = await como(JEFA).post("/api/periodos").send({
        nombre: "2026q4",
        fechaInicio: "2026-10-01",
        fechaFin: "2026-12-31",
      });
      expect(repetido.status).toBe(409);
      expect(repetido.body.error.codigo).toBe("NOMBRE_DUPLICADO");
    });

    it("lista los departamentos de auditoría", async () => {
      const res = await como(AUDITOR).get("/api/departamentos-auditoria");
      expect(res.body.map((d: { nombre: string }) => d.nombre)).toEqual(["Retail & Spin", "Beverage"]);
    });
  });

  describe("CP-EST-01: Alta en la jerarquía con periodo activo (AC1)", () => {
    it("como Jefe de Auditoría crea una unidad con gerente, departamento y periodo activo", async () => {
      const res = await altaUnidad("UDN-0001");
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        nombre: "UDN-0001",
        responsableId: await idDe(JEFA),
        periodoFiscalNombre: "2026Q4",
        departamentoAuditoriaNombre: "Retail & Spin",
        divisiones: [],
      });

      const evento = eventos.find((e) => e.accion === "estructura.alta");
      expect(evento?.actor).toBe(JEFA);
      expect(evento?.detalle.nivel).toBe("unidad");
    });

    it("la rama completa queda visible en el catálogo central para cualquier usuario con sesión", async () => {
      await altaRama("UDN-0003");
      const res = await como(AUDITOR).get("/api/unidades-negocio");
      expect(res.status).toBe(200);
      const [unidad] = res.body;
      expect(unidad.divisiones[0].nombre).toBe("DIVISION-0001");
      expect(unidad.divisiones[0].subdivisiones[0]).toMatchObject({ nombre: "SUBDIVISION-0001", pais: "México" });
      expect(unidad.divisiones[0].subdivisiones[0].areas[0].nombre).toBe("Nómina");
    });

    it("como Administrador también puede dar de alta", async () => {
      expect((await altaUnidad("UDN-0002", ADMIN)).status).toBe(201);
    });

    it("rechaza crear un nodo cuyo padre no existe (404)", async () => {
      const res = await como(JEFA).post("/api/areas").send({ nombre: "Compras", padreId: 999 });
      expect(res.status).toBe(404);
    });
  });

  describe("CP-EST-02: Control de acceso por roles (SNF-05)", () => {
    it("un Auditor no puede dar de alta unidades ni nodos (403)", async () => {
      const unidad = await como(AUDITOR).post("/api/unidades-negocio").send({ nombre: "X", responsableId: 1 });
      expect(unidad.status).toBe(403);
      expect(unidad.body.error.codigo).toBe("ROL_NO_AUTORIZADO");

      const division = await como(AUDITOR_SENIOR).post("/api/divisiones").send({ nombre: "X", padreId: 1 });
      expect(division.status).toBe(403);
    });

    it("un Auditor no puede eliminar (403)", async () => {
      const res = await como(AUDITOR_SENIOR).delete("/api/unidades-negocio/1");
      expect(res.status).toBe(403);
    });
  });

  describe("CP-EST-03: Gerente responsable", () => {
    it("rechaza un gerente inexistente, inactivo o sin rol Jefe de Auditoría (400)", async () => {
      for (const responsableId of [9999, await idDe(INACTIVO), await idDe(AUDITOR)]) {
        const res = await como(JEFA).post("/api/unidades-negocio").send({ nombre: "UDN-0009", responsableId });
        expect(res.status).toBe(400);
        expect(res.body.error.codigo).toBe("DATOS_INVALIDOS");
      }
    });

    it("solo ofrece Jefes de Auditoría activos como responsables", async () => {
      const res = await como(ADMIN).get("/api/unidades-negocio/responsables");
      expect(res.body.map((u: { correo: string }) => u.correo)).toEqual([JEFA]);
    });
  });

  describe("CP-EST-04: Sin periodo activo", () => {
    it("rechaza el alta con 409 PERIODO_ACTIVO_NO_CONFIGURADO", async () => {
      estructura.limpiarPeriodos();
      const res = await altaUnidad("UDN-0004");
      expect(res.status).toBe(409);
      expect(res.body.error.codigo).toBe("PERIODO_ACTIVO_NO_CONFIGURADO");
    });
  });

  describe("CP-EST-05: Nombres duplicados (AC2)", () => {
    // La intercalación sin_mayusculas ignora mayúsculas pero distingue acentos.
    it("rechaza una unidad con el mismo nombre, sin importar mayúsculas", async () => {
      expect((await altaUnidad("Proximidad y Salud")).status).toBe(201);
      for (const nombre of ["Proximidad y Salud", "PROXIMIDAD Y SALUD", "  proximidad y salud "]) {
        const res = await altaUnidad(nombre);
        expect(res.status).toBe(409);
        expect(res.body.error.codigo).toBe("NOMBRE_DUPLICADO");
      }
    });

    it("rechaza renombrar una unidad con el nombre de otra", async () => {
      await altaUnidad("UDN-0001");
      const otra = (await altaUnidad("UDN-0002")).body.id;
      const res = await como(JEFA).patch(`/api/unidades-negocio/${otra}`).send({ nombre: "udn-0001" });
      expect(res.status).toBe(409);
    });

    it("permite áreas con el mismo nombre en subdivisiones distintas", async () => {
      const a = await altaRama("UDN-0001");
      const b = await altaRama("UDN-0002");
      const repetida = await como(JEFA).post("/api/areas").send({ nombre: "Recursos Humanos", padreId: a.subdivisionId });
      const otra = await como(JEFA).post("/api/areas").send({ nombre: "Recursos Humanos", padreId: b.subdivisionId });
      expect(repetida.status).toBe(201);
      expect(otra.status).toBe(201);
    });
  });

  describe("CP-EST-06: Bloqueo de eliminación con auditorías activas (AC3)", () => {
    it.each(["Aprobado", "En Ejecución"])("bloquea cada nivel de la rama con un plan %s", async (estado) => {
      const rama = await altaRama("UDN-0005");
      estructura.registrarAuditoria(rama.subdivisionId, estado);

      for (const [ruta, id] of [
        ["areas", rama.areaId],
        ["subdivisiones", rama.subdivisionId],
        ["divisiones", rama.divisionId],
        ["unidades-negocio", rama.unidadId],
      ] as const) {
        const res = await como(JEFA).delete(`/api/${ruta}/${id}`);
        expect(res.status).toBe(409);
        expect(res.body.error.codigo).toBe("AUDITORIAS_ACTIVAS");
      }
    });

    it.each(["Borrador", "Cerrado"])("con un plan %s permite eliminar de la hoja a la raíz", async (estado) => {
      const rama = await altaRama("UDN-0006");
      estructura.registrarAuditoria(rama.subdivisionId, estado);

      for (const [ruta, id] of [
        ["areas", rama.areaId],
        ["subdivisiones", rama.subdivisionId],
        ["divisiones", rama.divisionId],
        ["unidades-negocio", rama.unidadId],
      ] as const) {
        expect((await como(JEFA).delete(`/api/${ruta}/${id}`)).status).toBe(204);
      }
      expect((await como(JEFA).get(`/api/unidades-negocio/${rama.unidadId}`)).status).toBe(404);
      expect(eventos.filter((e) => e.accion === "estructura.baja")).toHaveLength(4);
    });

    it("no elimina en cascada: un nodo con hijos responde 409 HIJOS_EXISTENTES", async () => {
      const rama = await altaRama("UDN-0007");
      const res = await como(JEFA).delete(`/api/divisiones/${rama.divisionId}`);
      expect(res.status).toBe(409);
      expect(res.body.error.codigo).toBe("HIJOS_EXISTENTES");
    });
  });

  describe("Riesgos en la jerarquía (consolidación con el explorador de riesgos)", () => {
    it("los riesgos registrados aparecen bajo su subdivisión en el catálogo", async () => {
      const rama = await altaRama("UDN-0001");
      estructura.registrarRiesgo(rama.subdivisionId, {
        nombre: "Pagos de nómina sin doble aprobación",
        nivel: "Alto",
        procedimientoControl: "Doble aprobación del layout",
      });

      const res = await como(AUDITOR).get("/api/unidades-negocio");
      expect(res.body[0].divisiones[0].subdivisiones[0].riesgos).toEqual([
        { id: 1, nombre: "Pagos de nómina sin doble aprobación", nivel: "Alto", procedimientoControl: "Doble aprobación del layout" },
      ]);
    });

    it("no elimina una subdivisión con riesgos registrados (409 HIJOS_EXISTENTES)", async () => {
      const rama = await altaRama("UDN-0002");
      await como(JEFA).delete(`/api/areas/${rama.areaId}`);
      estructura.registrarRiesgo(rama.subdivisionId, { nombre: "Fraude", nivel: null, procedimientoControl: null });

      const res = await como(JEFA).delete(`/api/subdivisiones/${rama.subdivisionId}`);
      expect(res.status).toBe(409);
      expect(res.body.error.codigo).toBe("HIJOS_EXISTENTES");
    });
  });

  describe("Nombre real (opcional) junto al código", () => {
    it("se guarda al dar de alta y editar una unidad, sin afectar la regla de nombre único", async () => {
      const alta = await como(JEFA).post("/api/unidades-negocio").send({
        nombre: "UDN-0003",
        nombreReal: "  KOF ",
        responsableId: await idDe(JEFA),
      });
      expect(alta.status).toBe(201);
      expect(alta.body).toMatchObject({ nombre: "UDN-0003", nombreReal: "KOF" });

      // El nombre real no es único ni cuenta para el duplicado: el código sí.
      const otra = await como(JEFA).post("/api/unidades-negocio").send({
        nombre: "UDN-0099",
        nombreReal: "KOF",
        responsableId: await idDe(JEFA),
      });
      expect(otra.status).toBe(201);

      // Vacío lo quita.
      const editada = await como(JEFA).patch(`/api/unidades-negocio/${alta.body.id}`).send({ nombreReal: "" });
      expect(editada.status).toBe(200);
      expect(editada.body.nombreReal).toBeNull();
    });

    it("división y subdivisión lo aceptan; el área lo ignora porque su nombre ya es el real", async () => {
      const rama = await altaRama("UDN-0003");
      const division = await como(JEFA).patch(`/api/divisiones/${rama.divisionId}`).send({ nombreReal: "Latam" });
      expect(division.body).toMatchObject({ nombre: "DIVISION-0001", nombreReal: "Latam" });

      const area = await como(JEFA).post("/api/areas").send({ nombre: "Fletes", nombreReal: "Ignorado", padreId: rama.subdivisionId });
      expect(area.status).toBe(201);
      expect(area.body.nombreReal).toBeNull();

      const unidad = (await como(AUDITOR).get(`/api/unidades-negocio/${rama.unidadId}`)).body;
      expect(unidad.divisiones[0].nombreReal).toBe("Latam");
      expect(unidad.divisiones[0].subdivisiones[0].nombreReal).toBeNull();
    });

    it("rechaza un nombre real de más de 150 caracteres (400)", async () => {
      const res = await como(JEFA).post("/api/unidades-negocio").send({
        nombre: "UDN-0010",
        nombreReal: "x".repeat(151),
        responsableId: await idDe(JEFA),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("Semilla del Consolidado (DATA_MODE=memoria)", () => {
    it("carga las 6 unidades con toda su jerarquía y riesgos a cargo del Jefe de Auditoría", async () => {
      estructura.sembrar(SEMILLA_ESTRUCTURA, await idDe(JEFA));

      const unidades = (await como(AUDITOR).get("/api/unidades-negocio")).body as Array<{
        nombre: string;
        responsableNombre: string;
        departamentoAuditoriaNombre: string;
        divisiones: Array<{ subdivisiones: Array<{ areas: unknown[]; riesgos: unknown[] }> }>;
      }>;
      const subdivisiones = unidades.flatMap((u) => u.divisiones.flatMap((d) => d.subdivisiones));
      expect(unidades.map((u) => u.nombre)).toEqual(["UDN-0001", "UDN-0002", "UDN-0003", "UDN-0004", "UDN-0005", "UDN-0006"]);
      expect(unidades.every((u) => u.responsableNombre === "María García")).toBe(true);
      expect(unidades.find((u) => u.nombre === "UDN-0003")?.departamentoAuditoriaNombre).toBe("Beverage");
      expect(subdivisiones).toHaveLength(40);
      expect(subdivisiones.flatMap((s) => s.areas)).toHaveLength(343);
      expect(subdivisiones.flatMap((s) => s.riesgos)).toHaveLength(251);

      // Nombres reales inferidos del deck (022): el código se conserva.
      const kof = (await como(AUDITOR).get("/api/unidades-negocio")).body.find(
        (u: { nombre: string }) => u.nombre === "UDN-0003",
      );
      expect(kof.nombreReal).toBe("KOF");
      expect(kof.divisiones.map((d: { nombreReal: string }) => d.nombreReal).sort()).toEqual([
        "Brasil",
        "Corporativo",
        "Latam",
        "México",
      ]);
    });
  });

  describe("Edición", () => {
    it("edita nombre, gerente y departamento de una unidad y lo registra en bitácora", async () => {
      const id = (await altaUnidad("UDN-0001")).body.id;
      const res = await como(JEFA).patch(`/api/unidades-negocio/${id}`).send({
        nombre: "UDN-0010",
        departamentoAuditoriaId: 2,
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ nombre: "UDN-0010", departamentoAuditoriaNombre: "Beverage" });
      expect(eventos.some((e) => e.accion === "estructura.edicion")).toBe(true);
    });

    it("edita el nombre y país de una subdivisión", async () => {
      const rama = await altaRama("UDN-0001");
      const res = await como(JEFA).patch(`/api/subdivisiones/${rama.subdivisionId}`).send({
        nombre: "SUBDIVISION-0002",
        pais: "KFS RTR",
      });
      expect(res.status).toBe(200);
      const unidad = (await como(JEFA).get(`/api/unidades-negocio/${rama.unidadId}`)).body;
      expect(unidad.divisiones[0].subdivisiones[0]).toMatchObject({ nombre: "SUBDIVISION-0002", pais: "KFS RTR" });
    });

    it("rechaza un departamento de auditoría inexistente (400)", async () => {
      const id = (await altaUnidad("UDN-0001")).body.id;
      const res = await como(JEFA).patch(`/api/unidades-negocio/${id}`).send({ departamentoAuditoriaId: 99 });
      expect(res.status).toBe(400);
    });
  });
});
