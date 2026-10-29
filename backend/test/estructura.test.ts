import type { Server } from "node:http";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { crearApp } from "../src/app.js";
import { crearVerificadorDev } from "../src/auth/verificador.js";
import type { EventoBitacora } from "../src/bitacora.js";
import { RepositorioEstructuraMemoria } from "../src/repos/estructuraMemoria.js";
import { RepositorioEvidenciasMemoria } from "../src/repos/evidenciasMemoria.js";
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
  patch: (ruta: string) => request(app).patch(ruta).set("X-Dev-Usuario", correo),
  delete: (ruta: string) => request(app).delete(ruta).set("X-Dev-Usuario", correo),
});

const idDe = async (correo: string) => (await usuarios.buscarPorCorreo(correo))!.id;

/** Alta de unidad; el código lo asigna el sistema (UDN-0001, UDN-0002… en un repositorio vacío). */
async function altaUnidad(nombre: string | null = null, correo = JEFA) {
  return como(correo).post("/api/unidades-negocio").send({
    nombre,
    responsableId: await idDe(JEFA),
    departamentoAuditoriaId: 1,
  });
}

/** Crea una unidad con una rama completa y devuelve los ids de cada nivel. */
async function altaRama() {
  const unidadId = (await altaUnidad()).body.id as number;
  const divisionId = (await como(JEFA).post("/api/divisiones").send({ padreId: unidadId })).body.id as number;
  const subdivisionId = (await como(JEFA).post("/api/subdivisiones").send({ padreId: divisionId, pais: "México" })).body
    .id as number;
  const areaId = (await como(JEFA).post("/api/areas").send({ nombre: "Nómina", padreId: subdivisionId })).body
    .id as number;
  return { unidadId, divisionId, subdivisionId, areaId };
}

describe("Parametrización de la estructura organizacional (SF-03)", () => {
  describe("Periodos de auditoría", () => {
    it("consulta el periodo trimestral activo", async () => {
      const res = await como(AUDITOR).get("/api/periodos/activo");
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ nombre: "2026 Q4", activo: true });
    });

    it("al activar un periodo nuevo desactiva el anterior y lo registra en bitácora", async () => {
      const res = await como(ADMIN).post("/api/periodos").send({
        nombre: "2027 Q1",
        fechaInicio: "2027-01-01",
        fechaFin: "2027-03-31",
        activo: true,
      });
      expect(res.status).toBe(201);
      const periodos = (await como(JEFA).get("/api/periodos")).body as Array<{ nombre: string; activo: boolean }>;
      expect(periodos.filter((p) => p.activo).map((p) => p.nombre)).toEqual(["2027 Q1"]);
      expect(eventos.some((e) => e.accion === "periodo.alta")).toBe(true);
    });

    it("rechaza fechas invertidas y nombres de periodo repetidos", async () => {
      const invertido = await como(JEFA).post("/api/periodos").send({
        nombre: "2027 Q2",
        fechaInicio: "2027-06-30",
        fechaFin: "2027-04-01",
      });
      expect(invertido.status).toBe(400);

      const repetido = await como(JEFA).post("/api/periodos").send({
        nombre: "2026 q4",
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
      const res = await altaUnidad();
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        codigo: "UDN-0001",
        nombre: null,
        responsableId: await idDe(JEFA),
        periodoFiscalNombre: "2026 Q4",
        departamentoAuditoriaNombre: "Retail & Spin",
        divisiones: [],
      });

      const evento = eventos.find((e) => e.accion === "estructura.alta");
      expect(evento?.actor).toBe(JEFA);
      expect(evento?.detalle).toMatchObject({ nivel: "unidad", codigo: "UDN-0001" });
    });

    it("la rama completa queda visible en el catálogo central para cualquier usuario con sesión", async () => {
      await altaRama();
      const res = await como(AUDITOR).get("/api/unidades-negocio");
      expect(res.status).toBe(200);
      const [unidad] = res.body;
      expect(unidad.divisiones[0].codigo).toBe("DIVISION-0001");
      expect(unidad.divisiones[0].subdivisiones[0]).toMatchObject({ codigo: "SUBDIVISION-0001", pais: "México" });
      expect(unidad.divisiones[0].subdivisiones[0].areas[0].nombre).toBe("Nómina");
    });

    it("como Administrador también puede dar de alta", async () => {
      expect((await altaUnidad(null, ADMIN)).status).toBe(201);
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
        const res = await como(JEFA).post("/api/unidades-negocio").send({ responsableId });
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
      const res = await altaUnidad();
      expect(res.status).toBe(409);
      expect(res.body.error.codigo).toBe("PERIODO_ACTIVO_NO_CONFIGURADO");
    });
  });

  describe("CP-EST-05: Código asignado por el sistema (AC2)", () => {
    it("asigna el siguiente código de cada nivel, en todo el catálogo", async () => {
      const a = await altaRama();
      const b = await altaRama();
      const codigos = async (unidadId: number) => {
        const u = (await como(AUDITOR).get(`/api/unidades-negocio/${unidadId}`)).body;
        return [u.codigo, u.divisiones[0].codigo, u.divisiones[0].subdivisiones[0].codigo];
      };
      expect(await codigos(a.unidadId)).toEqual(["UDN-0001", "DIVISION-0001", "SUBDIVISION-0001"]);
      expect(await codigos(b.unidadId)).toEqual(["UDN-0002", "DIVISION-0002", "SUBDIVISION-0002"]);
      // El área no tiene código.
      const area = (await como(AUDITOR).get(`/api/unidades-negocio/${a.unidadId}`)).body.divisiones[0].subdivisiones[0].areas[0];
      expect(area).not.toHaveProperty("codigo");
    });

    it("rechaza un código enviado por el usuario (400)", async () => {
      const rama = await altaRama();
      for (const [ruta, cuerpo] of [
        ["unidades-negocio", { codigo: "UDN-0099", responsableId: await idDe(JEFA) }],
        ["divisiones", { codigo: "DIVISION-0099", padreId: rama.unidadId }],
        ["subdivisiones", { codigo: "SUBDIVISION-0099", padreId: rama.divisionId }],
        ["areas", { codigo: "A-1", nombre: "Fletes", padreId: rama.subdivisionId }],
      ] as const) {
        const res = await como(JEFA).post(`/api/${ruta}`).send(cuerpo);
        expect(res.status, ruta).toBe(400);
        expect(res.body.error.mensaje).toMatch(/lo asigna el sistema/);
      }
    });

    it("reutiliza el código del último elemento eliminado y deja el hueco de uno intermedio", async () => {
      const primera = (await altaUnidad()).body.id;
      await altaUnidad();
      const tercera = (await altaUnidad()).body.id;
      // Borrar una intermedia (UDN-0001) deja el hueco: sigue UDN-0004.
      expect((await como(JEFA).delete(`/api/unidades-negocio/${primera}`)).status).toBe(204);
      const cuarta = await altaUnidad();
      expect(cuarta.body.codigo).toBe("UDN-0004");
      // Borrar la última (UDN-0004) libera su código; la UDN-0003 sigue.
      expect((await como(JEFA).delete(`/api/unidades-negocio/${cuarta.body.id}`)).status).toBe(204);
      expect((await altaUnidad()).body.codigo).toBe("UDN-0004");
      expect((await como(JEFA).get(`/api/unidades-negocio/${tercera}`)).body.codigo).toBe("UDN-0003");
    });

    it("la vista previa del código coincide con la del alta, también tras borrar, y no lo consume", async () => {
      const proximo = async (nivel: string) => (await como(JEFA).get(`/api/codigos-proximos/${nivel}`)).body.codigo;
      expect(await proximo("unidad")).toBe("UDN-0001");
      await altaUnidad();
      const segunda = (await altaUnidad()).body.id;
      expect((await como(JEFA).delete(`/api/unidades-negocio/${segunda}`)).status).toBe(204);
      expect(await proximo("unidad")).toBe("UDN-0002");
      expect(await proximo("unidad")).toBe("UDN-0002");
      expect(await proximo("division")).toBe("DIVISION-0001");
      expect((await altaUnidad()).body.codigo).toBe("UDN-0002");
    });

    it("la vista previa del código es solo para gestión y valida el nivel", async () => {
      expect((await como(ADMIN).get("/api/codigos-proximos/subdivision")).status).toBe(200);
      const auditor = await como(AUDITOR).get("/api/codigos-proximos/unidad");
      expect(auditor.status).toBe(403);
      const area = await como(JEFA).get("/api/codigos-proximos/area");
      expect(area.status).toBe(400);
      expect(area.body.error.codigo).toBe("DATOS_INVALIDOS");
    });

    it("con el Consolidado cargado continúa después del código más alto de cada nivel", async () => {
      estructura.sembrar(SEMILLA_ESTRUCTURA, await idDe(JEFA));
      const mayor = (codigos: string[]) => Math.max(...codigos.map((c) => Number(/^[A-Z]+-(\d+)$/.exec(c)?.[1] ?? 0)));
      const divisiones = SEMILLA_ESTRUCTURA.flatMap((u) => u.divisiones);
      const subdivisiones = divisiones.flatMap((d) => d.subdivisiones);

      const unidad = (await altaUnidad()).body;
      expect(unidad.codigo).toBe("UDN-0007");
      const division = (await como(JEFA).post("/api/divisiones").send({ padreId: unidad.id })).body;
      expect(division.codigo).toBe(`DIVISION-${String(mayor(divisiones.map((d) => d.nombre)) + 1).padStart(4, "0")}`);
      const subdivision = (await como(JEFA).post("/api/subdivisiones").send({ padreId: division.id })).body;
      expect(subdivision.codigo).toBe(`SUBDIVISION-${String(mayor(subdivisiones.map((s) => s.nombre)) + 1).padStart(4, "0")}`);
    });

    it("permite áreas con el mismo nombre en subdivisiones distintas", async () => {
      const a = await altaRama();
      const b = await altaRama();
      const repetida = await como(JEFA).post("/api/areas").send({ nombre: "Recursos Humanos", padreId: a.subdivisionId });
      const otra = await como(JEFA).post("/api/areas").send({ nombre: "Recursos Humanos", padreId: b.subdivisionId });
      expect(repetida.status).toBe(201);
      expect(otra.status).toBe(201);
    });
  });

  describe("CP-EST-05: Nombres duplicados (AC2)", () => {
    it("rechaza una unidad con un nombre que ya existe, sin distinguir mayúsculas (alta y renombre)", async () => {
      expect((await altaUnidad("KOF")).status).toBe(201);

      const repetida = await altaUnidad("kof");
      expect(repetida.status).toBe(409);
      expect(repetida.body.error.codigo).toBe("NOMBRE_DUPLICADO");
      expect(repetida.body.error.mensaje).toMatch(/Ya existe una unidad de negocio/);

      const otra = (await altaUnidad("Tragetta")).body.id as number;
      const renombre = await como(JEFA).patch(`/api/unidades-negocio/${otra}`).send({ nombre: "Kof" });
      expect(renombre.status).toBe(409);
      expect(renombre.body.error.codigo).toBe("NOMBRE_DUPLICADO");
    });

    it("permite varias unidades sin nombre y renombrar una unidad con su propio nombre", async () => {
      expect((await altaUnidad(null)).status).toBe(201);
      expect((await altaUnidad(null)).status).toBe(201);
      const kof = (await altaUnidad("KOF")).body.id as number;
      expect((await como(JEFA).patch(`/api/unidades-negocio/${kof}`).send({ nombre: "kof" })).status).toBe(200);
    });

    it("rechaza un área repetida en la misma subdivisión (alta y renombre)", async () => {
      const rama = await altaRama(); // ya tiene el área "Nómina"
      const repetida = await como(JEFA).post("/api/areas").send({ nombre: "NÓMINA", padreId: rama.subdivisionId });
      expect(repetida.status).toBe(409);
      expect(repetida.body.error.codigo).toBe("NOMBRE_DUPLICADO");

      const compras = (await como(JEFA).post("/api/areas").send({ nombre: "Compras", padreId: rama.subdivisionId })).body
        .id as number;
      const renombre = await como(JEFA).patch(`/api/areas/${compras}`).send({ nombre: "nómina" });
      expect(renombre.status).toBe(409);
      expect((await como(JEFA).patch(`/api/areas/${rama.areaId}`).send({ nombre: "Nómina" })).status).toBe(200);
    });
  });

  describe("CP-EST-06: Bloqueo de eliminación con auditorías activas (AC3)", () => {
    it.each(["Aprobado", "En Ejecución"])("bloquea cada nivel de la rama con un plan %s", async (estado) => {
      const rama = await altaRama();
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
      const rama = await altaRama();
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
      const rama = await altaRama();
      const res = await como(JEFA).delete(`/api/divisiones/${rama.divisionId}`);
      expect(res.status).toBe(409);
      expect(res.body.error.codigo).toBe("HIJOS_EXISTENTES");
    });
  });

  describe("Riesgos en la jerarquía (consolidación con el explorador de riesgos)", () => {
    it("los riesgos registrados aparecen bajo su subdivisión en el catálogo", async () => {
      const rama = await altaRama();
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
      const rama = await altaRama();
      await como(JEFA).delete(`/api/areas/${rama.areaId}`);
      estructura.registrarRiesgo(rama.subdivisionId, { nombre: "Fraude", nivel: null, procedimientoControl: null });

      const res = await como(JEFA).delete(`/api/subdivisiones/${rama.subdivisionId}`);
      expect(res.status).toBe(409);
      expect(res.body.error.codigo).toBe("HIJOS_EXISTENTES");
    });
  });

  describe("Código (fijo) y nombre (editable)", () => {
    it("el nombre es obligatorio solo en el área", async () => {
      const rama = await altaRama();
      expect((await como(JEFA).post("/api/areas").send({ padreId: rama.subdivisionId })).status).toBe(400);
      expect((await como(JEFA).post("/api/divisiones").send({ padreId: rama.unidadId })).status).toBe(201);
    });

    it("el nombre es opcional y se edita; vacío lo quita", async () => {
      const alta = await altaUnidad("  KOF ");
      expect(alta.status).toBe(201);
      expect(alta.body).toMatchObject({ codigo: "UDN-0001", nombre: "KOF" });

      const otra = await altaUnidad(null);
      expect(otra.status).toBe(201);
      expect(otra.body.codigo).toBe("UDN-0002");

      const renombrada = await como(JEFA).patch(`/api/unidades-negocio/${alta.body.id}`).send({ nombre: "Coca-Cola FEMSA" });
      expect(renombrada.body).toMatchObject({ codigo: "UDN-0001", nombre: "Coca-Cola FEMSA" });
      const sinNombre = await como(JEFA).patch(`/api/unidades-negocio/${alta.body.id}`).send({ nombre: "" });
      expect(sinNombre.status).toBe(200);
      expect(sinNombre.body.nombre).toBeNull();
    });

    it("rechaza cambiar el código de una unidad o de un nodo (400)", async () => {
      const rama = await altaRama();
      for (const [ruta, id] of [
        ["unidades-negocio", rama.unidadId],
        ["divisiones", rama.divisionId],
        ["subdivisiones", rama.subdivisionId],
      ] as const) {
        const res = await como(JEFA).patch(`/api/${ruta}/${id}`).send({ codigo: "OTRO-0001", nombre: "Otro" });
        expect(res.status).toBe(400);
        expect(res.body.error.mensaje).toMatch(/código no se puede modificar/);
      }
      const unidad = (await como(AUDITOR).get(`/api/unidades-negocio/${rama.unidadId}`)).body;
      expect(unidad).toMatchObject({ codigo: "UDN-0001", nombre: null });
    });

    it("división y subdivisión guardan su nombre; el área no tiene código", async () => {
      const rama = await altaRama();
      const division = await como(JEFA).patch(`/api/divisiones/${rama.divisionId}`).send({ nombre: "Latam" });
      expect(division.body).toMatchObject({ codigo: "DIVISION-0001", nombre: "Latam" });

      const area = await como(JEFA).post("/api/areas").send({ nombre: "Fletes", padreId: rama.subdivisionId });
      expect(area.status).toBe(201);
      expect(area.body).toMatchObject({ codigo: null, nombre: "Fletes" });

      const unidad = (await como(AUDITOR).get(`/api/unidades-negocio/${rama.unidadId}`)).body;
      expect(unidad.divisiones[0].nombre).toBe("Latam");
      expect(unidad.divisiones[0].subdivisiones[0].nombre).toBeNull();
    });

    it("rechaza un nombre de más de 150 caracteres (400)", async () => {
      expect((await altaUnidad("x".repeat(151))).status).toBe(400);
    });
  });

  describe("Semilla del Consolidado (DATA_MODE=memoria)", () => {
    it("carga las 6 unidades con toda su jerarquía y riesgos a cargo del Jefe de Auditoría", async () => {
      estructura.sembrar(SEMILLA_ESTRUCTURA, await idDe(JEFA));

      const unidades = (await como(AUDITOR).get("/api/unidades-negocio")).body as Array<{
        codigo: string;
        responsableNombre: string;
        departamentoAuditoriaNombre: string;
        divisiones: Array<{ subdivisiones: Array<{ areas: unknown[]; riesgos: unknown[] }> }>;
      }>;
      const subdivisiones = unidades.flatMap((u) => u.divisiones.flatMap((d) => d.subdivisiones));
      expect(unidades.map((u) => u.codigo)).toEqual(["UDN-0001", "UDN-0002", "UDN-0003", "UDN-0004", "UDN-0005", "UDN-0006"]);
      expect(unidades.every((u) => u.responsableNombre === "María García")).toBe(true);
      expect(unidades.find((u) => u.codigo === "UDN-0003")?.departamentoAuditoriaNombre).toBe("Beverage");
      expect(subdivisiones).toHaveLength(39);
      expect(subdivisiones.flatMap((s) => s.areas)).toHaveLength(338);
      expect(subdivisiones.flatMap((s) => s.riesgos)).toHaveLength(249);

      // Códigos con el formato del nivel y nombres inferidos del deck (022).
      const todas = (await como(AUDITOR).get("/api/unidades-negocio")).body as Array<{
        codigo: string;
        nombre: string | null;
        divisiones: Array<{ codigo: string; nombre: string | null; subdivisiones: Array<{ codigo: string }> }>;
      }>;
      const nodos = todas.flatMap((u) => [u, ...u.divisiones, ...u.divisiones.flatMap((d) => d.subdivisiones)]);
      expect(nodos.every((n) => /^(UDN|DIVISION|SUBDIVISION)-\d{4}$/.test(n.codigo))).toBe(true);
      const kof = todas.find((u) => u.codigo === "UDN-0003")!;
      expect(kof.nombre).toBe("KOF");
      expect(kof.divisiones.map((d) => d.nombre).sort()).toEqual(["Brasil", "Corporativo", "Latam", "México"]);
    });
  });

  describe("Edición", () => {
    it("edita nombre, gerente y departamento de una unidad y lo registra en bitácora", async () => {
      const id = (await altaUnidad()).body.id;
      const res = await como(JEFA).patch(`/api/unidades-negocio/${id}`).send({
        nombre: "Deportes",
        departamentoAuditoriaId: 2,
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ codigo: "UDN-0001", nombre: "Deportes", departamentoAuditoriaNombre: "Beverage" });
      expect(eventos.some((e) => e.accion === "estructura.edicion")).toBe(true);
    });

    it("edita el nombre y país de una subdivisión", async () => {
      const rama = await altaRama();
      const res = await como(JEFA).patch(`/api/subdivisiones/${rama.subdivisionId}`).send({
        nombre: "Brasil",
        pais: "KFS RTR",
      });
      expect(res.status).toBe(200);
      const unidad = (await como(JEFA).get(`/api/unidades-negocio/${rama.unidadId}`)).body;
      expect(unidad.divisiones[0].subdivisiones[0]).toMatchObject({ codigo: "SUBDIVISION-0001", nombre: "Brasil", pais: "KFS RTR" });
    });

    it("rechaza un departamento de auditoría inexistente (400)", async () => {
      const id = (await altaUnidad()).body.id;
      const res = await como(JEFA).patch(`/api/unidades-negocio/${id}`).send({ departamentoAuditoriaId: 99 });
      expect(res.status).toBe(400);
    });
  });
});
