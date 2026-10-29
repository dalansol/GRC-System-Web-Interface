// Pruebas de la jerarquía organizacional (017) y de la regla de auditoría activa contra un
// PostgreSQL real. Se omiten si no hay conexión configurada (variables SQL_TEST_*).
// Trabaja en un esquema propio para no chocar con los demás archivos de integración.

import { readFile } from "node:fs/promises";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ErrorNombreDuplicado } from "../src/repos/estructura.js";
import { RepositorioEstructuraSql } from "../src/repos/estructuraSql.js";

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
  "021_nombres_reales.sql",
  "022_seed_nombres_reales.sql",
  "023_codigo_y_nombre.sql",
  "024_seed_quitar_sin_codigo.sql",
  "025_nombres_unicos.sql",
  "026_nombres_periodos.sql",
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

  it("026 renombra los periodos al formato '2026 Q1' / '2026 Fiscal' y repetir 015 y 017 no los duplica", async () => {
    await pool.query(
      `INSERT INTO fiscal_periods (name, start_date, end_date, is_active)
       VALUES ('2031Q2', '2031-04-01', '2031-06-30', FALSE), ('Fiscal 2031', '2031-01-01', '2031-12-31', FALSE)`,
    );
    await pool.query(await script("026_nombres_periodos.sql"));
    for (const nombre of ["015_seed_estructura.sql", "017_jerarquia_organizacional.sql", "026_nombres_periodos.sql"]) {
      await pool.query(await script(nombre));
    }
    const nombres = (await repo.listarPeriodos()).map((p) => p.nombre);
    expect(nombres).toEqual(expect.arrayContaining(["2031 Q2", "2031 Fiscal", "2026 Fiscal", "2026 Q1", "2026 Q4"]));
    expect(nombres.filter((n) => /^\d{4}Q|^Fiscal /.test(n))).toEqual([]);
    const de2026 = await pool.query("SELECT count(*)::int AS n FROM fiscal_periods WHERE start_date >= '2026-01-01' AND end_date <= '2026-12-31'");
    expect(de2026.rows[0].n).toBe(5); // cuatro trimestres y el año fiscal
    await pool.query("DELETE FROM fiscal_periods WHERE name IN ('2031 Q2', '2031 Fiscal')");
  });

  it("repetir los scripts no cambia el periodo activo elegido en el Catálogo", async () => {
    const fiscal = (await repo.listarPeriodos()).find((p) => p.nombre === "2026 Fiscal")!;
    await repo.editarPeriodo(fiscal.id, { activo: true });
    for (const nombre of ["015_seed_estructura.sql", "017_jerarquia_organizacional.sql", "026_nombres_periodos.sql"]) {
      await pool.query(await script(nombre));
    }
    expect((await repo.obtenerPeriodoActivo())?.nombre).toBe("2026 Fiscal");
    const q4 = (await repo.listarPeriodos()).find((p) => p.nombre === "2026 Q4")!;
    await repo.editarPeriodo(q4.id, { activo: true });
  });

  it("los periodos son trimestrales, con 2026 Q4 como único activo", async () => {
    const activo = await repo.obtenerPeriodoActivo();
    expect(activo?.nombre).toBe("2026 Q4");
    expect((await repo.listarPeriodos()).filter((p) => p.activo)).toHaveLength(1);
  });

  it("el seed carga la jerarquía del Consolidado sin duplicarse al repetirse", async () => {
    const unidades = await repo.listarUnidades();
    expect(unidades.map((u) => [u.codigo, u.departamentoAuditoriaNombre])).toEqual([
      ["UDN-0001", "Retail & Spin"],
      ["UDN-0002", "Retail & Spin"],
      ["UDN-0003", "Beverage"],
      ["UDN-0004", "Retail & Spin"],
      ["UDN-0005", "Retail & Spin"],
      ["UDN-0006", "Beverage"],
    ]);
    const conteo = (await pool.query<{ divisiones: number; subdivisiones: number; areas: number; riesgos: number }>(
      `SELECT (SELECT COUNT(*)::int FROM division) AS divisiones, (SELECT COUNT(*)::int FROM business) AS subdivisiones,
              (SELECT COUNT(*)::int FROM area) AS areas, (SELECT COUNT(*)::int FROM risk_register) AS riesgos`,
    )).rows[0];
    expect(conteo).toEqual({ divisiones: 12, subdivisiones: 39, areas: 338, riesgos: 249 });
  });

  it("los nombres inferidos se muestran junto al código", async () => {
    const unidades = await repo.listarUnidades();
    expect(unidades.map((u) => [u.codigo, u.nombre])).toEqual([
      ["UDN-0001", "Deportes"],
      ["UDN-0002", "Spin"],
      ["UDN-0003", "KOF"],
      ["UDN-0004", "Proximidad y Salud"],
      ["UDN-0005", "FEMSA Servicios"],
      ["UDN-0006", "Tragetta"],
    ]);
    const europa = unidades[3]!.divisiones.find((d) => d.codigo === "DIVISION-0005");
    expect(europa?.nombre).toBe("Europa");
    expect(unidades.flatMap((u) => u.divisiones).filter((d) => d.nombre === null).map((d) => d.codigo)).toEqual([
      "DIVISION-0011",
    ]);
  });

  it("los datos de prueba solo traen códigos con el formato del nivel", async () => {
    const unidades = await repo.listarUnidades();
    const divisiones = unidades.flatMap((u) => u.divisiones);
    const subdivisiones = divisiones.flatMap((d) => d.subdivisiones);
    expect(unidades.every((u) => /^UDN-\d{4}$/.test(u.codigo))).toBe(true);
    expect(divisiones.every((d) => /^DIVISION-\d{4}$/.test(d.codigo))).toBe(true);
    expect(subdivisiones.every((s) => /^SUBDIVISION-\d{4}$/.test(s.codigo))).toBe(true);
  });

  it("024 quita la subdivisión sin código con sus áreas, sin tocar los nombres", async () => {
    // Simula una base que cargó los datos anteriores.
    const division = (await repo.listarUnidades()).find((u) => u.codigo === "UDN-0004")!.divisiones.find(
      (d) => d.codigo === "DIVISION-0005",
    )!;
    const subdivision = await repo.crearNodo("subdivision", { nombre: null, padreId: division.id, pais: "Alemania" });
    await pool.query("UPDATE business SET business_name = 'SIN NOMBRE (B-923765)' WHERE business_id = $1", [subdivision.id]);
    await repo.crearNodo("area", { nombre: "Operaciones", padreId: subdivision.id, pais: null });

    await pool.query(await script("024_seed_quitar_sin_codigo.sql"));

    expect(await repo.buscarNodo("subdivision", subdivision.id)).toBeNull();
    expect((await repo.listarUnidades()).find((u) => u.codigo === "UDN-0003")?.nombre).toBe("KOF");
  });

  it("los riesgos de prueba cuelgan de su subdivisión con nivel y procedimiento", async () => {
    const unidad = (await repo.listarUnidades()).find((u) => u.codigo === "UDN-0001")!;
    const subdivision = unidad.divisiones[0]!.subdivisiones[0]!;
    expect(subdivision.codigo).toBe("SUBDIVISION-0012");
    expect(subdivision.riesgos.length).toBeGreaterThan(0);
    expect(subdivision.riesgos.every((r) => r.nivel !== null && r.procedimientoControl?.startsWith("CP-"))).toBe(true);
    expect(await repo.tieneHijos("subdivision", subdivision.id)).toBe(true);
  });

  it("el nivel de riesgo solo acepta la escala definida", async () => {
    await expect(pool.query("INSERT INTO risk_library (name, level) VALUES ('X', 'Urgente')")).rejects.toThrow(
      /ck_risk_library_level/,
    );
  });

  it("la columna de padre es obligatoria en cada nivel", async () => {
    await expect(pool.query("INSERT INTO area (area_name) VALUES ('Suelta')")).rejects.toThrow(/null/i);
  });

  it("asigna el siguiente código por encima del Consolidado y reutiliza el de la última unidad borrada", async () => {
    const periodo = (await repo.obtenerPeriodoActivo())!.id;
    const alta = () => repo.crearUnidad({ nombre: null, responsableId: jefeId, departamentoAuditoriaId: null }, periodo, jefeId);
    expect(await repo.codigoProximo("unidad")).toBe("UDN-0007");
    const nueva = await alta();
    expect(nueva.codigo).toBe("UDN-0007");
    await repo.eliminarUnidad(nueva.id);
    expect(await repo.codigoProximo("unidad")).toBe("UDN-0007");
    const segunda = await alta();
    expect(segunda.codigo).toBe("UDN-0007");

    // División: después de DIVISION-0012 (el mayor del Consolidado).
    const division = await repo.crearNodo("division", { nombre: null, padreId: segunda.id, pais: null });
    expect(division.codigo).toBe("DIVISION-0013");
  });

  it("AC2: el nombre de unidad (si lo tiene) y el del área en su subdivisión no se repiten", async () => {
    const periodo = (await repo.obtenerPeriodoActivo())!.id;
    const alta = (nombre: string | null) =>
      repo.crearUnidad({ nombre, responsableId: jefeId, departamentoAuditoriaId: null }, periodo, jefeId);
    const unidad = await alta("Unidad Única");
    await expect(alta("unidad única")).rejects.toBeInstanceOf(ErrorNombreDuplicado);
    const otra = await alta(null);
    await alta(null); // varias sin nombre
    await expect(repo.editarUnidad(otra.id, { nombre: "UNIDAD ÚNICA" })).rejects.toBeInstanceOf(ErrorNombreDuplicado);
    expect((await repo.editarUnidad(unidad.id, { nombre: "unidad única" }))!.nombre).toBe("unidad única");

    const division = await repo.crearNodo("division", { nombre: null, padreId: unidad.id, pais: null });
    const [s1, s2] = [
      await repo.crearNodo("subdivision", { nombre: null, padreId: division.id, pais: null }),
      await repo.crearNodo("subdivision", { nombre: null, padreId: division.id, pais: null }),
    ];
    await repo.crearNodo("area", { nombre: "Nómina", padreId: s1.id, pais: null });
    await expect(repo.crearNodo("area", { nombre: "NÓMINA", padreId: s1.id, pais: null })).rejects.toBeInstanceOf(
      ErrorNombreDuplicado,
    );
    const compras = await repo.crearNodo("area", { nombre: "Compras", padreId: s1.id, pais: null });
    await expect(repo.editarNodo("area", compras.id, { nombre: "nómina" })).rejects.toBeInstanceOf(ErrorNombreDuplicado);
    expect((await repo.crearNodo("area", { nombre: "Nómina", padreId: s2.id, pais: null })).nombre).toBe("Nómina");
  });

  it("dos altas simultáneas reciben códigos distintos", async () => {
    const periodo = (await repo.obtenerPeriodoActivo())!.id;
    const alta = () => repo.crearUnidad({ nombre: null, responsableId: jefeId, departamentoAuditoriaId: null }, periodo, jefeId);
    const [a, b] = await Promise.all([alta(), alta()]);
    expect(a.codigo).not.toBe(b.codigo);
  });

  it("solo los planes Aprobado o En Ejecución bloquean cada nivel de la rama", async () => {
    const unidad = (await repo.listarUnidades()).find((u) => u.codigo === "UDN-0006")!;
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
    const unidad = (await repo.listarUnidades()).find((u) => u.codigo === "UDN-0001")!;
    const subdivision = await repo.crearNodo("subdivision", { nombre: null, padreId: unidad.divisiones[0]!.id, pais: null });
    const entidad = await uno(`INSERT INTO audit_entity (name, business_id) VALUES ('Entidad', $1) RETURNING id`, [subdivision.id]);

    expect(await repo.tieneHijos("subdivision", subdivision.id)).toBe(false);
    await repo.eliminarNodo("subdivision", subdivision.id);

    const fila = await pool.query("SELECT business_id FROM audit_entity WHERE id = $1", [entidad]);
    expect(fila.rows[0].business_id).toBeNull();
  });

  it("activar un periodo desactiva el anterior", async () => {
    const nuevo = await repo.crearPeriodo({ nombre: "2027 Q1", fechaInicio: "2027-01-01", fechaFin: "2027-03-31", activo: true });
    expect((await repo.obtenerPeriodoActivo())?.id).toBe(nuevo.id);
    const q4 = (await repo.listarPeriodos()).find((p) => p.nombre === "2026 Q4")!;
    await repo.editarPeriodo(q4.id, { activo: true });
    expect((await repo.obtenerPeriodoActivo())?.nombre).toBe("2026 Q4");
  });
});
