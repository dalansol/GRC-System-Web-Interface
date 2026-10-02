type Entorno = Record<string, string | undefined>;

export type ConfigAuth = { modo: "dev" } | { modo: "entra"; tenantId: string; clientId: string };

export type ConfigDatos =
  | { modo: "memoria" }
  | {
      modo: "sql";
      servidor: string;
      baseDatos: string;
      usuario: string;
      contrasena: string;
      puerto: number;
      /** Solo para un SQL Server local con certificado autofirmado. */
      confiarCertificado: boolean;
    };

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

  const numeroDePuerto = (nombre: string, porOmision: number): number => {
    const valor = Number(env[nombre] ?? porOmision);
    if (!Number.isInteger(valor) || valor < 1 || valor > 65535) {
      throw new Error(`${nombre} debe ser un número de puerto válido.`);
    }
    return valor;
  };

  const puerto = numeroDePuerto("PORT", 3000);

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
    const confiarCertificado = env.DB_TRUST_CERT === "true";
    if (confiarCertificado && produccion) {
      throw new Error("DB_TRUST_CERT=true no está permitido en producción.");
    }
    datos = {
      modo: "sql",
      servidor: requerida("DB_SERVER"),
      baseDatos: requerida("DB_NAME"),
      usuario: requerida("DB_USER"),
      contrasena: requerida("DB_PASSWORD"),
      puerto: numeroDePuerto("DB_PORT", 1433),
      confiarCertificado,
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
    // Vite usa el 5174 si el 5173 está ocupado.
    corsOrigin: corsOrigin.length > 0 ? corsOrigin : ["http://localhost:5173", "http://localhost:5174"],
  };
}
