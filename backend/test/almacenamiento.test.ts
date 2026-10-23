import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AlmacenamientoLocal, AlmacenamientoR2, type AlmacenamientoArchivos } from "../src/almacenamiento.js";
import { cargarConfig } from "../src/config.js";

const DEV = { AUTH_MODE: "dev", DATA_MODE: "memoria", DOMINIOS_PERMITIDOS: "expedite.com" };
const R2 = {
  ALMACENAMIENTO: "r2",
  R2_ACCOUNT_ID: "cuenta",
  R2_ACCESS_KEY_ID: "clave",
  R2_SECRET_ACCESS_KEY: "secreto",
  R2_BUCKET: "evidencias-expedite",
};

describe("configuración del almacenamiento", () => {
  it("usa el disco local si no se indica", () => {
    expect(cargarConfig(DEV).almacenamiento).toEqual({ proveedor: "local" });
  });

  it("carga Cloudflare R2", () => {
    expect(cargarConfig({ ...DEV, ...R2 }).almacenamiento).toEqual({
      proveedor: "r2",
      cuentaId: "cuenta",
      claveAcceso: "clave",
      claveSecreta: "secreto",
      bucket: "evidencias-expedite",
    });
  });

  it("exige las credenciales de R2 y rechaza un proveedor desconocido", () => {
    expect(() => cargarConfig({ ...DEV, ...R2, R2_BUCKET: "" })).toThrow("R2_BUCKET");
    expect(() => cargarConfig({ ...DEV, ALMACENAMIENTO: "s3" })).toThrow("ALMACENAMIENTO");
  });
});

describe("AlmacenamientoLocal", () => {
  let carpeta: string;
  afterEach(() => fs.rm(carpeta, { recursive: true, force: true }));

  it("guarda, lee y elimina sin salir de su carpeta", async () => {
    carpeta = await fs.mkdtemp(path.join(os.tmpdir(), "expedite-prueba-"));
    const almacenamiento: AlmacenamientoArchivos = new AlmacenamientoLocal(carpeta);

    await almacenamiento.guardar("../EV-1.pdf", Buffer.from("contenido"), "application/pdf");
    expect(await fs.readdir(carpeta)).toEqual(["EV-1.pdf"]);
    expect((await almacenamiento.leer("EV-1.pdf"))?.toString()).toBe("contenido");

    await almacenamiento.eliminar("EV-1.pdf");
    expect(await almacenamiento.leer("EV-1.pdf")).toBeNull();
    await expect(almacenamiento.eliminar("EV-1.pdf")).resolves.toBeUndefined();
  });
});

describe("AlmacenamientoR2", () => {
  it("guarda, lee y elimina bajo el prefijo de evidencias", async () => {
    const send = vi.fn(async (comando: unknown) => {
      if (comando instanceof GetObjectCommand) {
        return { Body: { transformToByteArray: async () => new TextEncoder().encode("contenido") } };
      }
      return {};
    });
    const almacenamiento = new AlmacenamientoR2({ send } as never, "bucket");

    await almacenamiento.guardar("../EV-1.pdf", Buffer.from("contenido"), "application/pdf");
    expect((await almacenamiento.leer("EV-1.pdf"))?.toString()).toBe("contenido");
    await almacenamiento.eliminar("EV-1.pdf");

    const [guardar, leer, eliminar] = send.mock.calls.map(([comando]) => comando as { input: object }) as [
      { input: object },
      { input: object },
      { input: object },
    ];
    expect(guardar).toBeInstanceOf(PutObjectCommand);
    expect(guardar.input).toMatchObject({ Bucket: "bucket", Key: "evidencias/EV-1.pdf", ContentType: "application/pdf" });
    expect(leer).toBeInstanceOf(GetObjectCommand);
    expect(leer.input).toEqual({ Bucket: "bucket", Key: "evidencias/EV-1.pdf" });
    expect(eliminar).toBeInstanceOf(DeleteObjectCommand);
  });

  it("devuelve null si el objeto no existe", async () => {
    const send = vi.fn(async () => {
      throw Object.assign(new Error("no existe"), { name: "NoSuchKey" });
    });
    expect(await new AlmacenamientoR2({ send } as never, "bucket").leer("EV-2.pdf")).toBeNull();
  });
});
