// Implementación SQL de los catálogos de la estructura (SF-03), tabla `structure_options` (034).
// `value` usa la intercalación `sin_mayusculas`: las comparaciones contra `area.area_name` y
// `business.country` la fuerzan con COLLATE para ignorar mayúsculas (no acentos).

import type pg from "pg";
import type { OpcionCatalogo, TipoCatalogo } from "../domain/catalogos.js";
import { ErrorOpcionEnUso, type RepositorioCatalogos } from "./catalogos.js";
import { ErrorNombreDuplicado } from "./estructura.js";

const UNIQUE_VIOLATION = "23505";

// Tabla y columna de la estructura que usa cada catálogo. Valores fijos: nunca vienen de la petición.
const USOS: Record<TipoCatalogo, { tabla: string; columna: string }> = {
  area: { tabla: "area", columna: "area_name" },
  pais: { tabla: "business", columna: "country" },
};

function columnasOpcion(tipo: TipoCatalogo): string {
  const { tabla, columna } = USOS[tipo];
  return `o.id, o.value AS valor,
          (SELECT COUNT(*)::int FROM ${tabla} u WHERE u.${columna} COLLATE sin_mayusculas = o.value) AS usos`;
}

function traducirDuplicado(error: unknown, valor: string): never {
  const { code, constraint } = (error ?? {}) as { code?: string; constraint?: string };
  if (code === UNIQUE_VIOLATION && constraint === "uq_structure_options_kind_value") {
    throw new ErrorNombreDuplicado("una opción", valor);
  }
  // Renombrar un área a un nombre que ya tiene otra en la misma subdivisión (025).
  if (code === UNIQUE_VIOLATION && constraint === "uq_area_business_name") {
    throw new ErrorNombreDuplicado("un área en una de las subdivisiones que usan esta opción", valor);
  }
  throw error;
}

export class RepositorioCatalogosSql implements RepositorioCatalogos {
  constructor(private pool: pg.Pool) {}

  async listar(tipo: TipoCatalogo): Promise<OpcionCatalogo[]> {
    const { rows } = await this.pool.query<OpcionCatalogo>(
      `SELECT ${columnasOpcion(tipo)} FROM structure_options o WHERE o.kind = $1 ORDER BY o.value`,
      [tipo],
    );
    return rows;
  }

  async buscarPorId(tipo: TipoCatalogo, id: number): Promise<OpcionCatalogo | null> {
    const { rows } = await this.pool.query<OpcionCatalogo>(
      `SELECT ${columnasOpcion(tipo)} FROM structure_options o WHERE o.kind = $1 AND o.id = $2`,
      [tipo, id],
    );
    return rows[0] ?? null;
  }

  async buscarPorValor(tipo: TipoCatalogo, valor: string): Promise<OpcionCatalogo | null> {
    const { rows } = await this.pool.query<OpcionCatalogo>(
      `SELECT ${columnasOpcion(tipo)} FROM structure_options o WHERE o.kind = $1 AND o.value = $2`,
      [tipo, valor.trim()],
    );
    return rows[0] ?? null;
  }

  async crear(tipo: TipoCatalogo, valor: string): Promise<OpcionCatalogo> {
    const limpio = valor.trim();
    const { rows } = await this.pool
      .query<{ id: number }>("INSERT INTO structure_options (kind, value) VALUES ($1, $2) RETURNING id", [tipo, limpio])
      .catch((error: unknown) => traducirDuplicado(error, limpio));
    return (await this.buscarPorId(tipo, rows[0]!.id))!;
  }

  async renombrar(tipo: TipoCatalogo, id: number, valor: string) {
    const limpio = valor.trim();
    const { tabla, columna } = USOS[tipo];
    const cliente = await this.pool.connect();
    try {
      await cliente.query("BEGIN");
      const actual = await cliente.query<{ value: string }>(
        "SELECT value FROM structure_options WHERE kind = $1 AND id = $2 FOR UPDATE",
        [tipo, id],
      );
      const anterior = actual.rows[0]?.value;
      if (anterior === undefined) {
        await cliente.query("ROLLBACK");
        return null;
      }
      await cliente.query("UPDATE structure_options SET value = $1 WHERE id = $2", [limpio, id]);
      await cliente.query(`UPDATE ${tabla} SET ${columna} = $1 WHERE ${columna} COLLATE sin_mayusculas = $2`, [
        limpio,
        anterior,
      ]);
      await cliente.query("COMMIT");
      return { opcion: (await this.buscarPorId(tipo, id))!, anterior };
    } catch (error) {
      await cliente.query("ROLLBACK");
      return traducirDuplicado(error, limpio);
    } finally {
      cliente.release();
    }
  }

  async eliminar(tipo: TipoCatalogo, id: number): Promise<void> {
    const opcion = await this.buscarPorId(tipo, id);
    if (!opcion) return;
    if (opcion.usos > 0) throw new ErrorOpcionEnUso(opcion.valor, opcion.usos);
    await this.pool.query("DELETE FROM structure_options WHERE kind = $1 AND id = $2", [tipo, id]);
  }
}
