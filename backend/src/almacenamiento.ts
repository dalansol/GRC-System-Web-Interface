import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { ConfigAlmacenamiento } from "./config.js";

// Adaptador de almacenamiento de evidencias (SRS: SF-08, INT-03). La base solo guarda la clave
// (evidence.storage_path); el contenido vive en el disco local o en Cloudflare R2.
export interface AlmacenamientoArchivos {
  guardar(clave: string, contenido: Buffer, tipoContenido: string): Promise<void>;
  /** null si el archivo no existe. */
  leer(clave: string): Promise<Buffer | null>;
  eliminar(clave: string): Promise<void>;
}

// basename impide salir de la carpeta (o del prefijo) aunque la clave traiga una ruta.
const claveSegura = (clave: string) => path.basename(clave);

export class AlmacenamientoLocal implements AlmacenamientoArchivos {
  constructor(private readonly carpeta: string) {}

  async guardar(clave: string, contenido: Buffer): Promise<void> {
    await fs.mkdir(this.carpeta, { recursive: true });
    await fs.writeFile(path.join(this.carpeta, claveSegura(clave)), contenido);
  }

  async leer(clave: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(path.join(this.carpeta, claveSegura(clave)));
    } catch {
      return null;
    }
  }

  async eliminar(clave: string): Promise<void> {
    await fs.rm(path.join(this.carpeta, claveSegura(clave)), { force: true });
  }
}

export class AlmacenamientoR2 implements AlmacenamientoArchivos {
  constructor(
    private readonly cliente: Pick<S3Client, "send">,
    private readonly bucket: string,
    private readonly prefijo = "evidencias/",
  ) {}

  private ruta(clave: string) {
    return `${this.prefijo}${claveSegura(clave)}`;
  }

  async guardar(clave: string, contenido: Buffer, tipoContenido: string): Promise<void> {
    await this.cliente.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: this.ruta(clave), Body: contenido, ContentType: tipoContenido }),
    );
  }

  async leer(clave: string): Promise<Buffer | null> {
    try {
      const respuesta = await this.cliente.send(new GetObjectCommand({ Bucket: this.bucket, Key: this.ruta(clave) }));
      if (!respuesta.Body) return null;
      return Buffer.from(await respuesta.Body.transformToByteArray());
    } catch (error) {
      if (error instanceof NoSuchKey || (error as { name?: string }).name === "NoSuchKey") return null;
      throw error;
    }
  }

  async eliminar(clave: string): Promise<void> {
    // S3/R2 no falla si el objeto ya no existe.
    await this.cliente.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: this.ruta(clave) }));
  }
}

// En Vercel solo /tmp admite escritura y se borra entre instancias: el disco local sirve
// para desarrollo y demostración; en un despliegue se usa R2.
export const CARPETA_LOCAL = process.env.VERCEL
  ? path.join(os.tmpdir(), "expedite-uploads")
  : path.resolve(import.meta.dirname, "../uploads");

export function crearAlmacenamiento(config: ConfigAlmacenamiento): AlmacenamientoArchivos {
  if (config.proveedor === "local") return new AlmacenamientoLocal(CARPETA_LOCAL);
  const cliente = new S3Client({
    region: "auto",
    endpoint: `https://${config.cuentaId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: config.claveAcceso, secretAccessKey: config.claveSecreta },
  });
  return new AlmacenamientoR2(cliente, config.bucket);
}
