import { describe, expect, it } from "vitest";
import { cargarConfig } from "../src/config.js";

const DEV = { AUTH_MODE: "dev", DATA_MODE: "memoria", DOMINIOS_PERMITIDOS: "expedite.com" };
const PRODUCCION = {
  NODE_ENV: "production",
  AUTH_MODE: "entra",
  DATA_MODE: "sql",
  DOMINIOS_PERMITIDOS: "femsa.com",
  ENTRA_TENANT_ID: "tenant",
  ENTRA_CLIENT_ID: "cliente",
  DB_SERVER: "servidor.database.windows.net",
  DB_NAME: "expedite",
  DB_USER: "usuario",
  DB_PASSWORD: "secreto",
  CORS_ORIGIN: "https://expedite.example",
};

describe("cargarConfig", () => {
  it("carga la configuración de desarrollo local", () => {
    expect(cargarConfig(DEV)).toMatchObject({
      puerto: 3000,
      auth: { modo: "dev" },
      datos: { modo: "memoria" },
      dominiosPermitidos: ["expedite.com"],
      corsOrigin: ["http://localhost:5173", "http://localhost:5174"],
    });
  });

  it("carga la configuración de producción con Entra ID y Azure SQL", () => {
    expect(cargarConfig(PRODUCCION)).toMatchObject({
      auth: { modo: "entra", tenantId: "tenant", clientId: "cliente" },
      datos: {
        modo: "sql",
        servidor: "servidor.database.windows.net",
        baseDatos: "expedite",
        puerto: 1433,
        confiarCertificado: false,
      },
      corsOrigin: ["https://expedite.example"],
    });
  });

  it("usa Entra ID y Azure SQL si no se indica el modo", () => {
    const { AUTH_MODE, DATA_MODE, ...resto } = PRODUCCION;

    expect(cargarConfig(resto)).toMatchObject({ auth: { modo: "entra" }, datos: { modo: "sql" } });
  });

  it("acepta un SQL Server local con otro puerto y certificado autofirmado", () => {
    const config = cargarConfig({ ...PRODUCCION, NODE_ENV: undefined, DB_PORT: "14333", DB_TRUST_CERT: "true" });

    expect(config.datos).toMatchObject({ puerto: 14333, confiarCertificado: true });
  });

  it("separa y normaliza varios dominios", () => {
    const config = cargarConfig({ ...DEV, DOMINIOS_PERMITIDOS: " Expedite.com , femsa.com,@kof.com.mx," });

    expect(config.dominiosPermitidos).toEqual(["expedite.com", "femsa.com", "kof.com.mx"]);
  });

  it.each([
    ["autenticación de desarrollo en producción", { ...PRODUCCION, AUTH_MODE: "dev" }, "AUTH_MODE"],
    ["datos en memoria en producción", { ...PRODUCCION, DATA_MODE: "memoria" }, "DATA_MODE"],
    ["modo de autenticación desconocido", { ...DEV, AUTH_MODE: "ninguno" }, "AUTH_MODE"],
    ["modo de datos desconocido", { ...DEV, DATA_MODE: "excel" }, "DATA_MODE"],
    ["sin dominios", { ...DEV, DOMINIOS_PERMITIDOS: " , " }, "DOMINIOS_PERMITIDOS"],
    ["Entra sin tenant", { ...PRODUCCION, ENTRA_TENANT_ID: "" }, "ENTRA_TENANT_ID"],
    ["Entra sin cliente", { ...PRODUCCION, ENTRA_CLIENT_ID: undefined }, "ENTRA_CLIENT_ID"],
    ["base de datos sin contraseña", { ...PRODUCCION, DB_PASSWORD: undefined }, "DB_PASSWORD"],
    ["puerto de base de datos inválido", { ...PRODUCCION, DB_PORT: "abc" }, "DB_PORT"],
    ["certificado sin validar en producción", { ...PRODUCCION, DB_TRUST_CERT: "true" }, "DB_TRUST_CERT"],
    ["puerto inválido", { ...DEV, PORT: "abc" }, "PORT"],
  ] as [string, Record<string, string | undefined>, string][])(
    "se niega a arrancar: %s",
    (_caso, entorno, variable) => {
      expect(() => cargarConfig(entorno)).toThrow(variable);
    },
  );
});
