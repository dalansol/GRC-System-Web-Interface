import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VistaHallazgoDetallado from "./VistaHallazgoDetallado";

const sesion = vi.hoisted(() => ({ usuario: { id: 1, rol: "Auditor" } as { id: number; rol: string } }));
vi.mock("../auth/SesionContext", () => ({ useSesion: () => sesion }));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const HALLAZGO = { id: "HAL-001", folio: "HAL-001", title: "Hallazgo de prueba", severity: "Medio", status: "Abierto" };
vi.mock("../api/cliente", async (original) => ({
  ...(await original<typeof import("../api/cliente")>()),
  pedir: vi.fn(async (ruta: string) => (ruta.endsWith("/planes-accion") ? [] : HALLAZGO)),
}));

const evidencias = vi.hoisted(() => vi.fn());
vi.mock("./EvidenciasSection", () => ({
  default: (props: Record<string, unknown>) => {
    evidencias(props);
    return <div data-testid="evidencias" />;
  },
}));
vi.mock("./FormularioPlanAccion", () => ({ default: () => null }));

async function abrir(rol: string) {
  sesion.usuario = { id: 1, rol };
  render(<VistaHallazgoDetallado hallazgoId="HAL-001" onBack={() => {}} />);
  await screen.findByText("Hallazgo de prueba");
}

describe("plan de acción en el detalle del hallazgo", () => {
  it.each(["Auditor", "Auditor Senior"])("%s puede crear un plan", async (rol) => {
    await abrir(rol);
    expect(await screen.findByRole("button", { name: "Crear plan de acción" })).toBeInTheDocument();
  });

  it.each(["Jefe de Auditoría", "Administrador", "Solo Lectura"])("%s no puede crear un plan", async (rol) => {
    await abrir(rol);
    await screen.findByText("Plan de Acción Correctivo");
    expect(screen.queryByRole("button", { name: "Crear plan de acción" })).not.toBeInTheDocument();
  });

  it.each(["Jefe Auditado", "Empleado Auditado"])("%s no ve la sección de planes ni puede crear", async (rol) => {
    await abrir(rol);
    expect(screen.queryByText("Plan de Acción Correctivo")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Crear plan de acción" })).not.toBeInTheDocument();
  });
});

describe("evidencia en el detalle del hallazgo", () => {
  beforeEach(() => evidencias.mockClear());

  it.each(["Administrador", "Jefe de Auditoría", "Auditor Senior", "Auditor"])("%s la ve sin poder subir archivos", async (rol) => {
    await abrir(rol);

    expect(screen.getByTestId("evidencias")).toBeInTheDocument();
    expect(evidencias).toHaveBeenCalledWith({ entityId: "HAL-001", entityType: "hallazgo", puedeSubir: false });
  });

  it.each(["Jefe Auditado", "Empleado Auditado", "Solo Lectura"])("%s no la ve", async (rol) => {
    await abrir(rol);

    expect(screen.queryByTestId("evidencias")).not.toBeInTheDocument();
  });
});
