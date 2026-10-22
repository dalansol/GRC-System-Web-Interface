import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "../api/cliente";
import * as api from "../api/asistente";
import { AISummaryCard } from "./SharedComponents";

vi.mock("../api/asistente", async (original) => ({
  ...(await original<typeof api>()),
  consultarVista: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

describe("AISummaryCard", () => {
  it("resume el registro con la IA", async () => {
    vi.mocked(api.consultarVista).mockResolvedValue({ vista: "Control CTR-002", tipo: "resumen", estado: "respondida", texto: "Control detectivo con revisión pendiente." });
    render(<AISummaryCard entityId="CTR-002" entityType="Control" />);

    await userEvent.click(screen.getByRole("button", { name: /generar resumen/i }));

    expect(await screen.findByText("Control detectivo con revisión pendiente.")).toBeInTheDocument();
    expect(api.consultarVista).toHaveBeenCalledWith("Control CTR-002", expect.stringContaining("CTR-002"));
  });

  it("se desactiva con un aviso si la IA falla", async () => {
    vi.mocked(api.consultarVista).mockRejectedValue(new ErrorApi(503, "IA_TIEMPO_AGOTADO", "El asistente de IA tardó demasiado en responder."));
    render(<AISummaryCard entityId="CTR-002" entityType="Control" />);

    await userEvent.click(screen.getByRole("button", { name: /generar resumen/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/tardó demasiado/);
    expect(screen.getByRole("button", { name: /generar resumen/i })).toBeDisabled();
  });
});
