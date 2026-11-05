import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api/planesAccion";
import type { EventoFlujoPlan } from "../api/planesAccion";
import HistorialFlujoPlan from "./HistorialFlujoPlan";

vi.mock("../api/planesAccion", async (original) => ({
  ...(await original<typeof api>()),
  obtenerFlujoPlan: vi.fn(),
}));

const evento = (cambios: Partial<EventoFlujoPlan>): EventoFlujoPlan => ({
  id: 1,
  planAccionId: 7,
  accion: "envio",
  estadoAnterior: "Asignado",
  estadoNuevo: "Pendiente",
  actor: { id: 6, nombre: "Laura Fernández", rol: "Auditor" },
  motivo: null,
  firmaHash: null,
  fecha: "2026-11-04T10:00:00.000Z",
  ...cambios,
});

const HASH = "abcdef0123456789".repeat(4);

describe("historial del flujo", () => {
  beforeEach(() => {
    vi.mocked(api.obtenerFlujoPlan).mockReset();
  });

  it("muestra los eventos en orden con quién actuó y su rol", async () => {
    vi.mocked(api.obtenerFlujoPlan).mockResolvedValue({
      eventos: [
        evento({ id: 1 }),
        evento({ id: 2, accion: "apertura", estadoAnterior: "Pendiente", estadoNuevo: "En Revisión", actor: { id: 2, nombre: "María García", rol: "Jefe de Auditoría" } }),
      ],
      firmaIntegra: null,
    });

    render(<HistorialFlujoPlan planId={7} recarga={0} />);

    const filas = await screen.findAllByRole("listitem");
    expect(filas).toHaveLength(2);
    expect(filas[0]).toHaveTextContent("Enviado a revisión");
    expect(filas[0]).toHaveTextContent("Laura Fernández");
    expect(filas[1]).toHaveTextContent("Abierto para revisión");
    expect(filas[1]).toHaveTextContent("María García");
    expect(filas[1]).toHaveTextContent("Jefe de Auditoría");
    expect(filas[1]).toHaveTextContent("2026");
    expect(api.obtenerFlujoPlan).toHaveBeenCalledWith(7);
  });

  it("muestra el motivo de un rechazo", async () => {
    vi.mocked(api.obtenerFlujoPlan).mockResolvedValue({
      eventos: [evento({ accion: "rechazo", estadoNuevo: "Rechazado", motivo: "Falta evidencia" })],
      firmaIntegra: null,
    });

    render(<HistorialFlujoPlan planId={7} recarga={0} />);

    expect(await screen.findByText(/Falta evidencia/)).toBeInTheDocument();
  });

  it("muestra la firma y la integridad verificada de una aprobación", async () => {
    vi.mocked(api.obtenerFlujoPlan).mockResolvedValue({
      eventos: [evento({ accion: "aprobacion", estadoNuevo: "Aprobado", firmaHash: HASH, actor: { id: 2, nombre: "María García", rol: "Jefe de Auditoría" } })],
      firmaIntegra: true,
    });

    render(<HistorialFlujoPlan planId={7} recarga={0} />);

    expect(await screen.findByText(/Firmado por María García/)).toBeInTheDocument();
    expect(screen.getByText(HASH.slice(0, 12))).toBeInTheDocument();
    expect(screen.getByText("Integridad verificada")).toBeInTheDocument();
  });

  it("avisa si el contenido cambió después de la firma", async () => {
    vi.mocked(api.obtenerFlujoPlan).mockResolvedValue({
      eventos: [evento({ accion: "aprobacion", estadoNuevo: "Aprobado", firmaHash: HASH })],
      firmaIntegra: false,
    });

    render(<HistorialFlujoPlan planId={7} recarga={0} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("El contenido cambió después de la firma");
    expect(screen.queryByText("Integridad verificada")).not.toBeInTheDocument();
  });

  it("muestra un mensaje si el plan aún no tiene eventos", async () => {
    vi.mocked(api.obtenerFlujoPlan).mockResolvedValue({ eventos: [], firmaIntegra: null });

    render(<HistorialFlujoPlan planId={7} recarga={0} />);

    expect(await screen.findByText("Todavía no hay movimientos en el flujo.")).toBeInTheDocument();
  });

  it("muestra un mensaje si no se puede cargar", async () => {
    vi.mocked(api.obtenerFlujoPlan).mockRejectedValue(new Error("Sin conexión"));

    render(<HistorialFlujoPlan planId={7} recarga={0} />);

    expect(await screen.findByText("No se pudo cargar el historial del flujo.")).toBeInTheDocument();
  });

  it("vuelve a cargar cuando cambia recarga", async () => {
    vi.mocked(api.obtenerFlujoPlan).mockResolvedValue({ eventos: [], firmaIntegra: null });

    const { rerender } = render(<HistorialFlujoPlan planId={7} recarga={0} />);
    await screen.findByText("Todavía no hay movimientos en el flujo.");

    rerender(<HistorialFlujoPlan planId={7} recarga={1} />);

    await vi.waitFor(() => expect(api.obtenerFlujoPlan).toHaveBeenCalledTimes(2));
  });
});
