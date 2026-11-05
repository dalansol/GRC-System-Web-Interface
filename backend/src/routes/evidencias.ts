import { ESTADOS_BLOQUEADOS } from "../domain/flujoPlanAccion.js";
import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import path from "path";
import multer from "multer";
import { poolPromise } from "../db.js";
import { upload } from "../middleware/upload.js";
import { usuarioEnSesion } from "../middleware/autenticar.js";
import type { AlmacenamientoArchivos } from "../almacenamiento.js";
import { condicionEvidenciaVisible } from "../repos/evidenciasAcceso.js";
import { ROLES_EDICION } from "./planesAccion.js";

// La evidencia de un plan en revisión o aprobado forma parte de lo que se revisa y se firma (SF-12).
const RESPUESTA_PLAN_BLOQUEADO = {
  error: {
    codigo: "PLAN_BLOQUEADO",
    mensaje: "El plan de acción aún no se valida, está en revisión o ya se aprobó, y su evidencia no puede modificarse.",
  },
};

async function pasoEnPlanBloqueado(pasoId: string): Promise<boolean> {
  const pool = await poolPromise;
  const resultado = await pool.query(
    `SELECT 1
     FROM action_plan_steps step
     JOIN action_plans plan ON plan.id = step.action_plan_id
     WHERE step.id::text = $1 AND (plan.status = ANY($2::varchar[]) OR plan.review_stage = 'definicion')
     LIMIT 1`,
    [pasoId, [...ESTADOS_BLOQUEADOS]],
  );
  return resultado.rowCount === 1;
}

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
      // El equipo de auditoría consulta la evidencia de hallazgos y de pasos de planes de acción para revisarla.
      const esEquipoAuditoria = (ROLES_EDICION as readonly string[]).includes(usuario.rol);
      let query = `
        SELECT e.* FROM evidence e
        WHERE e.entity_id = $1
          AND e.uploaded_by = $2
        ORDER BY e.created_at DESC`;
      let params: unknown[] = [entityId as string, String(usuario.id)];

      if (entityType === "control") {
        // entity_id guarda la asignación (audit_controls.id). Quien revisa no tiene asignación propia
        // y consulta con el id del control: recibe la evidencia de las asignaciones que le tocan revisar.
        query = `
          SELECT e.* FROM evidence e
          JOIN audit_controls ac ON ac.id::text = e.entity_id
          WHERE e.entity_type = 'control'
            AND (ac.id::text = $1 OR ac.control_id = $1)
            AND ($4::text IS NULL OR ac.audit_id::text = $4)
            AND (
              ($2 = 'Auditor' AND e.uploaded_by = $3)
              OR ($2 = 'Auditor Senior'
                AND ac.assigned_by = $3::integer
                AND ac.auditor_id::text = e.uploaded_by)
              OR ($2 = 'Jefe de Auditoría'
                AND ac.auditor_id::text = e.uploaded_by
                AND EXISTS (
                  SELECT 1 FROM audit_plans ap
                  WHERE ap.id = ac.audit_id AND ap.created_by = $3::integer
                ))
            )
          ORDER BY e.created_at DESC`;
        params = [entityId as string, usuario.rol, String(usuario.id), (auditId as string | undefined) ?? null];
      } else if (entityType === "hallazgo") {
        query = `
          SELECT e.* FROM evidence e
          WHERE e.entity_id = $1
            AND e.entity_type = 'hallazgo'
            AND (e.uploaded_by = $2 OR $3::boolean)
          ORDER BY e.created_at DESC`;
        params = [entityId as string, String(usuario.id), esEquipoAuditoria];
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
                  OR $3::boolean
                )
            )
          ORDER BY e.created_at DESC`;
        params = [entityId as string, String(usuario.id), esEquipoAuditoria];
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
          if (await pasoEnPlanBloqueado(entityId)) {
            return res.status(409).json(RESPUESTA_PLAN_BLOQUEADO);
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

        // Store the file before its metadata; if the insert fails it is removed again
        await almacenamiento.guardar(storedName, file.buffer, file.mimetype || "application/octet-stream");

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
        ).catch(async (error) => {
          await almacenamiento.eliminar(storedName).catch(() => {});
          throw error;
        });

        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error("Error uploading evidence:", error);
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
        if (evidence.entity_type === "action_plan_step" && (await pasoEnPlanBloqueado(evidence.entity_id))) {
          return res.status(409).json(RESPUESTA_PLAN_BLOQUEADO);
        }
      } else {
        // Solo quien la subió, igual que en la consulta del Auditor.
        if (evidence.uploaded_by !== String(usuario.id)) {
          return res.status(403).json({
            error: {
              codigo: "ROL_NO_AUTORIZADO",
              mensaje: "Solo quien subió la evidencia puede eliminarla.",
            },
          });
        }

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

      // Delete the database record first: a leftover file is harmless, a record without its file is not
      const { rows: versiones } = await pool.query<{ storage_path: string }>(
        "SELECT storage_path FROM evidence_versions WHERE evidence_id = $1",
        [id],
      );
      await pool.query("DELETE FROM evidence WHERE id = $1", [id]);

      // El archivo vigente y los de las versiones anteriores (UF-17).
      const claves = new Set([evidence.storage_path, ...versiones.map((v) => v.storage_path)]);
      for (const clave of claves) {
        await almacenamiento.eliminar(clave).catch((error) => {
          console.error("Error deleting evidence file:", error);
        });
      }

      res.json({ message: "Evidence deleted successfully." });
    } catch (error) {
      console.error("Error deleting evidence:", error);
      res.status(500).json({ error: "Error deleting evidence." });
    }
  });

  // ─── Edición de Excel en la plataforma (UF-17, SF-08, historia #106) ────────
  // El editor abre el archivo vigente, y al guardar crea una versión nueva con su
  // propio hash; el archivo original nunca se sobrescribe.

  type Evidencia = {
    id: string;
    file_name: string;
    mime_type: string;
    file_size: string | number;
    file_hash: string;
    storage_path: string;
    uploaded_by: string | null;
    created_at: string;
    version: number;
    entity_id: string;
    entity_type: string;
  };

  const LIBROS = ["xlsx", "xlsm"];
  const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const sinEvidencia = (res: Response) =>
    res.status(404).json({ error: { codigo: "NO_ENCONTRADO", mensaje: "La evidencia no existe." } });
  const noEsLibro = (res: Response) =>
    res.status(415).json({ error: { codigo: "TIPO_NO_EDITABLE", mensaje: "Solo los libros de Excel (.xlsx, .xlsm) se abren en el editor." } });

  async function buscarEvidencia(id: string): Promise<Evidencia | null> {
    const pool = await poolPromise;
    const { rows } = await pool.query<Evidencia>("SELECT * FROM evidence WHERE id = $1", [id]);
    return rows[0] ?? null;
  }

  // Misma regla que el listado de evidencias (repos/evidenciasAcceso.ts).
  async function puedeVer(evidencia: Evidencia, usuario: { id: number; rol: string }): Promise<boolean> {
    const pool = await poolPromise;
    const { rowCount } = await pool.query(
      `SELECT 1 FROM evidence e WHERE e.id = $1 AND ${condicionEvidenciaVisible("$2", "$3")}`,
      [evidencia.id, usuario.rol, String(usuario.id)],
    );
    return rowCount === 1;
  }

  // Misma regla que subir: en controles el Auditor asignado, en pasos el asignado al paso; en
  // hallazgos quien la subió (quién puede subir sigue TBD, CLAUDE.md §7 #19).
  async function puedeModificar(evidencia: Evidencia, usuario: { id: number }): Promise<boolean> {
    if (evidencia.entity_type === "hallazgo") return evidencia.uploaded_by === String(usuario.id);
    const consulta =
      evidencia.entity_type === "control"
        ? "SELECT 1 FROM audit_controls ac WHERE ac.id::text = $1 AND ac.auditor_id = $2 LIMIT 1"
        : evidencia.entity_type === "action_plan_step"
          ? "SELECT 1 FROM action_plan_steps paso WHERE paso.id::text = $1 AND paso.assigned_user_id = $2 LIMIT 1"
          : null;
    if (!consulta) return false;
    const pool = await poolPromise;
    const { rowCount } = await pool.query(consulta, [evidencia.entity_id, usuario.id]);
    return rowCount === 1;
  }

  // ─── GET: archivo vigente de la evidencia (binario) ──────────────────────────
  router.get("/evidencias/:id/archivo", async (req: Request, res: Response) => {
    try {
      const evidencia = await buscarEvidencia(String(req.params.id));
      if (!evidencia) return sinEvidencia(res);
      if (!LIBROS.includes(evidencia.mime_type)) return noEsLibro(res);
      if (!(await puedeVer(evidencia, usuarioEnSesion(res)))) return sinEvidencia(res);

      const contenido = await almacenamiento.leer(evidencia.storage_path);
      if (!contenido) {
        return res.status(404).json({ error: { codigo: "ARCHIVO_NO_DISPONIBLE", mensaje: "El archivo de la evidencia no está disponible." } });
      }
      res.setHeader("Content-Type", TIPO_XLSX);
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(evidencia.file_name)}`);
      res.setHeader("X-Evidencia-Version", String(evidencia.version));
      res.send(contenido);
    } catch (error) {
      console.error("Error reading evidence file:", error);
      res.status(500).json({ error: { codigo: "ERROR_INTERNO", mensaje: "No se pudo leer el archivo de la evidencia." } });
    }
  });

  const VERSIONES_SQL = `
    SELECT v.version, v.file_hash, v.file_size, v.created_at, v.comentario,
           COALESCE(u.name, v.uploaded_by) AS uploaded_by
    FROM evidence_versions v
    LEFT JOIN users u ON u.id::text = v.uploaded_by
    WHERE v.evidence_id = $1`;

  // ─── GET: historial de versiones ─────────────────────────────────────────────
  router.get("/evidencias/:id/versiones", async (req: Request, res: Response) => {
    try {
      const evidencia = await buscarEvidencia(String(req.params.id));
      if (!evidencia) return sinEvidencia(res);
      if (!(await puedeVer(evidencia, usuarioEnSesion(res)))) return sinEvidencia(res);

      const pool = await poolPromise;
      const { rows } = await pool.query(`${VERSIONES_SQL} ORDER BY v.version DESC`, [evidencia.id]);
      // Antes del primer guardado el historial está vacío: la única versión es el original.
      if (rows.length === 0) {
        const { rows: original } = await pool.query(
          `SELECT e.version, e.file_hash, e.file_size, e.created_at, NULL AS comentario,
                  COALESCE(u.name, e.uploaded_by) AS uploaded_by
           FROM evidence e LEFT JOIN users u ON u.id::text = e.uploaded_by WHERE e.id = $1`,
          [evidencia.id],
        );
        return res.json(original);
      }
      res.json(rows);
    } catch (error) {
      console.error("Error listing evidence versions:", error);
      res.status(500).json({ error: { codigo: "ERROR_INTERNO", mensaje: "No se pudo cargar el historial de versiones." } });
    }
  });

  // ─── POST: guardar una versión nueva desde el editor ─────────────────────────
  router.post(
    "/evidencias/:id/versiones",
    (req: Request, res: Response, next: NextFunction) => {
      upload.single("file")(req, res, (err: any) => {
        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: { codigo: "DATOS_INVALIDOS", mensaje: "El archivo supera el límite de 100 MB." } });
        }
        if (err) return res.status(400).json({ error: { codigo: "DATOS_INVALIDOS", mensaje: err.message } });
        next();
      });
    },
    async (req: Request, res: Response) => {
      const file = req.file;
      const usuario = usuarioEnSesion(res);
      const comentario = typeof req.body?.comentario === "string" ? req.body.comentario.trim().slice(0, 500) : "";

      // Lo que guarda el editor siempre es un .xlsx (las macros de un .xlsm no se conservan);
      // un libro de Excel es un ZIP y empieza con "PK".
      if (!file || path.extname(file.originalname).toLowerCase() !== ".xlsx" || file.buffer.length < 4 || file.buffer[0] !== 0x50 || file.buffer[1] !== 0x4b) {
        return res.status(400).json({ error: { codigo: "DATOS_INVALIDOS", mensaje: "Se esperaba un libro de Excel (.xlsx)." } });
      }

      try {
        const evidencia = await buscarEvidencia(String(req.params.id));
        if (!evidencia) return sinEvidencia(res);
        if (!LIBROS.includes(evidencia.mime_type)) return noEsLibro(res);
        if (!(await puedeModificar(evidencia, usuario))) {
          return res.status(403).json({ error: { codigo: "ROL_NO_AUTORIZADO", mensaje: "No puedes guardar cambios en esta evidencia." } });
        }

        // Guardar una versión cambia la evidencia que se revisa y se firma (SF-12).
        if (evidencia.entity_type === "action_plan_step" && (await pasoEnPlanBloqueado(evidencia.entity_id))) {
          return res.status(409).json(RESPUESTA_PLAN_BLOQUEADO);
        }

        const hash = crypto.createHash("sha256").update(file.buffer).digest("hex");
        const nombre = evidencia.file_name.replace(/\.xlsm$/i, ".xlsx");
        const pool = await poolPromise;
        const cliente = await pool.connect();
        let clave = "";
        try {
          await cliente.query("BEGIN");
          // Bloquea la evidencia para que dos guardados simultáneos no repitan versión.
          const { rows } = await cliente.query<Evidencia>("SELECT * FROM evidence WHERE id = $1 FOR UPDATE", [evidencia.id]);
          const vigente = rows[0]!;
          const { rows: historial } = await cliente.query<{ total: number }>(
            "SELECT COUNT(*)::int AS total FROM evidence_versions WHERE evidence_id = $1",
            [vigente.id],
          );
          if (historial[0]!.total === 0) {
            // El original pasa al historial como versión 1 con sus datos actuales.
            await cliente.query(
              `INSERT INTO evidence_versions (evidence_id, version, file_name, file_size, file_hash, storage_path, uploaded_by, comentario, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8)`,
              [vigente.id, vigente.version, vigente.file_name, vigente.file_size, vigente.file_hash, vigente.storage_path, vigente.uploaded_by, vigente.created_at],
            );
          }
          const version = vigente.version + 1;
          clave = `${vigente.id}-v${version}.xlsx`;
          // Primero el archivo, luego el registro; si el registro falla se borra el archivo.
          await almacenamiento.guardar(clave, file.buffer, TIPO_XLSX);
          const { rows: creada } = await cliente.query(
            `INSERT INTO evidence_versions (evidence_id, version, file_name, file_size, file_hash, storage_path, uploaded_by, comentario)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING version, file_hash, file_size, created_at, comentario, uploaded_by`,
            [vigente.id, version, nombre, file.size, hash, clave, String(usuario.id), comentario || null],
          );
          await cliente.query(
            `UPDATE evidence
             SET version = $2, file_name = $3, mime_type = 'xlsx', file_size = $4, file_hash = $5, storage_path = $6
             WHERE id = $1`,
            [vigente.id, version, nombre, file.size, hash, clave],
          );
          await cliente.query("COMMIT");
          res.status(201).json({ ...creada[0], uploaded_by: usuario.nombre });
        } catch (error) {
          await cliente.query("ROLLBACK").catch(() => {});
          if (clave) await almacenamiento.eliminar(clave).catch(() => {});
          throw error;
        } finally {
          cliente.release();
        }
      } catch (error) {
        console.error("Error saving evidence version:", error);
        res.status(500).json({ error: { codigo: "ERROR_INTERNO", mensaje: "No se pudo guardar la versión de la evidencia." } });
      }
    },
  );

  return router;
}
