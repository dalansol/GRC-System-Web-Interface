import type pg from "pg";
import { periodoClave, type DatosPlan, type EstadoPlan, type PlanAuditoria, type TipoPlan } from "../domain/planes.js";
import { ErrorCodigoDuplicado, type RepositorioPlanes } from "./planes.js";

interface FilaPlan {
  id: number;
  code: string;
  name: string;
  type: TipoPlan;
  period: string | null;
  start_date: string;
  end_date: string;
  status: EstadoPlan;
  estimated_hours: number;
  responsible_id: number;
  responsible_name: string;
  scope: string | null;
}

// Las columnas DATE se piden como texto (AAAA-MM-DD); pg las convertiría a un Date en la hora local.
const SELECT_PLAN = `
  SELECT p.id, p.code, p.name, p.type, p.period, p.start_date::text AS start_date, p.end_date::text AS end_date, p.status,
         p.estimated_hours, p.responsible_id, u.name AS responsible_name, p.scope
  FROM audit_plans p
  JOIN users u ON u.id = p.responsible_id`;

// Código de PostgreSQL para violación de restricción o índice único.
const ERROR_DUPLICADO = "23505";

function aPlan(fila: FilaPlan): PlanAuditoria {
  return {
    id: fila.id,
    codigo: fila.code,
    nombre: fila.name,
    tipo: fila.type,
    periodo: fila.period,
    fechaInicio: fila.start_date,
    fechaFin: fila.end_date,
    estado: fila.status,
    horasEstimadas: fila.estimated_hours,
    responsable: { id: fila.responsible_id, nombre: fila.responsible_name },
    alcance: fila.scope,
  };
}

// Repositorio de planes sobre PostgreSQL (Supabase). Todas las consultas usan parámetros.
export class RepositorioPlanesSql implements RepositorioPlanes {
  constructor(private readonly pool: pg.Pool) {}

  // En el orden de $1 a $10 de las consultas de crear y actualizar.
  private valores(datos: DatosPlan) {
    return [
      datos.codigo,
      datos.nombre,
      datos.tipo,
      datos.periodo,
      datos.fechaInicio,
      datos.fechaFin,
      datos.estado,
      datos.horasEstimadas,
      datos.responsableId,
      datos.alcance,
    ];
  }

  private async conCodigoUnico<T>(codigo: string, consulta: Promise<T>): Promise<T> {
    try {
      return await consulta;
    } catch (error) {
      if ((error as { code?: string }).code === ERROR_DUPLICADO) throw new ErrorCodigoDuplicado(codigo);
      throw error;
    }
  }

  async listar(responsableId?: number, auditorId?: number) {
    const condiciones: string[] = [];
    const valores: number[] = [];
    if (responsableId !== undefined) {
      valores.push(responsableId);
      condiciones.push(`p.responsible_id = $${valores.length}`);
    }
    if (auditorId !== undefined) {
      valores.push(auditorId);
      condiciones.push(`EXISTS (
        SELECT 1 FROM audit_controls ac
        WHERE ac.audit_id = p.id AND ac.auditor_id = $${valores.length}
      )`);
    }
    const consulta = `${SELECT_PLAN}${
      condiciones.length > 0 ? ` WHERE ${condiciones.join(" AND ")}` : ""
    } ORDER BY p.start_date DESC`;
    const resultado = await this.pool.query<FilaPlan>(
      consulta,
      valores,
    );
    return resultado.rows.map(aPlan);
  }

  async buscarPorId(id: number) {
    const resultado = await this.pool.query<FilaPlan>(`${SELECT_PLAN} WHERE p.id = $1`, [id]);
    const fila = resultado.rows[0];
    return fila ? aPlan(fila) : null;
  }

  async siguienteCodigo(datos: DatosPlan) {
    const year = Number(datos.fechaInicio.slice(0, 4));
    const quarter = Math.floor((Number(datos.fechaInicio.slice(5, 7)) - 1) / 3) + 1;
    const inicio = datos.tipo === "Anual"
      ? `${year}-01-01`
      : `${year}-${String((quarter - 1) * 3 + 1).padStart(2, "0")}-01`;
    const fin = datos.tipo === "Anual"
      ? `${year + 1}-01-01`
      : `${quarter === 4 ? year + 1 : year}-${String(quarter === 4 ? 1 : quarter * 3 + 1).padStart(2, "0")}-01`;
    const resultado = await this.pool.query<{ code: string }>(
      `
      SELECT p.code
      FROM audit_plans p
      WHERE p.type = $1
        AND p.start_date >= $2::date
        AND p.start_date < $3::date
      `,
      [datos.tipo, inicio, fin],
    );
    const ultimo = resultado.rows.reduce((maximo, fila) => {
      const coincidencia = fila.code.match(/(\d+)$/);
      return coincidencia ? Math.max(maximo, Number(coincidencia[1])) : maximo;
    }, 0);
    const periodo = periodoClave(datos);
    const sufijoPeriodo = datos.tipo === "Anual"
      ? periodo
      : `${datos.fechaInicio.slice(0, 4)}-${periodo.match(/Q[1-4]/)![0]}`;
    const prefijo = datos.tipo === "Anual" ? "PAA" : "PAT";
    return `${prefijo}-${sufijoPeriodo}-${String(ultimo + 1).padStart(3, "0")}`;
  }

  async crear(datos: DatosPlan, creadoPorId: number) {
    const resultado = await this.conCodigoUnico(
      datos.codigo,
      this.pool.query<{ id: number }>(
        `
        INSERT INTO audit_plans (code, name, type, period, start_date, end_date, status, estimated_hours, responsible_id, scope, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id`,
        [...this.valores(datos), creadoPorId],
      ),
    );
    return (await this.buscarPorId(resultado.rows[0]!.id))!;
  }

  async actualizar(id: number, datos: DatosPlan) {
    const resultado = await this.conCodigoUnico(
      datos.codigo,
      this.pool.query(
        `
        UPDATE audit_plans
        SET code = $1, name = $2, type = $3, period = $4, start_date = $5, end_date = $6,
            status = $7, estimated_hours = $8, responsible_id = $9, scope = $10
        WHERE id = $11`,
        [...this.valores(datos), id],
      ),
    );
    return resultado.rowCount === 1 ? this.buscarPorId(id) : null;
  }
}
