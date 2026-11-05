// Edición de Excel en la plataforma (UF-17, SF-08, historia #106): abrir el archivo de una
// evidencia y guardar versiones nuevas. Las rutas de evidencias consultan la base directo,
// así que estas pruebas corren contra un PostgreSQL real y se omiten sin SQL_TEST_*
// (mismas variables que sql.integracion.test.ts). Trabajan en un esquema propio.

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readFile } from "node:fs/promises";
import type { Server } from "node:http";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AlmacenamientoLocal, type AlmacenamientoArchivos } from "../src/almacenamiento.js";
import { crearApp } from "../src/app.js";
import { crearVerificadorDev } from "../src/auth/verificador.js";
import { registrarPool } from "../src/db.js";
import { RepositorioMemoria } from "../src/repos/memoria.js";
import { RepositorioEvidenciasMemoria } from "../src/repos/evidenciasMemoria.js";
import { RepositorioPlanesAccionMemoria } from "../src/repos/planesAccionMemoria.js";
import { RepositorioPlanesMemoria } from "../src/repos/planesMemoria.js";
import { rutasEvidencias } from "../src/routes/evidencias.js";
import { escuchar } from "./servidor.js";

const env = process.env;
const ESQUEMA = "prueba_versiones";
const SCRIPTS = ["001_schema.sql", "002_seed.sql", "004_findings.sql", "006_auditorias.sql", "008_estructura_y_controles.sql", "027_formatos_evidencia.sql", "034_versiones_evidencia.sql"];
const script = (nombre: string) => readFile(new URL(`../sql/${nombre}`, import.meta.url), "utf8");

const AUDITORA = "a.rodriguez@expedite.com";
const OTRA_AUDITORA = "l.fernandez@expedite.com";
const EVIDENCIA = "EV-prueba-1";

// Un .xlsx mínimo para las pruebas: lo que importa es que sea un ZIP ("PK") distinto cada vez.
const libro = (marca: string) => Buffer.concat([Buffer.from("PK\u0003\u0004"), Buffer.from(marca)]);

describe.skipIf(!env.SQL_TEST_SERVER)("archivo y versiones de evidencias sobre PostgreSQL", () => {
  let pool: pg.Pool;
  let carpeta: string;
  let almacenamiento: AlmacenamientoArchivos;
  let app: Server;
  let usuarios: RepositorioMemoria;

  const como = (correo: string) => ({
    get: (ruta: string) => request(app).get(ruta).set("X-Dev-Usuario", correo),
    post: (ruta: string) => request(app).post(ruta).set("X-Dev-Usuario", correo),
  });
  const idDe = async (correo: string) => String((await usuarios.buscarPorCorreo(correo))!.id);

  beforeAll(async () => {
    pool = new pg.Pool({
      host: env.SQL_TEST_SERVER,
      port: Number(env.SQL_TEST_PORT ?? 5432),
      database: env.SQL_TEST_DATABASE,
      user: env.SQL_TEST_USER,
      password: env.SQL_TEST_PASSWORD,
      ssl: { rejectUnauthorized: env.SQL_TEST_TRUST_CERT !== "true" },
      options: `-c search_path=${ESQUEMA}`,
    });
    await pool.query(`DROP SCHEMA IF EXISTS ${ESQUEMA} CASCADE; CREATE SCHEMA ${ESQUEMA};`);
    for (const nombre of SCRIPTS) await pool.query(await script(nombre));
    registrarPool(pool);
    carpeta = await mkdtemp(path.join(tmpdir(), "expedite-versiones-"));
    almacenamiento = new AlmacenamientoLocal(carpeta);
  });

  beforeEach(async () => {
    usuarios = new RepositorioMemoria();
    app = await escuchar(
      crearApp({
        repo: usuarios,
        repoPlanes: new RepositorioPlanesMemoria(usuarios),
        repoPlanesAccion: new RepositorioPlanesAccionMemoria(usuarios),
        repoEvidencias: new RepositorioEvidenciasMemoria(),
        proveedorIA: null,
        rutasConSesion: [rutasEvidencias(almacenamiento)],
        verificador: crearVerificadorDev(),
        dominiosPermitidos: ["expedite.com"],
        corsOrigin: "http://localhost:5173",
        registrarEvento: () => {},
      }),
    );
    await pool.query("DELETE FROM evidence");
    // Una evidencia de hallazgo subida por la auditora (quien la subió puede verla y editarla).
    await almacenamiento.guardar(`${EVIDENCIA}.xlsx`, libro("original"), "application/octet-stream");
    await pool.query(
      `INSERT INTO evidence (id, entity_id, entity_type, finding_id, file_name, mime_type, file_size, file_hash, storage_path, uploaded_by)
       VALUES ($1, 'HAL-1', 'hallazgo', 'HAL-1', 'Conciliacion.xlsx', 'xlsx', 12, 'hash-original', $2, $3)`,
      [EVIDENCIA, `${EVIDENCIA}.xlsx`, await idDe(AUDITORA)],
    );
  });

  afterAll(async () => {
    await pool?.query(`DROP SCHEMA IF EXISTS ${ESQUEMA} CASCADE`);
    await pool?.end();
    if (carpeta) await rm(carpeta, { recursive: true, force: true });
  });

  it("entrega el archivo vigente como binario a quien subió la evidencia", async () => {
    const res = await como(AUDITORA).get(`/api/evidencias/${EVIDENCIA}/archivo`).buffer().parse((r, cb) => {
      const partes: Buffer[] = [];
      r.on("data", (c: Buffer) => partes.push(c));
      r.on("end", () => cb(null, Buffer.concat(partes)));
    });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("spreadsheetml");
    expect(res.headers["x-evidencia-version"]).toBe("1");
    expect(Buffer.from(res.body).equals(libro("original"))).toBe(true);
  });

  it("responde 404 a quien no puede ver la evidencia y 404 si no existe", async () => {
    expect((await como(OTRA_AUDITORA).get(`/api/evidencias/${EVIDENCIA}/archivo`)).status).toBe(404);
    expect((await como(AUDITORA).get("/api/evidencias/EV-nada/archivo")).status).toBe(404);
    expect((await request(app).get(`/api/evidencias/${EVIDENCIA}/archivo`)).status).toBe(401);
  });

  it("solo abre libros de Excel", async () => {
    await pool.query("UPDATE evidence SET mime_type = 'pdf' WHERE id = $1", [EVIDENCIA]);

    expect((await como(AUDITORA).get(`/api/evidencias/${EVIDENCIA}/archivo`)).status).toBe(415);
  });

  it("guardar crea la versión 2 con su hash, conserva el original y actualiza la evidencia", async () => {
    const res = await como(AUDITORA)
      .post(`/api/evidencias/${EVIDENCIA}/versiones`)
      .field("comentario", "Corrige la suma de junio")
      .attach("file", libro("editado"), { filename: "Conciliacion.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ version: 2, comentario: "Corrige la suma de junio", uploaded_by: "Ana Rodríguez" });
    expect(res.body.file_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.file_hash).not.toBe("hash-original");

    const { rows } = await pool.query("SELECT version, file_hash, storage_path FROM evidence WHERE id = $1", [EVIDENCIA]);
    expect(rows[0]).toEqual({ version: 2, file_hash: res.body.file_hash, storage_path: `${EVIDENCIA}-v2.xlsx` });
    expect((await almacenamiento.leer(`${EVIDENCIA}-v2.xlsx`))!.equals(libro("editado"))).toBe(true);
    expect((await almacenamiento.leer(`${EVIDENCIA}.xlsx`))!.equals(libro("original"))).toBe(true);

    const historial = await como(AUDITORA).get(`/api/evidencias/${EVIDENCIA}/versiones`);
    expect(historial.body.map((v: { version: number; file_hash: string }) => [v.version, v.file_hash])).toEqual([
      [2, res.body.file_hash],
      [1, "hash-original"],
    ]);

    const archivo = await como(AUDITORA).get(`/api/evidencias/${EVIDENCIA}/archivo`);
    expect(archivo.headers["x-evidencia-version"]).toBe("2");
  });

  it("guardar dos veces numera 2 y 3", async () => {
    const enviar = (marca: string) =>
      como(AUDITORA).post(`/api/evidencias/${EVIDENCIA}/versiones`).attach("file", libro(marca), { filename: "Conciliacion.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    expect((await enviar("dos")).body.version).toBe(2);
    expect((await enviar("tres")).body.version).toBe(3);
    expect((await como(AUDITORA).get(`/api/evidencias/${EVIDENCIA}/versiones`)).body).toHaveLength(3);
  });

  it("antes del primer guardado el historial solo tiene el original", async () => {
    const res = await como(AUDITORA).get(`/api/evidencias/${EVIDENCIA}/versiones`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([expect.objectContaining({ version: 1, file_hash: "hash-original" })]);
  });

  it("quien no puede modificar la evidencia recibe 403 y nada cambia", async () => {
    const res = await como(OTRA_AUDITORA)
      .post(`/api/evidencias/${EVIDENCIA}/versiones`)
      .attach("file", libro("ajeno"), { filename: "Conciliacion.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    expect(res.status).toBe(403);
    expect((await pool.query("SELECT version FROM evidence WHERE id = $1", [EVIDENCIA])).rows[0]).toEqual({ version: 1 });
  });

  it("rechaza lo que no es un libro .xlsx", async () => {
    const texto = await como(AUDITORA)
      .post(`/api/evidencias/${EVIDENCIA}/versiones`)
      .attach("file", Buffer.from("hola"), { filename: "Conciliacion.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const pdf = await como(AUDITORA)
      .post(`/api/evidencias/${EVIDENCIA}/versiones`)
      .attach("file", libro("pdf"), { filename: "Conciliacion.pdf", contentType: "application/pdf" });

    expect(texto.status).toBe(400);
    expect(pdf.status).toBe(400);
  });

  it("un libro con macros se abre y la versión guardada queda como .xlsx", async () => {
    await pool.query("UPDATE evidence SET mime_type = 'xlsm', file_name = 'Macros.xlsm' WHERE id = $1", [EVIDENCIA]);

    expect((await como(AUDITORA).get(`/api/evidencias/${EVIDENCIA}/archivo`)).status).toBe(200);
    const res = await como(AUDITORA)
      .post(`/api/evidencias/${EVIDENCIA}/versiones`)
      .attach("file", libro("sin macros"), { filename: "Macros.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    expect(res.status).toBe(201);
    const { rows } = await pool.query("SELECT mime_type, file_name FROM evidence WHERE id = $1", [EVIDENCIA]);
    expect(rows[0]).toEqual({ mime_type: "xlsx", file_name: "Macros.xlsx" });
  });
});
