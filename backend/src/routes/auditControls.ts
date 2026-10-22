import { Router } from "express";
import { poolPromise } from "../db.js";
import { ErrorApi } from "../errores.js";
import { usuarioEnSesion } from "../middleware/autenticar.js";
import { autorizar } from "../middleware/autorizar.js";
import { MENSAJE_DECLARACION_PENDIENTE } from "../domain/conflictos.js";
import { ROL_ADMINISTRADOR } from "../domain/tipos.js";
import { declaracionPendiente } from "../repos/conflictosSql.js";

const router = Router();
const ROL_SENIOR = "Auditor Senior";
// El Administrador tiene "Ver Auditorías": consulta las asignaciones como la Jefatura, sin editarlas.
const ROLES_CONSULTA_ASIGNACIONES = [ROL_SENIOR, "Auditor", "Jefe de Auditoría", "Supervisor", ROL_ADMINISTRADOR];

function idNumerico(valor: string | string[] | undefined, nombre: string): number {
  const texto = typeof valor === "string" ? valor : "";
  if (!/^[1-9]\d*$/.test(texto)) {
    throw new ErrorApi(400, "DATOS_INVALIDOS", `${nombre} no es válido.`);
  }
  return Number(texto);
}

router.get("/controles/asignables", autorizar(ROL_SENIOR), async (_req, res) => {
  const pool = await poolPromise;
  const resultado = await pool.query(
    "SELECT id, code, name FROM controls ORDER BY code",
  );
  res.json(resultado.rows);
});

router.get("/controles", async (_req, res) => {
  const pool = await poolPromise;
  const usuario = usuarioEnSesion(res);
  const resultado = await pool.query(
    `SELECT c.id, c.code, c.name, c.description, c.type, c.frequency,
            CASE
              WHEN COUNT(ac.id) = 0 THEN 'En Progreso'
              WHEN BOOL_AND(ac.status = 'Completado') THEN 'Completado'
              WHEN BOOL_AND(ac.status = 'En Revision') THEN 'En Revision'
              ELSE 'En Progreso'
            END AS status,
            COALESCE(SUM(COALESCE(ac.hours_spent, 0)), 0) AS hours_spent,
            COALESCE(MAX(ac.feedback), '') AS feedback,
            COALESCE(array_agg(DISTINCT ac.audit_id) FILTER (WHERE ac.audit_id IS NOT NULL), '{}') AS audit_ids
     FROM controls c
     LEFT JOIN audit_controls ac ON ac.control_id = c.id
     WHERE CASE
       WHEN $1::text = 'Auditor' THEN
       EXISTS (
         SELECT 1 FROM audit_controls ac
         WHERE ac.control_id = c.id AND ac.auditor_id = $2
       )
       WHEN $1::text = 'Auditor Senior' THEN
       EXISTS (
         SELECT 1 FROM audit_controls ac
         WHERE ac.control_id = c.id AND ac.assigned_by = $2
       )
       WHEN $1::text = 'Jefe de Auditoría' THEN
       EXISTS (
         SELECT 1 FROM audit_controls ac
         JOIN audit_plans ap ON ap.id = ac.audit_id
         WHERE ac.control_id = c.id AND ap.created_by = $2
       )
       ELSE FALSE
     END
     GROUP BY c.id
     ORDER BY c.code`,
    [usuario.rol, usuario.id],
  );
  res.json(resultado.rows);
});

router.get("/controles/:controlId/mi-asignacion", async (req, res) => {
  const usuario = usuarioEnSesion(res);
  const controlId = req.params.controlId;
  if (!controlId) {
    throw new ErrorApi(400, "DATOS_INVALIDOS", "El control no es válido.");
  }
  const pool = await poolPromise;
  const resultado = await pool.query(
    `    SELECT ac.id, ac.audit_id, ac.control_id, ac.status
    FROM audit_controls ac
    JOIN controls c ON c.id = ac.control_id
    WHERE (c.id::text = $1 OR c.code = $1)
     AND ac.auditor_id = $2
    ORDER BY ac.created_at DESC
     LIMIT 1`,
    [controlId, usuario.id],
  );
  res.json({
    asignado: resultado.rowCount === 1,
    asignacion: resultado.rows[0] ?? null,
  });
});

router.get("/controles/:controlId/revision", async (req, res) => {
  const usuario = usuarioEnSesion(res);
  const pool = await poolPromise;
  const resultado = await pool.query(
    `SELECT ac.audit_id AS plan_id,
            CASE
              WHEN bool_and(ac.status = 'Completado') THEN 'Completado'
              WHEN bool_and(ac.status = 'En Revision') THEN 'En Revision'
              ELSE 'En Progreso'
            END AS status,
            (array_agg(ac.feedback ORDER BY ac.created_at DESC)
              FILTER (WHERE ac.feedback IS NOT NULL AND ac.feedback <> ''))[1] AS feedback,
            bool_and(ac.status = 'En Revision') AS listo,
            bool_or(r.name = 'Auditor Senior') AS tiene_senior,
            CASE
              WHEN bool_or(r.name = 'Auditor Senior')
                THEN bool_or(ap.created_by = $2 AND $3 = 'Jefe de Auditoría')
              ELSE bool_or(ap.responsible_id = $2 AND $3 = 'Auditor Senior')
            END AS puede_revisar
     FROM audit_controls ac
     JOIN controls c ON c.id = ac.control_id
     JOIN users u ON u.id = ac.auditor_id
     JOIN roles r ON r.id = u.role_id
     JOIN audit_plans ap ON ap.id = ac.audit_id
     WHERE (c.id::text = $1 OR c.code = $1)
     GROUP BY ac.audit_id
     ORDER BY
       bool_or(ap.created_by = $2 AND $3 = 'Jefe de Auditoría') DESC,
       max(ac.created_at) DESC
     LIMIT 1`,
    [req.params.controlId, usuario.id, usuario.rol],
  );
  if (resultado.rowCount !== 1) {
    return res.json({ puede_revisar: false, plan_id: null, status: null, feedback: null });
  }
  res.json({
    puede_revisar: Boolean(resultado.rows[0].puede_revisar && resultado.rows[0].listo),
    plan_id: resultado.rows[0].plan_id,
    status: resultado.rows[0].status,
    feedback: resultado.rows[0].feedback,
  });
});

router.post("/controles/:controlId/horas", async (req, res) => {
  const usuario = usuarioEnSesion(res);
  const { controlId } = req.params;
  const { horas } = req.body as {
    horas?: unknown;
  };
  if (typeof horas !== "number" || !Number.isFinite(horas) || horas <= 0 || horas >= 24) {
    throw new ErrorApi(400, "DATOS_INVALIDOS", "Las horas deben ser mayores que 0 y menores que 24.");
  }

  const pool = await poolPromise;
  const acceso = await pool.query(
    `SELECT ac.id, ac.audit_id FROM audit_controls ac
     JOIN controls c ON c.id = ac.control_id
     WHERE (c.id::text = $1 OR c.code = $1)
     AND (
       ($2 = 'Auditor' AND ac.auditor_id = $3)
       OR ($2 = 'Auditor Senior' AND ac.assigned_by = $3)
       OR ($2 = 'Jefe de Auditoría' AND EXISTS (
         SELECT 1 FROM audit_plans ap WHERE ap.id = ac.audit_id AND ap.created_by = $4
       ))
     )
     ORDER BY ac.created_at DESC
     LIMIT 1`,
    [controlId, usuario.rol, usuario.id, usuario.id],
  );
  if (acceso.rowCount !== 1) throw new ErrorApi(403, "ROL_NO_AUTORIZADO", "No puedes registrar horas para este control.");
  const asignacion = acceso.rows[0] as { id: number; audit_id: number };
  // Historia #96: el auditor asignado no evalúa controles del plan sin declarar sus conflictos de interés.
  if (await declaracionPendiente(pool, asignacion.audit_id, usuario.id)) {
    throw new ErrorApi(403, "DECLARACION_PENDIENTE", MENSAJE_DECLARACION_PENDIENTE);
  }

  const resultado = await pool.query(
    `UPDATE audit_controls
     SET hours_spent = COALESCE(hours_spent, 0) + $1
     WHERE id = $2
     RETURNING control_id AS id, hours_spent`,
    [horas, asignacion.id],
  );
  res.status(201).json(resultado.rows[0]);
});

router.patch("/controles/:controlId/status", async (req, res) => {
  const usuario = usuarioEnSesion(res);
  const { controlId } = req.params;
  const { status, feedback } = req.body as {
    status?: unknown;
    feedback?: unknown;
  };
  if (!["En Revision", "Completado"].includes(String(status))) {
    throw new ErrorApi(400, "DATOS_INVALIDOS", "El status no es válido.");
  }
  const pool = await poolPromise;
  const actual = await pool.query(
    `SELECT ac.id, ac.audit_id, ac.status, r.name AS auditor_role,
            ap.responsible_id, ap.created_by
     FROM audit_controls ac
     JOIN controls c ON c.id = ac.control_id
     JOIN users u ON u.id = ac.auditor_id
     JOIN roles r ON r.id = u.role_id
     JOIN audit_plans ap ON ap.id = ac.audit_id
     WHERE (c.id::text = $1 OR c.code = $1)
       AND (
         ac.auditor_id = $3
         OR ($2 = 'Jefe de Auditoría' AND (ap.responsible_id = $3 OR ap.created_by = $3))
       )
     ORDER BY ac.created_at DESC
     LIMIT 1`,
    [controlId, usuario.rol, usuario.id],
  );
  if (actual.rowCount !== 1) throw new ErrorApi(403, "ROL_NO_AUTORIZADO", "No puedes actualizar este control.");
  // Historia #96: el auditor asignado no envía a revisión sin declarar sus conflictos de interés.
  if (await declaracionPendiente(pool, actual.rows[0].audit_id as number, usuario.id)) {
    throw new ErrorApi(403, "DECLARACION_PENDIENTE", MENSAJE_DECLARACION_PENDIENTE);
  }
  const statusActual = actual.rows[0].status as string;
  const permitido =
    (statusActual === "En Progreso" && status === "En Revision" &&
      (actual.rows[0].auditor_role === "Auditor" || actual.rows[0].auditor_role === "Auditor Senior")) ||
    (statusActual === "En Revision" &&
      status === "Completado" &&
      ((actual.rows[0].auditor_role === "Auditor" && actual.rows[0].responsible_id === usuario.id) ||
        (actual.rows[0].auditor_role === "Auditor Senior" && usuario.rol === "Jefe de Auditoría" && actual.rows[0].created_by === usuario.id))) ||
    (statusActual === "En Revision" && status === "En Revision" && usuario.rol === "Jefe de Auditoría");
  if (!permitido) throw new ErrorApi(400, "DATOS_INVALIDOS", "La transición de status no está permitida.");

  const resultado = await pool.query(
    `UPDATE audit_controls
     SET status = $1, feedback = CASE WHEN $2::text IS NULL THEN feedback ELSE $2 END
     WHERE id = $3
     RETURNING control_id AS id, status, hours_spent, feedback`,
    [status, typeof feedback === "string" ? feedback.trim() : null, actual.rows[0].id],
  );
  const estadoControl = await pool.query(
    `SELECT CASE
              WHEN bool_and(status = 'Completado') THEN 'Completado'
              WHEN bool_and(status = 'En Revision') THEN 'En Revision'
              ELSE 'En Progreso'
            END AS aggregate_status,
            bool_and(status = 'En Revision') AS todos_en_revision,
            count(*) FILTER (WHERE status <> 'En Revision') AS pendientes
     FROM audit_controls
     WHERE audit_id = $1 AND control_id = (
       SELECT control_id FROM audit_controls WHERE id = $2
     )`,
    [actual.rows[0].audit_id, actual.rows[0].id],
  );
  res.json({
    ...resultado.rows[0],
    status: estadoControl.rows[0].aggregate_status,
    todos_en_revision: Boolean(estadoControl.rows[0].todos_en_revision),
    auditores_pendientes: Number(estadoControl.rows[0].pendientes),
  });
});

router.get("/usuarios/auditores", autorizar(ROL_SENIOR), async (_req, res) => {
  const pool = await poolPromise;
  const resultado = await pool.query(
    `SELECT u.id, u.name, u.email, r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.status = 'active' AND r.name IN ('Auditor Senior', 'Auditor')
     ORDER BY u.name`,
  );
  res.json(resultado.rows);
});

router.get("/planes/:planId/controles", autorizar(...ROLES_CONSULTA_ASIGNACIONES), async (req, res) => {
  const planId = idNumerico(req.params.planId, "El plan");
  const usuario = usuarioEnSesion(res);
  const pool = await poolPromise;
  const resultado = await pool.query(
    `SELECT ac.id, ac.audit_id, ac.control_id, c.code AS control_code,
            c.name AS control_name, ac.hours_spent, ac.status,
            ac.feedback, ac.auditor_id, u.name AS auditor_name, r.name AS auditor_role,
            ap.responsible_id AS plan_responsible_id, ap.created_by AS plan_created_by,
            ac.is_lead, ac.assigned_by, ac.created_at
     FROM audit_controls ac
     JOIN controls c ON c.id = ac.control_id
     JOIN users u ON u.id = ac.auditor_id
     JOIN roles r ON r.id = u.role_id
     JOIN audit_plans ap ON ap.id = ac.audit_id
     WHERE ac.audit_id = $1
       AND (
         $2 IN ('Jefe de Auditoría', 'Supervisor', 'Administrador')
         OR ($2 = 'Auditor Senior' AND ac.assigned_by = $3)
         OR ($2 = 'Auditor' AND ac.auditor_id = $3)
       )
     ORDER BY c.code, u.name`,
    [planId, usuario.rol, usuario.id],
  );
  res.json(resultado.rows);
});

router.patch("/planes/:planId/controles/:controlId/status", async (req, res) => {
  const planId = idNumerico(req.params.planId, "El plan");
  const { controlId } = req.params;
  const { status, feedback } = req.body as { status?: unknown; feedback?: unknown };
  if (status !== "Completado" && status !== "En Revision" && status !== "En Progreso") {
    throw new ErrorApi(400, "DATOS_INVALIDOS", "El status no es válido.");
  }

  const pool = await poolPromise;
  const actual = await pool.query(
    `SELECT c.id AS control_id,
            bool_and(ac.status = 'En Revision') AS todas_en_revision,
            bool_or(ac.status = 'En Revision') AS alguna_en_revision,
            bool_or(r.name = 'Auditor') AS tiene_auditor,
            bool_or(r.name = 'Auditor Senior') AS tiene_senior,
            bool_and(r.name IN ('Auditor', 'Auditor Senior')) AS roles_validos,
            bool_or(ap.responsible_id = $3) AS es_responsable,
            bool_or(ap.created_by = $3) AS es_creador,
            bool_or(ap.created_by = $3 AND $4 = 'Jefe de Auditoría') AS puede_revisar_jefatura,
            bool_or(ap.responsible_id = $3 AND $4 = 'Auditor Senior') AS puede_revisar_responsable
     FROM audit_controls ac
     JOIN controls c ON c.id = ac.control_id
     JOIN users u ON u.id = ac.auditor_id
     JOIN roles r ON r.id = u.role_id
     JOIN audit_plans ap ON ap.id = ac.audit_id
     WHERE ac.audit_id = $1
       AND (c.id::text = $2 OR c.code = $2)
     GROUP BY c.id`,
    [planId, controlId, usuarioEnSesion(res).id, usuarioEnSesion(res).rol],
  );
  if (actual.rowCount !== 1) {
    throw new ErrorApi(404, "NO_ENCONTRADO", "La asignación del control no existe en este plan.");
  }
  const puedeRevisar =
    actual.rows[0].todas_en_revision &&
    actual.rows[0].roles_validos &&
    (
      (actual.rows[0].tiene_senior
        ? actual.rows[0].puede_revisar_jefatura
        : actual.rows[0].puede_revisar_responsable)
    );
  if (!puedeRevisar) {
    throw new ErrorApi(403, "ROL_NO_AUTORIZADO", "No tienes permiso para revisar este control.");
  }

  const resultado = await pool.query(
    `UPDATE audit_controls
     SET status = $1,
         feedback = CASE WHEN $2::text IS NULL THEN feedback ELSE $2 END
     WHERE audit_id = $3 AND control_id = $4
     RETURNING id, control_id, status, hours_spent, feedback`,
    [status, typeof feedback === "string" ? feedback.trim() : null, planId, actual.rows[0].control_id],
  );
  res.json(resultado.rows[0]);
});

router.post("/planes/:planId/controles", autorizar(ROL_SENIOR), async (req, res) => {
  const planId = idNumerico(req.params.planId, "El plan");
  const { controlId, auditorId } = req.body as { controlId?: unknown; auditorId?: unknown };
  if (typeof controlId !== "string" || !controlId.trim() || !Number.isInteger(auditorId)) {
    throw new ErrorApi(400, "DATOS_INVALIDOS", "El control y el auditor son obligatorios.");
  }

  const senior = usuarioEnSesion(res);
  const pool = await poolPromise;
  const plan = await pool.query("SELECT id FROM audit_plans WHERE id = $1", [planId]);
  if (plan.rowCount !== 1) throw new ErrorApi(404, "NO_ENCONTRADO", "El plan no existe.");

  const auditor = await pool.query(
    `SELECT u.id, r.name AS role
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1 AND u.status = 'active' AND r.name IN ('Auditor Senior', 'Auditor')`,
    [auditorId],
  );
  if (auditor.rowCount !== 1) {
    throw new ErrorApi(400, "DATOS_INVALIDOS", "El usuario asignado no es un Auditor activo.");
  }

  try {
    const resultado = await pool.query(
      `INSERT INTO audit_controls
         (audit_id, control_id, auditor_id, is_lead, assigned_by, status)
       VALUES ($1, $2, $3, $4, $5, 'En Progreso')
       RETURNING id, audit_id, control_id, auditor_id, is_lead, assigned_by, status, created_at`,
      [planId, controlId.trim(), auditorId, auditorId === senior.id, senior.id],
    );
    res.status(201).json(resultado.rows[0]);
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new ErrorApi(409, "ASIGNACION_DUPLICADA", "El control ya está asignado a ese auditor en este plan.");
    }
    if ((error as { code?: string }).code === "23503") {
      throw new ErrorApi(400, "DATOS_INVALIDOS", "El control no existe.");
    }
    throw error;
  }
});

export default router;
