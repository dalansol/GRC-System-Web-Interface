import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listarControlesParaHallazgo } from "../api/controles";
import { useSesion } from "../auth/SesionContext";
import { useHallazgosViewModel } from "../domain/hallazgos/useHallazgosViewModel";
import VistaHallazgo from "./VistaHallazgo";

vi.mock("../api/controles", () => ({ listarControlesParaHallazgo: vi.fn() }));
vi.mock("../auth/SesionContext", () => ({ useSesion: vi.fn() }));
vi.mock("../domain/hallazgos/useHallazgosViewModel", () => ({ useHallazgosViewModel: vi.fn() }));
vi.mock("./FormularioPlanAccion", () => ({ default: () => null }));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const setShowCreateForm = vi.fn();

function mostrar(rol: string, showCreateForm = false) {
  vi.mocked(useSesion).mockReturnValue({ usuario: { id: 1, rol } } as never);
  vi.mocked(useHallazgosViewModel).mockReturnValue({
    hallazgos: [],
    loading: false,
    expandedFinding: null,
    sevFilter: "all",
    statusFilter: "all",
    USE_REAL_BACKEND: true,
    planesPorHallazgo: {},
    hallazgoParaPlan: null,
    setHallazgoParaPlan: vi.fn(),
    handlePlanCreado: vi.fn(),
    handlePlanActualizado: vi.fn(),
    setExpandedFinding: vi.fn(),
    setSevFilter: vi.fn(),
    setStatusFilter: vi.fn(),
    fetchHallazgos: vi.fn(),
    nextFolio: "HAL-2026-001",
    showCreateForm,
    setShowCreateForm,
  } as never);
  return render(<VistaHallazgo />);
}

beforeEach(() => vi.clearAllMocks());

describe("Nuevo hallazgo en la pantalla de hallazgos", () => {
  it("el equipo de auditoría ve el botón y un auditado no", () => {
    const { unmount } = mostrar("Auditor");
    expect(screen.getByRole("button", { name: /Nuevo hallazgo/ })).toBeTruthy();
    unmount();

    mostrar("Empleado Auditado");
    expect(screen.queryByRole("button", { name: /Nuevo hallazgo/ })).toBeNull();
  });

  it("abre el formulario con los controles reales del usuario", async () => {
    vi.mocked(listarControlesParaHallazgo).mockResolvedValue([
      { control_id: "CTR-1", code: "CP-1", name: "Uno", audit_id: 7, plan_code: "PAI-7", tiene_deficiencia: false },
    ]);
    mostrar("Auditor");

    fireEvent.click(screen.getByRole("button", { name: /Nuevo hallazgo/ }));

    await waitFor(() => expect(setShowCreateForm).toHaveBeenCalledWith(true));
  });

  it("sin controles asignados avisa y no abre el formulario", async () => {
    vi.mocked(listarControlesParaHallazgo).mockResolvedValue([]);
    mostrar("Administrador");

    fireEvent.click(screen.getByRole("button", { name: /Nuevo hallazgo/ }));

    await waitFor(() => expect(toast.info).toHaveBeenCalled());
    expect(setShowCreateForm).not.toHaveBeenCalled();
  });

  it("si la consulta falla muestra el error y no abre el formulario", async () => {
    vi.mocked(listarControlesParaHallazgo).mockRejectedValue(new Error("Sin conexión"));
    mostrar("Auditor");

    fireEvent.click(screen.getByRole("button", { name: /Nuevo hallazgo/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Sin conexión"));
    expect(setShowCreateForm).not.toHaveBeenCalled();
  });
});
