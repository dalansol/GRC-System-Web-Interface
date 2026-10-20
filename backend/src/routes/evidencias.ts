import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import multer from "multer";
import { poolPromise } from "../db.js";
import { upload } from "../middleware/upload.js";

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
    let query = "SELECT * FROM evidence WHERE entity_id = $1 ORDER BY created_at DESC";
    
    if (entityType === "control") {
      query = "SELECT * FROM evidence WHERE control_id = $1 ORDER BY created_at DESC";
    } else if (entityType === "hallazgo") {
      query = "SELECT * FROM evidence WHERE finding_id = $1 ORDER BY created_at DESC";
    }

    const result = await pool.query(query, [entityId as string]);

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching evidencias:", error);
    res.status(500).json({ error: "Error fetching evidencias from database." });
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
            .json({ error: "El archivo supera el límite de 50 MB." });
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

    const { entityId, entityType, uploadedBy, controlId, findingId, auditId, businessEntityId } = req.body;

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
      // Generate SHA-256 hash from the file buffer
      const hash = crypto
        .createHash("sha256")
        .update(file.buffer)
        .digest("hex");

      // Build a unique filename to avoid collisions
      const ext = path.extname(file.originalname).toLowerCase();
      const id = `EV-${crypto.randomUUID()}`;
      const storedName = `${id}${ext}`;
      const storagePath = path.join(UPLOADS_DIR, storedName);

      // Write file to disk
      fs.writeFileSync(storagePath, file.buffer);

      // Derive mime type label
      const mimeType = ext === ".pdf" ? "pdf" : "xlsx";

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
          businessEntityId || null,
          entityType,
          mimeType,
          file.size,
          hash,
          storedName,
          uploadedBy || null,
        ],
      );

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

    // Fetch the record first to get the storage path
    const lookup = await pool.query("SELECT storage_path FROM evidence WHERE id = $1", [id]);

    if (lookup.rows.length === 0) {
      return res.status(404).json({ error: "Evidence not found." });
    }

    const storagePath = path.join(UPLOADS_DIR, lookup.rows[0].storage_path);

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
