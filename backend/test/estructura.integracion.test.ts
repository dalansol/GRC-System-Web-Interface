// Pruebas de la jerarquía organizacional (017) y de la regla de auditoría activa contra un
// PostgreSQL real. Se omiten si no hay conexión configurada (variables SQL_TEST_*).
// Trabaja en un esquema propio para no chocar con los demás archivos de integración.

import { readFile } from "node:fs/promises";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { RepositorioEstructuraSql } from "../src/repos/estructuraSql.js";
import { ErrorNombreDuplicado } from "../src/repos/estructura.js";

const env = process.env;
const ESQUEMA = "prueba_estructura";

// Los de src/migrar.ts sin datos de prueba (003 exige editarse antes) más el seed de la jerarquía.
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
  "018_seed_jerarquia.sql",
  "019_riesgos_jerarquia.sql",
  "020_seed_riesgos.sql",
];

const script = (nombre: string) => readFile(new URL(`../sql/${nombre}`, import.meta.url), "utf8");

describe.skipIf(!env.SQL_TEST_SERVER)("jerarquía organizacional sobre PostgreSQL", () => {
  let pool: pg.Pool;
  let repo: RepositorioEstructuraSql;
  let jefeId: number;

  const uno = async (sql: string, valores: unknown[] = []) => (await pool.query(sql, valores)).rows[0].id as number;

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
    await pool.query(await script("001_schema.sql"));
    await pool.query(await script("002_seed.sql"));
    jefeId = await uno(
      `INSERT INTO users (name, email, role_id)
       SELECT 'Jefa Pruebas', 'jefa.pruebas@expedite.com', id FROM roles WHERE name = 'Jefe de Auditoría' RETURNING id`,
    );
    // Dos veces cada script: deben poder repetirse.
    for (const nombre of [...SCRIPTS, ...SCRIPTS]) {
      await pool.query(await script(nombre));
    }
    repo = new RepositorioEstructuraSql(pool);
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM audit_engagement; DELETE FROM audit_entity; DELETE FROM audit_plans;");
  });

  afterAll(async () => {
    await pool?.query(`DROP SCHEMA IF EXISTS ${ESQUEMA} CASCADE`);
    await pool?.end();
  });

  it("los periodos son trimestrales, con 2026Q4 como único activo", async () => {
    const activo = await repo.obtenerPeriodoActivo();
    expect(activo?.nombre).toBe("2026Q4");
    expect((await repo.listarPeriodos()).filter((p) => p.activo)).toHaveLength(1);
  });

  it("el seed deja dos unidades con su rama y departamento, sin duplicarse al repetirse", async () => {
    const unidades = await repo.listarUnidades();
    expect(unidades.map((u) => [u.nombre, u.departamentoAuditoriaNombre])).toEqual([
      ["UDN-0001", "Retail & Spin"],
      ["UDN-0003", "Beverage"],
    ]);
    const areas = unidades[0]!.divisiones[0]!.subdivisiones[0]!.areas.map((a) => a.nombre);
    expect(areas).toEqual(["Nómina", "Recursos Humanos"]);
  });

  it("los riesgos de prueba cuelgan de su subdivisión con su nivel", async () => {
    const unidad = (await repo.listarUnidades()).find((u) => u.nombre === "UDN-0003")!;
    const riesgos = unidad.divisiones[0]!.subdivisiones[0]!.riesgos;
    expect(riesgos.map((r) => [r.nombre, r.nivel])).toEqual([
      ["Diferencias de inventario en CEDIS", "Crítico"],
      ["Ruptura de cadena de frío", "Medio"],
    ]);
    expect(riesgos[0]!.procedimientoControl).toBe("Conteo cíclico mensual conciliado contra el sistema");
    expect(await repo.tieneHijos("subdivision", unidad.divisiones[0]!.subdivisiones[0]!.id)).toBe(true);
  });

  it("el nivel de riesgo solo acepta la escala definida", async () => {
    await expect(pool.query("INSERT INTO risk_library (name, level) VALUES ('X', 'Urgente')")).rejects.toThrow(
      /ck_risk_library_level/,
    );
  });

  it("la columna de padre es obligatoria en cada nivel", async () => {
    await expect(pool.query("INSERT INTO area (area_name) VALUES ('Suelta')")).rejects.toThrow(/null/i);
  });

  it("el nombre de la unidad es único sin importar mayúsculas", async () => {
    const periodo = (await repo.obtenerPeriodoActivo())!.id;
    await repo.crearUnidad({ nombre: "Proximidad y Salud", responsableId: jefeId, departamentoAuditoriaId: null }, periodo, jefeId);
    await expect(
      repo.crearUnidad({ nombre: "PROXIMIDAD Y SALUD", responsableId: jefeId, departamentoAuditoriaId: null }, periodo, jefeId),
    ).rejects.toBeInstanceOf(ErrorNombreDuplicado);
  });

  it("solo los planes Aprobado o En Ejecución bloquean cada nivel de la rama", async () => {
    const unidad = (await repo.listarUnidades()).find((u) => u.nombre === "UDN-0003")!;
    const division = unidad.divisiones[0]!;
    const subdivision = division.subdivisiones[0]!;
    const area = subdivision.areas[0]!;
    const entidad = await uno(`INSERT INTO audit_entity (name, business_id) VALUES ('Entidad', $1) RETURNING id`, [subdivision.id]);

    const nodos = [
      ["unidad", unidad.id],
      ["division", division.id],
      ["subdivision", subdivision.id],
      ["area", area.id],
    ] as const;

    for (const [estado, bloquea] of [["Borrador", false], ["Cerrado", false], ["Aprobado", true], ["En Ejecución", true]] as const) {
      await pool.query("DELETE FROM audit_engagement; DELETE FROM audit_plans;");
      const plan = await uno(
        `INSERT INTO audit_plans (code, name, type, start_date, end_date, status, estimated_hours, responsible_id, created_by)
         VALUES ('PAI-E-1', 'Plan', 'Trimestral', '2026-10-01', '2026-12-31', $1, 10, $2, $2) RETURNING id`,
        [estado, jefeId],
      );
      await pool.query(`INSERT INTO audit_engagement (code, audit_plan_id, audit_entity_id) VALUES ('ENG-1', $1, $2)`, [plan, entidad]);
      for (const [nivel, id] of nodos) {
        expect(await repo.tieneAuditoriasActivas(nivel, id), `${estado} / ${nivel}`).toBe(bloquea);
      }
    }
  });

  it("eliminar una subdivisión conserva su entidad auditable sin vínculo", async () => {
    const unidad = (await repo.listarUnidades()).find((u) => u.nombre === "UDN-0001")!;
    const subdivision = await repo.crearNodo("subdivision", { nombre: "SUBDIVISION-0099", padreId: unidad.divisiones[0]!.id, pais: null });
    const entidad = await uno(`INSERT INTO audit_entity (name, business_id) VALUES ('Entidad', $1) RETURNING id`, [subdivision.id]);

    expect(await repo.tieneHijos("subdivision", subdivision.id)).toBe(false);
    await repo.eliminarNodo("subdivision", subdivision.id);

    const fila = await pool.query("SELECT business_id FROM audit_entity WHERE id = $1", [entidad]);
    expect(fila.rows[0].business_id).toBeNull();
  });

  it("activar un periodo desactiva el anterior", async () => {
    const nuevo = await repo.crearPeriodo({ nombre: "2027Q1", fechaInicio: "2027-01-01", fechaFin: "2027-03-31", activo: true });
    expect((await repo.obtenerPeriodoActivo())?.id).toBe(nuevo.id);
    const q4 = (await repo.listarPeriodos()).find((p) => p.nombre === "2026Q4")!;
    await repo.editarPeriodo(q4.id, { activo: true });
    expect((await repo.obtenerPeriodoActivo())?.nombre).toBe("2026Q4");
  });
});
