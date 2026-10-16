// Implementación SQL del repositorio de estructura organizacional (SF-03).
// Usa el pool de pg compartido por el backend.

import type pg from "pg";
import type {
  PeriodoFiscal,
  UnidadNegocio,
  Proceso,
  AltaUnidadInput,
  AltaProcesoInput,
} from "../domain/estructura.js";
import { ErrorNombreDuplicado, ErrorAuditoriasActivas, type RepositorioEstructura } from "./estructura.js";

const UNIQUE_VIOLATION = "23505";

function esDuplicado(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === UNIQUE_VIOLATION;
}

export class RepositorioEstructuraSql implements RepositorioEstructura {
  constructor(private pool: pg.Pool) {}

  async obtenerPeriodoActivo(): Promise<PeriodoFiscal | null> {
    const { rows } = await this.pool.query<{
      id: number; name: string; start_date: string; end_date: string; is_active: boolean;
    }>(
      "SELECT id, name, start_date::text, end_date::text, is_active FROM fiscal_periods WHERE is_active = TRUE LIMIT 1",
    );
    return rows[0] ? this.mapearPeriodo(rows[0]) : null;
  }

  async listarPeriodos(): Promise<PeriodoFiscal[]> {
    const { rows } = await this.pool.query<{
      id: number; name: string; start_date: string; end_date: string; is_active: boolean;
    }>("SELECT id, name, start_date::text, end_date::text, is_active FROM fiscal_periods ORDER BY start_date DESC");
    return rows.map(this.mapearPeriodo);
  }

  async listarUnidades(): Promise<UnidadNegocio[]> {
    const { rows: unidades } = await this.pool.query<{
      id: number; name: string; manager_id: number; manager_name: string;
      fiscal_period_id: number; fiscal_period_name: string;
      created_by: number; created_at: string;
    }>(`
      SELECT bu.id, bu.name, bu.manager_id,
             u.name AS manager_name,
             bu.fiscal_period_id,
             fp.name AS fiscal_period_name,
             bu.created_by,
             bu.created_at
      FROM business_units bu
      JOIN users u ON u.id = bu.manager_id
      JOIN fiscal_periods fp ON fp.id = bu.fiscal_period_id
      ORDER BY bu.name
    `);

    const { rows: procesos } = await this.pool.query<{
      id: number; business_unit_id: number; name: string; created_at: string;
    }>("SELECT id, business_unit_id, name, created_at FROM processes ORDER BY name");

    const procesosPorUnidad = new Map<number, Proceso[]>();
    for (const p of procesos) {
      const lista = procesosPorUnidad.get(p.business_unit_id) ?? [];
      lista.push({ id: p.id, nombre: p.name, unidadNegocioId: p.business_unit_id, creadoEn: String(p.created_at) });
      procesosPorUnidad.set(p.business_unit_id, lista);
    }

    return unidades.map((u) => ({
      id: u.id,
      nombre: u.name,
      responsableId: u.manager_id,
      responsableNombre: u.manager_name,
      periodoFiscalId: u.fiscal_period_id,
      periodoFiscalNombre: u.fiscal_period_name,
      creadoPor: u.created_by,
      creadoEn: String(u.created_at),
      procesos: procesosPorUnidad.get(u.id) ?? [],
    }));
  }

  async buscarUnidadPorId(id: number): Promise<UnidadNegocio | null> {
    const { rows } = await this.pool.query<{
      id: number; name: string; manager_id: number; manager_name: string;
      fiscal_period_id: number; fiscal_period_name: string;
      created_by: number; created_at: string;
    }>(`
      SELECT bu.id, bu.name, bu.manager_id,
             u.name AS manager_name,
             bu.fiscal_period_id,
             fp.name AS fiscal_period_name,
             bu.created_by,
             bu.created_at
      FROM business_units bu
      JOIN users u ON u.id = bu.manager_id
      JOIN fiscal_periods fp ON fp.id = bu.fiscal_period_id
      WHERE bu.id = $1
    `, [id]);

    if (!rows[0]) return null;

    const { rows: procesos } = await this.pool.query<{
      id: number; business_unit_id: number; name: string; created_at: string;
    }>("SELECT id, business_unit_id, name, created_at FROM processes WHERE business_unit_id = $1 ORDER BY name", [id]);

    const u = rows[0];
    return {
      id: u.id,
      nombre: u.name,
      responsableId: u.manager_id,
      responsableNombre: u.manager_name,
      periodoFiscalId: u.fiscal_period_id,
      periodoFiscalNombre: u.fiscal_period_name,
      creadoPor: u.created_by,
      creadoEn: String(u.created_at),
      procesos: procesos.map((p) => ({
        id: p.id,
        nombre: p.name,
        unidadNegocioId: p.business_unit_id,
        creadoEn: String(p.created_at),
      })),
    };
  }

  async crearUnidadConProceso(datos: AltaUnidadInput, periodoFiscalId: number, creadoPor: number): Promise<UnidadNegocio> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      let unidadId: number;
      try {
        const { rows } = await client.query<{ id: number }>(
          `INSERT INTO business_units (name, manager_id, fiscal_period_id, created_by)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [datos.nombre, datos.responsableId, periodoFiscalId, creadoPor],
        );
        unidadId = rows[0]!.id;
      } catch (error) {
        if (esDuplicado(error)) throw new ErrorNombreDuplicado("una unidad de negocio", datos.nombre);
        throw error;
      }

      try {
        await client.query(
          "INSERT INTO processes (business_unit_id, name) VALUES ($1, $2)",
          [unidadId, datos.proceso],
        );
      } catch (error) {
        if (esDuplicado(error)) throw new ErrorNombreDuplicado("un proceso", datos.proceso);
        throw error;
      }

      await client.query("COMMIT");
      return (await this.buscarUnidadPorId(unidadId))!;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async editarUnidad(id: number, campos: { nombre?: string; responsableId?: number }): Promise<UnidadNegocio | null> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (campos.nombre !== undefined) { sets.push(`name = $${i++}`); vals.push(campos.nombre); }
    if (campos.responsableId !== undefined) { sets.push(`manager_id = $${i++}`); vals.push(campos.responsableId); }
    if (sets.length === 0) return this.buscarUnidadPorId(id);

    vals.push(id);
    try {
      const { rowCount } = await this.pool.query(
        `UPDATE business_units SET ${sets.join(", ")} WHERE id = $${i}`,
        vals,
      );
      if (rowCount === 0) return null;
    } catch (error) {
      if (esDuplicado(error)) throw new ErrorNombreDuplicado("una unidad de negocio", campos.nombre ?? "");
      throw error;
    }
    return this.buscarUnidadPorId(id);
  }

  async tieneAuditoriasActivas(unidadId: number): Promise<boolean> {
    const { rows } = await this.pool.query<{ tiene: boolean }>(`
      SELECT EXISTS (
        SELECT 1
        FROM processes p
        JOIN controls c ON c.process_id = p.id
        JOIN audit_controls ac ON ac.control_id = c.id
        JOIN audit_plans ap ON ap.id = ac.audit_id
        WHERE p.business_unit_id = $1
          AND ap.status != 'Cerrado'
      ) AS tiene
    `, [unidadId]);
    return rows[0]?.tiene ?? false;
  }

  async eliminarUnidad(id: number): Promise<void> {
    // Eliminar procesos hijos primero, luego la unidad.
    await this.pool.query("DELETE FROM processes WHERE business_unit_id = $1", [id]);
    await this.pool.query("DELETE FROM business_units WHERE id = $1", [id]);
  }

  async crearProceso(datos: AltaProcesoInput): Promise<Proceso> {
    try {
      const { rows } = await this.pool.query<{ id: number; business_unit_id: number; name: string; created_at: string }>(
        "INSERT INTO processes (business_unit_id, name) VALUES ($1, $2) RETURNING id, business_unit_id, name, created_at",
        [datos.unidadNegocioId, datos.nombre],
      );
      const p = rows[0]!;
      return { id: p.id, nombre: p.name, unidadNegocioId: p.business_unit_id, creadoEn: String(p.created_at) };
    } catch (error) {
      if (esDuplicado(error)) throw new ErrorNombreDuplicado("un proceso", datos.nombre);
      throw error;
    }
  }

  async editarProceso(id: number, nombre: string): Promise<Proceso | null> {
    try {
      const { rows } = await this.pool.query<{ id: number; business_unit_id: number; name: string; created_at: string }>(
        "UPDATE processes SET name = $1 WHERE id = $2 RETURNING id, business_unit_id, name, created_at",
        [nombre, id],
      );
      if (!rows[0]) return null;
      const p = rows[0];
      return { id: p.id, nombre: p.name, unidadNegocioId: p.business_unit_id, creadoEn: String(p.created_at) };
    } catch (error) {
      if (esDuplicado(error)) throw new ErrorNombreDuplicado("un proceso", nombre);
      throw error;
    }
  }

  async tieneAuditoriasActivasProceso(procesoId: number): Promise<boolean> {
    const { rows } = await this.pool.query<{ tiene: boolean }>(`
      SELECT EXISTS (
        SELECT 1
        FROM controls c
        JOIN audit_controls ac ON ac.control_id = c.id
        JOIN audit_plans ap ON ap.id = ac.audit_id
        WHERE c.process_id = $1
          AND ap.status != 'Cerrado'
      ) AS tiene
    `, [procesoId]);
    return rows[0]?.tiene ?? false;
  }

  async eliminarProceso(id: number): Promise<void> {
    await this.pool.query("DELETE FROM processes WHERE id = $1", [id]);
  }

  private mapearPeriodo(row: { id: number; name: string; start_date: string; end_date: string; is_active: boolean }): PeriodoFiscal {
    return {
      id: row.id,
      nombre: row.name,
      fechaInicio: row.start_date,
      fechaFin: row.end_date,
      activo: row.is_active,
    };
  }
}
