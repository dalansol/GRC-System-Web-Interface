import sql from "mssql";
import type { EstadoUsuario, Rol, Usuario } from "../domain/tipos.js";
import { ErrorCorreoDuplicado, type NuevoUsuario, type RepositorioUsuarios } from "./repositorio.js";

export interface ConexionSql {
  servidor: string;
  baseDatos: string;
  usuario: string;
  contrasena: string;
  /** Solo para SQL Server local con certificado autofirmado. */
  confiarCertificado?: boolean;
  puerto?: number;
}

interface FilaUsuario {
  id: number;
  name: string;
  email: string;
  role: string;
  status: EstadoUsuario;
  last_login: Date | null;
}

const SELECT_USUARIO = `
  SELECT u.id, u.name, u.email, r.name AS role, u.status, u.last_login
  FROM users u
  JOIN roles r ON r.id = u.role_id`;

// Números de error de SQL Server para violación de restricción o índice único.
const ERRORES_DUPLICADO = [2601, 2627];

function aUsuario(fila: FilaUsuario): Usuario {
  return {
    id: fila.id,
    nombre: fila.name,
    correo: fila.email,
    rol: fila.role,
    estado: fila.status,
    ultimoAcceso: fila.last_login ? fila.last_login.toISOString() : null,
  };
}

// Repositorio sobre Azure SQL. Todas las consultas usan parámetros.
export class RepositorioSql implements RepositorioUsuarios {
  private constructor(readonly pool: sql.ConnectionPool) {}

  static async conectar(conexion: ConexionSql): Promise<RepositorioSql> {
    // DB_SERVER puede traer una instancia con nombre (HOST\SQLEXPRESS); ahí no se usa el puerto.
    const [servidor = conexion.servidor, instancia] = conexion.servidor.split("\\", 2);
    const pool = await new sql.ConnectionPool({
      server: servidor,
      ...(instancia ? {} : { port: conexion.puerto }),
      database: conexion.baseDatos,
      user: conexion.usuario,
      password: conexion.contrasena,
      options: {
        encrypt: true,
        trustServerCertificate: conexion.confiarCertificado ?? false,
        ...(instancia ? { instanceName: instancia } : {}),
      },
    }).connect();
    return new RepositorioSql(pool);
  }

  async cerrar(): Promise<void> {
    await this.pool.close();
  }

  private async unUsuario(condicion: string, parametro: { tipo: sql.ISqlType | (() => sql.ISqlType); valor: unknown }) {
    const resultado = await this.pool
      .request()
      .input("valor", parametro.tipo, parametro.valor)
      .query<FilaUsuario>(`${SELECT_USUARIO} WHERE ${condicion}`);
    const fila = resultado.recordset[0];
    return fila ? aUsuario(fila) : null;
  }

  async listarUsuarios() {
    const resultado = await this.pool.request().query<FilaUsuario>(`${SELECT_USUARIO} ORDER BY u.name`);
    return resultado.recordset.map(aUsuario);
  }

  buscarPorId(id: number) {
    return this.unUsuario("u.id = @valor", { tipo: sql.Int, valor: id });
  }

  buscarPorCorreo(correo: string) {
    return this.unUsuario("u.email = @valor", { tipo: sql.NVarChar(254), valor: correo });
  }

  buscarPorOid(oid: string) {
    return this.unUsuario("u.entra_oid = @valor", { tipo: sql.NVarChar(64), valor: oid });
  }

  async vincularOid(id: number, oid: string) {
    const resultado = await this.pool
      .request()
      .input("id", sql.Int, id)
      .input("oid", sql.NVarChar(64), oid)
      .query("UPDATE users SET entra_oid = @oid WHERE id = @id AND entra_oid IS NULL");
    return (resultado.rowsAffected[0] ?? 0) === 1;
  }

  async registrarAcceso(id: number) {
    await this.pool
      .request()
      .input("id", sql.Int, id)
      .query("UPDATE users SET last_login = SYSUTCDATETIME() WHERE id = @id");
  }

  async crearUsuario(datos: NuevoUsuario) {
    try {
      const resultado = await this.pool
        .request()
        .input("nombre", sql.NVarChar(150), datos.nombre)
        .input("correo", sql.NVarChar(254), datos.correo)
        .input("rolId", sql.Int, datos.rolId)
        .query<{ id: number }>(
          "INSERT INTO users (name, email, role_id) OUTPUT INSERTED.id VALUES (@nombre, @correo, @rolId)",
        );
      const usuario = await this.buscarPorId(resultado.recordset[0]!.id);
      return usuario!;
    } catch (error) {
      if (ERRORES_DUPLICADO.includes((error as { number?: number }).number ?? 0)) {
        throw new ErrorCorreoDuplicado(datos.correo);
      }
      throw error;
    }
  }

  async cambiarRol(id: number, rolId: number) {
    await this.pool
      .request()
      .input("id", sql.Int, id)
      .input("rolId", sql.Int, rolId)
      .query("UPDATE users SET role_id = @rolId WHERE id = @id");
    return this.buscarPorId(id);
  }

  async contarActivosConRol(rolId: number) {
    const resultado = await this.pool
      .request()
      .input("rolId", sql.Int, rolId)
      .query<{ total: number }>(
        "SELECT COUNT(*) AS total FROM users WHERE role_id = @rolId AND status = 'active'",
      );
    return resultado.recordset[0]?.total ?? 0;
  }

  private async roles(filtro: string, nombre?: string): Promise<Rol[]> {
    const peticion = this.pool.request();
    if (nombre !== undefined) peticion.input("nombre", sql.NVarChar(100), nombre);
    const resultado = await peticion.query<{ id: number; name: string; permission: string | null }>(`
      SELECT r.id, r.name, p.name AS permission
      FROM roles r
      LEFT JOIN role_permissions rp ON rp.role_id = r.id
      LEFT JOIN permissions p ON p.id = rp.permission_id
      ${filtro}
      ORDER BY r.id, p.id`);

    const roles = new Map<number, Rol>();
    for (const fila of resultado.recordset) {
      const rol = roles.get(fila.id) ?? { id: fila.id, nombre: fila.name, permisos: [] };
      if (fila.permission) rol.permisos.push(fila.permission);
      roles.set(fila.id, rol);
    }
    return [...roles.values()];
  }

  listarRoles() {
    return this.roles("");
  }

  async buscarRolPorNombre(nombre: string) {
    const [rol] = await this.roles("WHERE r.name = @nombre", nombre);
    return rol ?? null;
  }
}
