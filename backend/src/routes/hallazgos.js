"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const router = (0, express_1.Router)();
// GET: Fetch all findings
router.get("/hallazgos", async (req, res) => {
    try {
        const pool = await db_1.poolPromise;
        const result = await pool.request().query("SELECT * FROM findings ORDER BY created_at DESC");
        res.json(result.recordset);
    }
    catch (error) {
        res.status(500).json({ error: "Error fetching findings from database." });
    }
});
// POST: Create a new finding
router.post("/hallazgos", async (req, res) => {
    const { id, folio, title, description, type, severity, status, auditId, controlId, ownerId } = req.body;
    try {
        const pool = await db_1.poolPromise;
        const result = await pool
            .request()
            .input("id", db_1.sql.NVarChar, id || Date.now().toString())
            .input("folio", db_1.sql.NVarChar, folio || null)
            .input("title", db_1.sql.NVarChar, title)
            .input("description", db_1.sql.NVarChar, description || null)
            .input("type", db_1.sql.NVarChar, type || null)
            .input("severity", db_1.sql.NVarChar, severity)
            .input("status", db_1.sql.NVarChar, status || "Abierto")
            .input("auditId", db_1.sql.NVarChar, auditId || null)
            .input("controlId", db_1.sql.NVarChar, controlId || null)
            .input("ownerId", db_1.sql.NVarChar, ownerId || null)
            .query(`
        INSERT INTO findings (id, folio, title, description, type, severity, status, auditId, controlId, ownerId)
        VALUES (@id, @folio, @title, @description, @type, @severity, @status, @auditId, @controlId, @ownerId);

        SELECT * FROM findings WHERE id = @id;
      `);
        res.status(201).json(result.recordset[0]);
    }
    catch (error) {
        res.status(500).json({ error: "Error creating finding." });
    }
});
// PUT: Update finding by ID
router.put("/hallazgos/:id", async (req, res) => {
    const { id } = req.params;
    const { title, severity, status, description } = req.body;
    try {
        const pool = await db_1.poolPromise;
        const result = await pool
            .request()
            .input("id", db_1.sql.NVarChar, id)
            .input("title", db_1.sql.NVarChar, title)
            .input("severity", db_1.sql.NVarChar, severity)
            .input("status", db_1.sql.NVarChar, status)
            .input("description", db_1.sql.NVarChar, description || null)
            .query(`
        UPDATE findings
        SET title = @title,
            severity = @severity,
            status = @status,
            description = @description
        WHERE id = @id;

        SELECT * FROM findings WHERE id = @id;
      `);
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: "Finding not found." });
        }
        res.json(result.recordset[0]);
    }
    catch (error) {
        res.status(500).json({ error: "Error updating finding." });
    }
});
// DELETE: Remove finding by ID
router.delete("/hallazgos/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await db_1.poolPromise;
        const result = await pool
            .request()
            .input("id", db_1.sql.NVarChar, id)
            .query("DELETE FROM findings WHERE id = @id");
        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: "Finding not found." });
        }
        res.json({ message: "Finding deleted successfully." });
    }
    catch (error) {
        res.status(500).json({ error: "Error deleting finding." });
    }
});
exports.default = router;
