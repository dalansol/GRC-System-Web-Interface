import type pg from "pg";

// Conexión a la base compartida por todas las rutas. La abre server.ts con la
// configuración del .env y la registra aquí; importar este módulo no conecta.
let entregar: (pool: pg.Pool) => void;

export const poolPromise = new Promise<pg.Pool>((resolve) => {
  entregar = resolve;
});

export function registrarPool(pool: pg.Pool): void {
  entregar(pool);
}
