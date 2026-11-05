// Rutas Express de los catálogos de la estructura organizacional (SF-03).
// Opciones de nombre de área y de país o región: las consultan todos los usuarios con sesión
// (formularios del Catálogo) y solo el Administrador las edita desde Ajustes (SF-16, SF-17).
// Renombrar propaga el cambio a la estructura; no se borra una opción en uso.

import { Router } from "express";
import type { RegistrarEvento } from "../bitacora.js";
import { esTipoCatalogo, validarValorOpcion, type TipoCatalogo } from "../domain/catalogos.js";
import { ROL_ADMINISTRADOR } from "../domain/tipos.js";
import { ErrorApi } from "../errores.js";
import { usuarioEnSesion } from "../middleware/autenticar.js";
import { autorizar } from "../middleware/autorizar.js";
import { ErrorOpcionEnUso, type RepositorioCatalogos } from "../repos/catalogos.js";
import { ErrorNombreDuplicado } from "../repos/estructura.js";

interface Dependencias {
  repo: RepositorioCatalogos;
  registrarEvento: RegistrarEvento;
}

function parseTipo(valor: unknown): TipoCatalogo {
  if (!esTipoCatalogo(valor)) throw new ErrorApi(404, "NO_ENCONTRADO", "El catálogo no existe.");
  return valor;
}

function parseId(valor: unknown): number {
  const texto = String(valor);
  if (!/^[1-9]\d{0,8}$/.test(texto)) {
    throw new ErrorApi(400, "DATOS_INVALIDOS", "El identificador de la opción no es válido.");
  }
  return Number(texto);
}

function leerValor(tipo: TipoCatalogo, cuerpo: unknown): string {
  const valor = typeof cuerpo === "object" && cuerpo !== null ? (cuerpo as Record<string, unknown>).valor : undefined;
  const error = validarValorOpcion(tipo, valor);
  if (error) throw new ErrorApi(400, "DATOS_INVALIDOS", error);
  return (valor as string).trim();
}

async function traducirErrores<T>(trabajo: () => Promise<T>): Promise<T> {
  try {
    return await trabajo();
  } catch (error) {
    if (error instanceof ErrorNombreDuplicado) throw new ErrorApi(409, "NOMBRE_DUPLICADO", error.message);
    if (error instanceof ErrorOpcionEnUso) throw new ErrorApi(409, "OPCION_EN_USO", error.message);
    throw error;
  }
}

export function rutasCatalogos({ repo, registrarEvento }: Dependencias): Router {
  const rutas = Router();

  rutas.get("/catalogos/:tipo", async (req, res) => {
    res.json(await repo.listar(parseTipo(req.params.tipo)));
  });

  rutas.post("/catalogos/:tipo", autorizar(ROL_ADMINISTRADOR), async (req, res) => {
    const tipo = parseTipo(req.params.tipo);
    const valor = leerValor(tipo, req.body);
    const opcion = await traducirErrores(() => repo.crear(tipo, valor));
    registrarEvento({
      accion: "catalogo.alta",
      actor: usuarioEnSesion(res).correo,
      detalle: { catalogo: tipo, id: opcion.id, valor: opcion.valor },
    });
    res.status(201).json(opcion);
  });

  rutas.patch("/catalogos/:tipo/:id", autorizar(ROL_ADMINISTRADOR), async (req, res) => {
    const tipo = parseTipo(req.params.tipo);
    const id = parseId(req.params.id);
    const valor = leerValor(tipo, req.body);
    const resultado = await traducirErrores(() => repo.renombrar(tipo, id, valor));
    if (!resultado) throw new ErrorApi(404, "NO_ENCONTRADO", "La opción no existe.");
    registrarEvento({
      accion: "catalogo.edicion",
      actor: usuarioEnSesion(res).correo,
      detalle: {
        catalogo: tipo,
        id,
        anterior: resultado.anterior,
        valor: resultado.opcion.valor,
        registrosActualizados: resultado.opcion.usos,
      },
    });
    res.json(resultado.opcion);
  });

  rutas.delete("/catalogos/:tipo/:id", autorizar(ROL_ADMINISTRADOR), async (req, res) => {
    const tipo = parseTipo(req.params.tipo);
    const id = parseId(req.params.id);
    const opcion = await repo.buscarPorId(tipo, id);
    if (!opcion) throw new ErrorApi(404, "NO_ENCONTRADO", "La opción no existe.");
    await traducirErrores(() => repo.eliminar(tipo, id));
    registrarEvento({
      accion: "catalogo.baja",
      actor: usuarioEnSesion(res).correo,
      detalle: { catalogo: tipo, id, valor: opcion.valor },
    });
    res.status(204).end();
  });

  return rutas;
}
