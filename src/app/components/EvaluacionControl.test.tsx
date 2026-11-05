import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "../api/cliente";
import * as api from "../api/evaluaciones";
import type { Criterio, EstadoEvaluacion, Evaluacion } from "../api/evaluaciones";
import EvaluacionControl from "./EvaluacionControl";

vi.mock("../api/evaluaciones", async (original) => ({
  ...(await original<typeof api>()),
  consultarEvaluacion: vi.fn(),
  guardarEvaluacion: vi.fn(),
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const criterio = (id: number, tipo: Criterio["tipo"], nombre: string): Criterio => ({
  id,
  codigo: `${tipo[0]!.toUpperCase()}${id}`,
  tipo,
  nombre,
  obligatorio: true,
  orden: id,
});

const CRITERIOS = [
  criterio(1, "diseno", "Objetivo ligado al riesgo"),
  criterio(2, "diseno", "Procedimiento documentado"),
  criterio(3, "efectividad", "Evidencia suficiente"),
  criterio(4, "efectividad", "Sin excepciones"),
];

const EVALUACION: Evaluacion = {
  planId: 2,
  controlId: "CTR-001",
  promedioDiseno: 4.5,
  promedioEfectividad: 4,
  calificacion: 4,
  resultado: "Efectivo",
  deficiencia: false,
  respuestas: [
    { criterioId: 1, valor: 5 },
    { criterioId: 2, valor: 4 },
    { criterioId: 3, valor: 4 },
    { criterioId: 4, valor: 4 },
  ],
  evaluadoPor: { id: 5, nombre: "Ana Rodríguez" },
  evaluadoEn: "2026-11-02T18:00:00.000Z",
};

const DEFICIENTE: Evaluacion = {
  ...EVALUACION,
  promedioEfectividad: 2,
  calificacion: 2,
  resultado: "Deficiente",
  deficiencia: true,
};

const estado = (cambios: Partial<EstadoEvaluacion> = {}): EstadoEvaluacion => ({
  criterios: CRITERIOS,
  evaluacion: null,
  puedeEvaluar: true,
  motivoBloqueo: null,
  ...cambios,
});

const generarHallazgo = vi.fn();

const mostrar = () =>
  render(<EvaluacionControl planId="2" controlId="CTR-001" onGenerarHallazgo={generarHallazgo} />);

const marcar = async (nombre: string, valor: number) => {
  const grupo = await screen.findByRole("group", { name: nombre });
  await userEvent.click(within(grupo).getByRole("radio", { name: String(valor) }));
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.consultarEvaluacion).mockResolvedValue(estado());
});

describe("EvaluacionControl", () => {
  it("muestra los criterios de diseño y de efectividad con la escala de 1 a 5", async () => {
    mostrar();

    expect(await screen.findByRole("heading", { name: "Diseño" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Efectividad operativa" })).toBeTruthy();
    const grupo = screen.getByRole("group", { name: "Evidencia suficiente" });
    expect(
      within(grupo)
        .getAllByRole("radio")
        .map((r) => r.getAttribute("value")),
    ).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("ancla el radio oculto a su etiqueta para que enfocarlo no desplace la página", async () => {
    // El radio lleva `sr-only` (position: absolute). Sin un ancestro posicionado, el navegador lo coloca
    // fuera de la pantalla y, al enfocarlo con un clic, desplaza toda la ventana hacia abajo.
    mostrar();

    const grupo = await screen.findByRole("group", { name: "Evidencia suficiente" });
    for (const radio of within(grupo).getAllByRole("radio")) {
      expect(radio.parentElement?.classList.contains("relative")).toBe(true);
    }
  });

  it("muestra las respuestas y el resultado ya guardados", async () => {
    vi.mocked(api.consultarEvaluacion).mockResolvedValue(estado({ evaluacion: EVALUACION }));

    mostrar();

    const grupo = await screen.findByRole("group", { name: "Objetivo ligado al riesgo" });
    expect(within(grupo).getByRole<HTMLInputElement>("radio", { name: "5" }).checked).toBe(true);
    expect(screen.getByText("Efectivo")).toBeTruthy();
    expect(screen.getByText(/Ana Rodríguez/)).toBeTruthy();
  });

  describe("criterio 1: calificación y estatus", () => {
    it("guarda las respuestas y muestra la calificación calculada por el backend", async () => {
      vi.mocked(api.guardarEvaluacion).mockResolvedValue(EVALUACION);
      mostrar();

      await marcar("Objetivo ligado al riesgo", 5);
      await marcar("Procedimiento documentado", 4);
      await marcar("Evidencia suficiente", 4);
      await marcar("Sin excepciones", 4);
      await userEvent.click(screen.getByRole("button", { name: "Guardar evaluación" }));

      await waitFor(() =>
        expect(api.guardarEvaluacion).toHaveBeenCalledWith("2", "CTR-001", EVALUACION.respuestas),
      );
      expect(await screen.findByText("Efectivo")).toBeTruthy();
      expect(screen.getByLabelText("Calificación").textContent).toBe("4.00");
      expect(toast.success).toHaveBeenCalled();
    });

    it("muestra el mensaje del backend si no se pudo guardar", async () => {
      vi.mocked(api.guardarEvaluacion).mockRejectedValue(
        new ErrorApi(
          409,
          "EVALUACION_CERRADA",
          "La evaluación solo se puede editar con el control En Progreso.",
        ),
      );
      vi.mocked(api.consultarEvaluacion).mockResolvedValue(estado({ evaluacion: EVALUACION }));
      mostrar();

      await userEvent.click(await screen.findByRole("button", { name: "Guardar evaluación" }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(
          "La evaluación solo se puede editar con el control En Progreso.",
        ),
      );
    });
  });

  describe("criterio 2: criterio obligatorio sin responder", () => {
    it("no guarda y señala el criterio que falta", async () => {
      mostrar();

      await marcar("Objetivo ligado al riesgo", 5);
      await marcar("Procedimiento documentado", 4);
      await marcar("Evidencia suficiente", 4);
      await userEvent.click(screen.getByRole("button", { name: "Guardar evaluación" }));

      expect(api.guardarEvaluacion).not.toHaveBeenCalled();
      const grupo = screen.getByRole("group", { name: "Sin excepciones" });
      expect(within(grupo).getByText("Este criterio es obligatorio.")).toBeTruthy();
      expect(screen.getAllByText("Este criterio es obligatorio.")).toHaveLength(1);
      expect(toast.error).toHaveBeenCalledWith("Falta responder: Sin excepciones.");
    });

    it("quita la señal al responder el criterio", async () => {
      mostrar();
      await userEvent.click(await screen.findByRole("button", { name: "Guardar evaluación" }));
      expect(screen.getAllByText("Este criterio es obligatorio.")).toHaveLength(4);

      await marcar("Sin excepciones", 3);

      expect(screen.getAllByText("Este criterio es obligatorio.")).toHaveLength(3);
    });
  });

  describe("criterio 3: deficiencia", () => {
    it("avisa de la deficiencia y permite generar un hallazgo", async () => {
      vi.mocked(api.consultarEvaluacion).mockResolvedValue(estado({ evaluacion: DEFICIENTE }));
      mostrar();

      expect(await screen.findByRole("alert")).toBeTruthy();
      await userEvent.click(screen.getByRole("button", { name: "Generar hallazgo" }));

      expect(generarHallazgo).toHaveBeenCalledTimes(1);
    });

    it("no ofrece el hallazgo si el control no tiene deficiencia", async () => {
      vi.mocked(api.consultarEvaluacion).mockResolvedValue(estado({ evaluacion: EVALUACION }));
      mostrar();

      await screen.findByText("Efectivo");

      expect(screen.queryByRole("button", { name: "Generar hallazgo" })).toBeNull();
    });
  });

  describe("sin permiso para evaluar", () => {
    it("muestra el motivo y deja las respuestas de solo lectura", async () => {
      vi.mocked(api.consultarEvaluacion).mockResolvedValue(
        estado({ puedeEvaluar: false, motivoBloqueo: "Debes declarar tus conflictos de interés." }),
      );
      mostrar();

      expect(await screen.findByText("Debes declarar tus conflictos de interés.")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Guardar evaluación" })).toBeNull();
      const grupo = screen.getByRole("group", { name: "Sin excepciones" });
      expect(within(grupo).getByRole<HTMLInputElement>("radio", { name: "3" }).disabled).toBe(true);
    });

    it("no muestra nada si el usuario no puede consultar la evaluación", async () => {
      vi.mocked(api.consultarEvaluacion).mockRejectedValue(
        new ErrorApi(403, "ROL_NO_AUTORIZADO", "No."),
      );

      const { container } = mostrar();

      await waitFor(() => expect(api.consultarEvaluacion).toHaveBeenCalled());
      await waitFor(() => expect(container.textContent).toBe(""));
    });

    it("muestra el error si no se pudo cargar", async () => {
      vi.mocked(api.consultarEvaluacion).mockRejectedValue(new Error("Sin conexión"));

      mostrar();

      expect(await screen.findByText("Sin conexión")).toBeTruthy();
    });
  });
});
