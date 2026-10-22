import type { Request } from "express";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, UnsecuredJWT, type JWTPayload } from "jose";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { crearApp } from "../src/app.js";
import { crearVerificadorEntra, type VerificadorToken } from "../src/auth/verificador.js";
import { RepositorioEvidenciasMemoria } from "../src/repos/evidenciasMemoria.js";
import { RepositorioMemoria } from "../src/repos/memoria.js";
import { RepositorioPlanesAccionMemoria } from "../src/repos/planesAccionMemoria.js";
import { RepositorioPlanesMemoria } from "../src/repos/planesMemoria.js";
import { escuchar } from "./servidor.js";

function repos() {
  const repo = new RepositorioMemoria();
  return { repo, repoPlanes: new RepositorioPlanesMemoria(repo), repoPlanesAccion: new RepositorioPlanesAccionMemoria(repo), repoEvidencias: new RepositorioEvidenciasMemoria(), proveedorIA: null };
}

const TENANT = "11111111-1111-1111-1111-111111111111";
const CLIENTE = "22222222-2222-2222-2222-222222222222";
const EMISOR = `https://login.microsoftonline.com/${TENANT}/v2.0`;
const OID = "33333333-3333-3333-3333-333333333333";

type Llave = Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];

let llaveTenant: Llave;
let llaveAjena: Llave;
let verificador: VerificadorToken;

beforeAll(async () => {
  const tenant = await generateKeyPair("RS256");
  const ajena = await generateKeyPair("RS256");
  llaveTenant = tenant.privateKey;
  llaveAjena = ajena.privateKey;
  const jwk = { ...(await exportJWK(tenant.publicKey)), kid: "llave-1", alg: "RS256" };
  verificador = crearVerificadorEntra({
    tenantId: TENANT,
    clientId: CLIENTE,
    llaves: createLocalJWKSet({ keys: [jwk] }),
  });
});

interface Opciones {
  claims?: JWTPayload;
  emisor?: string;
  audiencia?: string;
  expira?: string;
  llave?: Llave;
}

function firmar({ claims = {}, emisor = EMISOR, audiencia = CLIENTE, expira = "5m", llave = llaveTenant }: Opciones = {}) {
  return new SignJWT({ oid: OID, tid: TENANT, preferred_username: "S.Ramirez@expedite.com", ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "llave-1" })
    .setIssuer(emisor)
    .setAudience(audiencia)
    .setIssuedAt()
    .setExpirationTime(expira)
    .sign(llave);
}

function peticion(autorizacion?: string): Request {
  return {
    header: (nombre: string) => (nombre.toLowerCase() === "authorization" ? autorizacion : undefined),
  } as unknown as Request;
}

describe("verificador de tokens de Entra ID", () => {
  it("acepta un token válido y devuelve la identidad", async () => {
    const identidad = await verificador.verificar(peticion(`Bearer ${await firmar()}`));

    expect(identidad).toEqual({ oid: OID, correo: "s.ramirez@expedite.com" });
  });

  it("acepta la audiencia con el prefijo api://", async () => {
    const token = await firmar({ audiencia: `api://${CLIENTE}` });

    expect(await verificador.verificar(peticion(`Bearer ${token}`))).not.toBeNull();
  });

  it("acepta el emisor de tokens v1 del mismo tenant", async () => {
    const token = await firmar({
      emisor: `https://sts.windows.net/${TENANT}/`,
      claims: { preferred_username: undefined, upn: "s.ramirez@expedite.com" },
    });

    expect(await verificador.verificar(peticion(`Bearer ${token}`))).toEqual({
      oid: OID,
      correo: "s.ramirez@expedite.com",
    });
  });

  it.each([
    ["otra audiencia", { audiencia: "44444444-4444-4444-4444-444444444444" }],
    ["otro emisor", { emisor: "https://login.microsoftonline.com/otro-tenant/v2.0" }],
    ["otro tenant en el claim tid", { claims: { tid: "55555555-5555-5555-5555-555555555555" } }],
    ["token expirado", { expira: "-1m" }],
    ["sin oid", { claims: { oid: undefined } }],
    ["sin correo", { claims: { preferred_username: undefined } }],
  ] as [string, Opciones][])("rechaza: %s", async (_caso, opciones) => {
    const token = await firmar(opciones);

    expect(await verificador.verificar(peticion(`Bearer ${token}`))).toBeNull();
  });

  it("rechaza un token firmado con una llave ajena al tenant", async () => {
    const token = await firmar({ llave: llaveAjena });

    expect(await verificador.verificar(peticion(`Bearer ${token}`))).toBeNull();
  });

  it("rechaza un token sin firma", async () => {
    const token = new UnsecuredJWT({ oid: OID, tid: TENANT, preferred_username: "s.ramirez@expedite.com" })
      .setIssuer(EMISOR)
      .setAudience(CLIENTE)
      .setExpirationTime("5m")
      .encode();

    expect(await verificador.verificar(peticion(`Bearer ${token}`))).toBeNull();
  });

  it.each([undefined, "", "Bearer", "Bearer no.es.un-jwt", "Basic dXNlcjpwYXNz"])(
    "rechaza el encabezado %j",
    async (cabecera) => {
      expect(await verificador.verificar(peticion(cabecera))).toBeNull();
    },
  );
});

describe("inicio de sesión con Entra ID contra la API", () => {
  function crear() {
    return escuchar(
      crearApp({
        ...repos(),
        verificador,
        dominiosPermitidos: ["expedite.com"],
        corsOrigin: "http://localhost:5173",
        registrarEvento: () => {},
      }),
    );
  }

  it("un usuario registrado entra con su token y recibe su rol", async () => {
    const res = await request(await crear()).get("/api/me").set("Authorization", `Bearer ${await firmar()}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ correo: "s.ramirez@expedite.com", rol: "Administrador" });
  });

  it("un token válido de alguien no registrado no da acceso", async () => {
    const token = await firmar({ claims: { preferred_username: "intruso@expedite.com" } });
    const res = await request(await crear()).get("/api/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.codigo).toBe("USUARIO_NO_AUTORIZADO");
  });

  it("un token inválido responde 401", async () => {
    const token = await firmar({ llave: llaveAjena });
    const res = await request(await crear()).get("/api/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
  });

  it("tras el primer acceso, otra identidad con el mismo correo no puede entrar", async () => {
    const app = await crear();
    await request(app).get("/api/me").set("Authorization", `Bearer ${await firmar()}`);

    const impostor = await firmar({ claims: { oid: "66666666-6666-6666-6666-666666666666" } });
    const res = await request(app).get("/api/me").set("Authorization", `Bearer ${impostor}`);

    expect(res.status).toBe(403);
    expect((await request(app).get("/api/me").set("Authorization", `Bearer ${await firmar()}`)).status).toBe(200);
  });

  it("el encabezado de desarrollo no sirve cuando la autenticación es Entra", async () => {
    const res = await request(await crear()).get("/api/me").set("X-Dev-Usuario", "s.ramirez@expedite.com");

    expect(res.status).toBe(401);
  });
});
