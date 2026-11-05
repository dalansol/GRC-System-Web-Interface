import { Router } from "express";
import { ErrorApi } from "../errores.js";
import { usuarioEnSesion } from "../middleware/autenticar.js";
import type { RepositorioNotificaciones } from "../repos/notificaciones.js";

// Notificaciones del usuario en sesión. Nadie consulta ni modifica las de otro usuario.
export function rutasNotificaciones({ repo }: { repo: RepositorioNotificaciones }): Router {
  const rutas = Router();

  rutas.get("/notificaciones", async (_req, res) => {
    const items = await repo.listarNotificaciones(usuarioEnSesion(res).id);
    res.json({ noLeidas: items.filter((aviso) => !aviso.leida).length, items });
  });

  rutas.post("/notificaciones/leidas", async (_req, res) => {
    await repo.marcarTodasLeidas(usuarioEnSesion(res).id);
    res.status(204).end();
  });

  rutas.post("/notificaciones/:id/leida", async (req, res) => {
    const id = Number(req.params.id);
    const marcada = Number.isInteger(id) && id > 0 && (await repo.marcarNotificacionLeida(id, usuarioEnSesion(res).id));
    if (!marcada) throw new ErrorApi(404, "NO_ENCONTRADO", "La notificación no existe.");
    res.status(204).end();
  });

  return rutas;
}
