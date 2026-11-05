// Implementación SQL del repositorio de estructura organizacional (SF-03).
// Usa el pool de pg compartido por el backend. En la base, la subdivisión es la tabla
// `business` (ver 017_jerarquia_organizacional.sql).

import type pg from "pg";
import {
  ESTADOS_PLAN_ACTIVOS,
  formatearCodigo,
  PREFIJO_CODIGO,
  type NivelCodigo,
  type AltaNodoInput,
  type AltaPeriodoInput,
  type AltaUnidadInput,
  type DepartamentoAuditoria,
  type Division,
  type EdicionNodoInput,
  type EdicionPeriodoInput,
  type EdicionUnidadInput,
  type NivelEstructura,
  type NivelNodo,
  type NodoPlano,
  type NivelRiesgo,
  type PeriodoFiscal,
  type Riesgo,
  type UnidadNegocio,
} from "../domain/estructura.js";
import { ErrorNombreDuplicado, type RepositorioEstructura } from "./estructura.js";

const UNIQUE_VIOLATION = "23505";

function esDuplicado(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === UNIQUE_VIOLATION;
}

/**
 * AC2: traduce la violación de un índice único de nombre (025) a ErrorNombreDuplicado; cualquier
 * otro error (incluida otra violación única) se relanza tal cual.
 */
function traducirDuplicado(error: unknown, nombre: string | null | undefined): never {
  if (esDuplicado(error)) {
    const indice = (error as { constraint?: string }).constraint;
    if (indice === "uq_business_units_display_name") throw new ErrorNombreDuplicado("una unidad de negocio", nombre ?? "");
    if (indice === "uq_area_business_name") throw new ErrorNombreDuplicado("un área en esta subdivisión", nombre ?? "");
  }
  throw error;
}

// Tabla y columnas de cada nivel. Valores fijos: nunca vienen de la petición.
// `codigo` es la columna del código (el área no tiene); `nombre`, la del nombre (023).
const TABLAS: Record<NivelNodo, { tabla: string; id: string; codigo: string | null; nombre: string; padre: string }> = {
  division: { tabla: "division", id: "division_id", codigo: "name", nombre: "display_name", padre: "business_unit_id" },
  subdivision: { tabla: "business", id: "business_id", codigo: "business_name", nombre: "display_name", padre: "division_id" },
  area: { tabla: "area", id: "area_id", codigo: null, nombre: "area_name", padre: "business_id" },
};

/** Columnas de un NodoPlano para SELECT / RETURNING. */
function columnasNodo(t: (typeof TABLAS)[NivelNodo]): string {
  return `${t.id} AS id, ${t.codigo ?? "NULL::varchar"} AS codigo, ${t.nombre} AS nombre, ${t.padre} AS "padreId"`;
}

// Tabla y columna del código de cada nivel, para buscar el mayor número ya usado.
const COLUMNA_CODIGO: Record<NivelCodigo, { tabla: string; columna: string }> = {
  unidad: { tabla: "business_units", columna: "name" },
  division: { tabla: "division", columna: "name" },
  subdivision: { tabla: "business", columna: "business_name" },
};

// Condición sobre la rama para la regla de auditoría activa (alias b = business, d = division).
const RAMA: Record<NivelEstructura, string> = {
  unidad: "d.business_unit_id = $1",
  division: "d.division_id = $1",
  subdivision: "b.business_id = $1",
  area: "b.business_id = (SELECT business_id FROM area WHERE area_id = $1)",
};

// Consulta de hijos directos de cada nivel.
const HIJOS: Record<NivelEstructura, string | null> = {
  unidad: "SELECT 1 FROM division WHERE business_unit_id = $1",
  division: "SELECT 1 FROM business WHERE division_id = $1",
  // Los riesgos registrados también dependen de la subdivisión: no se desligan en silencio.
  subdivision: "SELECT 1 FROM area WHERE business_id = $1 UNION ALL SELECT 1 FROM risk_register WHERE business_id = $1",
  area: null,
};

interface FilaPeriodo {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

interface FilaUnidad {
  id: number;
  name: string;
  display_name: string | null;
  manager_id: number;
  manager_name: string;
  fiscal_period_id: number;
  fiscal_period_name: string;
  audit_department_id: number | null;
  audit_department_name: string | null;
  created_by: number;
  created_at: string;
}

interface FilaRama {
  business_unit_id: number;
  division_id: number;
  division_name: string;
  division_display_name: string | null;
  business_id: number | null;
  business_name: string | null;
  business_display_name: string | null;
  country: string | null;
  area_id: number | null;
  area_name: string | null;
}

interface FilaRiesgo {
  risk_register_id: number;
  business_id: number;
  name: string;
  level: NivelRiesgo | null;
  description: string | null;
}

const SELECT_PERIODO = "SELECT id, name, start_date::text, end_date::text, is_active FROM fiscal_periods";

const SELECT_UNIDAD = `
  SELECT bu.id, bu.name, bu.display_name, bu.manager_id, u.name AS manager_name,
         bu.fiscal_period_id, fp.name AS fiscal_period_name,
         bu.audit_department_id, cd.name AS audit_department_name,
         bu.created_by, bu.created_at
  FROM business_units bu
  JOIN users u ON u.id = bu.manager_id
  JOIN fiscal_periods fp ON fp.id = bu.fiscal_period_id
  LEFT JOIN catalog_department cd ON cd.id = bu.audit_department_id`;

// Una fila por área (o por división/subdivisión sin hijos); se arma el árbol en memoria.
const SELECT_RAMA = `
  SELECT d.business_unit_id, d.division_id, d.name AS division_name, d.display_name AS division_display_name,
         b.business_id, b.business_name, b.display_name AS business_display_name, b.country,
         a.area_id, a.area_name
  FROM division d
  LEFT JOIN business b ON b.division_id = d.division_id
  LEFT JOIN area a ON a.business_id = b.business_id`;

// Riesgos registrados en subdivisiones; se cuelgan del árbol en armarDivisiones.
const SELECT_RIESGOS = `
  SELECT rr.risk_register_id, rr.business_id, rl.name, rl.level, cp.description
  FROM risk_register rr
  JOIN risk_library rl ON rl.risk_library_id = rr.risk_library_id
  LEFT JOIN control_procedure cp ON cp.control_procedure_id = rr.control_procedure_id`;

function mapearPeriodo(row: FilaPeriodo): PeriodoFiscal {
  return { id: row.id, nombre: row.name, fechaInicio: row.start_date, fechaFin: row.end_date, activo: row.is_active };
}

function agruparRiesgos(filas: FilaRiesgo[]): Map<number, Riesgo[]> {
  const porSubdivision = new Map<number, Riesgo[]>();
  for (const fila of filas) {
    const lista = porSubdivision.get(fila.business_id) ?? [];
    lista.push({ id: fila.risk_register_id, nombre: fila.name, nivel: fila.level, procedimientoControl: fila.description });
    porSubdivision.set(fila.business_id, lista);
  }
  return porSubdivision;
}

function armarDivisiones(filas: FilaRama[], riesgos: Map<number, Riesgo[]>): Map<number, Division[]> {
  const porUnidad = new Map<number, Division[]>();
  const divisiones = new Map<number, Division>();
  const subdivisiones = new Map<number, Division["subdivisiones"][number]>();

  for (const fila of filas) {
    let division = divisiones.get(fila.division_id);
    if (!division) {
      division = {
        id: fila.division_id,
        codigo: fila.division_name,
        nombre: fila.division_display_name,
        unidadNegocioId: fila.business_unit_id,
        subdivisiones: [],
      };
      divisiones.set(division.id, division);
      const lista = porUnidad.get(fila.business_unit_id) ?? [];
      lista.push(division);
      porUnidad.set(fila.business_unit_id, lista);
    }
    if (fila.business_id === null) continue;

    let subdivision = subdivisiones.get(fila.business_id);
    if (!subdivision) {
      subdivision = {
        id: fila.business_id,
        codigo: fila.business_name ?? "",
        nombre: fila.business_display_name,
        pais: fila.country,
        divisionId: division.id,
        areas: [],
        riesgos: riesgos.get(fila.business_id) ?? [],
      };
      subdivisiones.set(subdivision.id, subdivision);
      division.subdivisiones.push(subdivision);
    }
    if (fila.area_id !== null) {
      subdivision.areas.push({ id: fila.area_id, nombre: fila.area_name ?? "", subdivisionId: subdivision.id });
    }
  }
  return porUnidad;
}

export class RepositorioEstructuraSql implements RepositorioEstructura {
  constructor(private pool: pg.Pool) {}

  // ── Periodos ───────────────────────────────────────────────────────────────

  async obtenerPeriodoActivo(): Promise<PeriodoFiscal | null> {
    const { rows } = await this.pool.query<FilaPeriodo>(`${SELECT_PERIODO} WHERE is_active = TRUE LIMIT 1`);
    return rows[0] ? mapearPeriodo(rows[0]) : null;
  }

  async listarPeriodos(): Promise<PeriodoFiscal[]> {
    const { rows } = await this.pool.query<FilaPeriodo>(`${SELECT_PERIODO} ORDER BY start_date DESC`);
    return rows.map(mapearPeriodo);
  }

  async buscarPeriodoPorId(id: number): Promise<PeriodoFiscal | null> {
    const { rows } = await this.pool.query<FilaPeriodo>(`${SELECT_PERIODO} WHERE id = $1`, [id]);
    return rows[0] ? mapearPeriodo(rows[0]) : null;
  }

  /** Activar un periodo desactiva los demás en la misma transacción (índice uq_fiscal_periods_active). */
  private async enTransaccion<T>(trabajo: (cliente: pg.PoolClient) => Promise<T>): Promise<T> {
    const cliente = await this.pool.connect();
    try {
      await cliente.query("BEGIN");
      const resultado = await trabajo(cliente);
      await cliente.query("COMMIT");
      return resultado;
    } catch (error) {
      await cliente.query("ROLLBACK");
      throw error;
    } finally {
      cliente.release();
    }
  }

  async crearPeriodo(datos: AltaPeriodoInput): Promise<PeriodoFiscal> {
    try {
      return await this.enTransaccion(async (cliente) => {
        if (datos.activo) await cliente.query("UPDATE fiscal_periods SET is_active = FALSE WHERE is_active");
        const { rows } = await cliente.query<FilaPeriodo>(
          `INSERT INTO fiscal_periods (name, start_date, end_date, is_active) VALUES ($1, $2, $3, $4)
           RETURNING id, name, start_date::text, end_date::text, is_active`,
          [datos.nombre, datos.fechaInicio, datos.fechaFin, datos.activo],
        );
        return mapearPeriodo(rows[0]!);
      });
    } catch (error) {
      if (esDuplicado(error)) throw new ErrorNombreDuplicado("un periodo", datos.nombre);
      throw error;
    }
  }

  async editarPeriodo(id: number, campos: EdicionPeriodoInput): Promise<PeriodoFiscal | null> {
    try {
      return await this.enTransaccion(async (cliente) => {
        if (campos.activo) {
          await cliente.query("UPDATE fiscal_periods SET is_active = FALSE WHERE is_active AND id <> $1", [id]);
        }
        const { rows } = await cliente.query<FilaPeriodo>(
          `UPDATE fiscal_periods
           SET name = COALESCE($2, name), start_date = COALESCE($3::date, start_date),
               end_date = COALESCE($4::date, end_date), is_active = COALESCE($5, is_active)
           WHERE id = $1
           RETURNING id, name, start_date::text, end_date::text, is_active`,
          [id, campos.nombre ?? null, campos.fechaInicio ?? null, campos.fechaFin ?? null, campos.activo ?? null],
        );
        return rows[0] ? mapearPeriodo(rows[0]) : null;
      });
    } catch (error) {
      if (esDuplicado(error)) throw new ErrorNombreDuplicado("un periodo", campos.nombre ?? "");
      throw error;
    }
  }

  async listarDepartamentos(): Promise<DepartamentoAuditoria[]> {
    const { rows } = await this.pool.query<{ id: number; name: string }>(
      "SELECT id, name FROM catalog_department ORDER BY name",
    );
    return rows.map((r) => ({ id: r.id, nombre: r.name }));
  }

  // ── Unidades ───────────────────────────────────────────────────────────────

  private aUnidad(u: FilaUnidad, divisiones: Division[]): UnidadNegocio {
    return {
      id: u.id,
      codigo: u.name,
      nombre: u.display_name,
      responsableId: u.manager_id,
      responsableNombre: u.manager_name,
      periodoFiscalId: u.fiscal_period_id,
      periodoFiscalNombre: u.fiscal_period_name,
      departamentoAuditoriaId: u.audit_department_id,
      departamentoAuditoriaNombre: u.audit_department_name,
      creadoPor: u.created_by,
      creadoEn: String(u.created_at),
      divisiones,
    };
  }

  async listarUnidades(): Promise<UnidadNegocio[]> {
    const { rows: unidades } = await this.pool.query<FilaUnidad>(`${SELECT_UNIDAD} ORDER BY bu.name`);
    const { rows: rama } = await this.pool.query<FilaRama>(
      `${SELECT_RAMA} ORDER BY d.name, d.division_id, b.business_name, b.business_id, a.area_name, a.area_id`,
    );
    const { rows: riesgos } = await this.pool.query<FilaRiesgo>(
      `${SELECT_RIESGOS} WHERE rr.business_id IS NOT NULL ORDER BY rl.name, rr.risk_register_id`,
    );
    const divisiones = armarDivisiones(rama, agruparRiesgos(riesgos));
    return unidades.map((u) => this.aUnidad(u, divisiones.get(u.id) ?? []));
  }

  async buscarUnidadPorId(id: number): Promise<UnidadNegocio | null> {
    const { rows } = await this.pool.query<FilaUnidad>(`${SELECT_UNIDAD} WHERE bu.id = $1`, [id]);
    if (!rows[0]) return null;
    const { rows: rama } = await this.pool.query<FilaRama>(
      `${SELECT_RAMA} WHERE d.business_unit_id = $1
       ORDER BY d.name, d.division_id, b.business_name, b.business_id, a.area_name, a.area_id`,
      [id],
    );
    const { rows: riesgos } = await this.pool.query<FilaRiesgo>(
      `${SELECT_RIESGOS}
       JOIN business b ON b.business_id = rr.business_id
       JOIN division d ON d.division_id = b.division_id
       WHERE d.business_unit_id = $1
       ORDER BY rl.name, rr.risk_register_id`,
      [id],
    );
    return this.aUnidad(rows[0], armarDivisiones(rama, agruparRiesgos(riesgos)).get(id) ?? []);
  }

  /**
   * Siguiente código del nivel, dentro de la transacción del alta: el mayor código existente
   * más uno, así que se reutiliza el de un elemento borrado si era el último (decisión del
   * 2026-10-28). La fila del nivel en `structure_code_counters` (023) solo se bloquea para que
   * dos altas simultáneas no tomen el mismo número; su valor ya no se usa.
   */
  private async siguienteCodigo(cliente: pg.PoolClient, nivel: NivelCodigo): Promise<string> {
    await cliente.query(
      "INSERT INTO structure_code_counters (level, last_value) VALUES ($1, 0) ON CONFLICT (level) DO NOTHING",
      [nivel],
    );
    await cliente.query("SELECT 1 FROM structure_code_counters WHERE level = $1 FOR UPDATE", [nivel]);
    return formatearCodigo(nivel, (await this.mayorCodigoExistente(cliente, nivel)) + 1);
  }

  /** Mayor número de código con el prefijo del nivel (0 si no hay). */
  private async mayorCodigoExistente(cliente: pg.Pool | pg.PoolClient, nivel: NivelCodigo): Promise<number> {
    const { tabla, columna } = COLUMNA_CODIGO[nivel];
    // La columna usa una intercalación no determinista: las expresiones regulares van en "C".
    const { rows } = await cliente.query<{ mayor: number }>(
      `SELECT COALESCE(MAX(substring(upper(${columna} COLLATE "C") FROM $1)::int), 0) AS mayor FROM ${tabla}`,
      [`^${PREFIJO_CODIGO[nivel]}-([0-9]+)$`],
    );
    return rows[0]!.mayor;
  }

  /** Misma cuenta que siguienteCodigo, sin bloquear. */
  async codigoProximo(nivel: NivelCodigo): Promise<string> {
    return formatearCodigo(nivel, (await this.mayorCodigoExistente(this.pool, nivel)) + 1);
  }

  async crearUnidad(datos: AltaUnidadInput, periodoFiscalId: number, creadoPor: number): Promise<UnidadNegocio> {
    const id = await this.enTransaccion(async (cliente) => {
      const codigo = await this.siguienteCodigo(cliente, "unidad");
      const { rows } = await cliente.query<{ id: number }>(
        `INSERT INTO business_units (name, display_name, manager_id, fiscal_period_id, audit_department_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [codigo, datos.nombre, datos.responsableId, periodoFiscalId, datos.departamentoAuditoriaId, creadoPor],
      );
      return rows[0]!.id;
    }).catch((error: unknown) => traducirDuplicado(error, datos.nombre));
    return (await this.buscarUnidadPorId(id))!;
  }

  async editarUnidad(id: number, campos: EdicionUnidadInput): Promise<UnidadNegocio | null> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (campos.nombre !== undefined) { vals.push(campos.nombre); sets.push(`display_name = $${vals.length}`); }
    if (campos.responsableId !== undefined) { vals.push(campos.responsableId); sets.push(`manager_id = $${vals.length}`); }
    if (campos.departamentoAuditoriaId !== undefined) {
      vals.push(campos.departamentoAuditoriaId);
      sets.push(`audit_department_id = $${vals.length}`);
    }
    if (sets.length === 0) return this.buscarUnidadPorId(id);

    vals.push(id);
    const { rowCount } = await this.pool
      .query(`UPDATE business_units SET ${sets.join(", ")} WHERE id = $${vals.length}`, vals)
      .catch((error: unknown) => traducirDuplicado(error, campos.nombre));
    if (rowCount === 0) return null;
    return this.buscarUnidadPorId(id);
  }

  async eliminarUnidad(id: number): Promise<void> {
    // Las unidades de la primera versión pueden tener procesos (tabla en desuso); se retiran
    // con la unidad y sus controles quedan sin proceso (016).
    await this.enTransaccion(async (cliente) => {
      await cliente.query("DELETE FROM processes WHERE business_unit_id = $1", [id]);
      await cliente.query("DELETE FROM business_units WHERE id = $1", [id]);
    });
  }

  // ── División, subdivisión y área ───────────────────────────────────────────

  async buscarNodo(nivel: NivelNodo, id: number): Promise<NodoPlano | null> {
    const t = TABLAS[nivel];
    const { rows } = await this.pool.query<NodoPlano>(`SELECT ${columnasNodo(t)} FROM ${t.tabla} WHERE ${t.id} = $1`, [id]);
    return rows[0] ?? null;
  }

  async crearNodo(nivel: NivelNodo, datos: AltaNodoInput): Promise<NodoPlano> {
    const t = TABLAS[nivel];
    return this.enTransaccion(async (cliente) => {
      const columnas = [t.nombre, t.padre];
      const vals: unknown[] = [datos.nombre, datos.padreId];
      if (nivel !== "area" && t.codigo) {
        columnas.push(t.codigo);
        vals.push(await this.siguienteCodigo(cliente, nivel));
      }
      if (nivel === "subdivision") { columnas.push("country"); vals.push(datos.pais); }
      const { rows } = await cliente.query<NodoPlano>(
        `INSERT INTO ${t.tabla} (${columnas.join(", ")}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(", ")})
         RETURNING ${columnasNodo(t)}`,
        vals,
      );
      return rows[0]!;
    }).catch((error: unknown) => traducirDuplicado(error, datos.nombre));
  }

  async editarNodo(nivel: NivelNodo, id: number, campos: EdicionNodoInput): Promise<NodoPlano | null> {
    const t = TABLAS[nivel];
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (campos.nombre !== undefined) { vals.push(campos.nombre); sets.push(`${t.nombre} = $${vals.length}`); }
    if (nivel === "subdivision" && campos.pais !== undefined) { vals.push(campos.pais); sets.push(`country = $${vals.length}`); }
    if (sets.length === 0) return this.buscarNodo(nivel, id);

    vals.push(id);
    const { rows } = await this.pool
      .query<NodoPlano>(
        `UPDATE ${t.tabla} SET ${sets.join(", ")} WHERE ${t.id} = $${vals.length}
         RETURNING ${columnasNodo(t)}`,
        vals,
      )
      .catch((error: unknown) => traducirDuplicado(error, campos.nombre));
    return rows[0] ?? null;
  }

  async eliminarNodo(nivel: NivelNodo, id: number): Promise<void> {
    const t = TABLAS[nivel];
    await this.pool.query(`DELETE FROM ${t.tabla} WHERE ${t.id} = $1`, [id]);
  }

  // ── Reglas de borrado ──────────────────────────────────────────────────────

  async tieneAuditoriasActivas(nivel: NivelEstructura, id: number): Promise<boolean> {
    const { rows } = await this.pool.query<{ tiene: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM audit_engagement ae
         JOIN audit_plans ap ON ap.id = ae.audit_plan_id
         JOIN audit_entity e ON e.id = ae.audit_entity_id
         JOIN business b ON b.business_id = e.business_id
         JOIN division d ON d.division_id = b.division_id
         WHERE ap.status = ANY($2::text[]) AND ${RAMA[nivel]}
       ) AS tiene`,
      [id, [...ESTADOS_PLAN_ACTIVOS]],
    );
    return rows[0]?.tiene ?? false;
  }

  async tieneHijos(nivel: NivelEstructura, id: number): Promise<boolean> {
    const consulta = HIJOS[nivel];
    if (!consulta) return false;
    const { rows } = await this.pool.query<{ tiene: boolean }>(`SELECT EXISTS (${consulta}) AS tiene`, [id]);
    return rows[0]?.tiene ?? false;
  }
}
