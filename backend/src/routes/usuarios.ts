import { Router } from "express";
import type { RegistrarEvento } from "../bitacora.js";
import { correoValido, dominioPermitido, normalizarCorreo } from "../domain/dominio.js";
import { ROL_ADMINISTRADOR, type Rol } from "../domain/tipos.js";
import { ErrorApi } from "../errores.js";
import { usuarioEnSesion } from "../middleware/autenticar.js";
import { autorizar } from "../middleware/autorizar.js";
import { ErrorCorreoDuplicado, type RepositorioUsuarios } from "../repos/repositorio.js";

const LARGO_MAXIMO_NOMBRE = 150;
const LARGO_MAXIMO_CORREO = 254;
const ID_MAXIMO = 2_147_483_647;

interface Dependencias {
  repo: RepositorioUsuarios;
  dominiosPermitidos: readonly string[];
  registrarEvento: RegistrarEvento;
}

function invalido(mensaje: string): ErrorApi {
  return new ErrorApi(400, "DATOS_INVALIDOS", mensaje);
}

function campos(cuerpo: unknown): Record<string, unknown> {
  return typeof cuerpo === "object" && cuerpo !== null ? (cuerpo as Record<string, unknown>) : {};
}

export function rutasUsuarios({ repo, dominiosPermitidos, registrarEvento }: Dependencias): Router {
  const rutas = Router();

  async function rolSolicitado(valor: unknown): Promise<Rol> {
    const rol = typeof valor === "string" ? await repo.buscarRolPorNombre(valor) : null;
    if (!rol) throw invalido("El rol indicado no existe.");
    return rol;
  }

  rutas.get("/me", async (_req, res) => {
    const usuario = usuarioEnSesion(res);
    await repo.registrarAcceso(usuario.id);
    res.json(usuario);
  });

  rutas.get("/roles", async (_req, res) => {
    res.json(await repo.listarRoles());
  });

  rutas.get("/usuarios", autorizar(ROL_ADMINISTRADOR), async (_req, res) => {
    res.json(await repo.listarUsuarios());
  });

  rutas.post("/usuarios", autorizar(ROL_ADMINISTRADOR), async (req, res) => {
    const cuerpo = campos(req.body);

    const nombre = typeof cuerpo.nombre === "string" ? cuerpo.nombre.trim() : "";
    if (!nombre || nombre.length > LARGO_MAXIMO_NOMBRE) {
      throw invalido(`El nombre completo es obligatorio y admite hasta ${LARGO_MAXIMO_NOMBRE} caracteres.`);
    }

    const correo = typeof cuerpo.correo === "string" ? normalizarCorreo(cuerpo.correo) : "";
    if (!correoValido(correo) || correo.length > LARGO_MAXIMO_CORREO) {
      throw invalido("El correo no tiene un formato válido.");
    }
    if (!dominioPermitido(correo, dominiosPermitidos)) {
      throw new ErrorApi(
        422,
        "DOMINIO_NO_AUTORIZADO",
        `El correo no pertenece al dominio corporativo autorizado (${dominiosPermitidos.map((d) => `@${d}`).join(", ")}).`,
      );
    }

    const rol = await rolSolicitado(cuerpo.rol);

    try {
      const usuario = await repo.crearUsuario({ nombre, correo, rolId: rol.id });
      registrarEvento({
        accion: "usuario.alta",
        actor: usuarioEnSesion(res).correo,
        detalle: { usuarioId: usuario.id, correo: usuario.correo, rol: usuario.rol },
      });
      res.status(201).json(usuario);
    } catch (error) {
      if (error instanceof ErrorCorreoDuplicado) {
        throw new ErrorApi(409, "CORREO_DUPLICADO", "Ya existe un usuario con ese correo.");
      }
      throw error;
    }
  });

  rutas.patch("/usuarios/:id/rol", autorizar(ROL_ADMINISTRADOR), async (req, res) => {
    const textoId = String(req.params.id);
    const id = Number(textoId);
    if (!/^[1-9]\d*$/.test(textoId) || id > ID_MAXIMO) {
      throw invalido("El identificador de usuario no es válido.");
    }

    const rolNuevo = await rolSolicitado(campos(req.body).rol);

    const actual = await repo.buscarPorId(id);
    if (!actual) throw new ErrorApi(404, "NO_ENCONTRADO", "El usuario no existe.");

    if (actual.rol === ROL_ADMINISTRADOR && rolNuevo.nombre !== ROL_ADMINISTRADOR && actual.estado === "active") {
      const administrador = await repo.buscarRolPorNombre(ROL_ADMINISTRADOR);
      if (administrador && (await repo.contarActivosConRol(administrador.id)) <= 1) {
        throw new ErrorApi(
          409,
          "ULTIMO_ADMINISTRADOR",
          "No se puede cambiar el rol del único Administrador activo.",
        );
      }
    }

    const actualizado = await repo.cambiarRol(id, rolNuevo.id);
    if (!actualizado) throw new ErrorApi(404, "NO_ENCONTRADO", "El usuario no existe.");

    if (actual.rol !== actualizado.rol) {
      registrarEvento({
        accion: "usuario.cambio_rol",
        actor: usuarioEnSesion(res).correo,
        detalle: { usuarioId: id, rolAnterior: actual.rol, rolNuevo: actualizado.rol },
      });
    }
    res.json({ ...actualizado, permisos: rolNuevo.permisos });
  });

  return rutas;
}
