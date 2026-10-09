import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "../api/cliente";
import * as api from "../api/asistente";
import CopilotPanel from "./CopilotPanel";

vi.mock("../api/asistente", async (original) => ({
  ...(await original<typeof api>()),
  obtenerEstadoAsistente: vi.fn(),
  consultarVista: vi.fn(),
}));

const respuesta = (cambios: Partial<api.RespuestaVista> = {}): api.RespuestaVista => ({
  vista: "Controles",
  tipo: "respuesta",
  estado: "respondida",
  texto: "CTR-002 requiere revisión.",
  ...cambios,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.obtenerEstadoAsistente).mockResolvedValue({ disponible: true });
});

async function abrir(props: Partial<React.ComponentProps<typeof CopilotPanel>> = {}) {
  render(<CopilotPanel currentView="controles" open onToggle={() => {}} {...props} />);
  await waitFor(() => expect(screen.getByLabelText(/pregunta para el asistente/i)).toBeEnabled());
}

async function preguntar(texto: string) {
  await userEvent.type(screen.getByLabelText(/pregunta para el asistente/i), texto);
  await userEvent.click(screen.getByRole("button", { name: /enviar pregunta/i }));
}

describe("CopilotPanel", () => {
  it("responde con los datos de la vista actual", async () => {
    vi.mocked(api.consultarVista).mockResolvedValue(respuesta());
    await abrir();

    await preguntar("¿Qué controles requieren revisión?");

    expect(await screen.findByText("CTR-002 requiere revisión.")).toBeInTheDocument();
    const [vista, contexto, pregunta] = vi.mocked(api.consultarVista).mock.calls[0]!;
    expect(vista).toBe("Controles");
    expect(contexto).toContain("CTR-002");
    expect(pregunta).toBe("¿Qué controles requieren revisión?");
  });

  it("usa el registro abierto en detalle", async () => {
    vi.mocked(api.consultarVista).mockResolvedValue(respuesta());
    await abrir({ detalle: { type: "control", id: "CTR-001" } });

    expect(screen.getByText("Datos de la vista: Control CTR-001")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Evalúa la efectividad de este control" }));

    await waitFor(() => expect(api.consultarVista).toHaveBeenCalledWith("Control CTR-001", expect.any(String), "Evalúa la efectividad de este control"));
  });

  it("muestra los mensajes fijos de fuera de tema", async () => {
    vi.mocked(api.consultarVista).mockResolvedValue(
      respuesta({ estado: "fuera_de_tema", texto: "Solo puedo responder preguntas sobre la información de Expedite que estás viendo." }),
    );
    await abrir();

    await preguntar("Cuéntame un chiste");

    expect(await screen.findByText(/Solo puedo responder preguntas sobre la información de Expedite/)).toBeInTheDocument();
  });

  it("se desactiva con un aviso si la IA falla", async () => {
    vi.mocked(api.consultarVista).mockRejectedValue(new ErrorApi(503, "IA_NO_DISPONIBLE", "El asistente de IA no está disponible en este momento."));
    await abrir();

    await preguntar("¿Qué controles hay?");

    expect(await screen.findByRole("alert")).toHaveTextContent(/no está disponible/);
    expect(screen.getByLabelText(/pregunta para el asistente/i)).toBeDisabled();
  });

  it("se desactiva si el asistente no está configurado", async () => {
    vi.mocked(api.obtenerEstadoAsistente).mockResolvedValue({ disponible: false });

    render(<CopilotPanel currentView="controles" open onToggle={() => {}} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/no está disponible/);
    expect(screen.getByLabelText(/pregunta para el asistente/i)).toBeDisabled();
  });

  it("muestra otros errores en la conversación sin desactivar el chat", async () => {
    vi.mocked(api.consultarVista).mockRejectedValue(new ErrorApi(403, "ROL_NO_AUTORIZADO", "Tu rol no tiene acceso a esta función."));
    await abrir();

    await preguntar("¿Qué controles hay?");

    expect(await screen.findByText("Tu rol no tiene acceso a esta función.")).toBeInTheDocument();
    expect(screen.getByLabelText(/pregunta para el asistente/i)).toBeEnabled();
  });

  it("avisa en vistas sin datos", async () => {
    render(<CopilotPanel currentView="editor" open onToggle={() => {}} />);

    expect(await screen.findByText(/aún no tiene datos de esta vista/)).toBeInTheDocument();
    expect(screen.getByLabelText(/pregunta para el asistente/i)).toBeDisabled();
  });

  it("no consulta la disponibilidad mientras está cerrado", () => {
    render(<CopilotPanel currentView="controles" open={false} onToggle={() => {}} />);

    expect(api.obtenerEstadoAsistente).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /asistente ia/i })).toBeInTheDocument();
  });
});
