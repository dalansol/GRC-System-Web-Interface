"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const db_1 = require("../db");
const upload_1 = require("../middleware/upload");
const router = (0, express_1.Router)();
// ─── Ensure uploads directory exists ─────────────────────────────────────────
const UPLOADS_DIR = path_1.default.resolve(__dirname, "../../uploads");
if (!fs_1.default.existsSync(UPLOADS_DIR)) {
    fs_1.default.mkdirSync(UPLOADS_DIR, { recursive: true });
}
// ─── GET: Fetch evidences for an entity ──────────────────────────────────────
router.get("/evidencias", async (req, res) => {
    const { entityId } = req.query;
    if (!entityId) {
        return res.status(400).json({ error: "entityId query parameter is required." });
    }
    try {
        const pool = await db_1.poolPromise;
        const result = await pool
            .request()
            .input("entityId", db_1.sql.NVarChar, entityId)
            .query("SELECT * FROM evidence WHERE entity_id = @entityId ORDER BY created_at DESC");
        res.json(result.recordset);
    }
    catch (error) {
        console.error("Error fetching evidencias:", error);
        res.status(500).json({ error: "Error fetching evidencias from database." });
    }
});
// ─── POST: Upload a new evidence file ────────────────────────────────────────
router.post("/evidencias/upload", 
// Wrap multer so we can catch its errors and return clean JSON
(req, res, next) => {
    upload_1.upload.single("file")(req, res, (err) => {
        if (err instanceof multer_1.default.MulterError) {
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
}, async (req, res) => {
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
        const hash = crypto_1.default
            .createHash("sha256")
            .update(file.buffer)
            .digest("hex");
        // Build a unique filename to avoid collisions
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        const idResult = await (await db_1.poolPromise)
            .request()
            .query("SELECT ISNULL(MAX(id), 0) + 1 AS id FROM evidence");
        const id = idResult.recordset[0].id;
        const storedName = `EV-${Date.now()}${ext}`;
        const storagePath = path_1.default.join(UPLOADS_DIR, storedName);
        // Write file to disk
        fs_1.default.writeFileSync(storagePath, file.buffer);
        // Derive mime type label
        const mimeType = ext === ".pdf" ? "pdf" : "xlsx";
        // Insert metadata into database
        const pool = await db_1.poolPromise;
        const result = await pool
            .request()
            .input("id", db_1.sql.Int, id)
            .input("entityId", db_1.sql.NVarChar, entityId)
            .input("entityType", db_1.sql.NVarChar, entityType)
            .input("fileName", db_1.sql.NVarChar, file.originalname)
            .input("mimeType", db_1.sql.NVarChar, mimeType)
            .input("fileSize", db_1.sql.BigInt, file.size)
            .input("fileHash", db_1.sql.NVarChar, hash)
            .input("storagePath", db_1.sql.NVarChar, storedName)
            .input("uploadedBy", db_1.sql.NVarChar, uploadedBy || null)
            .input("controlId", db_1.sql.Int, entityType === "control" ? Number(entityId) : null)
            .input("findingId", db_1.sql.Int, entityType === "hallazgo" ? Number(entityId) : null)
            .query(`
          INSERT INTO evidence (id, file_name, control_id, finding_id, entity_id, entity_type, mime_type, file_size, file_hash, storage_path, uploaded_by)
          VALUES (@id, @fileName, @controlId, @findingId, @entityId, @entityType, @mimeType, @fileSize, @fileHash, @storagePath, @uploadedBy);

          SELECT * FROM evidence WHERE id = @id;
        `);
        res.status(201).json(result.recordset[0]);
    }
    catch (error) {
        console.error("Error uploading evidence:", error);
        res.status(500).json({ error: "Error saving evidence." });
    }
});
// ─── DELETE: Remove evidence by ID ───────────────────────────────────────────
router.delete("/evidencias/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await db_1.poolPromise;
        // Fetch the record first to get the storage path
        const lookup = await pool
            .request()
            .input("id", db_1.sql.Int, Number(id))
            .query("SELECT storage_path FROM evidence WHERE id = @id");
        if (lookup.recordset.length === 0) {
            return res.status(404).json({ error: "Evidence not found." });
        }
        const storagePath = path_1.default.join(UPLOADS_DIR, lookup.recordset[0].storage_path);
        // Delete the file from disk (if it exists)
        if (fs_1.default.existsSync(storagePath)) {
            fs_1.default.unlinkSync(storagePath);
        }
        // Delete the database record
        await pool
            .request()
            .input("id", db_1.sql.Int, Number(id))
            .query("DELETE FROM evidence WHERE id = @id");
        res.json({ message: "Evidence deleted successfully." });
    }
    catch (error) {
        console.error("Error deleting evidence:", error);
        res.status(500).json({ error: "Error deleting evidence." });
    }
});
exports.default = router;
