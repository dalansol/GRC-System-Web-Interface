import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import multer from "multer";
import { poolPromise } from "../db.js";
import { upload } from "../middleware/upload.js";
import { usuarioEnSesion } from "../middleware/autenticar.js";

const router = Router();

// ─── Ensure uploads directory exists ─────────────────────────────────────────
// En Vercel solo /tmp admite escritura y se borra entre instancias: sirve para demostración,
// no como almacenamiento definitivo (proveedor pendiente, SF-08/INT-03).
const UPLOADS_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), "expedite-uploads")
  : path.resolve(import.meta.dirname, "../../uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ─── GET: Fetch evidences for an entity ──────────────────────────────────────
router.get("/evidencias", async (req: Request, res: Response) => {
  const { entityId, entityType } = req.query;

  if (!entityId) {
    return res.status(400).json({ error: "entityId query parameter is required." });
  }

  try {
    const pool = await poolPromise;
    const usuario = usuarioEnSesion(res);
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
          AND (
            ($2 = 'Auditor' AND e.uploaded_by = $3)
            OR ($2 = 'Auditor Senior' AND EXISTS (
              SELECT 1 FROM audit_controls ac
              WHERE ac.id::text = e.entity_id
              AND ac.assigned_by = $3::integer
                AND ac.auditor_id::text = e.uploaded_by
            ))
            OR ($2 = 'Jefe de Auditoría' AND EXISTS (
              SELECT 1 FROM audit_controls ac
              JOIN audit_plans ap ON ap.id::text = ac.audit_id::text
              WHERE ac.id::text = e.entity_id
              AND ap.created_by = $3::integer
                AND ac.auditor_id::text = e.uploaded_by
            ))
          )
        ORDER BY e.created_at DESC`;
      params = [entityId as string, usuario.rol, String(usuario.id)];
    } else if (entityType === "hallazgo") {
      query = `
        SELECT e.* FROM evidence e
        WHERE e.entity_id = $1
          AND e.entity_type = 'hallazgo'
          AND e.uploaded_by = $2
        ORDER BY e.created_at DESC`;
      params = [entityId as string, String(usuario.id)];
    } else if (entityType === "action_plan_step") {
      query = `
        SELECT e.* FROM evidence e
        WHERE e.entity_id = $1
          AND e.entity_type = 'action_plan_step'
          AND EXISTS (
            SELECT 1
            FROM action_plan_steps target_step
            JOIN action_plans target_plan ON target_plan.id = target_step.action_plan_id
            WHERE target_step.id::text = $1
              AND (
                target_plan.responsible_id = $2::integer
                OR target_step.assigned_user_id = $2::integer
              )
          )
        ORDER BY e.created_at DESC`;
      params = [entityId as string, String(usuario.id)];
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

    const { entityId, entityType } = req.body;
    const usuario = usuarioEnSesion(res);
    let storagePath: string | null = null;

    if (!entityId || !entityType) {
      return res
        .status(400)
        .json({ error: "entityId and entityType are required." });
    }

    if (!["control", "hallazgo", "action_plan_step"].includes(entityType)) {
      return res
        .status(400)
        .json({ error: "entityType must be 'control', 'hallazgo' or 'action_plan_step'." });
    }

    try {
      // Control: only the Auditor assigned to it.
      if (entityType === "control") {
        const pool = await poolPromise;
        const asignacion = await pool.query(
          `SELECT 1
           FROM audit_controls ac
           WHERE ac.id::text = $1
             AND ac.auditor_id = $2
           LIMIT 1`,
          [entityId, usuario.id],
        );
        if (asignacion.rowCount !== 1) {
          return res.status(403).json({
            error: {
              codigo: "ROL_NO_AUTORIZADO",
              mensaje: "Solo el Auditor asignado puede enviar evidencia para este control.",
            },
          });
        }
      } else if (entityType === "action_plan_step") {
        const pool = await poolPromise;
        const asignacion = await pool.query(
          `SELECT 1
           FROM action_plan_steps step
           WHERE step.id::text = $1
             AND step.assigned_user_id = $2
           LIMIT 1`,
          [entityId, usuario.id],
        );
        if (asignacion.rowCount !== 1) {
          return res.status(403).json({
            error: {
              codigo: "ROL_NO_AUTORIZADO",
              mensaje: "Solo puedes enviar evidencia al paso de acción que tienes asignado.",
            },
          });
        }
      } else {
        const pool = await poolPromise;
        const hallazgo = await pool.query(
          "SELECT 1 FROM findings WHERE id::text = $1 LIMIT 1",
          [entityId],
        );
        if (hallazgo.rowCount !== 1) {
          return res.status(404).json({ error: "El hallazgo no existe." });
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
      storagePath = path.join(UPLOADS_DIR, storedName);

      // Write file to disk
      fs.writeFileSync(storagePath, file.buffer);

      // Derive mime type label (the extension, already validated by the upload filter)
      const mimeType = ext.slice(1);

      // Insert metadata into database
      const pool = await poolPromise;
      const result = await pool.query(
        `
          INSERT INTO evidence (id, file_name, entity_id, entity_type, mime_type, file_size, file_hash, storage_path, uploaded_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *;
        `,
        [
          id,
          file.originalname,
          entityId,
          entityType,
          mimeType,
          file.size,
          hash,
          storedName,
          String(usuario.id),
        ],
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Error uploading evidence:", error);
      if (storagePath && fs.existsSync(storagePath)) {
        fs.unlinkSync(storagePath);
      }
      res.status(500).json({
        error: {
          codigo: "ERROR_INTERNO",
          mensaje: "No se pudo guardar la evidencia. Verifica que la migración de evidencias esté aplicada.",
        },
      });
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
      `SELECT e.storage_path, e.entity_id, e.entity_type, e.uploaded_by
       FROM evidence e
       WHERE e.id = $1`,
      [id],
    );

    if (lookup.rows.length === 0) {
      return res.status(404).json({ error: "Evidence not found." });
    }

    const evidence = lookup.rows[0] as {
      storage_path: string;
      entity_id: string;
      entity_type: string;
      uploaded_by: string | null;
    };
    if (evidence.entity_type !== "control") {
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
      const asignacion = await pool.query(
        `SELECT 1
         FROM audit_controls ac
         WHERE ac.id::text = $1
           AND ac.auditor_id = $2
         LIMIT 1`,
        [evidence.entity_id, usuario.id],
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

    const storagePath = path.join(UPLOADS_DIR, evidence.storage_path);

    // Delete the file from disk (if it exists)
    if (fs.existsSync(storagePath)) {
      fs.unlinkSync(storagePath);
    }

    // Delete the database record
    await pool.query("DELETE FROM evidence WHERE id = $1", [id]);

    res.json({ message: "Evidence deleted successfully." });
  } catch (error) {
    console.error("Error deleting evidence:", error);
    res.status(500).json({ error: "Error deleting evidence." });
  }
});

export default router;
