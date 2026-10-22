import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "../api/cliente";
import * as api from "../api/asistente";
import PanelAsistenteEvidencia from "./PanelAsistenteEvidencia";

vi.mock("../api/asistente", async (original) => ({
  ...(await original<typeof api>()),
  obtenerEstadoAsistente: vi.fn(),
  resumirEvidencia: vi.fn(),
  preguntarEvidencia: vi.fn(),
}));

const EVIDENCIA = { id: "EV-002", nombre: "Listado_Accesos_SAP_Q2.pdf" };

const respuesta = (cambios: Partial<api.RespuestaAsistente> = {}): api.RespuestaAsistente => ({
  evidenciaId: EVIDENCIA.id,
  tipo: "respuesta",
  estado: "respondida",
  texto: "Se revisaron 42 usuarios (página 1).",
  recortado: false,
  ...cambios,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.obtenerEstadoAsistente).mockResolvedValue({ disponible: true });
});

async function abrir() {
  render(<PanelAsistenteEvidencia evidencia={EVIDENCIA} onCerrar={() => {}} />);
  await waitFor(() => expect(screen.getByRole("button", { name: /generar resumen/i })).toBeEnabled());
}

describe("PanelAsistenteEvidencia", () => {
  it("muestra el documento seleccionado", async () => {
    await abrir();

    expect(screen.getByText(EVIDENCIA.nombre)).toBeInTheDocument();
  });

  it("muestra el resumen generado por la IA", async () => {
    vi.mocked(api.resumirEvidencia).mockResolvedValue(respuesta({ tipo: "resumen", texto: "El documento lista los accesos SAP." }));
    await abrir();

    await userEvent.click(screen.getByRole("button", { name: /generar resumen/i }));

    expect(await screen.findByText("El documento lista los accesos SAP.")).toBeInTheDocument();
    expect(api.resumirEvidencia).toHaveBeenCalledWith(EVIDENCIA.id);
  });

  it("responde una pregunta sobre el documento", async () => {
    vi.mocked(api.preguntarEvidencia).mockResolvedValue(respuesta());
    await abrir();

    await userEvent.type(screen.getByLabelText(/pregunta sobre el documento/i), "¿Cuántos usuarios se revisaron?");
    await userEvent.click(screen.getByRole("button", { name: /preguntar/i }));

    expect(await screen.findByText("Se revisaron 42 usuarios (página 1).")).toBeInTheDocument();
    expect(screen.getByText("¿Cuántos usuarios se revisaron?")).toBeInTheDocument();
    expect(api.preguntarEvidencia).toHaveBeenCalledWith(EVIDENCIA.id, "¿Cuántos usuarios se revisaron?");
  });

  it("usa una pregunta sugerida", async () => {
    vi.mocked(api.preguntarEvidencia).mockResolvedValue(respuesta());
    await abrir();

    await userEvent.click(screen.getByRole("button", { name: "¿Qué riesgos identifica?" }));

    await waitFor(() => expect(api.preguntarEvidencia).toHaveBeenCalledWith(EVIDENCIA.id, "¿Qué riesgos identifica?"));
  });

  it("no permite preguntas demasiado cortas", async () => {
    await abrir();

    await userEvent.type(screen.getByLabelText(/pregunta sobre el documento/i), "hola");

    expect(screen.getByRole("button", { name: /preguntar/i })).toBeDisabled();
  });

  it("distingue las respuestas fuera de tema", async () => {
    vi.mocked(api.preguntarEvidencia).mockResolvedValue(
      respuesta({ estado: "fuera_de_tema", texto: "Solo puedo responder preguntas sobre este documento." }),
    );
    await abrir();

    await userEvent.type(screen.getByLabelText(/pregunta sobre el documento/i), "Cuéntame un chiste");
    await userEvent.click(screen.getByRole("button", { name: /preguntar/i }));

    expect(await screen.findByText("Solo puedo responder preguntas sobre este documento.")).toBeInTheDocument();
  });

  it("avisa cuando el documento es muy largo", async () => {
    vi.mocked(api.resumirEvidencia).mockResolvedValue(respuesta({ tipo: "resumen", recortado: true }));
    await abrir();

    await userEvent.click(screen.getByRole("button", { name: /generar resumen/i }));

    expect(await screen.findByText(/solo se analizó la parte inicial/i)).toBeInTheDocument();
  });

  it("se desactiva con un aviso si la IA no está disponible", async () => {
    vi.mocked(api.obtenerEstadoAsistente).mockResolvedValue({ disponible: false });

    render(<PanelAsistenteEvidencia evidencia={EVIDENCIA} onCerrar={() => {}} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/no está disponible/i);
    expect(screen.getByRole("button", { name: /generar resumen/i })).toBeDisabled();
    expect(screen.getByLabelText(/pregunta sobre el documento/i)).toBeDisabled();
  });

  it.each([
    ["la IA falla", new ErrorApi(503, "IA_NO_DISPONIBLE", "El asistente de IA no está disponible en este momento.")],
    ["la IA tarda demasiado", new ErrorApi(503, "IA_TIEMPO_AGOTADO", "El asistente de IA tardó demasiado en responder.")],
    ["no hay conexión", new ErrorApi(0, "SIN_CONEXION", "No se pudo conectar con el servidor de Expedite.")],
  ])("se desactiva si %s durante una consulta", async (_caso, error) => {
    vi.mocked(api.resumirEvidencia).mockRejectedValue(error);
    await abrir();

    await userEvent.click(screen.getByRole("button", { name: /generar resumen/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(error.message);
    expect(screen.getByRole("button", { name: /generar resumen/i })).toBeDisabled();
  });

  it("muestra otros errores sin desactivar la función", async () => {
    vi.mocked(api.resumirEvidencia).mockRejectedValue(
      new ErrorApi(422, "SIN_TEXTO", "No se pudo leer texto de este documento (puede ser un PDF escaneado)."),
    );
    await abrir();

    await userEvent.click(screen.getByRole("button", { name: /generar resumen/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/PDF escaneado/);
    expect(screen.getByRole("button", { name: /generar resumen/i })).toBeEnabled();
  });

  it("indica que las respuestas son generadas por IA", async () => {
    await abrir();

    expect(screen.getByText(/generadas por IA/i)).toBeInTheDocument();
  });
});
