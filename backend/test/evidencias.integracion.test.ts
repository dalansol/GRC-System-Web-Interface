// Pruebas de quién consulta, sube y elimina evidencias (SF-08) contra un PostgreSQL real.
// Se omiten si no hay conexión configurada (variables SQL_TEST_*).
// Trabaja en un esquema propio para no chocar con los demás archivos de integración.

import { readFile } from "node:fs/promises";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AlmacenamientoArchivos } from "../src/almacenamiento.js";
import { crearApp } from "../src/app.js";
import { crearVerificadorDev } from "../src/auth/verificador.js";
import { registrarPool } from "../src/db.js";
import { RepositorioEvidenciasMemoria } from "../src/repos/evidenciasMemoria.js";
import { RepositorioMemoria } from "../src/repos/memoria.js";
import { huellaContenidoPlan } from "../src/domain/flujoPlanAccion.js";
import { RepositorioPlanesAccionMemoria } from "../src/repos/planesAccionMemoria.js";
import { RepositorioPlanesAccionSql } from "../src/repos/planesAccionSql.js";
import { RepositorioPlanesMemoria } from "../src/repos/planesMemoria.js";
import { rutasEvidencias } from "../src/routes/evidencias.js";
import { escuchar } from "./servidor.js";

const env = process.env;
const ESQUEMA = "prueba_evidencias";

// Los de src/migrar.ts sin datos de prueba.
const SCRIPTS = [
  "001_schema.sql",
  "002_seed.sql",
  "004_findings.sql",
  "006_auditorias.sql",
  "007_action_plans.sql",
  "008_estructura_y_controles.sql",
  "010_catalogos_riesgos_y_ejecucion.sql",
  "011_audit_controls_plan.sql",
  "012_seguimiento_controles.sql",
  "013_seguimiento_asignaciones_control.sql",
  "014_quitar_seguimiento_controles_catalogo.sql",
  "015_seed_estructura.sql",
  "016_mantener_controles_al_eliminar_proceso.sql",
  "017_jerarquia_organizacional.sql",
  "019_riesgos_jerarquia.sql",
  "021_nombres_reales.sql",
  "023_codigo_y_nombre.sql",
  "025_nombres_unicos.sql",
  "026_nombres_periodos.sql",
  "027_formatos_evidencia.sql",
  "028_estado_inicial_controles_progreso.sql",
  "029_conflictos_por_plan.sql",
  "031_rls_control_horas.sql",
  "032_normalizar_entidad_evidencias_control.sql",
  "033_campos_muestra_rotacion_controles.sql",
  "034_catalogos_estructura.sql",
  "034_portal_auditado.sql",
  "035_normalizar_root_cause_plan.sql",
  "035_trimestres_periodos.sql",
  "036_permitir_varios_planes_por_hallazgo.sql",
  "037_migrar_relacion_planes_hallazgos.sql",
  "038_public_id_planes_accion.sql",
  "039_entidad_evidencias.sql",
  "040_evidencias_entidad_unica.sql",
  "041_estado_revision_planes.sql",
  "042_procesos_en_asignaciones.sql",
  "044_flujo_aprobacion_planes.sql",
];

const ADMIN = "s.ramirez@expedite.com";
const JEFA = "m.garcia@expedite.com";
const SENIOR = "c.morales@expedite.com";
const AUDITORA = "l.fernandez@expedite.com";
const OTRA_AUDITORA = "a.rodriguez@expedite.com";
const SOLO_LECTURA = "d.torres@expedite.com";
const JEFE_AUDITADO = "j.ejemplo@expedite.com";
const EMPLEADO_AUDITADO = "c.ejemplo@expedite.com";

const script = (nombre: string) => readFile(new URL(`../sql/${nombre}`, import.meta.url), "utf8");

describe.skipIf(!env.SQL_TEST_SERVER)("evidencias sobre PostgreSQL", () => {
  let pool: pg.Pool;
  let usuarios: RepositorioMemoria;
  let planId: number;
  let otroPlanId: number;
  let asignacionId: number;
  let pasoId: number;
  const guardados = new Map<string, Buffer>();

  const almacenamiento: AlmacenamientoArchivos = {
    async guardar(clave, contenido) {
      guardados.set(clave, contenido);
    },
    async leer(clave) {
      return guardados.get(clave) ?? null;
    },
    async eliminar(clave) {
      guardados.delete(clave);
    },
  };

  const idDe = async (correo: string) => (await usuarios.buscarPorCorreo(correo))!.id;
  const uno = async (sql: string, valores: unknown[] = []) => (await pool.query(sql, valores)).rows[0].id as number;

  const api = () =>
    escuchar(
      crearApp({
        repo: usuarios,
        repoPlanes: new RepositorioPlanesMemoria(usuarios),
        repoPlanesAccion: new RepositorioPlanesAccionMemoria(usuarios),
        repoEvidencias: new RepositorioEvidenciasMemoria(),
        proveedorIA: null,
        verificador: crearVerificadorDev(),
        dominiosPermitidos: ["expedite.com"],
        corsOrigin: "http://localhost:5173",
        registrarEvento: () => {},
        rutasConSesion: [rutasEvidencias(almacenamiento)],
      }),
    );

  const subir = async (correo: string, entityId: string | number, entityType: string) =>
    request(await api())
      .post("/api/evidencias/upload")
      .set("X-Dev-Usuario", correo)
      .field("entityId", String(entityId))
      .field("entityType", entityType)
      .attach("file", Buffer.from("%PDF-1.4 prueba"), { filename: "prueba.pdf", contentType: "application/pdf" });

  const consultar = async (correo: string, entityId: string | number, entityType: string, auditId?: number) => {
    const res = await request(await api())
      .get("/api/evidencias")
      .query({ entityId: String(entityId), entityType, ...(auditId ? { auditId: String(auditId) } : {}) })
      .set("X-Dev-Usuario", correo);
    expect(res.status).toBe(200);
    return (res.body as { id: string }[]).map((fila) => fila.id);
  };

  const eliminar = async (correo: string, id: string) =>
    request(await api()).delete(`/api/evidencias/${id}`).set("X-Dev-Usuario", correo);

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
    for (const nombre of SCRIPTS) {
      await pool.query(await script(nombre));
    }
    registrarPool(pool);

    // La sesión sale del repositorio en memoria; en la base van los mismos usuarios con el mismo id.
    usuarios = new RepositorioMemoria();
    for (const usuario of await usuarios.listarUsuarios()) {
      await pool.query(
        `INSERT INTO users (id, name, email, role_id) OVERRIDING SYSTEM VALUE
         SELECT $1, $2, $3, id FROM roles WHERE name = $4`,
        [usuario.id, usuario.nombre, usuario.correo, usuario.rol],
      );
    }

    const jefa = await idDe(JEFA);
    const senior = await idDe(SENIOR);
    const nuevoPlan = (codigo: string) =>
      uno(
        `INSERT INTO audit_plans (code, name, type, start_date, end_date, status, estimated_hours, responsible_id, created_by)
         VALUES ($1, 'Plan de prueba', 'Anual', '2026-01-01', '2026-12-31', 'En Ejecución', 10, $2, $3) RETURNING id`,
        [codigo, senior, jefa],
      );
    planId = await nuevoPlan("PAI-EV-1");
    otroPlanId = await nuevoPlan("PAI-EV-2");

    await pool.query(`INSERT INTO controls (id, code, name) VALUES ('CTR-EV', 'EV-0001', 'Control de prueba')`);
    asignacionId = await uno(
      `INSERT INTO audit_controls (audit_id, control_id, auditor_id, is_lead, assigned_by)
       VALUES ($1, 'CTR-EV', $2, TRUE, $3) RETURNING id`,
      [planId, await idDe(AUDITORA), senior],
    );

    await pool.query(`INSERT INTO findings (id, title, severity) VALUES ('HAL-EV', 'Hallazgo de prueba', 'Medio')`);
    const planAccion = await uno(
      `INSERT INTO action_plans (root_cause, responsible_id, due_date, created_by)
       VALUES ('Causa', $1, '2030-01-01', $2) RETURNING id`,
      [await idDe(JEFE_AUDITADO), jefa],
    );
    pasoId = await uno(
      `INSERT INTO action_plan_steps (action_plan_id, assigned_user_id, description, due_date)
       VALUES ($1, $2, 'Paso de prueba', '2029-12-01') RETURNING id`,
      [planAccion, await idDe(EMPLEADO_AUDITADO)],
    );
  });

  afterAll(async () => {
    await pool?.query(`DROP SCHEMA IF EXISTS ${ESQUEMA} CASCADE`);
    await pool?.end();
  });

  describe("controles", () => {
    it("solo sube el auditor asignado, y quien revisa la consulta con el id del control", async () => {
      expect((await subir(OTRA_AUDITORA, asignacionId, "control")).status).toBe(403);

      const subida = await subir(AUDITORA, asignacionId, "control");
      expect(subida.status).toBe(201);
      expect(subida.body.entity_id).toBe(String(asignacionId));
      const id = subida.body.id as string;

      expect(await consultar(AUDITORA, asignacionId, "control")).toEqual([id]);
      expect(await consultar(JEFA, "CTR-EV", "control")).toEqual([id]);
      expect(await consultar(SENIOR, "CTR-EV", "control")).toEqual([id]);
      expect(await consultar(JEFA, "CTR-EV", "control", planId)).toEqual([id]);

      // Otro plan, otra auditora o un rol sin relación con el control no la ven.
      expect(await consultar(JEFA, "CTR-EV", "control", otroPlanId)).toEqual([]);
      expect(await consultar(OTRA_AUDITORA, "CTR-EV", "control")).toEqual([]);
      expect(await consultar(SOLO_LECTURA, "CTR-EV", "control")).toEqual([]);

      expect((await eliminar(OTRA_AUDITORA, id)).status).toBe(403);
      expect((await eliminar(AUDITORA, id)).status).toBe(200);
      expect(guardados.size).toBe(0);
    });
  });

  describe("pasos de planes de acción", () => {
    it("el equipo de auditoría la consulta, pero solo sube el asignado al paso", async () => {
      expect((await subir(JEFA, pasoId, "action_plan_step")).status).toBe(403);

      const subida = await subir(EMPLEADO_AUDITADO, pasoId, "action_plan_step");
      expect(subida.status).toBe(201);
      const id = subida.body.id as string;

      for (const correo of [EMPLEADO_AUDITADO, JEFE_AUDITADO, ADMIN, JEFA, SENIOR, AUDITORA]) {
        expect(await consultar(correo, pasoId, "action_plan_step")).toEqual([id]);
      }
      expect(await consultar(SOLO_LECTURA, pasoId, "action_plan_step")).toEqual([]);

      expect((await eliminar(JEFA, id)).status).toBe(403);
      expect((await eliminar(EMPLEADO_AUDITADO, id)).status).toBe(200);
    });
  });

  describe("bloqueo por el flujo de aprobación", () => {
    const pasoNuevo = async () => {
      const plan = await uno(
        `INSERT INTO action_plans (root_cause, responsible_id, due_date, created_by)
         VALUES ('Causa', $1, '2030-01-01', $2) RETURNING id`,
        [await idDe(JEFE_AUDITADO), await idDe(JEFA)],
      );
      const paso = await uno(
        `INSERT INTO action_plan_steps (action_plan_id, assigned_user_id, description, due_date)
         VALUES ($1, $2, 'Paso de prueba', '2029-12-01') RETURNING id`,
        [plan, await idDe(EMPLEADO_AUDITADO)],
      );
      return { plan, paso };
    };
    const fijarEstado = (plan: number, estado: string) =>
      pool.query("UPDATE action_plans SET status = $1 WHERE id = $2", [estado, plan]);

    it.each(["Pendiente", "En Revisión", "Aprobado"])("con el plan %s no se sube evidencia ni se guarda el archivo", async (estado) => {
      const { plan, paso } = await pasoNuevo();
      await fijarEstado(plan, estado);
      const archivos = guardados.size;

      const res = await subir(EMPLEADO_AUDITADO, paso, "action_plan_step");

      expect(res.status).toBe(409);
      expect(res.body.error.codigo).toBe("PLAN_BLOQUEADO");
      expect(guardados.size).toBe(archivos);
      expect(await consultar(EMPLEADO_AUDITADO, paso, "action_plan_step")).toEqual([]);
    });

    it.each(["Pendiente", "En Revisión", "Aprobado"])("con el plan %s no se elimina evidencia", async (estado) => {
      const { plan, paso } = await pasoNuevo();
      const { id } = (await subir(EMPLEADO_AUDITADO, paso, "action_plan_step")).body as { id: string };
      await fijarEstado(plan, estado);

      const res = await eliminar(EMPLEADO_AUDITADO, id);

      expect(res.status).toBe(409);
      expect(res.body.error.codigo).toBe("PLAN_BLOQUEADO");
      expect(await consultar(EMPLEADO_AUDITADO, paso, "action_plan_step")).toEqual([id]);
    });

    it("con el plan Rechazado se sube y se elimina evidencia", async () => {
      const { plan, paso } = await pasoNuevo();
      await fijarEstado(plan, "Rechazado");

      const subida = await subir(EMPLEADO_AUDITADO, paso, "action_plan_step");
      expect(subida.status).toBe(201);
      expect((await eliminar(EMPLEADO_AUDITADO, subida.body.id)).status).toBe(200);
    });

    it("firmaIntegra es falso si cambia en la base el hash de una evidencia aprobada", async () => {
      const { plan, paso } = await pasoNuevo();
      const { id } = (await subir(EMPLEADO_AUDITADO, paso, "action_plan_step")).body as { id: string };
      const planes = new RepositorioPlanesAccionSql(pool);
      await fijarEstado(plan, "En Revisión");
      await planes.transicionar(plan, {
        desde: ["En Revisión"],
        hacia: "Aprobado",
        accion: "aprobacion",
        actor: { id: await idDe(JEFA), nombre: "María García", rol: "Jefe de Auditoría" },
        firmaHash: huellaContenidoPlan((await planes.buscarPorId(plan))!, await planes.hashesEvidenciaPlan(plan)),
      });
      const app = await escuchar(
        crearApp({
          repo: usuarios,
          repoPlanes: new RepositorioPlanesMemoria(usuarios),
          repoPlanesAccion: planes,
          repoEvidencias: new RepositorioEvidenciasMemoria(),
          proveedorIA: null,
          verificador: crearVerificadorDev(),
          dominiosPermitidos: ["expedite.com"],
          corsOrigin: "http://localhost:5173",
          registrarEvento: () => {},
        }),
      );
      const firmaIntegra = async () =>
        (await request(app).get(`/api/planes-accion/${plan}/flujo`).set("X-Dev-Usuario", JEFA)).body.firmaIntegra;

      expect(await firmaIntegra()).toBe(true);

      await pool.query("UPDATE evidence SET file_hash = 'alterado' WHERE id = $1", [id]);

      expect(await firmaIntegra()).toBe(false);
    });
  });

  describe("hallazgos", () => {
    it("el equipo de auditoría y quien la subió la consultan; solo quien la subió la elimina", async () => {
      const subida = await subir(SOLO_LECTURA, "HAL-EV", "hallazgo");
      expect(subida.status).toBe(201);
      const id = subida.body.id as string;

      for (const correo of [SOLO_LECTURA, ADMIN, JEFA, SENIOR, AUDITORA]) {
        expect(await consultar(correo, "HAL-EV", "hallazgo")).toEqual([id]);
      }
      expect(await consultar(JEFE_AUDITADO, "HAL-EV", "hallazgo")).toEqual([]);
      expect(await consultar(EMPLEADO_AUDITADO, "HAL-EV", "hallazgo")).toEqual([]);

      expect((await eliminar(JEFA, id)).status).toBe(403);
      expect((await eliminar(SOLO_LECTURA, id)).status).toBe(200);
      expect(await consultar(JEFA, "HAL-EV", "hallazgo")).toEqual([]);
    });
  });
});
