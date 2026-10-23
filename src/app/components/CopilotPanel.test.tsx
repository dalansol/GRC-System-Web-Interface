import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "../api/cliente";
import * as api from "../api/asistente";
import { conversacionControl, conversacionHallazgo } from "../domain/conversacionesAsistente";
import CopilotPanel from "./CopilotPanel";

vi.mock("../api/asistente", async (original) => ({
  ...(await original<typeof api>()),
  obtenerEstadoAsistente: vi.fn(),
  consultarVista: vi.fn(),
  obtenerConversacionHallazgo: vi.fn(),
  consultarHallazgo: vi.fn(),
  borrarConversacionHallazgo: vi.fn(),
  obtenerConversacionControl: vi.fn(),
  consultarControl: vi.fn(),
  borrarConversacionControl: vi.fn(),
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

describe("CopilotPanel con un hallazgo abierto", () => {
  const HALLAZGO = { id: "FND-TEST-001", folio: "HAL-2026-001" };

  beforeEach(() => {
    vi.mocked(api.obtenerConversacionHallazgo).mockResolvedValue({
      hallazgo: { id: HALLAZGO.id, folio: HALLAZGO.folio, titulo: "Conciliaciones" },
      mensajes: [
        { rol: "usuario", texto: "¿Cómo va el plan de acción?", estado: null, fecha: "2026-10-20T10:00:00Z" },
        { rol: "asistente", texto: "Está Asignado a Laura Méndez.", estado: "respondida", fecha: "2026-10-20T10:00:01Z" },
      ],
    });
  });

  it("carga la conversación guardada y pregunta al backend por el hallazgo", async () => {
    vi.mocked(api.consultarHallazgo).mockResolvedValue({
      hallazgoId: HALLAZGO.id,
      tipo: "respuesta",
      estado: "respondida",
      texto: "Vence el 2027-01-31.",
      evidenciasRecortadas: ["Largo.pdf"],
    });
    await abrir({ currentView: "findings", conversacion: conversacionHallazgo(HALLAZGO) });

    expect(screen.getByText("Hallazgo HAL-2026-001")).toBeInTheDocument();
    expect(await screen.findByText("Está Asignado a Laura Méndez.")).toBeInTheDocument();

    await preguntar("¿Y cuándo vence?");

    expect(await screen.findByText("Vence el 2027-01-31.")).toBeInTheDocument();
    expect(screen.getByText(/De Largo.pdf solo se analizó la parte inicial/)).toBeInTheDocument();
    expect(api.consultarHallazgo).toHaveBeenCalledWith(HALLAZGO.id, "¿Y cuándo vence?");
    expect(api.consultarVista).not.toHaveBeenCalled();
  });

  it("empieza una nueva conversación", async () => {
    vi.mocked(api.borrarConversacionHallazgo).mockResolvedValue(undefined);
    await abrir({ currentView: "findings", conversacion: conversacionHallazgo(HALLAZGO) });
    await screen.findByText("Está Asignado a Laura Méndez.");

    await userEvent.click(screen.getByRole("button", { name: "Nueva conversación" }));

    await waitFor(() => expect(screen.queryByText("Está Asignado a Laura Méndez.")).not.toBeInTheDocument());
    expect(api.borrarConversacionHallazgo).toHaveBeenCalledWith(HALLAZGO.id);
  });

  it("al cerrar el hallazgo vuelve a los datos de la vista sin mezclar mensajes", async () => {
    const { rerender } = render(<CopilotPanel currentView="findings" conversacion={conversacionHallazgo(HALLAZGO)} open onToggle={() => {}} />);
    await screen.findByText("Está Asignado a Laura Méndez.");

    rerender(<CopilotPanel currentView="findings" conversacion={null} open onToggle={() => {}} />);

    await waitFor(() => expect(screen.queryByText("Está Asignado a Laura Méndez.")).not.toBeInTheDocument());
    expect(screen.getByText("Datos de la vista: Hallazgos")).toBeInTheDocument();
  });
});

describe("CopilotPanel con un control de un plan abierto", () => {
  it("conversa con el expediente del control en ese plan", async () => {
    vi.mocked(api.obtenerConversacionControl).mockResolvedValue({
      control: { id: "CTR-002", codigo: "CTR-002", nombre: "Segregación de Funciones" },
      plan: { id: 7, codigo: "PAA-2026-001", nombre: "Plan anual" },
      mensajes: [],
    });
    vi.mocked(api.consultarControl).mockResolvedValue({
      planId: 7,
      controlId: "CTR-002",
      tipo: "respuesta",
      estado: "respondida",
      texto: "Lo trabaja Ana Rodríguez con 4 h registradas.",
      evidenciasRecortadas: [],
    });
    await abrir({ currentView: "plans", detalle: { type: "control", id: "CTR-002" }, conversacion: conversacionControl("7", "CTR-002") });

    expect(screen.getByText("Control CTR-002 · plan de auditoría")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Evalúa si las evidencias cubren el control" }));

    expect(await screen.findByText("Lo trabaja Ana Rodríguez con 4 h registradas.")).toBeInTheDocument();
    expect(api.obtenerConversacionControl).toHaveBeenCalledWith("7", "CTR-002");
    expect(api.consultarControl).toHaveBeenCalledWith("7", "CTR-002", "Evalúa si las evidencias cubren el control");
    expect(api.consultarVista).not.toHaveBeenCalled();
  });
});
