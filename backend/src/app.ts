import cors from "cors";
import express, { type ErrorRequestHandler, type Express, type Router } from "express";
import type { VerificadorToken } from "./auth/verificador.js";
import { registrarEnConsola, type RegistrarEvento } from "./bitacora.js";
import { ErrorApi } from "./errores.js";
import { autenticar } from "./middleware/autenticar.js";
import type { RepositorioUsuarios } from "./repos/repositorio.js";
import { rutasUsuarios } from "./routes/usuarios.js";

export interface DependenciasApp {
  repo: RepositorioUsuarios;
  verificador: VerificadorToken;
  dominiosPermitidos: readonly string[];
  corsOrigin: string | string[];
  registrarEvento?: RegistrarEvento;
  /** Rutas de /api que aún no exigen sesión. Deben pasar a exigirla. */
  rutasSinSesion?: Router[];
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
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: deps.corsOrigin }));
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
      registrarEvento: deps.registrarEvento ?? registrarEnConsola,
    }),
    () => {
      throw new ErrorApi(404, "NO_ENCONTRADO", "La ruta no existe.");
    },
  );

  app.use(manejarErrores);
  return app;
}
