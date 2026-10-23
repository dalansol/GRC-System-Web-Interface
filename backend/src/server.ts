import "dotenv/config";
import type { Router } from "express";
import { crearAlmacenamiento } from "./almacenamiento.js";
import { crearApp } from "./app.js";
import { crearProveedor } from "./asistente/proveedor.js";
import { crearVerificadorDev, crearVerificadorEntra } from "./auth/verificador.js";
import { cargarConfig } from "./config.js";
import { registrarPool } from "./db.js";
import type { RepositorioConflictos } from "./repos/conflictos.js";
import { RepositorioConflictosMemoria } from "./repos/conflictosMemoria.js";
import { RepositorioConflictosSql } from "./repos/conflictosSql.js";
import type { RepositorioEvidencias } from "./repos/evidencias.js";
import { RepositorioEvidenciasMemoria } from "./repos/evidenciasMemoria.js";
import { RepositorioEvidenciasSql } from "./repos/evidenciasSql.js";
import { RepositorioMemoria } from "./repos/memoria.js";
import type { RepositorioPlanes } from "./repos/planes.js";
import type { RepositorioPlanesAccion } from "./repos/planesAccion.js";
import { RepositorioPlanesAccionMemoria } from "./repos/planesAccionMemoria.js";
import { RepositorioPlanesAccionSql } from "./repos/planesAccionSql.js";
import { RepositorioPlanesMemoria } from "./repos/planesMemoria.js";
import { RepositorioPlanesSql } from "./repos/planesSql.js";
import type { RepositorioUsuarios } from "./repos/repositorio.js";
import type { RepositorioEstructura } from "./repos/estructura.js";
import { RepositorioEstructuraMemoria } from "./repos/estructuraMemoria.js";
import { SEMILLA_ESTRUCTURA } from "./repos/semillaEstructura.js";
import { RepositorioEstructuraSql } from "./repos/estructuraSql.js";
import { RepositorioSql } from "./repos/sql.js";

const config = cargarConfig(process.env);
const almacenamiento = crearAlmacenamiento(config.almacenamiento);

let repo: RepositorioUsuarios;
let repoPlanes: RepositorioPlanes;
let repoPlanesAccion: RepositorioPlanesAccion;
let repoConflictos: RepositorioConflictos;
let repoEvidencias: RepositorioEvidencias;
let repoEstructura: RepositorioEstructura;
const rutasSinSesion: Router[] = [];

if (config.datos.modo === "sql") {
  const repoSql = await RepositorioSql.conectar(config.datos);
  repo = repoSql;
  repoPlanes = new RepositorioPlanesSql(repoSql.pool);
  repoPlanesAccion = new RepositorioPlanesAccionSql(repoSql.pool);
  repoConflictos = new RepositorioConflictosSql(repoSql.pool);
  repoEvidencias = new RepositorioEvidenciasSql(repoSql.pool, almacenamiento);
  repoEstructura = new RepositorioEstructuraSql(repoSql.pool);
  // Las rutas de hallazgos y evidencias usan la misma conexión que las de usuarios.
  registrarPool(repoSql.pool);
  rutasSinSesion.push((await import("./routes/hallazgos.js")).default);
} else {
  // Sin base de datos no hay rutas de hallazgos ni de evidencias; el frontend usa sus datos de prueba.
  repo = new RepositorioMemoria();
  repoPlanes = new RepositorioPlanesMemoria(repo);
  repoPlanesAccion = new RepositorioPlanesAccionMemoria(repo);
  repoConflictos = new RepositorioConflictosMemoria(repo, repoPlanes);
  repoEvidencias = new RepositorioEvidenciasMemoria();
  // La estructura arranca con los datos del Consolidado (anonimizados), a cargo del primer
  // Jefe de Auditoría activo, igual que 018_seed_jerarquia.sql en la base.
  const estructuraMemoria = new RepositorioEstructuraMemoria(repo);
  const jefe = (await repo.listarUsuarios()).find((u) => u.rol === "Jefe de Auditoría" && u.estado === "active");
  if (jefe) estructuraMemoria.sembrar(SEMILLA_ESTRUCTURA, jefe.id);
  repoEstructura = estructuraMemoria;
}

const verificador = config.auth.modo === "entra" ? crearVerificadorEntra(config.auth) : crearVerificadorDev();

const app = crearApp({
  repo,
  repoPlanes,
  repoPlanesAccion,
  repoEvidencias,
  proveedorIA: crearProveedor(config.ia),
  repoConflictos,
  repoEstructura,
  rutasConSesion: config.datos.modo === "sql"
    ? [(await import("./routes/evidencias.js")).rutasEvidencias(almacenamiento)]
    : [],
  verificador,
  dominiosPermitidos: config.dominiosPermitidos,
  corsOrigin: config.corsOrigin,
  rutasSinSesion,
});

app.listen(config.puerto, () => {
  console.log(
    `API Expedite en http://localhost:${config.puerto}/api (autenticación: ${config.auth.modo}, datos: ${config.datos.modo}, archivos: ${config.almacenamiento.proveedor}, IA: ${config.ia.proveedor})`,
  );
});
