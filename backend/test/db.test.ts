import type sql from "mssql";
import { describe, expect, it } from "vitest";
import { poolPromise, registrarPool } from "../src/db.js";

describe("conexión compartida", () => {
  it("importar el módulo no abre ninguna conexión; las rutas esperan a la que registra el servidor", async () => {
    let entregada: unknown = null;
    void poolPromise.then((pool) => {
      entregada = pool;
    });
    await Promise.resolve();
    expect(entregada).toBeNull();

    const pool = { connected: true } as unknown as sql.ConnectionPool;
    registrarPool(pool);

    expect(await poolPromise).toBe(pool);
  });
});
