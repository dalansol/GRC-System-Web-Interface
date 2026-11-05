import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { crearHallazgo } from "../api/hallazgos";
import FormularioHallazgo, { controlesConDeficiencia } from "./FormularioHallazgo";

vi.mock("../api/hallazgos", () => ({ crearHallazgo: vi.fn() }));

const CONTROLES = [
  { id: "CTR-001", name: "Conciliación bancaria", vulnerability: "Alta" as const },
  { id: "CTR-002", name: "Revisión de accesos", vulnerability: "Baja" as const },
];

const mostrar = (fixedControlId?: string) =>
  render(
    <FormularioHallazgo
      controls={CONTROLES}
      nextFolio="HAL-2026-001"
      onCreated={vi.fn()}
      onClose={vi.fn()}
      fixedControlId={fixedControlId}
    />,
  );

describe("controlesConDeficiencia", () => {
  it("sin control deficiente deja la lista igual", () => {
    expect(controlesConDeficiencia(CONTROLES, null)).toEqual(CONTROLES);
  });

  it("un control deficiente de la lista pasa a vulnerabilidad alta", () => {
    const controles = controlesConDeficiencia(CONTROLES, { id: "CTR-002", nombre: "Revisión de accesos" });

    expect(controles.find((c) => c.id === "CTR-002")?.vulnerability).toBe("Alta");
    expect(controles).toHaveLength(2);
  });

  it("agrega el control deficiente que no está en la lista", () => {
    const controles = controlesConDeficiencia(CONTROLES, { id: "CTR-900", nombre: "Control real" });

    expect(controles.at(-1)).toEqual({ id: "CTR-900", name: "Control real", vulnerability: "Alta" });
  });
});

describe("FormularioHallazgo", () => {
  it("sin control fijo hay que elegir uno", () => {
    mostrar();

    expect(screen.getByDisplayValue("Seleccionar control")).toBeTruthy();
  });

  it("con el control fijo de la evaluación no se pide elegirlo", () => {
    mostrar("CTR-001");

    expect(screen.queryByDisplayValue("Seleccionar control")).toBeNull();
  });

  it("guarda el plan de la opción elegida aunque el control esté en dos planes", async () => {
    vi.mocked(crearHallazgo).mockResolvedValue({ id: "1", title: "T", severity: "Medio" } as never);
    render(
      <FormularioHallazgo
        controls={[
          { id: "CTR-1", name: "Uno", vulnerability: "Baja", auditId: "7", etiqueta: "CP-1 - Uno (PAI-7)" },
          { id: "CTR-1", name: "Uno", vulnerability: "Baja", auditId: "8", etiqueta: "CP-1 - Uno (PAI-8)" },
        ]}
        nextFolio="HAL-2026-002"
        onCreated={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByDisplayValue("Seleccionar control"), { target: { value: "CTR-1::8" } });
    const textos = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input[type="text"], input:not([type]), textarea');
    textos.forEach((campo) => fireEvent.change(campo, { target: { value: "Texto" } }));
    fireEvent.change(screen.getByDisplayValue(/Seleccionar tipo|Selecciona/), { target: { value: "Otro" } });
    fireEvent.click(screen.getByRole("button", { name: /Registrar hallazgo/ }));

    await waitFor(() => expect(crearHallazgo).toHaveBeenCalledWith(expect.objectContaining({ controlId: "CTR-1", auditId: "8" })));
  });
});
