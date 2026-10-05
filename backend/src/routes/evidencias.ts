import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import { poolPromise, sql } from "../db";
import { upload } from "../middleware/upload";

const router = Router();

// ─── Ensure uploads directory exists ─────────────────────────────────────────
const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ─── GET: Fetch evidences for an entity ──────────────────────────────────────
router.get("/evidencias", async (req: Request, res: Response) => {
  const { entityId } = req.query;

  if (!entityId) {
    return res.status(400).json({ error: "entityId query parameter is required." });
  }

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("entityId", sql.NVarChar, entityId as string)
      .query(
        "SELECT * FROM evidencias WHERE entity_id = @entityId ORDER BY created_at DESC"
      );

    res.json(result.recordset);
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

    const { entityId, entityType, uploadedBy } = req.body;

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
      const id = `EV-${Date.now()}`;
      const storedName = `${id}${ext}`;
      const storagePath = path.join(UPLOADS_DIR, storedName);

      // Write file to disk
      fs.writeFileSync(storagePath, file.buffer);

      // Derive mime type label
      const mimeType = ext === ".pdf" ? "pdf" : "xlsx";

      // Insert metadata into database
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input("id", sql.NVarChar, id)
        .input("entityId", sql.NVarChar, entityId)
        .input("entityType", sql.NVarChar, entityType)
        .input("fileName", sql.NVarChar, file.originalname)
        .input("mimeType", sql.NVarChar, mimeType)
        .input("fileSize", sql.BigInt, file.size)
        .input("fileHash", sql.NVarChar, hash)
        .input("storagePath", sql.NVarChar, storedName)
        .input("uploadedBy", sql.NVarChar, uploadedBy || null)
        .query(`
          INSERT INTO evidencias (id, entity_id, entity_type, file_name, mime_type, file_size, file_hash, storage_path, uploaded_by)
          VALUES (@id, @entityId, @entityType, @fileName, @mimeType, @fileSize, @fileHash, @storagePath, @uploadedBy);

          SELECT * FROM evidencias WHERE id = @id;
        `);

      res.status(201).json(result.recordset[0]);
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
    const lookup = await pool
      .request()
      .input("id", sql.NVarChar, id)
      .query("SELECT storage_path FROM evidencias WHERE id = @id");

    if (lookup.recordset.length === 0) {
      return res.status(404).json({ error: "Evidence not found." });
    }

    const storagePath = path.join(UPLOADS_DIR, lookup.recordset[0].storage_path);

    // Delete the file from disk (if it exists)
    if (fs.existsSync(storagePath)) {
      fs.unlinkSync(storagePath);
    }

    // Delete the database record
    await pool
      .request()
      .input("id", sql.NVarChar, id)
      .query("DELETE FROM evidencias WHERE id = @id");

    res.json({ message: "Evidence deleted successfully." });
  } catch (error) {
    console.error("Error deleting evidence:", error);
    res.status(500).json({ error: "Error deleting evidence." });
  }
});

export default router;
