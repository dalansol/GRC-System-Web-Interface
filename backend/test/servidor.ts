import { createServer, type RequestListener, type Server } from "node:http";
import { afterEach } from "vitest";

// supertest abre su servidor en "::" y se conecta a 127.0.0.1. En macOS otro
// programa puede estar escuchando en 127.0.0.1 con ese mismo puerto, y la
// petición le llega a él (respuestas ajenas, 404 o tiempo agotado). Abrir el
// servidor directamente en 127.0.0.1 reserva el puerto de verdad.
const abiertos: Server[] = [];

afterEach(async () => {
  await Promise.all(
    abiertos.splice(0).map(
      (servidor) =>
        new Promise<void>((listo) => {
          servidor.closeAllConnections();
          servidor.close(() => listo());
        }),
    ),
  );
});

/** Pone la app a escuchar en 127.0.0.1 y la cierra al terminar la prueba. */
export async function escuchar(app: RequestListener): Promise<Server> {
  const servidor = createServer(app);
  abiertos.push(servidor);
  await new Promise<void>((listo, fallo) => {
    servidor.once("error", fallo);
    servidor.listen(0, "127.0.0.1", () => listo());
  });
  return servidor;
}
