import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configurarCredenciales, ErrorApi, pedir } from "./cliente";

const respuesta = (status: number, cuerpo: unknown) =>
  new Response(typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo), { status });

const fetchFalso = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchFalso);
  configurarCredenciales(async () => ({ Authorization: "Bearer token-de-prueba" }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchFalso.mockReset();
});

describe("pedir", () => {
  it("envía las credenciales de la sesión en cada petición", async () => {
    fetchFalso.mockResolvedValue(respuesta(200, [{ id: 1 }]));

    const datos = await pedir("/api/usuarios");

    expect(datos).toEqual([{ id: 1 }]);
    expect(fetchFalso).toHaveBeenCalledWith("http://localhost:3001/api/usuarios", {
      method: "GET",
      headers: { Authorization: "Bearer token-de-prueba" },
      body: undefined,
    });
  });

  it("envía el cuerpo como JSON", async () => {
    fetchFalso.mockResolvedValue(respuesta(201, { id: 4 }));

    await pedir("/api/usuarios", { metodo: "POST", cuerpo: { nombre: "Luis Peña" } });

    expect(fetchFalso).toHaveBeenCalledWith("http://localhost:3001/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer token-de-prueba" },
      body: '{"nombre":"Luis Peña"}',
    });
  });

  it("convierte el error del servidor en ErrorApi con su código y mensaje", async () => {
    fetchFalso.mockResolvedValue(
      respuesta(422, { error: { codigo: "DOMINIO_NO_AUTORIZADO", mensaje: "El correo no pertenece al dominio corporativo autorizado (@expedite.com)." } }),
    );

    const error = await pedir("/api/usuarios", { metodo: "POST", cuerpo: {} }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ErrorApi);
    expect(error).toMatchObject({
      status: 422,
      codigo: "DOMINIO_NO_AUTORIZADO",
      message: "El correo no pertenece al dominio corporativo autorizado (@expedite.com).",
    });
  });

  it("usa un mensaje genérico si el error no viene en el formato de la API", async () => {
    fetchFalso.mockResolvedValue(respuesta(502, "<html>Bad Gateway</html>"));

    await expect(pedir("/api/me")).rejects.toMatchObject({
      status: 502,
      codigo: "ERROR_INTERNO",
      message: "Ocurrió un error inesperado.",
    });
  });

  it("avisa cuando no hay conexión con el servidor", async () => {
    fetchFalso.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(pedir("/api/me")).rejects.toMatchObject({
      status: 0,
      codigo: "SIN_CONEXION",
      message: "No se pudo conectar con el servidor de Expedite.",
    });
  });
});
