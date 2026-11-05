import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FormularioHallazgo, { controlesConDeficiencia } from "./FormularioHallazgo";

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
});
