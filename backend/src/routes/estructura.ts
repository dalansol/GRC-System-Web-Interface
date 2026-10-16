// Rutas Express para parametrización de estructura organizacional (SF-03).
// Endpoints para periodos fiscales, unidades de negocio y procesos.

import { Router } from "express";
import type { RegistrarEvento } from "../bitacora.js";
import {
  normalizarAltaProceso,
  normalizarAltaUnidad,
  validarAltaProceso,
  validarAltaUnidad,
  validarEdicionProceso,
  validarEdicionUnidad,
} from "../domain/estructura.js";
import { ROL_ADMINISTRADOR } from "../domain/tipos.js";
import { ErrorApi } from "../errores.js";
import { usuarioEnSesion } from "../middleware/autenticar.js";
import { autorizar } from "../middleware/autorizar.js";
import {
  ErrorAuditoriasActivas,
  ErrorNombreDuplicado,
  type RepositorioEstructura,
} from "../repos/estructura.js";
import type { RepositorioUsuarios } from "../repos/repositorio.js";

const ROL_JEFATURA = "Jefe de Auditoría";
const ROLES_GESTION = [ROL_ADMINISTRADOR, ROL_JEFATURA];

interface Dependencias {
  repo: RepositorioEstructura;
  usuarios: RepositorioUsuarios;
  registrarEvento: RegistrarEvento;
}

function campos(cuerpo: unknown): Record<string, unknown> {
  return typeof cuerpo === "object" && cuerpo !== null ? (cuerpo as Record<string, unknown>) : {};
}

function parseId(valor: unknown, entidad: string): number {
  const texto = String(valor);
  if (!/^[1-9]\d{0,8}$/.test(texto)) {
    throw new ErrorApi(400, "DATOS_INVALIDOS", `El identificador de ${entidad} no es válido.`);
  }
  return Number(texto);
}

export function rutasEstructura({ repo, usuarios, registrarEvento }: Dependencias): Router {
  const rutas = Router();

  // ── Periodos Fiscales ────────────────────────────────────────────────────────

  rutas.get("/periodos/activo", async (_req, res) => {
    const periodo = await repo.obtenerPeriodoActivo();
    if (!periodo) {
      throw new ErrorApi(404, "NO_ENCONTRADO", "No hay ningún periodo de auditoría activo configurado.");
    }
    res.json(periodo);
  });

  rutas.get("/periodos", async (_req, res) => {
    const periodos = await repo.listarPeriodos();
    res.json(periodos);
  });

  // ── Unidades de Negocio ──────────────────────────────────────────────────────

  rutas.get("/unidades-negocio", async (_req, res) => {
    const unidades = await repo.listarUnidades();
    res.json(unidades);
  });

  rutas.get("/unidades-negocio/responsables", autorizar(...ROLES_GESTION), async (_req, res) => {
    const todos = await usuarios.listarUsuarios();
    const activos = todos.filter((u) => u.estado === "active");
    res.json(activos.map(({ id, nombre, correo, rol }) => ({ id, nombre, correo, rol })));
  });

  rutas.get("/unidades-negocio/:id", async (req, res) => {
    const id = parseId(req.params.id, "la unidad de negocio");
    const unidad = await repo.buscarUnidadPorId(id);
    if (!unidad) {
      throw new ErrorApi(404, "NO_ENCONTRADO", "La unidad de negocio no existe.");
    }
    res.json(unidad);
  });

  rutas.post("/unidades-negocio", autorizar(...ROLES_GESTION), async (req, res) => {
    const cuerpo = campos(req.body);
    const errorValidacion = validarAltaUnidad(cuerpo);
    if (errorValidacion) {
      throw new ErrorApi(400, "DATOS_INVALIDOS", errorValidacion);
    }

    const responsable = await usuarios.buscarPorId(Number(cuerpo.responsableId));
    if (!responsable || responsable.estado !== "active") {
      throw new ErrorApi(400, "DATOS_INVALIDOS", "El gerente responsable no existe o está inactivo.");
    }

    const periodoActivo = await repo.obtenerPeriodoActivo();
    if (!periodoActivo) {
      throw new ErrorApi(
        400,
        "PERIODO_ACTIVO_NO_CONFIGURADO",
        "No hay un periodo de auditoría activo configurado.",
      );
    }

    const datos = normalizarAltaUnidad(cuerpo);
    const usuarioActual = usuarioEnSesion(res);

    try {
      const nuevaUnidad = await repo.crearUnidadConProceso(datos, periodoActivo.id, usuarioActual.id);

      registrarEvento({
        accion: "unidad_negocio.alta",
        actor: usuarioActual.correo,
        detalle: {
          unidadId: nuevaUnidad.id,
          nombre: nuevaUnidad.nombre,
          periodoId: periodoActivo.id,
          responsableId: nuevaUnidad.responsableId,
        },
      });

      res.status(201).json(nuevaUnidad);
    } catch (error) {
      if (error instanceof ErrorNombreDuplicado) {
        throw new ErrorApi(409, "NOMBRE_DUPLICADO", error.message);
      }
      throw error;
    }
  });

  rutas.patch("/unidades-negocio/:id", autorizar(...ROLES_GESTION), async (req, res) => {
    const id = parseId(req.params.id, "la unidad de negocio");
    const cuerpo = campos(req.body);
    const errorValidacion = validarEdicionUnidad(cuerpo);
    if (errorValidacion) {
      throw new ErrorApi(400, "DATOS_INVALIDOS", errorValidacion);
    }

    if (cuerpo.responsableId !== undefined) {
      const resp = await usuarios.buscarPorId(Number(cuerpo.responsableId));
      if (!resp || resp.estado !== "active") {
        throw new ErrorApi(400, "DATOS_INVALIDOS", "El gerente responsable no existe o está inactivo.");
      }
    }

    const datosEdicion: { nombre?: string; responsableId?: number } = {};
    if (cuerpo.nombre !== undefined) datosEdicion.nombre = (cuerpo.nombre as string).trim();
    if (cuerpo.responsableId !== undefined) datosEdicion.responsableId = Number(cuerpo.responsableId);

    try {
      const unidadActualizada = await repo.editarUnidad(id, datosEdicion);
      if (!unidadActualizada) {
        throw new ErrorApi(404, "NO_ENCONTRADO", "La unidad de negocio no existe.");
      }

      const usuarioActual = usuarioEnSesion(res);
      registrarEvento({
        accion: "unidad_negocio.edicion",
        actor: usuarioActual.correo,
        detalle: { unidadId: id, campos: Object.keys(datosEdicion) },
      });

      res.json(unidadActualizada);
    } catch (error) {
      if (error instanceof ErrorNombreDuplicado) {
        throw new ErrorApi(409, "NOMBRE_DUPLICADO", error.message);
      }
      throw error;
    }
  });

  rutas.delete("/unidades-negocio/:id", autorizar(...ROLES_GESTION), async (req, res) => {
    const id = parseId(req.params.id, "la unidad de negocio");
    const unidad = await repo.buscarUnidadPorId(id);
    if (!unidad) {
      throw new ErrorApi(404, "NO_ENCONTRADO", "La unidad de negocio no existe.");
    }

    const tieneAuditorias = await repo.tieneAuditoriasActivas(id);
    if (tieneAuditorias) {
      throw new ErrorApi(
        409,
        "AUDITORIAS_ACTIVAS",
        "No se puede eliminar la unidad de negocio porque tiene auditorías activas asociadas.",
      );
    }

    await repo.eliminarUnidad(id);

    const usuarioActual = usuarioEnSesion(res);
    registrarEvento({
      accion: "unidad_negocio.baja",
      actor: usuarioActual.correo,
      detalle: { unidadId: id, nombre: unidad.nombre },
    });

    res.status(204).end();
  });

  // ── Procesos ─────────────────────────────────────────────────────────────────

  rutas.post("/procesos", autorizar(...ROLES_GESTION), async (req, res) => {
    const cuerpo = campos(req.body);
    const errorValidacion = validarAltaProceso(cuerpo);
    if (errorValidacion) {
      throw new ErrorApi(400, "DATOS_INVALIDOS", errorValidacion);
    }

    const unidad = await repo.buscarUnidadPorId(Number(cuerpo.unidadNegocioId));
    if (!unidad) {
      throw new ErrorApi(404, "NO_ENCONTRADO", "La unidad de negocio especificada no existe.");
    }

    const datos = normalizarAltaProceso(cuerpo);
    try {
      const proceso = await repo.crearProceso(datos);

      const usuarioActual = usuarioEnSesion(res);
      registrarEvento({
        accion: "proceso.alta",
        actor: usuarioActual.correo,
        detalle: { procesoId: proceso.id, nombre: proceso.nombre, unidadNegocioId: proceso.unidadNegocioId },
      });

      res.status(201).json(proceso);
    } catch (error) {
      if (error instanceof ErrorNombreDuplicado) {
        throw new ErrorApi(409, "NOMBRE_DUPLICADO", error.message);
      }
      throw error;
    }
  });

  rutas.patch("/procesos/:id", autorizar(...ROLES_GESTION), async (req, res) => {
    const id = parseId(req.params.id, "el proceso");
    const cuerpo = campos(req.body);
    const errorValidacion = validarEdicionProceso(cuerpo);
    if (errorValidacion) {
      throw new ErrorApi(400, "DATOS_INVALIDOS", errorValidacion);
    }

    const nuevoNombre = (cuerpo.nombre as string).trim();
    try {
      const procesoActualizado = await repo.editarProceso(id, nuevoNombre);
      if (!procesoActualizado) {
        throw new ErrorApi(404, "NO_ENCONTRADO", "El proceso no existe.");
      }

      const usuarioActual = usuarioEnSesion(res);
      registrarEvento({
        accion: "proceso.edicion",
        actor: usuarioActual.correo,
        detalle: { procesoId: id, nuevoNombre },
      });

      res.json(procesoActualizado);
    } catch (error) {
      if (error instanceof ErrorNombreDuplicado) {
        throw new ErrorApi(409, "NOMBRE_DUPLICADO", error.message);
      }
      throw error;
    }
  });

  rutas.delete("/procesos/:id", autorizar(...ROLES_GESTION), async (req, res) => {
    const id = parseId(req.params.id, "el proceso");

    const unidades = await repo.listarUnidades();
    const proceso = unidades.flatMap((unidad) => unidad.procesos).find((item) => item.id === id);
    if (!proceso) {
      throw new ErrorApi(404, "NO_ENCONTRADO", "El proceso no existe.");
    }

    const tieneAuditorias = await repo.tieneAuditoriasActivasProceso(id);
    if (tieneAuditorias) {
      throw new ErrorApi(
        409,
        "AUDITORIAS_ACTIVAS",
        "No se puede eliminar el proceso porque tiene auditorías activas asociadas.",
      );
    }

    await repo.eliminarProceso(id);

    const usuarioActual = usuarioEnSesion(res);
    registrarEvento({
      accion: "proceso.baja",
      actor: usuarioActual.correo,
      detalle: { procesoId: id, nombre: proceso.nombre },
    });

    res.status(204).end();
  });

  return rutas;
}
