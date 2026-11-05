import { Router, Request, Response } from "express";
import { poolPromise } from "../db.js";
import { usuarioEnSesion } from "../middleware/autenticar.js";
import { ROLES_EDICION } from "./planesAccion.js";

const router = Router();

// El equipo de auditoría trabaja con todos los hallazgos; los demás roles, solo con los propios y los de su unidad.
const esEquipoAuditoria = (rol: string) => (ROLES_EDICION as readonly string[]).includes(rol);

const HALLAZGO_VISIBLE_POR_USUARIO = (usuarioParametro: number, unidadParametro: number, equipoParametro: number) => `
  (
    $${equipoParametro}::boolean
    OR f."ownerId" = $${usuarioParametro}
    OR EXISTS (
      SELECT 1
      FROM audit_controls ac
      JOIN processes p ON p.id = ac.process_id
      WHERE ac.audit_id::text = f."auditId"::text
        AND (ac.control_id::text = f."controlId"::text OR ac.id::text = f."controlId"::text)
        AND p.business_unit_id = $${unidadParametro}
    )
  )`;

// Auditor Senior y Auditor consultan todos los hallazgos, pero solo editan o eliminan los que registraron.
const ROLES_SOLO_PROPIOS = ["Auditor Senior", "Auditor"];

async function rechazarSiNoEsPropio(id: string, res: Response): Promise<boolean> {
  const usuario = usuarioEnSesion(res);
  if (!ROLES_SOLO_PROPIOS.includes(usuario.rol)) return false;

  const pool = await poolPromise;
  const hallazgo = await pool.query(`SELECT "ownerId" FROM findings WHERE id = $1`, [id]);
  // Si no existe, la ruta responde 404 como con cualquier otro rol.
  if (hallazgo.rows.length === 0 || hallazgo.rows[0].ownerId === String(usuario.id)) return false;

  res.status(403).json({
    error: {
      codigo: "ROL_NO_AUTORIZADO",
      mensaje: "Solo puedes editar o eliminar los hallazgos que tú registraste.",
    },
  });
  return true;
}

// GET: Fetch all findings
router.get("/hallazgos", async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const usuario = usuarioEnSesion(res);
    const result = await pool.query(`
      SELECT f.*,
             (
               SELECT p.business_unit_id
               FROM audit_controls ac
               JOIN processes p ON p.id = ac.process_id
               WHERE ac.audit_id::text = f."auditId"::text
                 AND (ac.control_id::text = f."controlId"::text OR ac.id::text = f."controlId"::text)
               LIMIT 1
             ) AS "businessUnitId"
      FROM findings f
      WHERE ${HALLAZGO_VISIBLE_POR_USUARIO(1, 2, 3)}
      ORDER BY
        CASE WHEN status = 'Cerrado' THEN 1 ELSE 0 END,
        created_at DESC;
    `, [String(usuario.id), usuario.business_unit_id, esEquipoAuditoria(usuario.rol)]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Error fetching findings from database." });
  }
});

// GET: Fetch findings linked to processes/controls in a specific Business Unit
router.get("/hallazgos/unidad-negocio", async (req: Request, res: Response) => {
  const businessUnitId = usuarioEnSesion(res).business_unit_id;

  if (!businessUnitId) {
    return res.status(400).json({ error: "El usuario no tiene una unidad de negocio asignada." });
  }

  try {
    const pool = await poolPromise;
    const result = await pool.query(
      `
      SELECT DISTINCT
        f.id,
        f.folio,
        f.title,
        f.description,
        f.severity,
        f.status,
        f."auditId",
        f."controlId",
        f."ownerId",
        (
          SELECT p2.business_unit_id
          FROM audit_controls ac2
          JOIN processes p2 ON p2.id = ac2.process_id
          WHERE ac2.audit_id::text = f."auditId"::text
            AND (ac2.control_id::text = f."controlId"::text OR ac2.id::text = f."controlId"::text)
          LIMIT 1
        ) AS "businessUnitId"
      FROM findings f
      INNER JOIN audit_controls ac
        ON ac.audit_id::text = f."auditId"::text
       AND (ac.control_id::text = f."controlId"::text OR ac.id::text = f."controlId"::text)
      INNER JOIN processes p
        ON p.id::text = ac.process_id::text
      WHERE p.business_unit_id::text = TRIM($1::text)
         OR f."ownerId" = $2
      ORDER BY f.id DESC;
      `,
      [String(businessUnitId), String(usuarioEnSesion(res).id)]
    );

    console.log(`[Backend] Findings found for businessUnitId (${businessUnitId}):`, result.rows.length);
    res.json(result.rows);
  } catch (error) {
    console.error("Error al obtener hallazgos por unidad de negocio:", error);
    res.status(500).json({ error: "Error al obtener hallazgos por unidad de negocio." });
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
        String(usuarioEnSesion(res).id),
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
    if (await rechazarSiNoEsPropio(id as string, res)) return;
    const pool = await poolPromise;
    const usuario = usuarioEnSesion(res);
    const result = await pool.query(
      `
        UPDATE findings AS f
        SET title = $2,
            severity = $3,
            status = $4,
            description = $5
        WHERE id = $1
          AND ${HALLAZGO_VISIBLE_POR_USUARIO(6, 7, 8)}
        RETURNING *;
      `,
      [id, title, severity, status, description || null, String(usuario.id), usuario.business_unit_id, esEquipoAuditoria(usuario.rol)],
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
    if (await rechazarSiNoEsPropio(id as string, res)) return;
    const pool = await poolPromise;
    const usuario = usuarioEnSesion(res);
    const finding = await pool.query(
      `SELECT status FROM findings f
       WHERE f.id = $1 AND ${HALLAZGO_VISIBLE_POR_USUARIO(2, 3, 4)}`,
      [id, String(usuario.id), usuario.business_unit_id, esEquipoAuditoria(usuario.rol)],
    );

    if (finding.rows.length === 0) {
      return res.status(404).json({ error: "Finding not found." });
    }

    if (finding.rows[0].status === "En Revisión") {
      return res.status(409).json({
        error: "Este hallazgo ya fue enviado a revisión por la jefatura y no puede eliminarse.",
      });
    }

    const result = await pool.query(
      `DELETE FROM findings f
       WHERE f.id = $1 AND f.status <> 'En Revisión'
         AND ${HALLAZGO_VISIBLE_POR_USUARIO(2, 3, 4)}`,
      [id, String(usuario.id), usuario.business_unit_id, esEquipoAuditoria(usuario.rol)],
    );

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

router.get("/hallazgos/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const pool = await poolPromise;
    const usuario = usuarioEnSesion(res);
    const result = await pool.query(
      `
      SELECT f.*, u.name AS created_by_name
      FROM findings f
      LEFT JOIN users u ON u.id::text = f."ownerId"::text
      WHERE (f.id::text = $1 OR f.folio = $1)
        AND ${HALLAZGO_VISIBLE_POR_USUARIO(2, 3, 4)}
      LIMIT 1;
      `,
      [id, String(usuario.id), usuario.business_unit_id, esEquipoAuditoria(usuario.rol)],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Hallazgo no encontrado." });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener el hallazgo." });
  }
});

router.get("/hallazgos/:id/planes-accion", async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const pool = await poolPromise;
    const usuario = usuarioEnSesion(res);
    const result = await pool.query(
      `
      SELECT ap.id,
             NULL::varchar AS public_id,
             relation.finding_id,
             COALESCE(ap.title, ap.root_cause) AS title,
             ap.root_cause,
             u.name AS responsible_name,
             ap.due_date,
             ap.status,
             ap.created_at,
             COALESCE(
               json_agg(
                 json_build_object(
                   'id', step.id,
                   'action_plan_id', step.action_plan_id,
                   'assigned_user_id', step.assigned_user_id,
                   'description', step.description,
                   'due_date', step.due_date,
                   'is_completed', step.is_completed,
                   'created_at', step.created_at
                 )
                 ORDER BY step.id
               ) FILTER (WHERE step.id IS NOT NULL),
               '[]'::json
             ) AS steps
      FROM action_plans ap
      JOIN action_plan_findings relation ON relation.action_plan_id = ap.id
      LEFT JOIN users u ON u.id = ap.responsible_id
      LEFT JOIN action_plan_steps step ON step.action_plan_id = ap.id
      JOIN findings f ON f.id = relation.finding_id
      WHERE relation.finding_id::text = $1
        AND ${HALLAZGO_VISIBLE_POR_USUARIO(2, 3, 4)}
      GROUP BY ap.id, relation.finding_id, u.name
      ORDER BY ap.due_date ASC;
      `,
      [id, String(usuario.id), usuario.business_unit_id, esEquipoAuditoria(usuario.rol)],
    );

    res.json(result.rows);
  } catch (error) {
    res.json([]);
  }
});

export default router;