import { readFileSync } from "node:fs";
import pg from "pg";
import { normalizarCorreo } from "../domain/dominio.js";
import type { EstadoUsuario, Rol, Usuario } from "../domain/tipos.js";
import { ErrorCorreoDuplicado, type NuevoUsuario, type RepositorioUsuarios } from "./repositorio.js";

export interface ConexionSql {
  servidor: string;
  baseDatos: string;
  usuario: string;
  contrasena: string;
  /** Solo para un PostgreSQL local con certificado autofirmado. */
  confiarCertificado?: boolean;
  /** Archivo con el certificado de la autoridad que firma el del servidor. */
  certificadoCa?: string;
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

// Código de PostgreSQL para violación de restricción o índice único.
const ERROR_DUPLICADO = "23505";

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

// Repositorio sobre PostgreSQL (Supabase). Todas las consultas usan parámetros.
// DB_CA_CERT puede ser la ruta del archivo o el certificado mismo; en Vercel el archivo no viaja con la función.
function leerCertificado(valor: string): string {
  return valor.includes("BEGIN CERTIFICATE") ? valor.replace(/\\n/g, "\n") : readFileSync(valor, "utf8");
}

export class RepositorioSql implements RepositorioUsuarios {
  private constructor(readonly pool: pg.Pool) {}

  static async conectar(conexion: ConexionSql): Promise<RepositorioSql> {
    const pool = new pg.Pool({
      host: conexion.servidor,
      port: conexion.puerto,
      database: conexion.baseDatos,
      user: conexion.usuario,
      password: conexion.contrasena,
      ssl: {
        rejectUnauthorized: !(conexion.confiarCertificado ?? false),
        ...(conexion.certificadoCa ? { ca: leerCertificado(conexion.certificadoCa) } : {}),
      },
    });
    // Una conexión en reposo que el servidor cierra no debe tumbar el proceso; el pool abre otra.
    pool.on("error", (error) => {
      console.error("Se perdió una conexión en reposo a la base de datos:", error.message);
    });
    // El pool conecta hasta la primera consulta; esta hace que unos datos de conexión malos fallen al arrancar.
    try {
      await pool.query("SELECT 1");
    } catch (error) {
      await pool.end();
      throw error;
    }
    return new RepositorioSql(pool);
  }

  async cerrar(): Promise<void> {
    await this.pool.end();
  }

  private async unUsuario(condicion: string, valor: unknown) {
    const resultado = await this.pool.query<FilaUsuario>(`${SELECT_USUARIO} WHERE ${condicion}`, [valor]);
    const fila = resultado.rows[0];
    return fila ? aUsuario(fila) : null;
  }

  async listarUsuarios() {
    const resultado = await this.pool.query<FilaUsuario>(`${SELECT_USUARIO} ORDER BY u.name`);
    return resultado.rows.map(aUsuario);
  }

  buscarPorId(id: number) {
    return this.unUsuario("u.id = $1", id);
  }

  async buscarPorCorreo(correo: string) {
    const usuario = await this.unUsuario("u.email = $1", correo);
    // La intercalación de la columna también iguala variantes de ancho (ａ = a). Para
    // identificar a alguien el correo debe ser el mismo, salvo por las mayúsculas.
    return usuario && normalizarCorreo(usuario.correo) === normalizarCorreo(correo) ? usuario : null;
  }

  buscarPorOid(oid: string) {
    return this.unUsuario("u.entra_oid = $1", oid);
  }

  async vincularOid(id: number, oid: string) {
    const resultado = await this.pool.query("UPDATE users SET entra_oid = $2 WHERE id = $1 AND entra_oid IS NULL", [id, oid]);
    return resultado.rowCount === 1;
  }

  async registrarAcceso(id: number) {
    await this.pool.query("UPDATE users SET last_login = now() WHERE id = $1", [id]);
  }

  async crearUsuario(datos: NuevoUsuario) {
    try {
      const resultado = await this.pool.query<{ id: number }>(
        "INSERT INTO users (name, email, role_id) VALUES ($1, $2, $3) RETURNING id",
        [datos.nombre, datos.correo, datos.rolId],
      );
      const usuario = await this.buscarPorId(resultado.rows[0]!.id);
      return usuario!;
    } catch (error) {
      if ((error as { code?: string }).code === ERROR_DUPLICADO) {
        throw new ErrorCorreoDuplicado(datos.correo);
      }
      throw error;
    }
  }

  async cambiarRol(id: number, rolId: number) {
    await this.pool.query("UPDATE users SET role_id = $2 WHERE id = $1", [id, rolId]);
    return this.buscarPorId(id);
  }

  async contarActivosConRol(rolId: number) {
    const resultado = await this.pool.query<{ total: number }>(
      "SELECT COUNT(*)::int AS total FROM users WHERE role_id = $1 AND status = 'active'",
      [rolId],
    );
    return resultado.rows[0]?.total ?? 0;
  }

  private async roles(filtro: string, nombre?: string): Promise<Rol[]> {
    const resultado = await this.pool.query<{ id: number; name: string; permission: string | null }>(
      `
      SELECT r.id, r.name, p.name AS permission
      FROM roles r
      LEFT JOIN role_permissions rp ON rp.role_id = r.id
      LEFT JOIN permissions p ON p.id = rp.permission_id
      ${filtro}
      ORDER BY r.id, p.id`,
      nombre === undefined ? [] : [nombre],
    );

    const roles = new Map<number, Rol>();
    for (const fila of resultado.rows) {
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
    const [rol] = await this.roles("WHERE r.name = $1", nombre);
    return rol ?? null;
  }
}
