import sql from "mssql";
import type { DatosPlan, EstadoPlan, PlanAuditoria, TipoPlan } from "../domain/planes.js";
import { ErrorCodigoDuplicado, type RepositorioPlanes } from "./planes.js";

interface FilaPlan {
  id: number;
  code: string;
  name: string;
  type: TipoPlan;
  period: string | null;
  start_date: Date;
  end_date: Date;
  status: EstadoPlan;
  estimated_hours: number;
  responsible_id: number;
  responsible_name: string;
  scope: string | null;
}

const SELECT_PLAN = `
  SELECT p.id, p.code, p.name, p.type, p.period, p.start_date, p.end_date, p.status,
         p.estimated_hours, p.responsible_id, u.name AS responsible_name, p.scope
  FROM audit_plans p
  JOIN users u ON u.id = p.responsible_id`;

// Números de error de SQL Server para violación de restricción o índice único.
const ERRORES_DUPLICADO = [2601, 2627];

// mssql devuelve las columnas DATE como Date a medianoche UTC.
const aTexto = (fecha: Date) => fecha.toISOString().slice(0, 10);

function aPlan(fila: FilaPlan): PlanAuditoria {
  return {
    id: fila.id,
    codigo: fila.code,
    nombre: fila.name,
    tipo: fila.type,
    periodo: fila.period,
    fechaInicio: aTexto(fila.start_date),
    fechaFin: aTexto(fila.end_date),
    estado: fila.status,
    horasEstimadas: fila.estimated_hours,
    responsable: { id: fila.responsible_id, nombre: fila.responsible_name },
    alcance: fila.scope,
  };
}

// Repositorio de planes sobre Azure SQL. Todas las consultas usan parámetros.
export class RepositorioPlanesSql implements RepositorioPlanes {
  constructor(private readonly pool: sql.ConnectionPool) {}

  private conDatos(datos: DatosPlan) {
    return this.pool
      .request()
      .input("codigo", sql.NVarChar(30), datos.codigo)
      .input("nombre", sql.NVarChar(200), datos.nombre)
      .input("tipo", sql.NVarChar(10), datos.tipo)
      .input("periodo", sql.NVarChar(50), datos.periodo)
      .input("inicio", sql.Date, new Date(`${datos.fechaInicio}T00:00:00Z`))
      .input("fin", sql.Date, new Date(`${datos.fechaFin}T00:00:00Z`))
      .input("estado", sql.NVarChar(20), datos.estado)
      .input("horas", sql.Int, datos.horasEstimadas)
      .input("responsableId", sql.Int, datos.responsableId)
      .input("alcance", sql.NVarChar(2000), datos.alcance);
  }

  private async conCodigoUnico<T>(codigo: string, consulta: Promise<T>): Promise<T> {
    try {
      return await consulta;
    } catch (error) {
      if (ERRORES_DUPLICADO.includes((error as { number?: number }).number ?? 0)) throw new ErrorCodigoDuplicado(codigo);
      throw error;
    }
  }

  async listar() {
    const resultado = await this.pool.request().query<FilaPlan>(`${SELECT_PLAN} ORDER BY p.start_date DESC`);
    return resultado.recordset.map(aPlan);
  }

  async buscarPorId(id: number) {
    const resultado = await this.pool.request().input("id", sql.Int, id).query<FilaPlan>(`${SELECT_PLAN} WHERE p.id = @id`);
    const fila = resultado.recordset[0];
    return fila ? aPlan(fila) : null;
  }

  async crear(datos: DatosPlan, creadoPorId: number) {
    const resultado = await this.conCodigoUnico(
      datos.codigo,
      this.conDatos(datos).input("creadoPor", sql.Int, creadoPorId).query<{ id: number }>(`
        INSERT INTO audit_plans (code, name, type, period, start_date, end_date, status, estimated_hours, responsible_id, scope, created_by)
        OUTPUT INSERTED.id
        VALUES (@codigo, @nombre, @tipo, @periodo, @inicio, @fin, @estado, @horas, @responsableId, @alcance, @creadoPor)`),
    );
    return (await this.buscarPorId(resultado.recordset[0]!.id))!;
  }

  async actualizar(id: number, datos: DatosPlan) {
    const resultado = await this.conCodigoUnico(
      datos.codigo,
      this.conDatos(datos).input("id", sql.Int, id).query(`
        UPDATE audit_plans
        SET code = @codigo, name = @nombre, type = @tipo, period = @periodo, start_date = @inicio, end_date = @fin,
            status = @estado, estimated_hours = @horas, responsible_id = @responsableId, scope = @alcance
        WHERE id = @id`),
    );
    return (resultado.rowsAffected[0] ?? 0) === 1 ? this.buscarPorId(id) : null;
  }
}
