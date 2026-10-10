import sql from "mssql";
import type { DatosEdicionPlanAccion, DatosPlanAccion, EstadoPlanAccion, HallazgoResumen, PlanAccion } from "../domain/planesAccion.js";
import { ErrorPlanDuplicado, type RepositorioPlanesAccion } from "./planesAccion.js";

interface FilaHallazgo {
  id: string;
  folio: string | null;
  title: string;
  severity: string | null;
  auditId: string | null;
  controlId: string | null;
  audit_end_date: Date | null;
}

interface FilaPlan extends FilaHallazgo {
  plan_id: number;
  description: string;
  responsible_id: number;
  responsible_name: string;
  due_date: Date;
  status: EstadoPlanAccion;
  created_at: Date;
}

// Números de error de SQL Server para violación de restricción o índice único.
const ERRORES_DUPLICADO = [2601, 2627];

// mssql devuelve las columnas DATE como Date a medianoche UTC.
const aTexto = (fecha: Date) => fecha.toISOString().slice(0, 10);

const SELECT_HALLAZGO = `
  SELECT f.id, f.folio, f.title, f.severity, f.auditId, f.controlId, a.end_date AS audit_end_date
  FROM findings f
  LEFT JOIN audits a ON a.id = f.auditId`;

const SELECT_PLAN = `
  SELECT p.id AS plan_id, p.description, p.responsible_id, u.name AS responsible_name, p.due_date, p.status, p.created_at,
         f.id, f.folio, f.title, f.severity, f.auditId, f.controlId, a.end_date AS audit_end_date
  FROM action_plans p
  JOIN findings f ON f.id = p.finding_id
  JOIN users u ON u.id = p.responsible_id
  LEFT JOIN audits a ON a.id = f.auditId`;

function aHallazgo(fila: FilaHallazgo): HallazgoResumen {
  return {
    id: fila.id,
    folio: fila.folio,
    titulo: fila.title,
    severidad: fila.severity,
    auditoriaId: fila.auditId,
    controlId: fila.controlId,
    fechaCierreAuditoria: fila.audit_end_date ? aTexto(fila.audit_end_date) : null,
  };
}

function aPlan(fila: FilaPlan): PlanAccion {
  return {
    id: fila.plan_id,
    hallazgo: aHallazgo(fila),
    descripcion: fila.description,
    responsable: { id: fila.responsible_id, nombre: fila.responsible_name },
    fechaCompromiso: aTexto(fila.due_date),
    estado: fila.status,
    creadoEn: fila.created_at.toISOString(),
  };
}

// Repositorio de planes de acción sobre Azure SQL. Todas las consultas usan parámetros.
export class RepositorioPlanesAccionSql implements RepositorioPlanesAccion {
  constructor(private readonly pool: sql.ConnectionPool) {}

  async buscarHallazgo(hallazgoId: string) {
    const resultado = await this.pool
      .request()
      .input("id", sql.NVarChar(100), hallazgoId)
      .query<FilaHallazgo>(`${SELECT_HALLAZGO} WHERE f.id = @id`);
    const fila = resultado.recordset[0];
    return fila ? aHallazgo(fila) : null;
  }

  async listar() {
    const resultado = await this.pool.request().query<FilaPlan>(`${SELECT_PLAN} ORDER BY p.due_date ASC`);
    return resultado.recordset.map(aPlan);
  }

  async listarPorResponsable(usuarioId: number) {
    const resultado = await this.pool
      .request()
      .input("usuarioId", sql.Int, usuarioId)
      .query<FilaPlan>(`${SELECT_PLAN} WHERE p.responsible_id = @usuarioId ORDER BY p.due_date ASC`);
    return resultado.recordset.map(aPlan);
  }

  async buscarPorHallazgo(hallazgoId: string) {
    const resultado = await this.pool
      .request()
      .input("hallazgoId", sql.NVarChar(100), hallazgoId)
      .query<FilaPlan>(`${SELECT_PLAN} WHERE p.finding_id = @hallazgoId`);
    const fila = resultado.recordset[0];
    return fila ? aPlan(fila) : null;
  }

  async crear(datos: DatosPlanAccion, creadoPorId: number) {
    // El alta del plan y el cambio de estado del hallazgo van en la misma transacción.
    const transaccion = new sql.Transaction(this.pool);
    await transaccion.begin();
    let id: number;
    try {
      const resultado = await new sql.Request(transaccion)
        .input("hallazgoId", sql.NVarChar(100), datos.hallazgoId)
        .input("descripcion", sql.NVarChar(2000), datos.descripcion)
        .input("responsableId", sql.Int, datos.responsableId)
        .input("fecha", sql.Date, new Date(`${datos.fechaCompromiso}T00:00:00Z`))
        .input("creadoPor", sql.Int, creadoPorId)
        .query<{ id: number }>(`
          INSERT INTO action_plans (finding_id, description, responsible_id, due_date, status, created_by)
          OUTPUT INSERTED.id
          VALUES (@hallazgoId, @descripcion, @responsableId, @fecha, N'Asignado', @creadoPor);

          UPDATE findings SET status = N'Asignado' WHERE id = @hallazgoId;`);
      id = resultado.recordset[0]!.id;
      await transaccion.commit();
    } catch (error) {
      await transaccion.rollback();
      if (ERRORES_DUPLICADO.includes((error as { number?: number }).number ?? 0)) throw new ErrorPlanDuplicado(datos.hallazgoId);
      throw error;
    }
    return (await this.buscarPorId(id))!;
  }

  async buscarPorId(id: number) {
    const resultado = await this.pool.request().input("id", sql.Int, id).query<FilaPlan>(`${SELECT_PLAN} WHERE p.id = @id`);
    const fila = resultado.recordset[0];
    return fila ? aPlan(fila) : null;
  }

  async actualizar(id: number, datos: DatosEdicionPlanAccion) {
    const resultado = await this.pool
      .request()
      .input("id", sql.Int, id)
      .input("descripcion", sql.NVarChar(2000), datos.descripcion)
      .input("responsableId", sql.Int, datos.responsableId)
      .input("fecha", sql.Date, new Date(`${datos.fechaCompromiso}T00:00:00Z`))
      .input("estado", sql.NVarChar(20), datos.estado)
      .query(`
        UPDATE action_plans
        SET description = @descripcion, responsible_id = @responsableId, due_date = @fecha, status = @estado
        WHERE id = @id;`);
    if (resultado.rowsAffected[0] === 0) return null;
    return this.buscarPorId(id);
  }
}
