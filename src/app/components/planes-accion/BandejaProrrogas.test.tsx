import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "../../api/cliente";
import * as api from "../../api/planesAccion";
import type { SolicitudProrroga } from "../../api/planesAccion";
import BandejaProrrogas from "./BandejaProrrogas";

vi.mock("../../api/planesAccion", async (original) => ({
  ...(await original<typeof api>()),
  listarProrrogasPendientes: vi.fn(),
  aprobarProrroga: vi.fn(),
  rechazarProrroga: vi.fn(),
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const SOLICITUD: SolicitudProrroga = {
  id: 3,
  planAccionId: 7,
  folioPlan: "PACC-2026-007",
  solicitadaPor: { id: 6, nombre: "Javier Ejemplo" },
  fechaActual: "2027-01-15",
  fechaPropuesta: "2027-03-01",
  justificacion: "Depende de un proveedor",
  estado: "Pendiente",
  motivoDecision: null,
  creadaEn: "2026-11-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

async function abrir(solicitudes: SolicitudProrroga[] = [SOLICITUD]) {
  vi.mocked(api.listarProrrogasPendientes).mockResolvedValue(solicitudes);
  render(<BandejaProrrogas />);
  return userEvent.setup();
}

describe("llegar desde una notificación", () => {
  it("resalta la solicitud del plan", async () => {
    vi.mocked(api.listarProrrogasPendientes).mockResolvedValue([SOLICITUD, { ...SOLICITUD, id: 4, planAccionId: 8, folioPlan: "PACC-2026-008" }]);
    render(<BandejaProrrogas destino={{ planId: 7, pestana: "prorrogas", solicitud: 1 }} />);

    expect((await screen.findByText("PACC-2026-007")).closest("li")).toHaveAttribute("data-destacado", "true");
    expect(screen.getByText("PACC-2026-008").closest("li")).not.toHaveAttribute("data-destacado");
    expect(api.listarProrrogasPendientes).toHaveBeenCalledTimes(1);
  });

  it("si ya se decidió lo avisa", async () => {
    vi.mocked(api.listarProrrogasPendientes).mockResolvedValue([]);
    render(<BandejaProrrogas destino={{ planId: 7, pestana: "prorrogas", solicitud: 1 }} />);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("ya se decidió")));
  });
});

describe("BandejaProrrogas", () => {
  it("muestra el plan, quién la pide, las fechas y la justificación", async () => {
    await abrir();

    expect(await screen.findByText("PACC-2026-007")).toBeInTheDocument();
    expect(screen.getByText(/Javier Ejemplo/)).toBeInTheDocument();
    expect(screen.getByText(/2027-01-15/)).toBeInTheDocument();
    expect(screen.getByText(/2027-03-01/)).toBeInTheDocument();
    expect(screen.getByText(/Depende de un proveedor/)).toBeInTheDocument();
  });

  it("avisa cuando no hay solicitudes", async () => {
    await abrir([]);
    expect(await screen.findByText("No hay solicitudes de prórroga pendientes.")).toBeInTheDocument();
  });

  it("aprueba una sola vez y recarga", async () => {
    // La respuesta queda pendiente para comprobar el doble clic mientras la decisión está en curso.
    let responder!: (solicitud: SolicitudProrroga) => void;
    vi.mocked(api.aprobarProrroga).mockReturnValue(new Promise((resolver) => (responder = resolver)));
    const usuario = await abrir();

    await usuario.dblClick(await screen.findByRole("button", { name: "Aprobar prórroga" }));

    expect(api.aprobarProrroga).toHaveBeenCalledTimes(1);
    expect(api.aprobarProrroga).toHaveBeenCalledWith(3);

    responder({ ...SOLICITUD, estado: "Aprobada" });

    await waitFor(() => expect(api.listarProrrogasPendientes).toHaveBeenCalledTimes(2));
    expect(toast.success).toHaveBeenCalled();
  });

  it("rechazar sin motivo no llama a la API y lo pide", async () => {
    const usuario = await abrir();

    await usuario.click(await screen.findByRole("button", { name: "Rechazar prórroga" }));
    await usuario.type(await screen.findByLabelText("Motivo del rechazo"), "   ");
    await usuario.click(screen.getByRole("button", { name: "Confirmar rechazo" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Escribe el motivo del rechazo.");
    expect(api.rechazarProrroga).not.toHaveBeenCalled();
  });

  it("rechaza con el motivo sin espacios", async () => {
    vi.mocked(api.rechazarProrroga).mockResolvedValue({ ...SOLICITUD, estado: "Rechazada" });
    const usuario = await abrir();

    await usuario.click(await screen.findByRole("button", { name: "Rechazar prórroga" }));
    await usuario.type(await screen.findByLabelText("Motivo del rechazo"), "  No procede  ");
    await usuario.click(screen.getByRole("button", { name: "Confirmar rechazo" }));

    await waitFor(() => expect(api.rechazarProrroga).toHaveBeenCalledWith(3, "No procede"));
    await waitFor(() => expect(api.listarProrrogasPendientes).toHaveBeenCalledTimes(2));
  });

  it("si la decisión falla muestra el mensaje y recarga", async () => {
    vi.mocked(api.aprobarProrroga).mockRejectedValue(new ErrorApi(403, "REVISOR_IMPEDIDO", "No puedes revisar este plan."));
    const usuario = await abrir();

    await usuario.click(await screen.findByRole("button", { name: "Aprobar prórroga" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("No puedes revisar este plan."));
    await waitFor(() => expect(api.listarProrrogasPendientes).toHaveBeenCalledTimes(2));
  });
});
