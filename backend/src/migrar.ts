// Aplica a la base de las variables DB_* (Supabase o un PostgreSQL local) los
// scripts de backend/sql que le falten, en orden, y los anota en schema_migrations.
//
//   pnpm db:migrar
//   pnpm db:migrar --datos-prueba
//   pnpm db:migrar --admin-nombre "Nombre Apellido" --admin-correo correo@dominio.com
//
// --datos-prueba agrega los usuarios, planes, hallazgos y controles de prueba (no usar en producción).
// --admin-nombre y --admin-correo dan de alta al primer Administrador, igual que
// 003_primer_administrador.sql, sin tener que editar ese archivo.
//
// Un script ya aplicado no se vuelve a correr. Si su contenido cambió se reaplica
// (todos se pueden repetir), pero un cambio al esquema debe ir en un script nuevo.

import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { cargarConfig } from "./config.js";
import { RepositorioSql } from "./repos/sql.js";

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
];
const SCRIPTS_DATOS_PRUEBA = ["005_seed_findings.sql", "009_seed_controles.sql", "018_seed_jerarquia.sql", "020_seed_riesgos.sql", "022_seed_nombres_reales.sql", "024_seed_quitar_sin_codigo.sql", "030_seed_demo.sql"];

const { values: opciones } = parseArgs({
  options: {
    "datos-prueba": { type: "boolean", default: false },
    "admin-nombre": { type: "string" },
    "admin-correo": { type: "string" },
  },
});

const nombreAdmin = opciones["admin-nombre"]?.trim();
const correoAdmin = opciones["admin-correo"]?.trim().toLowerCase();
if (Boolean(nombreAdmin) !== Boolean(correoAdmin)) {
  throw new Error("--admin-nombre y --admin-correo van juntos.");
}

const config = cargarConfig(process.env);
if (config.datos.modo !== "sql") {
  throw new Error("DATA_MODE debe ser 'sql' para aplicar los scripts a una base de datos.");
}
if (correoAdmin && !config.dominiosPermitidos.includes(correoAdmin.split("@")[1] ?? "")) {
  throw new Error(`El correo del Administrador debe ser de un dominio permitido (${config.dominiosPermitidos.join(", ")}).`);
}

const repo = await RepositorioSql.conectar(config.datos);
try {
  const pool = repo.pool;
  console.log(`Base de datos: ${config.datos.baseDatos} en ${config.datos.servidor}`);

  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
         name       VARCHAR(100)   NOT NULL CONSTRAINT pk_schema_migrations PRIMARY KEY,
         checksum   CHAR(64)       NOT NULL,
         applied_at TIMESTAMPTZ(0) NOT NULL DEFAULT now()
     );
     ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;`,
  );
  const registro = await pool.query<{ name: string; checksum: string }>("SELECT name, checksum FROM schema_migrations");
  const aplicados = new Map(registro.rows.map((fila) => [fila.name, fila.checksum]));

  const scripts = opciones["datos-prueba"] ? [...SCRIPTS, ...SCRIPTS_DATOS_PRUEBA].sort() : SCRIPTS;
  for (const nombre of scripts) {
    const contenido = await readFile(new URL(`../sql/${nombre}`, import.meta.url), "utf8");
    const checksum = createHash("sha256").update(contenido).digest("hex");
    const anterior = aplicados.get(nombre);
    if (anterior === checksum) {
      console.log(`  al día     ${nombre}`);
      continue;
    }

    // El script y su anotación se confirman juntos: si falla, no queda a medias.
    const cliente = await pool.connect();
    try {
      await cliente.query("BEGIN");
      await cliente.query(contenido);
      await cliente.query(
        `INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = now()`,
        [nombre, checksum],
      );
      await cliente.query("COMMIT");
    } catch (error) {
      await cliente.query("ROLLBACK");
      throw new Error(`Falló ${nombre}; no se aplicó nada de ese script.`, { cause: error });
    } finally {
      cliente.release();
    }
    console.log(`  ${anterior ? "reaplicado" : "aplicado  "} ${nombre}${anterior ? " (cambió desde la última vez)" : ""}`);
  }

  if (nombreAdmin && correoAdmin) {
    const resultado = await pool.query(
      `INSERT INTO users (name, email, role_id)
       SELECT $1, $2, r.id FROM roles r WHERE r.name = 'Administrador'
       ON CONFLICT (email) DO NOTHING`,
      [nombreAdmin, correoAdmin],
    );
    console.log(resultado.rowCount ? `  Administrador dado de alta: ${correoAdmin}` : `  ${correoAdmin} ya estaba registrado`);
  }

  const tablas = await pool.query<{ nombre: string }>(
    "SELECT tablename AS nombre FROM pg_tables WHERE schemaname = current_schema() ORDER BY tablename",
  );
  console.log(`Tablas (${tablas.rows.length}): ${tablas.rows.map((t) => t.nombre).join(", ")}`);
} finally {
  await repo.cerrar();
}
