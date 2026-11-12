import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Las vistas de planes abren una conexión de avisos en vivo con el backend. En las pruebas no hay backend:
// el aviso queda simulado y cada prueba puede capturar al oyente con vi.mocked(suscribirCambiosPlanes).
// Las pruebas del propio módulo usan vi.importActual.
vi.mock("../app/api/cambiosPlanes", () => ({
  suscribirCambiosPlanes: vi.fn(() => () => {}),
}));

afterEach(() => {
  cleanup();
});
