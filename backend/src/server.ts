import "dotenv/config";
import type { Router } from "express";
import { crearApp } from "./app.js";
import { crearVerificadorDev, crearVerificadorEntra } from "./auth/verificador.js";
import { cargarConfig } from "./config.js";
import { registrarPool } from "./db.js";
import { RepositorioMemoria } from "./repos/memoria.js";
import type { RepositorioPlanes } from "./repos/planes.js";
import type { RepositorioPlanesAccion } from "./repos/planesAccion.js";
import { RepositorioPlanesAccionMemoria } from "./repos/planesAccionMemoria.js";
import { RepositorioPlanesAccionSql } from "./repos/planesAccionSql.js";
import { RepositorioPlanesMemoria } from "./repos/planesMemoria.js";
import { RepositorioPlanesSql } from "./repos/planesSql.js";
import type { RepositorioUsuarios } from "./repos/repositorio.js";
import { RepositorioSql } from "./repos/sql.js";

const config = cargarConfig(process.env);

let repo: RepositorioUsuarios;
let repoPlanes: RepositorioPlanes;
let repoPlanesAccion: RepositorioPlanesAccion;
const rutasSinSesion: Router[] = [];

if (config.datos.modo === "sql") {
  const repoSql = await RepositorioSql.conectar(config.datos);
  repo = repoSql;
  repoPlanes = new RepositorioPlanesSql(repoSql.pool);
  repoPlanesAccion = new RepositorioPlanesAccionSql(repoSql.pool);
  // Las rutas de hallazgos y evidencias usan la misma conexión que las de usuarios.
  registrarPool(repoSql.pool);
  rutasSinSesion.push((await import("./routes/hallazgos.js")).default);
  rutasSinSesion.push((await import("./routes/evidencias.js")).default);
} else {
  // Sin base de datos no hay rutas de hallazgos ni de evidencias; el frontend usa sus datos de prueba.
  repo = new RepositorioMemoria();
  repoPlanes = new RepositorioPlanesMemoria(repo);
  repoPlanesAccion = new RepositorioPlanesAccionMemoria(repo);
}

const verificador = config.auth.modo === "entra" ? crearVerificadorEntra(config.auth) : crearVerificadorDev();

const app = crearApp({
  repo,
  repoPlanes,
  repoPlanesAccion,
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
