import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "../api/cliente";
import * as api from "../api/asistente";
import PanelAsistenteEvidencia from "./PanelAsistenteEvidencia";

vi.mock("../api/asistente", async (original) => ({
  ...(await original<typeof api>()),
  obtenerEstadoAsistente: vi.fn(),
  obtenerConversacionEvidencia: vi.fn(),
  consultarEvidencia: vi.fn(),
  borrarConversacionEvidencia: vi.fn(),
}));

const EVIDENCIA = { id: "EV-002", nombre: "Listado_Accesos_SAP_Q2.pdf" };

const respuesta = (cambios: Partial<api.RespuestaEvidencia> = {}): api.RespuestaEvidencia => ({
  evidenciaId: EVIDENCIA.id,
  tipo: "pregunta",
  estado: "respondida",
  texto: "Se revisaron 42 usuarios (página 1).",
  recortado: false,
  ...cambios,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.obtenerEstadoAsistente).mockResolvedValue({ disponible: true });
  vi.mocked(api.obtenerConversacionEvidencia).mockResolvedValue({
    evidencia: EVIDENCIA,
    contexto: { tipo: "hallazgo", etiqueta: "Hallazgo HAL-2026-001" },
    mensajes: [],
  });
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
    vi.mocked(api.consultarEvidencia).mockResolvedValue(respuesta({ tipo: "resumen", texto: "El documento lista los accesos SAP." }));
    await abrir();

    await userEvent.click(screen.getByRole("button", { name: /generar resumen/i }));

    expect(await screen.findByText("El documento lista los accesos SAP.")).toBeInTheDocument();
    expect(api.consultarEvidencia).toHaveBeenCalledWith(EVIDENCIA.id, {});
  });

  it("responde una pregunta sobre el documento", async () => {
    vi.mocked(api.consultarEvidencia).mockResolvedValue(respuesta());
    await abrir();

    await userEvent.type(screen.getByLabelText(/pregunta sobre el documento/i), "¿Cuántos usuarios se revisaron?");
    await userEvent.click(screen.getByRole("button", { name: /preguntar/i }));

    expect(await screen.findByText("Se revisaron 42 usuarios (página 1).")).toBeInTheDocument();
    expect(screen.getByText("¿Cuántos usuarios se revisaron?")).toBeInTheDocument();
    expect(api.consultarEvidencia).toHaveBeenCalledWith(EVIDENCIA.id, { pregunta: "¿Cuántos usuarios se revisaron?" });
  });

  it("usa una pregunta sugerida", async () => {
    vi.mocked(api.consultarEvidencia).mockResolvedValue(respuesta());
    await abrir();

    await userEvent.click(screen.getByRole("button", { name: "¿Qué riesgos identifica?" }));

    await waitFor(() => expect(api.consultarEvidencia).toHaveBeenCalledWith(EVIDENCIA.id, { pregunta: "¿Qué riesgos identifica?" }));
  });

  it("no permite preguntas demasiado cortas", async () => {
    await abrir();

    await userEvent.type(screen.getByLabelText(/pregunta sobre el documento/i), "hola");

    expect(screen.getByRole("button", { name: /preguntar/i })).toBeDisabled();
  });

  it("distingue las respuestas fuera de tema", async () => {
    vi.mocked(api.consultarEvidencia).mockResolvedValue(
      respuesta({ estado: "fuera_de_tema", texto: "Solo puedo responder preguntas sobre este documento." }),
    );
    await abrir();

    await userEvent.type(screen.getByLabelText(/pregunta sobre el documento/i), "Cuéntame un chiste");
    await userEvent.click(screen.getByRole("button", { name: /preguntar/i }));

    expect(await screen.findByText("Solo puedo responder preguntas sobre este documento.")).toBeInTheDocument();
  });

  it("avisa cuando el documento es muy largo", async () => {
    vi.mocked(api.consultarEvidencia).mockResolvedValue(respuesta({ tipo: "resumen", recortado: true }));
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
    vi.mocked(api.consultarEvidencia).mockRejectedValue(error);
    await abrir();

    await userEvent.click(screen.getByRole("button", { name: /generar resumen/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(error.message);
    expect(screen.getByRole("button", { name: /generar resumen/i })).toBeDisabled();
  });

  it("muestra otros errores sin desactivar la función", async () => {
    vi.mocked(api.consultarEvidencia).mockRejectedValue(
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

  it("no ofrece validar una evidencia que no es de un control", async () => {
    await abrir();

    expect(screen.queryByRole("button", { name: /validar contra el control/i })).not.toBeInTheDocument();
  });
});

describe("PanelAsistenteEvidencia con una evidencia de control", () => {
  beforeEach(() => {
    vi.mocked(api.obtenerConversacionEvidencia).mockResolvedValue({
      evidencia: EVIDENCIA,
      contexto: { tipo: "control", etiqueta: "Control CTR-002 · Plan PAA-2026-001" },
      mensajes: [
        { rol: "usuario", texto: "¿Qué periodo cubre?", estado: null, fecha: "2026-10-23T10:00:00Z" },
        { rol: "asistente", texto: "Cubre julio de 2026.", estado: "respondida", fecha: "2026-10-23T10:00:01Z" },
      ],
    });
  });

  it("muestra el control y el plan y la conversación guardada", async () => {
    await abrir();

    expect(await screen.findByText("Control CTR-002 · Plan PAA-2026-001")).toBeInTheDocument();
    expect(screen.getByText("¿Qué periodo cubre?")).toBeInTheDocument();
    expect(screen.getByText("Cubre julio de 2026.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "¿La muestra cumple con el tamaño requerido?" })).toBeInTheDocument();
  });

  it("valida la evidencia contra el control", async () => {
    vi.mocked(api.consultarEvidencia).mockResolvedValue(
      respuesta({ tipo: "validacion", texto: "Borrador: la muestra de 5 no alcanza los 25 requeridos." }),
    );
    await abrir();

    await userEvent.click(await screen.findByRole("button", { name: /validar contra el control/i }));

    expect(await screen.findByText("Borrador: la muestra de 5 no alcanza los 25 requeridos.")).toBeInTheDocument();
    expect(screen.getByText("Validación contra el control")).toBeInTheDocument();
    expect(api.consultarEvidencia).toHaveBeenCalledWith(EVIDENCIA.id, { validar: true });
  });

  it("empieza una nueva conversación", async () => {
    vi.mocked(api.borrarConversacionEvidencia).mockResolvedValue(undefined);
    await abrir();
    await screen.findByText("Cubre julio de 2026.");

    await userEvent.click(screen.getByRole("button", { name: /nueva conversación/i }));

    await waitFor(() => expect(screen.queryByText("Cubre julio de 2026.")).not.toBeInTheDocument());
    expect(api.borrarConversacionEvidencia).toHaveBeenCalledWith(EVIDENCIA.id);
  });
});
