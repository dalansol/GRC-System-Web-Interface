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
  SQL_SERVER: "servidor.database.windows.net",
  SQL_DATABASE: "expedite",
  SQL_USER: "usuario",
  SQL_PASSWORD: "secreto",
  CORS_ORIGIN: "https://expedite.example",
};

describe("cargarConfig", () => {
  it("carga la configuración de desarrollo local", () => {
    expect(cargarConfig(DEV)).toMatchObject({
      puerto: 3001,
      auth: { modo: "dev" },
      datos: { modo: "memoria" },
      dominiosPermitidos: ["expedite.com"],
      corsOrigin: ["http://localhost:5173"],
    });
  });

  it("carga la configuración de producción con Entra ID y Azure SQL", () => {
    expect(cargarConfig(PRODUCCION)).toMatchObject({
      auth: { modo: "entra", tenantId: "tenant", clientId: "cliente" },
      datos: { modo: "sql", servidor: "servidor.database.windows.net", baseDatos: "expedite" },
      corsOrigin: ["https://expedite.example"],
    });
  });

  it("usa Entra ID y Azure SQL si no se indica el modo", () => {
    const { AUTH_MODE, DATA_MODE, ...resto } = PRODUCCION;

    expect(cargarConfig(resto)).toMatchObject({ auth: { modo: "entra" }, datos: { modo: "sql" } });
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
    ["SQL sin contraseña", { ...PRODUCCION, SQL_PASSWORD: undefined }, "SQL_PASSWORD"],
    ["puerto inválido", { ...DEV, PORT: "abc" }, "PORT"],
  ] as [string, Record<string, string | undefined>, string][])(
    "se niega a arrancar: %s",
    (_caso, entorno, variable) => {
      expect(() => cargarConfig(entorno)).toThrow(variable);
    },
  );
});
