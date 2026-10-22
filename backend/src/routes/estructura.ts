// Rutas Express para parametrización de estructura organizacional (SF-03).
// Periodos de auditoría, departamentos, unidades de negocio y su jerarquía
// (división → subdivisión → área). Consultan todos los usuarios con sesión;
// escriben Administrador y Jefe de Auditoría.

import { Router } from "express";
import type { RegistrarEvento } from "../bitacora.js";
import {
  NIVEL_PADRE,
  normalizarAltaNodo,
  normalizarAltaUnidad,
  normalizarEdicionNodo,
  normalizarEdicionUnidad,
  normalizarPeriodo,
  validarAltaNodo,
  validarAltaPeriodo,
  validarAltaUnidad,
  validarEdicionNodo,
  validarEdicionPeriodo,
  validarEdicionUnidad,
  type AltaPeriodoInput,
  type NivelEstructura,
  type NivelNodo,
} from "../domain/estructura.js";
import { ROL_ADMINISTRADOR } from "../domain/tipos.js";
import { ErrorApi } from "../errores.js";
import { usuarioEnSesion } from "../middleware/autenticar.js";
import { autorizar } from "../middleware/autorizar.js";
import { ErrorNombreDuplicado, type RepositorioEstructura } from "../repos/estructura.js";
import type { RepositorioUsuarios } from "../repos/repositorio.js";

const ROL_JEFATURA = "Jefe de Auditoría";
const ROLES_GESTION = [ROL_ADMINISTRADOR, ROL_JEFATURA];

/** Ruta y textos de cada nivel. */
const NIVELES: Record<NivelEstructura, { ruta: string; etiqueta: string; articulo: string }> = {
  unidad: { ruta: "unidades-negocio", etiqueta: "unidad de negocio", articulo: "la" },
  division: { ruta: "divisiones", etiqueta: "división", articulo: "la" },
  subdivision: { ruta: "subdivisiones", etiqueta: "subdivisión", articulo: "la" },
  area: { ruta: "areas", etiqueta: "área", articulo: "el" },
};

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

function noEncontrado(nivel: NivelEstructura): ErrorApi {
  const { articulo, etiqueta } = NIVELES[nivel];
  return new ErrorApi(404, "NO_ENCONTRADO", `${articulo === "la" ? "La" : "El"} ${etiqueta} no existe.`);
}

/** Traduce el error de nombre duplicado (periodos) del repositorio a 409. */
async function sinDuplicados<T>(trabajo: () => Promise<T>): Promise<T> {
  try {
    return await trabajo();
  } catch (error) {
    if (error instanceof ErrorNombreDuplicado) throw new ErrorApi(409, "NOMBRE_DUPLICADO", error.message);
    throw error;
  }
}

export function rutasEstructura({ repo, usuarios, registrarEvento }: Dependencias): Router {
  const rutas = Router();

  /** El gerente responsable debe ser un usuario activo con rol Jefe de Auditoría. */
  async function validarGerente(id: number): Promise<void> {
    const gerente = await usuarios.buscarPorId(id);
    if (!gerente || gerente.estado !== "active" || gerente.rol !== ROL_JEFATURA) {
      throw new ErrorApi(400, "DATOS_INVALIDOS", "El gerente responsable debe ser un Jefe de Auditoría activo.");
    }
  }

  async function validarDepartamento(id: number | null | undefined): Promise<void> {
    if (id === null || id === undefined) return;
    const departamentos = await repo.listarDepartamentos();
    if (!departamentos.some((d) => d.id === id)) {
      throw new ErrorApi(400, "DATOS_INVALIDOS", "El departamento de auditoría no existe.");
    }
  }

  async function existe(nivel: NivelEstructura, id: number): Promise<boolean> {
    return nivel === "unidad" ? (await repo.buscarUnidadPorId(id)) !== null : (await repo.buscarNodo(nivel, id)) !== null;
  }

  /** AC3: no se borra con auditorías activas en la rama, ni con hijos (no se borra en cascada). */
  async function validarBorrado(nivel: NivelEstructura, id: number): Promise<void> {
    const { articulo, etiqueta } = NIVELES[nivel];
    if (await repo.tieneAuditoriasActivas(nivel, id)) {
      throw new ErrorApi(
        409,
        "AUDITORIAS_ACTIVAS",
        `No se puede eliminar ${articulo} ${etiqueta} mientras existan auditorías activas asociadas.`,
      );
    }
    if (await repo.tieneHijos(nivel, id)) {
      throw new ErrorApi(
        409,
        "HIJOS_EXISTENTES",
        `No se puede eliminar ${articulo} ${etiqueta} porque tiene elementos dependientes (niveles inferiores o riesgos registrados). Elimínalos primero.`,
      );
    }
  }

  // ── Periodos de auditoría ───────────────────────────────────────────────────

  rutas.get("/periodos/activo", async (_req, res) => {
    const periodo = await repo.obtenerPeriodoActivo();
    if (!periodo) {
      throw new ErrorApi(404, "NO_ENCONTRADO", "No hay ningún periodo de auditoría activo configurado.");
    }
    res.json(periodo);
  });

  rutas.get("/periodos", async (_req, res) => {
    res.json(await repo.listarPeriodos());
  });

  rutas.post("/periodos", autorizar(...ROLES_GESTION), async (req, res) => {
    const cuerpo = campos(req.body);
    const error = validarAltaPeriodo(cuerpo);
    if (error) throw new ErrorApi(400, "DATOS_INVALIDOS", error);

    const datos = { activo: false, ...normalizarPeriodo(cuerpo) } as AltaPeriodoInput;
    const periodo = await sinDuplicados(() => repo.crearPeriodo(datos));
    registrarEvento({
      accion: "periodo.alta",
      actor: usuarioEnSesion(res).correo,
      detalle: { periodoId: periodo.id, nombre: periodo.nombre, activo: periodo.activo },
    });
    res.status(201).json(periodo);
  });

  rutas.patch("/periodos/:id", autorizar(...ROLES_GESTION), async (req, res) => {
    const id = parseId(req.params.id, "el periodo");
    const actual = await repo.buscarPeriodoPorId(id);
    if (!actual) throw new ErrorApi(404, "NO_ENCONTRADO", "El periodo no existe.");

    const cuerpo = campos(req.body);
    const error = validarEdicionPeriodo(cuerpo, actual);
    if (error) throw new ErrorApi(400, "DATOS_INVALIDOS", error);

    const datos = normalizarPeriodo(cuerpo);
    const periodo = (await sinDuplicados(() => repo.editarPeriodo(id, datos)))!;
    registrarEvento({
      accion: "periodo.edicion",
      actor: usuarioEnSesion(res).correo,
      detalle: { periodoId: id, campos: Object.keys(datos) },
    });
    res.json(periodo);
  });

  rutas.get("/departamentos-auditoria", async (_req, res) => {
    res.json(await repo.listarDepartamentos());
  });

  // ── Unidades de negocio ─────────────────────────────────────────────────────

  rutas.get("/unidades-negocio", async (_req, res) => {
    res.json(await repo.listarUnidades());
  });

  rutas.get("/unidades-negocio/responsables", autorizar(...ROLES_GESTION), async (_req, res) => {
    const todos = await usuarios.listarUsuarios();
    const jefes = todos.filter((u) => u.estado === "active" && u.rol === ROL_JEFATURA);
    res.json(jefes.map(({ id, nombre, correo, rol }) => ({ id, nombre, correo, rol })));
  });

  rutas.get("/unidades-negocio/:id", async (req, res) => {
    const id = parseId(req.params.id, "la unidad de negocio");
    const unidad = await repo.buscarUnidadPorId(id);
    if (!unidad) throw noEncontrado("unidad");
    res.json(unidad);
  });

  rutas.post("/unidades-negocio", autorizar(...ROLES_GESTION), async (req, res) => {
    const cuerpo = campos(req.body);
    const error = validarAltaUnidad(cuerpo);
    if (error) throw new ErrorApi(400, "DATOS_INVALIDOS", error);

    const datos = normalizarAltaUnidad(cuerpo);
    await validarGerente(datos.responsableId);
    await validarDepartamento(datos.departamentoAuditoriaId);

    const periodoActivo = await repo.obtenerPeriodoActivo();
    if (!periodoActivo) {
      throw new ErrorApi(
        409,
        "PERIODO_ACTIVO_NO_CONFIGURADO",
        "No hay un periodo de auditoría activo configurado. Activa uno antes de dar de alta unidades.",
      );
    }

    const usuarioActual = usuarioEnSesion(res);
    const unidad = await sinDuplicados(() => repo.crearUnidad(datos, periodoActivo.id, usuarioActual.id));
    registrarEvento({
      accion: "estructura.alta",
      actor: usuarioActual.correo,
      detalle: {
        nivel: "unidad",
        id: unidad.id,
        codigo: unidad.codigo,
        nombre: unidad.nombre,
        periodoId: periodoActivo.id,
        responsableId: unidad.responsableId,
      },
    });
    res.status(201).json(unidad);
  });

  rutas.patch("/unidades-negocio/:id", autorizar(...ROLES_GESTION), async (req, res) => {
    const id = parseId(req.params.id, "la unidad de negocio");
    const cuerpo = campos(req.body);
    const error = validarEdicionUnidad(cuerpo);
    if (error) throw new ErrorApi(400, "DATOS_INVALIDOS", error);

    const datos = normalizarEdicionUnidad(cuerpo);
    if (datos.responsableId !== undefined) await validarGerente(datos.responsableId);
    await validarDepartamento(datos.departamentoAuditoriaId);

    const unidad = await repo.editarUnidad(id, datos);
    if (!unidad) throw noEncontrado("unidad");
    registrarEvento({
      accion: "estructura.edicion",
      actor: usuarioEnSesion(res).correo,
      detalle: { nivel: "unidad", id, campos: Object.keys(datos) },
    });
    res.json(unidad);
  });

  rutas.delete("/unidades-negocio/:id", autorizar(...ROLES_GESTION), async (req, res) => {
    const id = parseId(req.params.id, "la unidad de negocio");
    const unidad = await repo.buscarUnidadPorId(id);
    if (!unidad) throw noEncontrado("unidad");

    await validarBorrado("unidad", id);
    await repo.eliminarUnidad(id);
    registrarEvento({
      accion: "estructura.baja",
      actor: usuarioEnSesion(res).correo,
      detalle: { nivel: "unidad", id, codigo: unidad.codigo, nombre: unidad.nombre },
    });
    res.status(204).end();
  });

  // ── División, subdivisión y área ────────────────────────────────────────────
  // El repositorio asigna el código de división y subdivisión; los nombres se repiten
  // legítimamente entre ramas.

  for (const nivel of ["division", "subdivision", "area"] as NivelNodo[]) {
    const { ruta, articulo, etiqueta } = NIVELES[nivel];
    const entidad = `${articulo} ${etiqueta}`;

    rutas.post(`/${ruta}`, autorizar(...ROLES_GESTION), async (req, res) => {
      const cuerpo = campos(req.body);
      const error = validarAltaNodo(nivel, cuerpo);
      if (error) throw new ErrorApi(400, "DATOS_INVALIDOS", error);

      const datos = normalizarAltaNodo(nivel, cuerpo);
      if (!(await existe(NIVEL_PADRE[nivel], datos.padreId))) throw noEncontrado(NIVEL_PADRE[nivel]);

      const nodo = await repo.crearNodo(nivel, datos);
      registrarEvento({
        accion: "estructura.alta",
        actor: usuarioEnSesion(res).correo,
        detalle: { nivel, id: nodo.id, codigo: nodo.codigo, nombre: nodo.nombre, padreId: nodo.padreId },
      });
      res.status(201).json(nodo);
    });

    rutas.patch(`/${ruta}/:id`, autorizar(...ROLES_GESTION), async (req, res) => {
      const id = parseId(req.params.id, entidad);
      const cuerpo = campos(req.body);
      const error = validarEdicionNodo(nivel, cuerpo);
      if (error) throw new ErrorApi(400, "DATOS_INVALIDOS", error);

      const datos = normalizarEdicionNodo(nivel, cuerpo);
      const nodo = await repo.editarNodo(nivel, id, datos);
      if (!nodo) throw noEncontrado(nivel);
      registrarEvento({
        accion: "estructura.edicion",
        actor: usuarioEnSesion(res).correo,
        detalle: { nivel, id, campos: Object.keys(datos) },
      });
      res.json(nodo);
    });

    rutas.delete(`/${ruta}/:id`, autorizar(...ROLES_GESTION), async (req, res) => {
      const id = parseId(req.params.id, entidad);
      const nodo = await repo.buscarNodo(nivel, id);
      if (!nodo) throw noEncontrado(nivel);

      await validarBorrado(nivel, id);
      await repo.eliminarNodo(nivel, id);
      registrarEvento({
        accion: "estructura.baja",
        actor: usuarioEnSesion(res).correo,
        detalle: { nivel, id, codigo: nodo.codigo, nombre: nodo.nombre },
      });
      res.status(204).end();
    });
  }

  return rutas;
}
