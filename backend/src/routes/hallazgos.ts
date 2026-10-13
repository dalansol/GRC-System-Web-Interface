import { Router, Request, Response } from "express";
import { poolPromise } from "../db.js";

const router = Router();

// GET: Fetch all findings
router.get("/hallazgos", async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const result = await pool.query(`
      SELECT *
      FROM findings
      ORDER BY
        CASE WHEN status = 'Cerrado' THEN 1 ELSE 0 END,
        created_at DESC;
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Error fetching findings from database." });
  }
});

// POST: Create a new finding
router.post("/hallazgos", async (req: Request, res: Response) => {
  const {
    id,
    folio,
    title,
    description,
    type,
    severity,
    status,
    auditId,
    controlId,
    failedControlId,
    failedControl,
    residualRisk,
    ownerId,
  } = req.body;

  try {
    const pool = await poolPromise;
    const result = await pool.query(
      `
        INSERT INTO findings (id, folio, title, description, type, severity, status, "auditId", "controlId", "failedControl", "residualRisk", "ownerId")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *;
      `,
      [
        id || Date.now().toString(),
        folio || null,
        title,
        description || null,
        type || null,
        severity,
        status || "Abierto",
        auditId || null,
        controlId || failedControlId || null,
        failedControl || null,
        residualRisk || null,
        ownerId || null,
      ],
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return res.status(409).json({ error: "El folio del hallazgo ya existe." });
    }
    res.status(500).json({ error: "Error creating finding." });
  }
});

// PUT: Update finding by ID
router.put("/hallazgos/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, severity, status, description } = req.body;

  try {
    const pool = await poolPromise;
    const result = await pool.query(
      `
        UPDATE findings
        SET title = $2,
            severity = $3,
            status = $4,
            description = $5
        WHERE id = $1
        RETURNING *;
      `,
      [id, title, severity, status, description || null],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Finding not found." });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Error updating finding." });
  }
});

// DELETE: Remove finding by ID
router.delete("/hallazgos/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const pool = await poolPromise;
    const finding = await pool.query("SELECT status FROM findings WHERE id = $1", [id]);

    if (finding.rows.length === 0) {
      return res.status(404).json({ error: "Finding not found." });
    }

    if (finding.rows[0].status === "En Revisión") {
      return res.status(409).json({
        error: "Este hallazgo ya fue enviado a revisión por la jefatura y no puede eliminarse.",
      });
    }

    const result = await pool.query("DELETE FROM findings WHERE id = $1 AND status <> 'En Revisión'", [id]);

    if (result.rowCount === 0) {
      return res.status(409).json({
        error: "Este hallazgo ya fue enviado a revisión por la jefatura y no puede eliminarse.",
      });
    }

    res.json({ message: "Finding deleted successfully." });
  } catch (error) {
    res.status(500).json({ error: "Error deleting finding." });
  }
});

export default router;