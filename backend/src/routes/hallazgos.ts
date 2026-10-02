import { Router, Request, Response } from "express";
import { poolPromise, sql } from "../db.js";

const router = Router();

// GET: Fetch all findings
router.get("/hallazgos", async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM findings ORDER BY created_at DESC");
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ error: "Error fetching findings from database." });
  }
});

// POST: Create a new finding
router.post("/hallazgos", async (req: Request, res: Response) => {
  const { id, folio, title, description, type, severity, status, auditId, controlId, ownerId } = req.body;

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", sql.NVarChar, id || Date.now().toString())
      .input("folio", sql.NVarChar, folio || null)
      .input("title", sql.NVarChar, title)
      .input("description", sql.NVarChar, description || null)
      .input("type", sql.NVarChar, type || null)
      .input("severity", sql.NVarChar, severity)
      .input("status", sql.NVarChar, status || "Abierto")
      .input("auditId", sql.NVarChar, auditId || null)
      .input("controlId", sql.NVarChar, controlId || null)
      .input("ownerId", sql.NVarChar, ownerId || null)
      .query(`
        INSERT INTO findings (id, folio, title, description, type, severity, status, auditId, controlId, ownerId)
        VALUES (@id, @folio, @title, @description, @type, @severity, @status, @auditId, @controlId, @ownerId);

        SELECT * FROM findings WHERE id = @id;
      `);

    res.status(201).json(result.recordset[0]);
  } catch (error) {
    res.status(500).json({ error: "Error creating finding." });
  }
});

// PUT: Update finding by ID
router.put("/hallazgos/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, severity, status, description } = req.body;

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", sql.NVarChar, id)
      .input("title", sql.NVarChar, title)
      .input("severity", sql.NVarChar, severity)
      .input("status", sql.NVarChar, status)
      .input("description", sql.NVarChar, description || null)
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
  } catch (error) {
    res.status(500).json({ error: "Error updating finding." });
  }
});

// DELETE: Remove finding by ID
router.delete("/hallazgos/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("id", sql.NVarChar, id)
      .query("DELETE FROM findings WHERE id = @id");

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ error: "Finding not found." });
    }

    res.json({ message: "Finding deleted successfully." });
  } catch (error) {
    res.status(500).json({ error: "Error deleting finding." });
  }
});

export default router;