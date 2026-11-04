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
import { escuchar } from "./servidor.js";

const ADMIN = "s.ramirez@expedite.com";
const JEFA = "m.garcia@expedite.com";
const AUDITOR = "a.rodriguez@expedite.com";

let app: Server;
let usuarios: RepositorioMemoria;
let eventos: EventoBitacora[];

beforeEach(async () => {
  eventos = [];
  usuarios = new RepositorioMemoria();
  app = await escuchar(
    crearApp({
      repo: usuarios,
      repoPlanes: new RepositorioPlanesMemoria(usuarios),
      repoPlanesAccion: new RepositorioPlanesAccionMemoria(usuarios),
      repoEstructura: new RepositorioEstructuraMemoria(usuarios),
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

/** Unidad → división → subdivisión (con país) → área; devuelve los ids. */
async function altaRama(pais: string | null = "México", area = "Nómina") {
  const jefaId = (await usuarios.buscarPorCorreo(JEFA))!.id;
  const unidadId = (await como(JEFA).post("/api/unidades-negocio").send({ responsableId: jefaId })).body.id as number;
  const divisionId = (await como(JEFA).post("/api/divisiones").send({ padreId: unidadId })).body.id as number;
  const subdivision = await como(JEFA).post("/api/subdivisiones").send({ padreId: divisionId, pais });
  const areaRes = await como(JEFA).post("/api/areas").send({ nombre: area, padreId: subdivision.body.id });
  return { subdivision, area: areaRes };
}

async function opcion(tipo: "area" | "pais", valor: string) {
  const lista = (await como(ADMIN).get(`/api/catalogos/${tipo}`)).body as Array<{ id: number; valor: string; usos: number }>;
  return lista.find((o) => o.valor === valor);
}

describe("Catálogos de la estructura (SF-03)", () => {
  describe("Consulta", () => {
    it("cualquier usuario con sesión consulta las opciones precargadas del Consolidado", async () => {
      const areas = await como(AUDITOR).get("/api/catalogos/area");
      expect(areas.status).toBe(200);
      expect(areas.body.map((o: { valor: string }) => o.valor)).toEqual(expect.arrayContaining(["Nómina", "Compras"]));
      const paises = await como(AUDITOR).get("/api/catalogos/pais");
      expect(paises.body.map((o: { valor: string }) => o.valor)).toEqual(expect.arrayContaining(["México", "KFS RTR"]));
    });

    it("cuenta los usos de cada opción en la estructura", async () => {
      await altaRama();
      expect((await opcion("area", "Nómina"))?.usos).toBe(1);
      expect((await opcion("pais", "México"))?.usos).toBe(1);
      expect((await opcion("pais", "Brasil"))?.usos).toBe(0);
    });

    it("un catálogo que no existe responde 404", async () => {
      expect((await como(ADMIN).get("/api/catalogos/divisiones")).status).toBe(404);
    });
  });

  describe("Edición (solo Administrador)", () => {
    it("el Administrador agrega una opción y queda en bitácora", async () => {
      const res = await como(ADMIN).post("/api/catalogos/area").send({ valor: "  Auditoría Forense " });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ valor: "Auditoría Forense", usos: 0 });
      expect(eventos).toContainEqual(expect.objectContaining({ accion: "catalogo.alta", actor: ADMIN }));
    });

    it("otros roles no pueden editar el catálogo", async () => {
      expect((await como(JEFA).post("/api/catalogos/area").send({ valor: "Forense" })).status).toBe(403);
      const nomina = (await opcion("area", "Nómina"))!;
      expect((await como(JEFA).patch(`/api/catalogos/area/${nomina.id}`).send({ valor: "Pagos" })).status).toBe(403);
      expect((await como(AUDITOR).delete(`/api/catalogos/area/${nomina.id}`)).status).toBe(403);
    });

    it("rechaza valores vacíos o repetidos (sin distinguir mayúsculas)", async () => {
      expect((await como(ADMIN).post("/api/catalogos/pais").send({ valor: "  " })).status).toBe(400);
      const repetido = await como(ADMIN).post("/api/catalogos/pais").send({ valor: "MÉXICO" });
      expect(repetido.status).toBe(409);
      expect(repetido.body.error.codigo).toBe("NOMBRE_DUPLICADO");
    });

    it("renombrar propaga el cambio a las áreas y subdivisiones que lo usan", async () => {
      const { subdivision } = await altaRama("México", "Nómina");
      const nomina = (await opcion("area", "Nómina"))!;
      const mexico = (await opcion("pais", "México"))!;

      const res = await como(ADMIN).patch(`/api/catalogos/area/${nomina.id}`).send({ valor: "Nómina y Compensaciones" });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ valor: "Nómina y Compensaciones", usos: 1 });
      await como(ADMIN).patch(`/api/catalogos/pais/${mexico.id}`).send({ valor: "México (MX)" });

      const unidades = (await como(AUDITOR).get("/api/unidades-negocio")).body;
      const sub = unidades[0].divisiones[0].subdivisiones[0];
      expect(sub.id).toBe(subdivision.body.id);
      expect(sub.pais).toBe("México (MX)");
      expect(sub.areas[0].nombre).toBe("Nómina y Compensaciones");
      expect(eventos).toContainEqual(
        expect.objectContaining({
          accion: "catalogo.edicion",
          detalle: expect.objectContaining({ anterior: "Nómina", valor: "Nómina y Compensaciones" }),
        }),
      );
    });

    it("no borra una opción en uso; sí una libre", async () => {
      await altaRama();
      const nomina = (await opcion("area", "Nómina"))!;
      const enUso = await como(ADMIN).delete(`/api/catalogos/area/${nomina.id}`);
      expect(enUso.status).toBe(409);
      expect(enUso.body.error.codigo).toBe("OPCION_EN_USO");

      const brasil = (await opcion("pais", "Brasil"))!;
      expect((await como(ADMIN).delete(`/api/catalogos/pais/${brasil.id}`)).status).toBe(204);
      expect(await opcion("pais", "Brasil")).toBeUndefined();
      expect(eventos).toContainEqual(expect.objectContaining({ accion: "catalogo.baja" }));
    });
  });

  describe("Formularios del Catálogo", () => {
    it("rechaza un área o un país fuera del catálogo", async () => {
      const { subdivision, area } = await altaRama("Atlántida", "Nómina");
      expect(subdivision.status).toBe(400);
      expect(subdivision.body.error.codigo).toBe("OPCION_NO_VALIDA");
      expect(area.status).toBe(400); // sin subdivisión no hay a dónde colgarla

      const { subdivision: valida } = await altaRama(null, "Nómina");
      expect(valida.status).toBe(201);
      const fuera = await como(JEFA).post("/api/areas").send({ nombre: "Astrología", padreId: valida.body.id });
      expect(fuera.status).toBe(400);
      expect(fuera.body.error.codigo).toBe("OPCION_NO_VALIDA");
      const edicion = await como(JEFA).patch(`/api/subdivisiones/${valida.body.id}`).send({ pais: "Atlántida" });
      expect(edicion.status).toBe(400);
    });

    it("guarda la grafía del catálogo", async () => {
      const { subdivision, area } = await altaRama("méxico", "NÓMINA");
      expect(area.body.nombre).toBe("Nómina");
      const unidades = (await como(AUDITOR).get("/api/unidades-negocio")).body;
      expect(unidades[0].divisiones[0].subdivisiones[0]).toMatchObject({ id: subdivision.body.id, pais: "México" });
    });
  });
});
