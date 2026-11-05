import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api/planesAccion";
import type { PlanAccion } from "../api/planesAccion";
import VistaPlanesAccion from "./VistaPlanesAccion";

vi.mock("../api/planesAccion", async (original) => ({
  ...(await original<typeof api>()),
  listarMisPlanesAccion: vi.fn(),
  enviarPlanARevision: vi.fn(),
  obtenerFlujoPlan: vi.fn(),
}));

const sesion = vi.hoisted(() => ({ usuario: { id: 6, rol: "Jefe Auditado" } as { id: number; rol: string } }));
vi.mock("../auth/SesionContext", () => ({ useSesion: () => sesion }));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

vi.mock("./EvidenciasSection", () => ({ default: () => null }));
vi.mock("./HistorialFlujoPlan", () => ({ default: () => <div data-testid="historial" /> }));
vi.mock("./BandejaRevisionPlanes", () => ({ default: () => <div data-testid="bandeja" /> }));

const HALLAZGO = {
  id: "HAL-1",
  folio: "HAL-1",
  titulo: "Hallazgo de prueba",
  severidad: "Alto",
  auditoriaId: "AUD-1",
  controlId: "CTR-1",
  fechaCierreAuditoria: "2026-01-31",
};

const paso = (completado: boolean) => ({
  id: 11,
  action_plan_id: 7,
  planAccionId: 7,
  usuarioAsignado: { id: 6, nombre: "Laura Fernández" },
  descripcion: "Revisar conciliaciones",
  fechaCompromiso: "2026-02-01",
  completado,
  creadoEn: "2026-01-01T00:00:00.000Z",
  evidenciasCount: 1,
});

const plan = (cambios: Partial<PlanAccion> = {}): PlanAccion => ({
  id: 7,
  publicId: "PACC-2026-007",
  titulo: "Corregir conciliaciones",
  causaRaiz: "Falta de revisión",
  hallazgo: HALLAZGO,
  descripcion: "Falta de revisión",
  responsable: { id: 6, nombre: "Laura Fernández" },
  fechaCompromiso: "2026-03-01",
  status: "Asignado",
  estado: "Asignado",
  creadoEn: "2026-01-01T00:00:00.000Z",
  hallazgosRelacionados: [HALLAZGO],
  pasos: [paso(true)],
  ...cambios,
});

beforeEach(() => {
  vi.clearAllMocks();
  sesion.usuario = { id: 6, rol: "Jefe Auditado" };
});

async function abrirDetalle(datos: PlanAccion) {
  vi.mocked(api.listarMisPlanesAccion).mockResolvedValue([datos]);
  render(<VistaPlanesAccion />);
  const usuario = userEvent.setup();
  await usuario.click(await screen.findByRole("button", { name: /Ver detalles/ }));
  return usuario;
}

describe("pestañas", () => {
  it.each(["Administrador", "Jefe de Auditoría"])("%s ve la bandeja de revisión", async (rol) => {
    sesion.usuario = { id: 2, rol };
    vi.mocked(api.listarMisPlanesAccion).mockResolvedValue([]);
    render(<VistaPlanesAccion />);
    const usuario = userEvent.setup();

    await usuario.click(await screen.findByRole("tab", { name: "Bandeja de revisión" }));

    expect(screen.getByTestId("bandeja")).toBeInTheDocument();
  });

  it.each(["Auditor Senior", "Auditor", "Jefe Auditado", "Empleado Auditado"])("%s no ve la bandeja de revisión", async (rol) => {
    sesion.usuario = { id: 2, rol };
    vi.mocked(api.listarMisPlanesAccion).mockResolvedValue([]);
    render(<VistaPlanesAccion />);

    await screen.findByText(/No tienes planes de acción/);

    expect(screen.queryByRole("tab", { name: "Bandeja de revisión" })).not.toBeInTheDocument();
  });
});

describe("envío a revisión", () => {
  it("el responsable con todos los pasos completos envía el plan", async () => {
    vi.mocked(api.enviarPlanARevision).mockResolvedValue(plan({ estado: "Pendiente", status: "Pendiente" }));
    const usuario = await abrirDetalle(plan());

    await usuario.click(screen.getByRole("button", { name: "Enviar a revisión" }));

    await waitFor(() => expect(api.enviarPlanARevision).toHaveBeenCalledWith(7));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Enviar a revisión" })).not.toBeInTheDocument());
    expect(screen.getAllByText("Pendiente").length).toBeGreaterThan(0);
  });

  it("no se ofrece con pasos incompletos", async () => {
    await abrirDetalle(plan({ pasos: [paso(false)] }));
    expect(screen.queryByRole("button", { name: "Enviar a revisión" })).not.toBeInTheDocument();
  });

  it("no se ofrece a quien solo tiene pasos asignados", async () => {
    await abrirDetalle(plan({ responsable: { id: 9, nombre: "Otro responsable" } }));
    expect(screen.queryByRole("button", { name: "Enviar a revisión" })).not.toBeInTheDocument();
  });

  it.each(["Pendiente", "En Revisión", "Aprobado"] as const)("no se ofrece con el plan %s", async (estado) => {
    await abrirDetalle(plan({ estado, status: estado }));
    expect(screen.queryByRole("button", { name: /a revisión/ })).not.toBeInTheDocument();
  });

  it("muestra el historial del flujo en el detalle", async () => {
    await abrirDetalle(plan());
    expect(screen.getByTestId("historial")).toBeInTheDocument();
  });
});

describe("plan rechazado", () => {
  const rechazado = plan({ estado: "Rechazado", status: "Rechazado" });

  it("muestra el motivo y permite reenviar", async () => {
    vi.mocked(api.obtenerFlujoPlan).mockResolvedValue({
      eventos: [
        {
          id: 1,
          planAccionId: 7,
          accion: "rechazo",
          estadoAnterior: "En Revisión",
          estadoNuevo: "Rechazado",
          actor: { id: 2, nombre: "María García", rol: "Jefe de Auditoría" },
          motivo: "Falta evidencia del paso 2",
          firmaHash: null,
          fecha: "2026-11-04T10:00:00.000Z",
        },
      ],
      firmaIntegra: null,
    });
    vi.mocked(api.enviarPlanARevision).mockResolvedValue(plan({ estado: "Pendiente", status: "Pendiente" }));

    const usuario = await abrirDetalle(rechazado);

    expect(await screen.findByText(/Falta evidencia del paso 2/)).toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: "Reenviar a revisión" }));

    await waitFor(() => expect(api.enviarPlanARevision).toHaveBeenCalledWith(7));
  });

  it("si no se puede leer el motivo, sigue permitiendo reenviar", async () => {
    vi.mocked(api.obtenerFlujoPlan).mockRejectedValue(new Error("Sin conexión"));

    await abrirDetalle(rechazado);

    expect(await screen.findByRole("button", { name: "Reenviar a revisión" })).toBeInTheDocument();
  });
});
