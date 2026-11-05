import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import path from "path";
import multer from "multer";
import { poolPromise } from "../db.js";
import { upload } from "../middleware/upload.js";
import { usuarioEnSesion } from "../middleware/autenticar.js";
import type { AlmacenamientoArchivos } from "../almacenamiento.js";

// Los archivos se guardan en el almacenamiento configurado (disco local o Cloudflare R2,
// SF-08/INT-03); la tabla evidence guarda la clave en storage_path.
export function rutasEvidencias(almacenamiento: AlmacenamientoArchivos): Router {
  const router = Router();

  // ─── GET: Fetch evidences for an entity ──────────────────────────────────────
  router.get("/evidencias", async (req: Request, res: Response) => {
    const { entityId, entityType, auditId } = req.query;

    if (!entityId) {
      return res.status(400).json({ error: "entityId query parameter is required." });
    }

    try {
      const pool = await poolPromise;
      const usuario = usuarioEnSesion(res);
      // Each query receives only the parameters it uses: PostgreSQL rejects a parameter
      // it never sees ("could not determine data type of parameter").
      let query = `
        SELECT e.* FROM evidence e
        WHERE e.entity_id = $1
          AND e.uploaded_by = $2
        ORDER BY e.created_at DESC`;
      let params: string[] = [entityId as string, String(usuario.id)];

      if (entityType === "control") {
        query = `
          SELECT e.* FROM evidence e
          WHERE e.entity_id = $1
            AND e.entity_type = 'control'
            AND e.audit_id::text = $2
            AND (
              ($3 = 'Auditor' AND e.uploaded_by = $4)
              OR ($3 = 'Auditor Senior' AND EXISTS (
                SELECT 1 FROM audit_controls ac
                WHERE ac.control_id = e.entity_id
                  AND ac.audit_id::text = e.audit_id::text
                  AND ac.assigned_by = $4::integer
                  AND ac.auditor_id::text = e.uploaded_by
              ))
              OR ($3 = 'Jefe de Auditoría' AND EXISTS (
                SELECT 1 FROM audit_controls ac
                JOIN audit_plans ap ON ap.id::text = ac.audit_id::text
                WHERE ac.control_id = e.entity_id
                  AND ac.audit_id::text = e.audit_id::text
                  AND ap.created_by = $4::integer
                  AND ac.auditor_id::text = e.uploaded_by
              ))
            )
          ORDER BY e.created_at DESC`;
        params = [entityId as string, String(auditId ?? ""), usuario.rol, String(usuario.id)];
      } else if (entityType === "hallazgo") {
        query = `
          SELECT e.* FROM evidence e
          WHERE e.finding_id = $1
            AND e.uploaded_by = $2
          ORDER BY e.created_at DESC`;
      }

      const result = await pool.query(query, params);

      res.json(result.rows);
    } catch (error) {
      console.error("Error fetching evidencias:", error);
      res.status(500).json({
        error: {
          codigo: "ERROR_INTERNO",
          mensaje: "No se pudieron cargar las evidencias.",
        },
      });
    }
  });

  // ─── POST: Upload a new evidence file ────────────────────────────────────────
  router.post(
    "/evidencias/upload",
    // Wrap multer so we can catch its errors and return clean JSON
    (req: Request, res: Response, next: NextFunction) => {
      upload.single("file")(req, res, (err: any) => {
        if (err instanceof multer.MulterError) {
          if (err.code === "LIMIT_FILE_SIZE") {
            return res
              .status(400)
              .json({ error: "El archivo supera el límite de 100 MB." });
          }
          return res.status(400).json({ error: err.message });
        }
        if (err) {
          // Custom validation errors from fileFilter
          return res.status(400).json({ error: err.message });
        }
        next();
      });
    },
    async (req: Request, res: Response) => {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "No file provided." });
      }

      const { entityId, entityType, controlId, findingId, auditId, businessEntityId } = req.body;
      const usuario = usuarioEnSesion(res);

      if (!entityId || !entityType) {
        return res
          .status(400)
          .json({ error: "entityId and entityType are required." });
      }

      if (!["control", "hallazgo"].includes(entityType)) {
        return res
          .status(400)
          .json({ error: "entityType must be 'control' or 'hallazgo'." });
      }

      try {
        // Control: only the Auditor assigned to it.
        // Hallazgo: TBD who may upload (CLAUDE.md §7 #19); for now any signed-in user.
        if (entityType === "control") {
          if (!auditId) {
            return res.status(400).json({
              error: "auditId es obligatorio para evidencias de controles.",
            });
          }
          const pool = await poolPromise;
          const asignacion = await pool.query(
            `SELECT 1
             FROM audit_controls ac
             JOIN controls c ON c.id = ac.control_id
             WHERE (c.id::text = $1 OR c.code = $1)
               AND ac.audit_id::text = $2
               AND ac.auditor_id = $3
             LIMIT 1`,
            [controlId || entityId, String(auditId ?? ""), usuario.id],
          );
          if (asignacion.rowCount !== 1) {
            return res.status(403).json({
              error: {
                codigo: "ROL_NO_AUTORIZADO",
                mensaje: "Solo el Auditor asignado puede enviar evidencia para este control.",
              },
            });
          }
        }

        // Generate SHA-256 hash from the file buffer
        const hash = crypto
          .createHash("sha256")
          .update(file.buffer)
          .digest("hex");

        // Build a unique filename to avoid collisions
        const ext = path.extname(file.originalname).toLowerCase();
        const id = `EV-${crypto.randomUUID()}`;
        const storedName = `${id}${ext}`;

        // Store the file before its metadata; if the insert fails it is removed again
        await almacenamiento.guardar(storedName, file.buffer, file.mimetype || "application/octet-stream");

        // Derive mime type label (the extension, already validated by the upload filter)
        const mimeType = ext.slice(1);

        // Insert metadata into database
        const pool = await poolPromise;
        const result = await pool.query(
          `
            INSERT INTO evidence (id, file_name, control_id, finding_id, audit_id, entity_id, entity_type, mime_type, file_size, file_hash, storage_path, uploaded_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *;
          `,
          [
            id,
            file.originalname,
            controlId || (entityType === "control" ? entityId : null),
            findingId || (entityType === "hallazgo" ? entityId : null),
            auditId || null,
            entityType === "control" ? controlId || entityId : businessEntityId || null,
            entityType,
            mimeType,
            file.size,
            hash,
            storedName,
            String(usuario.id),
          ],
        ).catch(async (error) => {
          await almacenamiento.eliminar(storedName).catch(() => {});
          throw error;
        });

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error uploading evidence:", error);
        res.status(500).json({ error: "Error saving evidence." });
      }
    }
  );

  // ─── DELETE: Remove evidence by ID ───────────────────────────────────────────
  router.delete("/evidencias/:id", async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const pool = await poolPromise;
      const usuario = usuarioEnSesion(res);

      // Fetch the record first to get the storage path
      const lookup = await pool.query(
        `SELECT e.storage_path, e.control_id, e.entity_type, e.uploaded_by
         FROM evidence e
         WHERE e.id = $1`,
        [id],
      );

      if (lookup.rows.length === 0) {
        return res.status(404).json({ error: "Evidence not found." });
      }

      const evidence = lookup.rows[0] as {
        storage_path: string;
        control_id: string | number | null;
        entity_type: string;
        uploaded_by: string | null;
      };
      if (evidence.entity_type === "hallazgo") {
        // Hallazgo: quien la subió, igual que en la consulta (quién puede subir sigue TBD).
        if (evidence.uploaded_by !== String(usuario.id)) {
          return res.status(403).json({
            error: {
              codigo: "ROL_NO_AUTORIZADO",
              mensaje: "Solo quien subió la evidencia puede eliminarla.",
            },
          });
        }
      } else {
        if (evidence.control_id === null) {
          return res.status(403).json({
            error: {
              codigo: "ROL_NO_AUTORIZADO",
              mensaje: "Solo el auditor asignado puede eliminar evidencia de un control.",
            },
          });
        }

        const asignacion = await pool.query(
          `SELECT 1
           FROM audit_controls ac
           WHERE ac.control_id = $1
             AND ac.auditor_id = $2
           LIMIT 1`,
          [evidence.control_id, usuario.id],
        );
        if (asignacion.rowCount !== 1) {
          return res.status(403).json({
            error: {
              codigo: "ROL_NO_AUTORIZADO",
              mensaje: "Solo el auditor asignado puede eliminar evidencia de este control.",
            },
          });
        }
      }

      // Delete the database record first: a leftover file is harmless, a record without its file is not
      const { rows: versiones } = await pool.query<{ storage_path: string }>(
        "SELECT storage_path FROM evidence_versions WHERE evidence_id = $1",
        [id],
      );
      await pool.query("DELETE FROM evidence WHERE id = $1", [id]);

      // El archivo vigente y los de las versiones anteriores (UF-17).
      const claves = new Set([evidence.storage_path, ...versiones.map((v) => v.storage_path)]);
      for (const clave of claves) {
        await almacenamiento.eliminar(clave).catch((error) => {
          console.error("Error deleting evidence file:", error);
        });
      }

      res.json({ message: "Evidence deleted successfully." });
    } catch (error) {
      console.error("Error deleting evidence:", error);
      res.status(500).json({ error: "Error deleting evidence." });
    }
  });

  // ─── Edición de Excel en la plataforma (UF-17, SF-08, historia #106) ────────
  // El editor abre el archivo vigente, y al guardar crea una versión nueva con su
  // propio hash; el archivo original nunca se sobrescribe.

  type Evidencia = {
    id: string;
    file_name: string;
    mime_type: string;
    file_size: string | number;
    file_hash: string;
    storage_path: string;
    uploaded_by: string | null;
    created_at: string;
    version: number;
    control_id: string | null;
    entity_type: string;
  };

  const LIBROS = ["xlsx", "xlsm"];
  const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const sinEvidencia = (res: Response) =>
    res.status(404).json({ error: { codigo: "NO_ENCONTRADO", mensaje: "La evidencia no existe." } });
  const noEsLibro = (res: Response) =>
    res.status(415).json({ error: { codigo: "TIPO_NO_EDITABLE", mensaje: "Solo los libros de Excel (.xlsx, .xlsm) se abren en el editor." } });

  async function buscarEvidencia(id: string): Promise<Evidencia | null> {
    const pool = await poolPromise;
    const { rows } = await pool.query<Evidencia>("SELECT * FROM evidence WHERE id = $1", [id]);
    return rows[0] ?? null;
  }

  // Misma regla que el listado: quien la subió; en controles también el Auditor Senior que
  // asignó el control y la Jefatura dueña del plan.
  async function puedeVer(evidencia: Evidencia, usuario: { id: number; rol: string }): Promise<boolean> {
    if (evidencia.uploaded_by === String(usuario.id)) return true;
    if (evidencia.entity_type !== "control") return false;
    const pool = await poolPromise;
    const { rowCount } = await pool.query(
      `SELECT 1 FROM evidence e
       WHERE e.id = $1 AND (
         ($2 = 'Auditor Senior' AND EXISTS (
           SELECT 1 FROM audit_controls ac
           WHERE ac.control_id = e.entity_id AND ac.audit_id::text = e.audit_id::text
             AND ac.assigned_by = $3::integer AND ac.auditor_id::text = e.uploaded_by))
         OR ($2 = 'Jefe de Auditoría' AND EXISTS (
           SELECT 1 FROM audit_controls ac
           JOIN audit_plans ap ON ap.id::text = ac.audit_id::text
           WHERE ac.control_id = e.entity_id AND ac.audit_id::text = e.audit_id::text
             AND ap.created_by = $3::integer AND ac.auditor_id::text = e.uploaded_by)))`,
      [evidencia.id, usuario.rol, usuario.id],
    );
    return rowCount === 1;
  }

  // Misma regla que subir o eliminar: en controles el Auditor asignado; en hallazgos quien
  // la subió (quién puede subir sigue TBD, CLAUDE.md §7 #19).
  async function puedeModificar(evidencia: Evidencia, usuario: { id: number }): Promise<boolean> {
    if (evidencia.entity_type === "hallazgo") return evidencia.uploaded_by === String(usuario.id);
    if (evidencia.control_id === null) return false;
    const pool = await poolPromise;
    const { rowCount } = await pool.query(
      "SELECT 1 FROM audit_controls ac WHERE ac.control_id = $1 AND ac.auditor_id = $2 LIMIT 1",
      [evidencia.control_id, usuario.id],
    );
    return rowCount === 1;
  }

  // ─── GET: archivo vigente de la evidencia (binario) ──────────────────────────
  router.get("/evidencias/:id/archivo", async (req: Request, res: Response) => {
    try {
      const evidencia = await buscarEvidencia(String(req.params.id));
      if (!evidencia) return sinEvidencia(res);
      if (!LIBROS.includes(evidencia.mime_type)) return noEsLibro(res);
      if (!(await puedeVer(evidencia, usuarioEnSesion(res)))) return sinEvidencia(res);

      const contenido = await almacenamiento.leer(evidencia.storage_path);
      if (!contenido) {
        return res.status(404).json({ error: { codigo: "ARCHIVO_NO_DISPONIBLE", mensaje: "El archivo de la evidencia no está disponible." } });
      }
      res.setHeader("Content-Type", TIPO_XLSX);
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(evidencia.file_name)}`);
      res.setHeader("X-Evidencia-Version", String(evidencia.version));
      res.send(contenido);
    } catch (error) {
      console.error("Error reading evidence file:", error);
      res.status(500).json({ error: { codigo: "ERROR_INTERNO", mensaje: "No se pudo leer el archivo de la evidencia." } });
    }
  });

  const VERSIONES_SQL = `
    SELECT v.version, v.file_hash, v.file_size, v.created_at, v.comentario,
           COALESCE(u.name, v.uploaded_by) AS uploaded_by
    FROM evidence_versions v
    LEFT JOIN users u ON u.id::text = v.uploaded_by
    WHERE v.evidence_id = $1`;

  // ─── GET: historial de versiones ─────────────────────────────────────────────
  router.get("/evidencias/:id/versiones", async (req: Request, res: Response) => {
    try {
      const evidencia = await buscarEvidencia(String(req.params.id));
      if (!evidencia) return sinEvidencia(res);
      if (!(await puedeVer(evidencia, usuarioEnSesion(res)))) return sinEvidencia(res);

      const pool = await poolPromise;
      const { rows } = await pool.query(`${VERSIONES_SQL} ORDER BY v.version DESC`, [evidencia.id]);
      // Antes del primer guardado el historial está vacío: la única versión es el original.
      if (rows.length === 0) {
        const { rows: original } = await pool.query(
          `SELECT e.version, e.file_hash, e.file_size, e.created_at, NULL AS comentario,
                  COALESCE(u.name, e.uploaded_by) AS uploaded_by
           FROM evidence e LEFT JOIN users u ON u.id::text = e.uploaded_by WHERE e.id = $1`,
          [evidencia.id],
        );
        return res.json(original);
      }
      res.json(rows);
    } catch (error) {
      console.error("Error listing evidence versions:", error);
      res.status(500).json({ error: { codigo: "ERROR_INTERNO", mensaje: "No se pudo cargar el historial de versiones." } });
    }
  });

  // ─── POST: guardar una versión nueva desde el editor ─────────────────────────
  router.post(
    "/evidencias/:id/versiones",
    (req: Request, res: Response, next: NextFunction) => {
      upload.single("file")(req, res, (err: any) => {
        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: { codigo: "DATOS_INVALIDOS", mensaje: "El archivo supera el límite de 100 MB." } });
        }
        if (err) return res.status(400).json({ error: { codigo: "DATOS_INVALIDOS", mensaje: err.message } });
        next();
      });
    },
    async (req: Request, res: Response) => {
      const file = req.file;
      const usuario = usuarioEnSesion(res);
      const comentario = typeof req.body?.comentario === "string" ? req.body.comentario.trim().slice(0, 500) : "";

      // Lo que guarda el editor siempre es un .xlsx (las macros de un .xlsm no se conservan);
      // un libro de Excel es un ZIP y empieza con "PK".
      if (!file || path.extname(file.originalname).toLowerCase() !== ".xlsx" || file.buffer.length < 4 || file.buffer[0] !== 0x50 || file.buffer[1] !== 0x4b) {
        return res.status(400).json({ error: { codigo: "DATOS_INVALIDOS", mensaje: "Se esperaba un libro de Excel (.xlsx)." } });
      }

      try {
        const evidencia = await buscarEvidencia(String(req.params.id));
        if (!evidencia) return sinEvidencia(res);
        if (!LIBROS.includes(evidencia.mime_type)) return noEsLibro(res);
        if (!(await puedeModificar(evidencia, usuario))) {
          return res.status(403).json({ error: { codigo: "ROL_NO_AUTORIZADO", mensaje: "No puedes guardar cambios en esta evidencia." } });
        }

        const hash = crypto.createHash("sha256").update(file.buffer).digest("hex");
        const nombre = evidencia.file_name.replace(/\.xlsm$/i, ".xlsx");
        const pool = await poolPromise;
        const cliente = await pool.connect();
        let clave = "";
        try {
          await cliente.query("BEGIN");
          // Bloquea la evidencia para que dos guardados simultáneos no repitan versión.
          const { rows } = await cliente.query<Evidencia>("SELECT * FROM evidence WHERE id = $1 FOR UPDATE", [evidencia.id]);
          const vigente = rows[0]!;
          const { rows: historial } = await cliente.query<{ total: number }>(
            "SELECT COUNT(*)::int AS total FROM evidence_versions WHERE evidence_id = $1",
            [vigente.id],
          );
          if (historial[0]!.total === 0) {
            // El original pasa al historial como versión 1 con sus datos actuales.
            await cliente.query(
              `INSERT INTO evidence_versions (evidence_id, version, file_name, file_size, file_hash, storage_path, uploaded_by, comentario, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8)`,
              [vigente.id, vigente.version, vigente.file_name, vigente.file_size, vigente.file_hash, vigente.storage_path, vigente.uploaded_by, vigente.created_at],
            );
          }
          const version = vigente.version + 1;
          clave = `${vigente.id}-v${version}.xlsx`;
          // Primero el archivo, luego el registro; si el registro falla se borra el archivo.
          await almacenamiento.guardar(clave, file.buffer, TIPO_XLSX);
          const { rows: creada } = await cliente.query(
            `INSERT INTO evidence_versions (evidence_id, version, file_name, file_size, file_hash, storage_path, uploaded_by, comentario)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING version, file_hash, file_size, created_at, comentario, uploaded_by`,
            [vigente.id, version, nombre, file.size, hash, clave, String(usuario.id), comentario || null],
          );
          await cliente.query(
            `UPDATE evidence
             SET version = $2, file_name = $3, mime_type = 'xlsx', file_size = $4, file_hash = $5, storage_path = $6
             WHERE id = $1`,
            [vigente.id, version, nombre, file.size, hash, clave],
          );
          await cliente.query("COMMIT");
          res.status(201).json({ ...creada[0], uploaded_by: usuario.nombre });
        } catch (error) {
          await cliente.query("ROLLBACK").catch(() => {});
          if (clave) await almacenamiento.eliminar(clave).catch(() => {});
          throw error;
        } finally {
          cliente.release();
        }
      } catch (error) {
        console.error("Error saving evidence version:", error);
        res.status(500).json({ error: { codigo: "ERROR_INTERNO", mensaje: "No se pudo guardar la versión de la evidencia." } });
      }
    },
  );

  return router;
}
