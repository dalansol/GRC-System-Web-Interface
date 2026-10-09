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

// Asistente de IA (SF-19). Es opcional: sin proveedor la plataforma funciona y la función queda desactivada.
export type ConfigIA =
  | { proveedor: "ninguno"; tiempoEsperaMs: number }
  | { proveedor: "gemini"; apiKey: string; modelo: string; tiempoEsperaMs: number }
  | {
      proveedor: "azure";
      endpoint: string;
      apiKey: string;
      despliegue: string;
      versionApi: string;
      tiempoEsperaMs: number;
    };

export interface Config {
  puerto: number;
  auth: ConfigAuth;
  datos: ConfigDatos;
  ia: ConfigIA;
  dominiosPermitidos: string[];
  corsOrigin: string[];
}

function lista(valor: string | undefined): string[] {
  return (valor ?? "")
    .split(",")
    .map((parte) => parte.trim())
    .filter(Boolean);
}

function variableRequerida(env: Entorno) {
  return (nombre: string): string => {
    const valor = env[nombre]?.trim();
    if (!valor) throw new Error(`Falta la variable de entorno ${nombre}.`);
    return valor;
  };
}

// Se exporta aparte para que el script de prueba de conexión no exija el resto de la configuración.
export function cargarConfigIA(env: Entorno): ConfigIA {
  const requerida = variableRequerida(env);

  const tiempoEsperaMs = Number(env.IA_TIEMPO_ESPERA_MS ?? 30000);
  if (!Number.isInteger(tiempoEsperaMs) || tiempoEsperaMs < 1) {
    throw new Error("IA_TIEMPO_ESPERA_MS debe ser un número entero de milisegundos mayor que cero.");
  }

  const proveedor = env.IA_PROVEEDOR?.trim() || "ninguno";
  if (proveedor === "ninguno") return { proveedor, tiempoEsperaMs };
  if (proveedor === "gemini") {
    return { proveedor, apiKey: requerida("GEMINI_API_KEY"), modelo: requerida("GEMINI_MODELO"), tiempoEsperaMs };
  }
  if (proveedor === "azure") {
    return {
      proveedor,
      endpoint: requerida("AZURE_OPENAI_ENDPOINT").replace(/\/+$/, ""),
      apiKey: requerida("AZURE_OPENAI_API_KEY"),
      despliegue: requerida("AZURE_OPENAI_DEPLOYMENT"),
      versionApi: requerida("AZURE_OPENAI_API_VERSION"),
      tiempoEsperaMs,
    };
  }
  throw new Error("IA_PROVEEDOR debe ser 'gemini', 'azure' o 'ninguno'.");
}

export function cargarConfig(env: Entorno): Config {
  const produccion = env.NODE_ENV === "production";
  const requerida = variableRequerida(env);

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
    ia: cargarConfigIA(env),
    dominiosPermitidos,
    // Vite usa el 5174 si el 5173 está ocupado.
    corsOrigin: corsOrigin.length > 0 ? corsOrigin : ["http://localhost:5173", "http://localhost:5174"],
  };
}
