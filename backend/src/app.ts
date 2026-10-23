import cors from "cors";
import express, { type ErrorRequestHandler, type Express, type Router } from "express";
import type { ProveedorIA } from "./asistente/proveedor.js";
import type { VerificadorToken } from "./auth/verificador.js";
import { registrarEnConsola, type RegistrarEvento } from "./bitacora.js";
import { ErrorApi } from "./errores.js";
import { autenticar } from "./middleware/autenticar.js";
import type { RepositorioAsistente } from "./repos/asistente.js";
import { RepositorioAsistenteMemoria } from "./repos/asistenteMemoria.js";
import type { RepositorioConflictos } from "./repos/conflictos.js";
import { RepositorioConflictosMemoria } from "./repos/conflictosMemoria.js";
import type { RepositorioEstructura } from "./repos/estructura.js";
import type { RepositorioEvidencias } from "./repos/evidencias.js";
import type { RepositorioPlanes } from "./repos/planes.js";
import type { RepositorioPlanesAccion } from "./repos/planesAccion.js";
import type { RepositorioUsuarios } from "./repos/repositorio.js";
import { rutasAsistente } from "./routes/asistente.js";
import { rutasConflictos } from "./routes/conflictos.js";
import { rutasEstructura } from "./routes/estructura.js";
import { rutasPlanes } from "./routes/planes.js";
import { rutasPlanesAccion } from "./routes/planesAccion.js";
import { rutasUsuarios } from "./routes/usuarios.js";
import auditControls from "./routes/auditControls.js";

export interface DependenciasApp {
  repo: RepositorioUsuarios;
  repoPlanes: RepositorioPlanes;
  repoPlanesAccion: RepositorioPlanesAccion;
  repoEvidencias: RepositorioEvidencias;
  /** null si la IA está desactivada (IA_PROVEEDOR=ninguno). */
  proveedorIA: ProveedorIA | null;
  /** Expedientes y memoria del asistente. Si no se indica se usa el repositorio en memoria. */
  repoAsistente?: RepositorioAsistente;
  /** Declaraciones de conflictos de interés. Si no se indica se usa el repositorio en memoria. */
  repoConflictos?: RepositorioConflictos;
  repoEstructura?: RepositorioEstructura;
  verificador: VerificadorToken;
  dominiosPermitidos: readonly string[];
  corsOrigin: string | string[];
  registrarEvento?: RegistrarEvento;
  /** Rutas de /api que aún no exigen sesión. Deben pasar a exigirla. */
  rutasSinSesion?: Router[];
  /** Rutas de /api que requieren sesión y se montan tras autenticar. */
  rutasConSesion?: Router[];
}

const manejarErrores: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ErrorApi) {
    res.status(error.status).json({ error: { codigo: error.codigo, mensaje: error.message } });
    return;
  }
  // Errores de body-parser: JSON mal formado o cuerpo demasiado grande.
  const status = (error as { status?: number }).status;
  if (typeof status === "number" && status >= 400 && status < 500) {
    res.status(400).json({ error: { codigo: "DATOS_INVALIDOS", mensaje: "La petición no es válida." } });
    return;
  }
  console.error(error);
  res.status(500).json({ error: { codigo: "ERROR_INTERNO", mensaje: "Ocurrió un error inesperado." } });
};

export function crearApp(deps: DependenciasApp): Express {
  const registrarEvento = deps.registrarEvento ?? registrarEnConsola;
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: deps.corsOrigin }));
  // Las consultas del asistente llevan los datos de la vista; el resto de la API conserva 10 kB.
  app.use("/api/asistente/consultas", express.json({ limit: "100kb" }));
  app.use(express.json({ limit: "10kb" }));

  for (const rutas of deps.rutasSinSesion ?? []) {
    app.use("/api", rutas);
  }

  app.use(
    "/api",
    autenticar(deps.repo, deps.verificador),
    rutasUsuarios({
      repo: deps.repo,
      dominiosPermitidos: deps.dominiosPermitidos,
      registrarEvento,
    }),
    rutasPlanes({ repo: deps.repoPlanes, usuarios: deps.repo, registrarEvento }),
    rutasPlanesAccion({ repo: deps.repoPlanesAccion, usuarios: deps.repo, registrarEvento }),
    rutasAsistente({
      proveedor: deps.proveedorIA,
      evidencias: deps.repoEvidencias,
      conversaciones: deps.repoAsistente ?? new RepositorioAsistenteMemoria(),
      registrarEvento,
    }),
    rutasConflictos({
      repo: deps.repoConflictos ?? new RepositorioConflictosMemoria(deps.repo, deps.repoPlanes),
      registrarEvento,
    }),
    ...(deps.repoEstructura
      ? [rutasEstructura({ repo: deps.repoEstructura, usuarios: deps.repo, registrarEvento })]
      : []),
    auditControls,
    ...(deps.rutasConSesion ?? []),
    () => {
      throw new ErrorApi(404, "NO_ENCONTRADO", "La ruta no existe.");
    },
  );

  app.use(manejarErrores);
  return app;
}
