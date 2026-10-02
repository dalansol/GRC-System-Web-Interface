type Entorno = Record<string, string | undefined>;

export type ConfigAuth = { modo: "dev" } | { modo: "entra"; tenantId: string; clientId: string };

export type ConfigDatos =
  | { modo: "memoria" }
  | { modo: "sql"; servidor: string; baseDatos: string; usuario: string; contrasena: string };

export interface Config {
  puerto: number;
  auth: ConfigAuth;
  datos: ConfigDatos;
  dominiosPermitidos: string[];
  corsOrigin: string[];
}

function lista(valor: string | undefined): string[] {
  return (valor ?? "")
    .split(",")
    .map((parte) => parte.trim())
    .filter(Boolean);
}

export function cargarConfig(env: Entorno): Config {
  const produccion = env.NODE_ENV === "production";

  const requerida = (nombre: string): string => {
    const valor = env[nombre]?.trim();
    if (!valor) throw new Error(`Falta la variable de entorno ${nombre}.`);
    return valor;
  };

  const puerto = Number(env.PORT ?? 3001);
  if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
    throw new Error("PORT debe ser un número de puerto válido.");
  }

  const modoAuth = env.AUTH_MODE ?? "entra";
  let auth: ConfigAuth;
  if (modoAuth === "dev") {
    if (produccion) throw new Error("AUTH_MODE=dev no está permitido en producción.");
    auth = { modo: "dev" };
  } else if (modoAuth === "entra") {
    auth = { modo: "entra", tenantId: requerida("ENTRA_TENANT_ID"), clientId: requerida("ENTRA_CLIENT_ID") };
  } else {
    throw new Error("AUTH_MODE debe ser 'entra' o 'dev'.");
  }

  const modoDatos = env.DATA_MODE ?? "sql";
  let datos: ConfigDatos;
  if (modoDatos === "memoria") {
    if (produccion) throw new Error("DATA_MODE=memoria no está permitido en producción.");
    datos = { modo: "memoria" };
  } else if (modoDatos === "sql") {
    datos = {
      modo: "sql",
      servidor: requerida("SQL_SERVER"),
      baseDatos: requerida("SQL_DATABASE"),
      usuario: requerida("SQL_USER"),
      contrasena: requerida("SQL_PASSWORD"),
    };
  } else {
    throw new Error("DATA_MODE debe ser 'sql' o 'memoria'.");
  }

  const dominiosPermitidos = lista(env.DOMINIOS_PERMITIDOS).map((d) => d.replace(/^@/, "").toLowerCase());
  if (dominiosPermitidos.length === 0) {
    throw new Error("DOMINIOS_PERMITIDOS debe incluir al menos un dominio corporativo.");
  }

  const corsOrigin = lista(env.CORS_ORIGIN);

  return {
    puerto,
    auth,
    datos,
    dominiosPermitidos,
    corsOrigin: corsOrigin.length > 0 ? corsOrigin : ["http://localhost:5173"],
  };
}
