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
      await pool.query("DELETE FROM evidence WHERE id = $1", [id]);

      await almacenamiento.eliminar(evidence.storage_path).catch((error) => {
        console.error("Error deleting evidence file:", error);
      });

      res.json({ message: "Evidence deleted successfully." });
    } catch (error) {
      console.error("Error deleting evidence:", error);
      res.status(500).json({ error: "Error deleting evidence." });
    }
  });

  return router;
}
