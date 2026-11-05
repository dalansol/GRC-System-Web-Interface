import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "../api/cliente";
import * as api from "../api/planesAccion";
import type { PlanAccion } from "../api/planesAccion";
import BandejaRevisionPlanes from "./BandejaRevisionPlanes";

vi.mock("../api/planesAccion", async (original) => ({
  ...(await original<typeof api>()),
  listarBandejaRevision: vi.fn(),
  abrirRevisionPlan: vi.fn(),
  aprobarPlanAccion: vi.fn(),
  rechazarPlanAccion: vi.fn(),
}));

const sesion = vi.hoisted(() => ({ usuario: { id: 2, rol: "Jefe de Auditoría" } as { id: number; rol: string } }));
vi.mock("../auth/SesionContext", () => ({ useSesion: () => sesion }));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const historial = vi.hoisted(() => vi.fn());
vi.mock("./HistorialFlujoPlan", () => ({
  default: (props: { planId: number; recarga: number }) => {
    historial(props);
    return <div data-testid="historial" />;
  },
}));

const evidencias = vi.hoisted(() => vi.fn());
vi.mock("./EvidenciasSection", () => ({
  default: (props: Record<string, unknown>) => {
    evidencias(props);
    return <div data-testid="evidencias" />;
  },
}));

const HALLAZGO = {
  id: "HAL-1",
  folio: "HAL-1",
  titulo: "Hallazgo de prueba",
  severidad: "Alto",
  auditoriaId: "AUD-1",
  controlId: "CTR-1",
  fechaCierreAuditoria: "2026-01-31",
};

const plan = (cambios: Partial<PlanAccion> = {}): PlanAccion => ({
  id: 7,
  publicId: "PACC-2026-007",
  titulo: "Corregir conciliaciones",
  causaRaiz: "Falta de revisión",
  hallazgo: HALLAZGO,
  descripcion: "Falta de revisión",
  responsable: { id: 6, nombre: "Laura Fernández" },
  fechaCompromiso: "2026-03-01",
  status: "Pendiente",
  estado: "Pendiente",
  creadoEn: "2026-01-01T00:00:00.000Z",
  hallazgosRelacionados: [HALLAZGO],
  pasos: [
    {
      id: 11,
      action_plan_id: 7,
      planAccionId: 7,
      usuarioAsignado: { id: 6, nombre: "Laura Fernández" },
      descripcion: "Revisar conciliaciones",
      fechaCompromiso: "2026-02-01",
      completado: true,
      creadoEn: "2026-01-01T00:00:00.000Z",
      evidenciasCount: 1,
    },
  ],
  ...cambios,
});
const enRevision = (cambios: Partial<PlanAccion> = {}) => plan({ estado: "En Revisión", status: "En Revisión", ...cambios });

beforeEach(() => {
  vi.clearAllMocks();
  sesion.usuario = { id: 2, rol: "Jefe de Auditoría" };
});

async function abrirBandeja(planes: PlanAccion[]) {
  vi.mocked(api.listarBandejaRevision).mockResolvedValue(planes);
  render(<BandejaRevisionPlanes />);
  const usuario = userEvent.setup();
  await screen.findByRole("tablist");
  return usuario;
}

/** Abre el detalle de un plan en revisión con el filtro correspondiente. */
async function abrirDetalleEnRevision(cambios: Partial<PlanAccion> = {}) {
  const usuario = await abrirBandeja([enRevision(cambios)]);
  await usuario.click(screen.getByRole("tab", { name: /En Revisión/ }));
  await usuario.click(await screen.findByRole("button", { name: /Corregir conciliaciones/ }));
  return usuario;
}

describe("lista de la bandeja", () => {
  it("muestra los filtros por estado con sus conteos y empieza en Pendiente", async () => {
    await abrirBandeja([
      plan({ id: 1, titulo: "Plan pendiente" }),
      enRevision({ id: 2, titulo: "Plan en revisión" }),
      plan({ id: 3, titulo: "Plan aprobado", estado: "Aprobado", status: "Aprobado" }),
    ]);

    expect(screen.getByRole("tab", { name: "Pendiente (1)" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "En Revisión (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Aprobado (1)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Rechazado (0)" })).toBeInTheDocument();
    expect(screen.getByText("Plan pendiente")).toBeInTheDocument();
    expect(screen.queryByText("Plan en revisión")).not.toBeInTheDocument();
  });

  it("muestra un mensaje cuando no hay planes en el estado", async () => {
    await abrirBandeja([]);
    expect(screen.getByText("No hay planes en este estado.")).toBeInTheDocument();
  });

  it("muestra un error si no se puede cargar", async () => {
    vi.mocked(api.listarBandejaRevision).mockRejectedValue(new ErrorApi(0, "SIN_CONEXION", "Sin conexión"));
    render(<BandejaRevisionPlanes />);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Sin conexión"));
  });
});

describe("abrir un plan (criterio 1)", () => {
  it("un revisor que abre un plan pendiente lo pasa a En Revisión una sola vez", async () => {
    vi.mocked(api.abrirRevisionPlan).mockResolvedValue(enRevision());
    const usuario = await abrirBandeja([plan()]);

    await usuario.click(screen.getByRole("button", { name: /Corregir conciliaciones/ }));

    await waitFor(() => expect(api.abrirRevisionPlan).toHaveBeenCalledTimes(1));
    expect(api.abrirRevisionPlan).toHaveBeenCalledWith(7);
    expect(await screen.findByRole("button", { name: "Aprobar" })).toBeInTheDocument();
    expect(screen.getByTestId("historial")).toBeInTheDocument();
  });

  it("abrir un plan que ya está en revisión no vuelve a llamar a la API", async () => {
    await abrirDetalleEnRevision();
    expect(api.abrirRevisionPlan).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Aprobar" })).toBeInTheDocument();
  });

  it("muestra la evidencia de los pasos sin permitir subirla", async () => {
    await abrirDetalleEnRevision();
    expect(evidencias).toHaveBeenCalledWith(expect.objectContaining({ entityId: "11", entityType: "action_plan_step", puedeSubir: false }));
  });

  it("si otro usuario ya actuó, muestra el mensaje y recarga la lista", async () => {
    vi.mocked(api.abrirRevisionPlan).mockRejectedValue(new ErrorApi(409, "ESTADO_INVALIDO", "Otro usuario ya actuó."));
    const usuario = await abrirBandeja([plan()]);

    await usuario.click(screen.getByRole("button", { name: /Corregir conciliaciones/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Otro usuario ya actuó."));
    await waitFor(() => expect(api.listarBandejaRevision).toHaveBeenCalledTimes(2));
  });
});

describe("revisor impedido", () => {
  const impedido = "No puedes revisar este plan porque eres su responsable o tienes pasos asignados.";

  it("el responsable ve el plan en solo lectura y no lo cambia de estado", async () => {
    sesion.usuario = { id: 6, rol: "Jefe de Auditoría" };
    const usuario = await abrirBandeja([plan({ pasos: [] })]);

    await usuario.click(screen.getByRole("button", { name: /Corregir conciliaciones/ }));

    expect(await screen.findByText(impedido)).toBeInTheDocument();
    expect(api.abrirRevisionPlan).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rechazar" })).not.toBeInTheDocument();
  });

  it("quien tiene un paso asignado tampoco puede revisar", async () => {
    sesion.usuario = { id: 6, rol: "Administrador" };
    const usuario = await abrirBandeja([plan({ responsable: { id: 9, nombre: "Otro" } })]);

    await usuario.click(screen.getByRole("button", { name: /Corregir conciliaciones/ }));

    expect(await screen.findByText(impedido)).toBeInTheDocument();
    expect(api.abrirRevisionPlan).not.toHaveBeenCalled();
  });
});

describe("aprobar (criterio 2)", () => {
  it("pide confirmar, firma una sola vez y actualiza el historial", async () => {
    vi.mocked(api.aprobarPlanAccion).mockResolvedValue(plan({ estado: "Aprobado", status: "Aprobado" }));
    const usuario = await abrirDetalleEnRevision();
    const cargasIniciales = historial.mock.lastCall![0].recarga;

    await usuario.click(screen.getByRole("button", { name: "Aprobar" }));

    expect(await screen.findByText(/firma electrónica/)).toBeInTheDocument();
    expect(api.aprobarPlanAccion).not.toHaveBeenCalled();

    await usuario.dblClick(screen.getByRole("button", { name: "Confirmar y firmar" }));

    await waitFor(() => expect(api.aprobarPlanAccion).toHaveBeenCalledTimes(1));
    expect(api.aprobarPlanAccion).toHaveBeenCalledWith(7);
    await waitFor(() => expect(historial.mock.lastCall![0].recarga).toBeGreaterThan(cargasIniciales));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalled();
  });

  it("si otro revisor ya actuó, muestra el mensaje y recarga la lista", async () => {
    vi.mocked(api.aprobarPlanAccion).mockRejectedValue(new ErrorApi(409, "ESTADO_INVALIDO", "Otro usuario ya actuó."));
    const usuario = await abrirDetalleEnRevision();

    await usuario.click(screen.getByRole("button", { name: "Aprobar" }));
    await usuario.click(await screen.findByRole("button", { name: "Confirmar y firmar" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Otro usuario ya actuó."));
    await waitFor(() => expect(api.listarBandejaRevision).toHaveBeenCalledTimes(2));
  });
});

describe("rechazar (criterio 3)", () => {
  async function abrirRechazo() {
    const usuario = await abrirDetalleEnRevision();
    await usuario.click(screen.getByRole("button", { name: "Rechazar" }));
    return usuario;
  }

  it("sin motivo no llama a la API y pide el motivo", async () => {
    const usuario = await abrirRechazo();

    await usuario.click(await screen.findByRole("button", { name: "Confirmar rechazo" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Escribe el motivo del rechazo.");
    expect(api.rechazarPlanAccion).not.toHaveBeenCalled();
  });

  it("con solo espacios no llama a la API y pide el motivo", async () => {
    const usuario = await abrirRechazo();

    await usuario.type(await screen.findByLabelText("Motivo del rechazo"), "    ");
    await usuario.click(screen.getByRole("button", { name: "Confirmar rechazo" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Escribe el motivo del rechazo.");
    expect(api.rechazarPlanAccion).not.toHaveBeenCalled();
  });

  it("con motivo envía el texto sin espacios y cierra el diálogo", async () => {
    vi.mocked(api.rechazarPlanAccion).mockResolvedValue(plan({ estado: "Rechazado", status: "Rechazado" }));
    const usuario = await abrirRechazo();

    await usuario.type(await screen.findByLabelText("Motivo del rechazo"), "  Falta evidencia  ");
    await usuario.click(screen.getByRole("button", { name: "Confirmar rechazo" }));

    await waitFor(() => expect(api.rechazarPlanAccion).toHaveBeenCalledWith(7, "Falta evidencia"));
    await waitFor(() => expect(screen.queryByLabelText("Motivo del rechazo")).not.toBeInTheDocument());
    expect(toast.success).toHaveBeenCalled();
  });

  it("no ofrece aprobar ni rechazar un plan ya rechazado", async () => {
    const usuario = await abrirBandeja([plan({ estado: "Rechazado", status: "Rechazado" })]);

    await usuario.click(screen.getByRole("tab", { name: /Rechazado/ }));
    await usuario.click(await screen.findByRole("button", { name: /Corregir conciliaciones/ }));

    expect(api.abrirRevisionPlan).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rechazar" })).not.toBeInTheDocument();
  });
});
