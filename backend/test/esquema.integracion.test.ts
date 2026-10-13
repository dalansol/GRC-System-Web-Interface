// Pruebas del esquema completo contra un PostgreSQL real: aplica todos los scripts de
// backend/sql y comprueba que cada tabla existe, está protegida y se puede consultar.
// Se omiten si no hay conexión configurada (mismas variables SQL_TEST_* que
// sql.integracion.test.ts). Trabaja en un esquema propio para no chocar con ese archivo.

import { readFile } from "node:fs/promises";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const env = process.env;
const ESQUEMA = "prueba_esquema";

// En el orden en que los aplica src/migrar.ts con --datos-prueba. 003 se prueba aparte:
// exige editar el nombre y el correo antes de correrlo.
const SCRIPTS = [
  "001_schema.sql",
  "002_seed.sql",
  "004_findings.sql",
  "005_seed_findings.sql",
  "006_auditorias.sql",
  "007_action_plans.sql",
  "008_estructura_y_controles.sql",
  "009_seed_controles.sql",
  "010_catalogos_riesgos_y_ejecucion.sql",
  "011_seed_demo.sql",
];

// Las tablas del modelo entidad-relación de docs/diseno/base-de-datos.md.
const TABLAS = [
  "action_plans", "area", "audit_controls", "audit_engagement", "audit_engagement_team", "audit_entity",
  "audit_plans", "audit_procedure_type", "audit_procedures", "audit_status", "audits", "business",
  "business_units", "catalog_department", "catalog_domain", "catalogs", "conflict_declarations",
  "control_procedure", "controls", "division", "evidence", "findings", "fiscal_periods", "permissions",
  "processes", "risk_library", "risk_register", "role_permissions", "roles", "users",
];

const script = (nombre: string) => readFile(new URL(`../sql/${nombre}`, import.meta.url), "utf8");

describe.skipIf(!env.SQL_TEST_SERVER)("esquema completo sobre PostgreSQL", () => {
  let pool: pg.Pool;

  const contar = async (tabla: string) =>
    (await pool.query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM ${tabla}`)).rows[0]!.total;

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
    // Dos veces cada script: deben poder repetirse.
    for (const nombre of [...SCRIPTS, ...SCRIPTS]) {
      await pool.query(await script(nombre));
    }
  });

  afterAll(async () => {
    await pool?.query(`DROP SCHEMA IF EXISTS ${ESQUEMA} CASCADE`);
    await pool?.end();
  });

  it("los scripts crean las 30 tablas del modelo y ninguna más", async () => {
    const { rows } = await pool.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename",
      [ESQUEMA],
    );

    expect(rows.map((t) => t.tablename)).toEqual(TABLAS);
  });

  it("todas las tablas tienen la seguridad por filas activada y ninguna política", async () => {
    const sinProteccion = await pool.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = $1 AND NOT rowsecurity",
      [ESQUEMA],
    );
    const politicas = await pool.query("SELECT policyname FROM pg_policies WHERE schemaname = $1", [ESQUEMA]);

    expect(sinProteccion.rows).toEqual([]);
    expect(politicas.rows).toEqual([]);
  });

  it.each(TABLAS)("la tabla %s se puede consultar", async (tabla) => {
    const resultado = await pool.query(`SELECT * FROM ${tabla} LIMIT 1`);

    expect(resultado.fields.length).toBeGreaterThan(0);
  });

  it("los scripts repetidos no duplican los datos iniciales", async () => {
    expect(await contar("roles")).toBe(6);
    expect(await contar("permissions")).toBe(8);
    expect(await contar("role_permissions")).toBe(24);
    expect(await contar("audits")).toBe(4);
    expect(await contar("evidence")).toBe(2);
    expect(await contar("findings")).toBe(5);
    expect(await contar("controls")).toBe(4);
  });

  it("consulta la cadena de la estructura a la ejecución y rechaza referencias inexistentes", async () => {
    const cliente = await pool.connect();
    try {
      await cliente.query("BEGIN");
      const uno = async (sql: string, valores: unknown[] = []) => (await cliente.query(sql, valores)).rows[0].id as number;

      const usuario = await uno(
        `INSERT INTO users (name, email, role_id) SELECT 'Ana Pruebas', 'ana.pruebas@expedite.com', id FROM roles WHERE name = 'Auditor' RETURNING id`,
      );
      const periodo = await uno(
        `INSERT INTO fiscal_periods (name, start_date, end_date, is_active) VALUES ('Fiscal 2026', '2026-01-01', '2026-12-31', TRUE) RETURNING id`,
      );
      const catalogo = await uno(`INSERT INTO catalogs (business, country) VALUES ('Proximidad', 'México') RETURNING catalog_id AS id`);
      const unidad = await uno(
        `INSERT INTO business_units (name, manager_id, fiscal_period_id, created_by, catalog_id) VALUES ('Finanzas', $1, $2, $1, $3) RETURNING id`,
        [usuario, periodo, catalogo],
      );
      const proceso = await uno(`INSERT INTO processes (business_unit_id, name) VALUES ($1, 'Cierre contable') RETURNING id`, [unidad]);
      await cliente.query(`UPDATE controls SET process_id = $1, owner_id = $2 WHERE id = 'CTR-001'`, [proceso, usuario]);
      await cliente.query(
        `INSERT INTO audit_controls (audit_id, control_id, auditor_id, is_lead, assigned_by) VALUES ('AUD-001', 'CTR-001', $1, TRUE, $1)`,
        [usuario],
      );
      await cliente.query(
        `INSERT INTO conflict_declarations (audit_id, auditor_id, has_conflict) VALUES ('AUD-001', $1, FALSE)`,
        [usuario],
      );

      const plan = await uno(
        `INSERT INTO audit_plans (code, name, type, start_date, end_date, status, estimated_hours, responsible_id, created_by)
         VALUES ('PAI-P-1', 'Plan de prueba', 'Anual', '2026-01-01', '2026-12-31', 'Borrador', 10, $1, $1) RETURNING id`,
        [usuario],
      );
      const departamento = await uno(`INSERT INTO catalog_department (name) VALUES ('Auditoría Financiera') RETURNING id`);
      const dominio = await uno(`INSERT INTO catalog_domain (name) VALUES ('Finanzas') RETURNING id`);
      const estado = await uno(`INSERT INTO audit_status (name) VALUES ('En curso') RETURNING id`);
      const tipo = await uno(`INSERT INTO audit_procedure_type (name) VALUES ('Prueba de control') RETURNING id`);
      const entidad = await uno(
        `INSERT INTO audit_entity (name, department_id, domain_id) VALUES ('Tesorería MX', $1, $2) RETURNING id`,
        [departamento, dominio],
      );
      const trabajo = await uno(
        `INSERT INTO audit_engagement (code, audit_plan_id, audit_entity_id, department_id, domain_id, lead_auditor_id, status_id)
         VALUES ('ENG-1', $1, $2, $3, $4, $5, $6) RETURNING id`,
        [plan, entidad, departamento, dominio, usuario, estado],
      );
      await cliente.query(
        `INSERT INTO audit_engagement_team (audit_engagement_id, auditor_id, role_in_engagement) VALUES ($1, $2, 'Líder')`,
        [trabajo, usuario],
      );
      await cliente.query(
        `INSERT INTO audit_procedures (code, audit_engagement_id, procedure_type_id, assigned_to, status_id) VALUES ('PRC-1', $1, $2, $3, $4)`,
        [trabajo, tipo, usuario, estado],
      );
      const riesgo = await uno(`INSERT INTO risk_library (name) VALUES ('Fraude en pagos') RETURNING risk_library_id AS id`);
      const procedimiento = await uno(
        `INSERT INTO control_procedure (description, catalog_id) VALUES ('Doble aprobación', $1) RETURNING control_procedure_id AS id`,
        [catalogo],
      );
      await cliente.query(`INSERT INTO risk_register (catalog_id, risk_library_id, control_procedure_id) VALUES ($1, $2, $3)`, [
        catalogo, riesgo, procedimiento,
      ]);

      const estructura = await cliente.query(`
        SELECT b.name AS unidad, f.name AS periodo, p.name AS proceso, c.id AS control, a.name AS auditoria, u.name AS auditor
        FROM business_units b
        JOIN fiscal_periods f ON f.id = b.fiscal_period_id
        JOIN processes p ON p.business_unit_id = b.id
        JOIN controls c ON c.process_id = p.id
        JOIN audit_controls ac ON ac.control_id = c.id
        JOIN audits a ON a.id = ac.audit_id
        JOIN users u ON u.id = ac.auditor_id`);
      expect(estructura.rows).toEqual([
        {
          unidad: "Finanzas", periodo: "Fiscal 2026", proceso: "Cierre contable", control: "CTR-001",
          auditoria: "Auditoría SOX — Cuentas por Pagar", auditor: "Ana Pruebas",
        },
      ]);

      const ejecucion = await cliente.query(`
        SELECT e.code AS trabajo, pl.code AS plan, en.name AS entidad, s.name AS estado, pr.code AS procedimiento, t.name AS tipo
        FROM audit_engagement e
        JOIN audit_plans pl ON pl.id = e.audit_plan_id
        JOIN audit_entity en ON en.id = e.audit_entity_id
        JOIN audit_status s ON s.id = e.status_id
        JOIN audit_procedures pr ON pr.audit_engagement_id = e.id
        JOIN audit_procedure_type t ON t.id = pr.procedure_type_id`);
      expect(ejecucion.rows).toEqual([
        { trabajo: "ENG-1", plan: "PAI-P-1", entidad: "Tesorería MX", estado: "En curso", procedimiento: "PRC-1", tipo: "Prueba de control" },
      ]);

      const riesgos = await cliente.query(`
        SELECT rl.name AS riesgo, cp.description AS procedimiento, k.business AS negocio
        FROM risk_register rr
        JOIN risk_library rl ON rl.risk_library_id = rr.risk_library_id
        JOIN control_procedure cp ON cp.control_procedure_id = rr.control_procedure_id
        JOIN catalogs k ON k.catalog_id = rr.catalog_id`);
      expect(riesgos.rows).toEqual([{ riesgo: "Fraude en pagos", procedimiento: "Doble aprobación", negocio: "Proximidad" }]);

      // Cada intento fallido va en un punto de guardado: un error aborta la transacción.
      const rechaza = async (sql: string, restriccion: RegExp) => {
        await cliente.query("SAVEPOINT intento");
        await expect(cliente.query(sql)).rejects.toThrow(restriccion);
        await cliente.query("ROLLBACK TO SAVEPOINT intento");
      };
      await rechaza(`INSERT INTO processes (business_unit_id, name) VALUES (999999, 'Huérfano')`, /fk_processes_business_unit/);
      await rechaza(`INSERT INTO risk_register (risk_library_id) VALUES (999999)`, /fk_risk_register_risk_library/);
      await rechaza(
        `INSERT INTO audit_procedures (code, audit_engagement_id) VALUES ('PRC-X', 999999)`,
        /fk_audit_procedures_engagement/,
      );
      await rechaza(
        `INSERT INTO fiscal_periods (name, start_date, end_date, is_active) VALUES ('Fiscal 2027', '2027-01-01', '2027-12-31', TRUE)`,
        /uq_fiscal_periods_active/,
      );
      await rechaza(
        `INSERT INTO conflict_declarations (audit_id, auditor_id, has_conflict, justification) VALUES ('AUD-002', ${usuario}, TRUE, '  ')`,
        /ck_conflict_declarations_justification/,
      );
    } finally {
      await cliente.query("ROLLBACK");
      cliente.release();
    }
  });
});
