import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api/notificaciones";
import type { Notificacion } from "../api/notificaciones";
import CampanaNotificaciones from "./CampanaNotificaciones";

vi.mock("../api/notificaciones", () => ({
  listarNotificaciones: vi.fn(),
  marcarNotificacionLeida: vi.fn(),
  marcarTodasLeidas: vi.fn(),
}));

const aviso = (cambios: Partial<Notificacion> = {}): Notificacion => ({
  id: 1,
  tipo: "plan_accion.aprobacion",
  mensaje: "El plan de acción PACC-2026-007 fue aprobado por María García.",
  entidadTipo: "action_plan",
  entidadId: "7",
  leida: false,
  fecha: "2026-11-04T10:00:00.000Z",
  ...cambios,
});

const punto = () => screen.queryByTestId("notificaciones-sin-leer");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.marcarNotificacionLeida).mockResolvedValue(undefined);
  vi.mocked(api.marcarTodasLeidas).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("campana de notificaciones", () => {
  it("sin notificaciones sin leer no muestra el punto", async () => {
    vi.mocked(api.listarNotificaciones).mockResolvedValue({ noLeidas: 0, items: [] });

    render(<CampanaNotificaciones />);

    await waitFor(() => expect(api.listarNotificaciones).toHaveBeenCalled());
    expect(punto()).not.toBeInTheDocument();
  });

  it("con notificaciones sin leer muestra el punto y los mensajes", async () => {
    vi.mocked(api.listarNotificaciones).mockResolvedValue({ noLeidas: 1, items: [aviso()] });
    const usuario = userEvent.setup();

    render(<CampanaNotificaciones />);
    await screen.findByTestId("notificaciones-sin-leer");

    await usuario.click(screen.getByRole("button", { name: /Notificaciones/ }));

    expect(await screen.findByText(/PACC-2026-007 fue aprobado/)).toBeInTheDocument();
  });

  it("muestra un mensaje si no hay notificaciones", async () => {
    vi.mocked(api.listarNotificaciones).mockResolvedValue({ noLeidas: 0, items: [] });
    const usuario = userEvent.setup();

    render(<CampanaNotificaciones />);
    await usuario.click(screen.getByRole("button", { name: /Notificaciones/ }));

    expect(await screen.findByText("No tienes notificaciones.")).toBeInTheDocument();
  });

  it("al hacer clic en una notificación la marca como leída y baja el conteo", async () => {
    vi.mocked(api.listarNotificaciones).mockResolvedValue({ noLeidas: 1, items: [aviso({ id: 5 })] });
    const usuario = userEvent.setup();

    render(<CampanaNotificaciones />);
    await screen.findByTestId("notificaciones-sin-leer");
    await usuario.click(screen.getByRole("button", { name: /Notificaciones/ }));
    await usuario.click(await screen.findByRole("button", { name: /PACC-2026-007/ }));

    await waitFor(() => expect(api.marcarNotificacionLeida).toHaveBeenCalledWith(5));
    await waitFor(() => expect(punto()).not.toBeInTheDocument());
  });

  it("una notificación ya leída no se vuelve a marcar", async () => {
    vi.mocked(api.listarNotificaciones).mockResolvedValue({ noLeidas: 0, items: [aviso({ leida: true })] });
    const usuario = userEvent.setup();

    render(<CampanaNotificaciones />);
    await usuario.click(screen.getByRole("button", { name: /Notificaciones/ }));
    await usuario.click(await screen.findByRole("button", { name: /PACC-2026-007/ }));

    expect(api.marcarNotificacionLeida).not.toHaveBeenCalled();
  });

  it("marca todas como leídas", async () => {
    vi.mocked(api.listarNotificaciones).mockResolvedValue({ noLeidas: 2, items: [aviso({ id: 1 }), aviso({ id: 2 })] });
    const usuario = userEvent.setup();

    render(<CampanaNotificaciones />);
    await screen.findByTestId("notificaciones-sin-leer");
    await usuario.click(screen.getByRole("button", { name: /Notificaciones/ }));
    await usuario.click(await screen.findByRole("button", { name: "Marcar todas como leídas" }));

    await waitFor(() => expect(api.marcarTodasLeidas).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(punto()).not.toBeInTheDocument());
  });

  it("si falla la carga la barra sigue funcionando sin punto", async () => {
    vi.mocked(api.listarNotificaciones).mockRejectedValue(new Error("Sin conexión"));

    render(<CampanaNotificaciones />);

    await waitFor(() => expect(api.listarNotificaciones).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: /Notificaciones/ })).toBeInTheDocument();
    expect(punto()).not.toBeInTheDocument();
  });

  it("vuelve a consultar cada minuto y al regresar a la ventana, y deja de hacerlo al desmontarse", async () => {
    vi.useFakeTimers();
    vi.mocked(api.listarNotificaciones).mockResolvedValue({ noLeidas: 0, items: [] });

    const { unmount } = render(<CampanaNotificaciones />);
    expect(api.listarNotificaciones).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(api.listarNotificaciones).toHaveBeenCalledTimes(2);

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(api.listarNotificaciones).toHaveBeenCalledTimes(3);

    unmount();
    await vi.advanceTimersByTimeAsync(120_000);
    window.dispatchEvent(new Event("focus"));
    expect(api.listarNotificaciones).toHaveBeenCalledTimes(3);
  });
});
