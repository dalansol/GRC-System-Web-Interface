import "dotenv/config";
import { crearApp } from "./app.js";
import { crearVerificadorDev, crearVerificadorEntra } from "./auth/verificador.js";
import { cargarConfig } from "./config.js";
import { RepositorioMemoria } from "./repos/memoria.js";
import { RepositorioSql } from "./repos/sql.js";

const config = cargarConfig(process.env);

const repo =
  config.datos.modo === "sql"
    ? await RepositorioSql.conectar({
        ...config.datos,
        puerto: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : undefined,
        confiarCertificado: process.env.SQL_TRUST_CERT === "true" && process.env.NODE_ENV !== "production",
      })
    : new RepositorioMemoria();

const verificador = config.auth.modo === "entra" ? crearVerificadorEntra(config.auth) : crearVerificadorDev();

const app = crearApp({
  repo,
  verificador,
  dominiosPermitidos: config.dominiosPermitidos,
  corsOrigin: config.corsOrigin,
});

app.listen(config.puerto, () => {
  console.log(
    `API Expedite en http://localhost:${config.puerto} (autenticación: ${config.auth.modo}, datos: ${config.datos.modo})`,
  );
});
