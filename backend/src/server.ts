import "dotenv/config";
import type { Router } from "express";
import { crearApp } from "./app.js";
import { crearVerificadorDev, crearVerificadorEntra } from "./auth/verificador.js";
import { cargarConfig } from "./config.js";
import { registrarPool } from "./db.js";
import { RepositorioMemoria } from "./repos/memoria.js";
import type { RepositorioUsuarios } from "./repos/repositorio.js";
import { RepositorioSql } from "./repos/sql.js";

const config = cargarConfig(process.env);

let repo: RepositorioUsuarios;
const rutasSinSesion: Router[] = [];

if (config.datos.modo === "sql") {
  const repoSql = await RepositorioSql.conectar(config.datos);
  repo = repoSql;
  // Las rutas de hallazgos usan la misma conexión que las de usuarios.
  registrarPool(repoSql.pool);
  rutasSinSesion.push((await import("./routes/hallazgos.js")).default);
} else {
  // Sin base de datos no hay rutas de hallazgos; el frontend usa sus datos de prueba.
  repo = new RepositorioMemoria();
}

const verificador = config.auth.modo === "entra" ? crearVerificadorEntra(config.auth) : crearVerificadorDev();

const app = crearApp({
  repo,
  verificador,
  dominiosPermitidos: config.dominiosPermitidos,
  corsOrigin: config.corsOrigin,
  rutasSinSesion,
});

app.listen(config.puerto, () => {
  console.log(
    `API Expedite en http://localhost:${config.puerto}/api (autenticación: ${config.auth.modo}, datos: ${config.datos.modo})`,
  );
});
