import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "../api/cliente";
import * as api from "../api/planesAccion";
import type { PlanAccion } from "../api/planesAccion";
import FormularioPlanAccion from "./FormularioPlanAccion";

vi.mock("../api/planesAccion", async (original) => ({
  ...(await original<typeof api>()),
  obtenerHallazgoParaPlan: vi.fn(),
  listarResponsables: vi.fn(),
  crearPlanAccion: vi.fn(),
  actualizarPlanAccion: vi.fn(),
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const HALLAZGO = {
  id: "HAL-2025-003",
  folio: "HAL-2025-003",
  titulo: "Calendario normativo desactualizado",
  severidad: "Medio",
  auditoriaId: "AUD-003",
  controlId: "CTR-004",
  fechaCierreAuditoria: "2025-11-30",
};

const PLAN: PlanAccion = {
  id: 7,
  hallazgo: HALLAZGO,
  descripcion: "Actualizar el calendario normativo.",
  responsable: { id: 6, nombre: "Laura Fernández" },
  fechaCompromiso: "2025-12-15",
  estado: "Asignado",
  creadoEn: "2025-10-08T10:00:00.000Z",
};

let onCreado: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  onCreado = vi.fn();
  vi.mocked(api.obtenerHallazgoParaPlan).mockResolvedValue(HALLAZGO);
  vi.mocked(api.listarResponsables).mockResolvedValue([{ id: 6, nombre: "Laura Fernández", correo: "l.fernandez@expedite.com" }]);
  vi.mocked(api.crearPlanAccion).mockResolvedValue(PLAN);
});

async function abrir() {
  render(<FormularioPlanAccion hallazgoId="HAL-2025-003" hallazgoTitulo={HALLAZGO.titulo} onGuardado={onCreado} onCerrar={() => {}} />);
  await screen.findByLabelText("Descripción de la acción correctiva");
}

async function llenar(fecha: string) {
  const usuario = userEvent.setup();
  await usuario.type(screen.getByLabelText("Descripción de la acción correctiva"), "Actualizar el calendario normativo.");
  await usuario.selectOptions(screen.getByLabelText("Responsable auditado"), "6");
  await usuario.clear(screen.getByLabelText("Fecha de compromiso"));
  await usuario.type(screen.getByLabelText("Fecha de compromiso"), fecha);
  return usuario;
}

describe("FormularioPlanAccion", () => {
  it("muestra la fecha de cierre de la auditoría del hallazgo", async () => {
    await abrir();
    expect(screen.getByText("2025-11-30")).toBeInTheDocument();
  });

  it("guarda el plan con descripción, responsable y fecha, y lo entrega en estado Asignado", async () => {
    await abrir();
    const usuario = await llenar("2025-12-15");

    await usuario.click(screen.getByRole("button", { name: "Guardar plan" }));

    await waitFor(() => expect(onCreado).toHaveBeenCalledWith(PLAN));
    expect(api.crearPlanAccion).toHaveBeenCalledWith({
      hallazgoId: "HAL-2025-003",
      descripcion: "Actualizar el calendario normativo.",
      responsableId: 6,
      fechaCompromiso: "2025-12-15",
    });
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("2025-12-15"));
  });

  it("rechaza una fecha de compromiso anterior al cierre de la auditoría con un mensaje explícito", async () => {
    await abrir();
    const usuario = await llenar("2025-11-29");

    expect(screen.getByRole("alert")).toHaveTextContent(api.MENSAJE_FECHA_ANTERIOR_AL_CIERRE);

    await usuario.click(screen.getByRole("button", { name: "Guardar plan" }));

    expect(api.crearPlanAccion).not.toHaveBeenCalled();
    expect(onCreado).not.toHaveBeenCalled();
  });

  it("muestra el mensaje de validación que devuelve el servidor", async () => {
    vi.mocked(api.crearPlanAccion).mockRejectedValue(new ErrorApi(400, "DATOS_INVALIDOS", api.MENSAJE_FECHA_ANTERIOR_AL_CIERRE));
    await abrir();
    const usuario = await llenar("2025-12-15");

    await usuario.click(screen.getByRole("button", { name: "Guardar plan" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(api.MENSAJE_FECHA_ANTERIOR_AL_CIERRE);
    expect(onCreado).not.toHaveBeenCalled();
  });
});

describe("FormularioPlanAccion en modo edición", () => {
  async function abrirEdicion(plan: PlanAccion = PLAN) {
    render(
      <FormularioPlanAccion hallazgoId="HAL-2025-003" hallazgoTitulo={HALLAZGO.titulo} plan={plan} onGuardado={onCreado} onCerrar={() => {}} />,
    );
    await screen.findByLabelText("Estado");
  }

  it("precarga los datos del plan y envía los cambios con el estado", async () => {
    const actualizado: PlanAccion = { ...PLAN, estado: "En Progreso", fechaCompromiso: "2026-01-10" };
    vi.mocked(api.actualizarPlanAccion).mockResolvedValue(actualizado);
    await abrirEdicion();

    expect(screen.getByRole("heading", { name: "Editar plan de acción" })).toBeInTheDocument();
    expect(screen.getByLabelText("Descripción de la acción correctiva")).toHaveValue(PLAN.descripcion);
    expect(screen.getByLabelText("Responsable auditado")).toHaveValue("6");
    expect(screen.getByLabelText("Fecha de compromiso")).toHaveValue("2025-12-15");

    const usuario = userEvent.setup();
    await usuario.selectOptions(screen.getByLabelText("Estado"), "En Progreso");
    await usuario.clear(screen.getByLabelText("Fecha de compromiso"));
    await usuario.type(screen.getByLabelText("Fecha de compromiso"), "2026-01-10");
    await usuario.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(onCreado).toHaveBeenCalledWith(actualizado));
    expect(api.actualizarPlanAccion).toHaveBeenCalledWith(7, {
      descripcion: PLAN.descripcion,
      responsableId: 6,
      fechaCompromiso: "2026-01-10",
      estado: "En Progreso",
    });
    expect(api.crearPlanAccion).not.toHaveBeenCalled();
  });

  it("rechaza cambiar la fecha a una anterior al cierre de la auditoría", async () => {
    await abrirEdicion();
    const usuario = userEvent.setup();
    await usuario.clear(screen.getByLabelText("Fecha de compromiso"));
    await usuario.type(screen.getByLabelText("Fecha de compromiso"), "2025-11-29");

    expect(screen.getByRole("alert")).toHaveTextContent(api.MENSAJE_FECHA_ANTERIOR_AL_CIERRE);
    await usuario.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(api.actualizarPlanAccion).not.toHaveBeenCalled();
  });

  it("conserva como opción a un responsable que ya no está activo", async () => {
    await abrirEdicion({ ...PLAN, responsable: { id: 99, nombre: "Pedro Sánchez" } });
    expect(screen.getByLabelText("Responsable auditado")).toHaveValue("99");
    expect(screen.getByRole("option", { name: "Pedro Sánchez" })).toBeInTheDocument();
  });
});
