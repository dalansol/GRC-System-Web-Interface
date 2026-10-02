import sql from "mssql";

// Conexión a la base compartida por todas las rutas. La abre server.ts con la
// configuración del .env y la registra aquí; importar este módulo no conecta.
let entregar: (pool: sql.ConnectionPool) => void;

export const poolPromise = new Promise<sql.ConnectionPool>((resolve) => {
  entregar = resolve;
});

export function registrarPool(pool: sql.ConnectionPool): void {
  entregar(pool);
}

export { sql };
