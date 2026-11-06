import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../api/planesAccion";
import type { PlanAccion } from "../../api/planesAccion";
import VistaPlanesAccion from "./VistaPlanesAccion";

vi.mock("../../api/planesAccion", async (original) => ({
  ...(await original<typeof api>()),
  listarPlanesAccion: vi.fn(),
  enviarPlanARevision: vi.fn(),
  obtenerFlujoPlan: vi.fn(),
  actualizarPasoPlanAccion: vi.fn(),
}));

const sesion = vi.hoisted(() => ({ usuario: { id: 5, rol: "Auditor" } as { id: number; rol: string } }));
vi.mock("../../auth/SesionContext", () => ({ useSesion: () => sesion }));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

vi.mock("../EvidenciasSection", () => ({ default: () => null }));
vi.mock("./HistorialFlujoPlan", () => ({ default: () => <div data-testid="historial" /> }));
vi.mock("./BandejaRevisionPlanes", () => ({
  default: ({ destino }: { destino?: { planId: number } }) => <div data-testid="bandeja" data-plan={destino?.planId} />,
}));
vi.mock("./BandejaProrrogas", () => ({
  default: ({ destino }: { destino?: { planId: number } }) => <div data-testid="prorrogas" data-plan={destino?.planId} />,
}));
vi.mock("./PortalPlanesAuditado", () => ({
  default: ({ destino }: { destino?: { planId: number } }) => <div data-testid="portal" data-plan={destino?.planId} />,
}));
vi.mock("./FormularioPlanAccion", () => ({
  default: ({ plan, onGuardado }: { plan: PlanAccion; onGuardado: (plan: PlanAccion) => void }) => (
    <button type="button" onClick={() => onGuardado({ ...plan, titulo: "Título corregido" })}>
      Guardar formulario
    </button>
  ),
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

const paso = (completado: boolean, evidenciasCount = 1) => ({
  id: 11,
  action_plan_id: 7,
  planAccionId: 7,
  usuarioAsignado: { id: 6, nombre: "Javier Ejemplo" },
  descripcion: "Revisar conciliaciones",
  fechaCompromiso: "2026-02-01",
  completado,
  creadoEn: "2026-01-01T00:00:00.000Z",
  evidenciasCount,
});

const plan = (cambios: Partial<PlanAccion> = {}): PlanAccion => ({
  id: 7,
  publicId: "PACC-2026-007",
  titulo: "Corregir conciliaciones",
  causaRaiz: "Falta de revisión",
  hallazgo: HALLAZGO,
  descripcion: "Falta de revisión",
  responsable: { id: 6, nombre: "Javier Ejemplo" },
  fechaCompromiso: "2026-03-01",
  status: "Asignado",
  estado: "Asignado",
  etapa: "cierre",
  creadoEn: "2026-01-01T00:00:00.000Z",
  hallazgosRelacionados: [HALLAZGO],
  pasos: [paso(true)],
  ...cambios,
});

const conEstado = (estado: PlanAccion["estado"], cambios: Partial<PlanAccion> = {}) => plan({ estado, status: estado, ...cambios });

beforeEach(() => {
  vi.clearAllMocks();
  sesion.usuario = { id: 5, rol: "Auditor" };
  vi.mocked(api.listarPlanesAccion).mockResolvedValue([]);
});

async function abrirDetalle(datos: PlanAccion) {
  vi.mocked(api.listarPlanesAccion).mockResolvedValue([datos]);
  render(<VistaPlanesAccion />);
  const usuario = userEvent.setup();
  await usuario.click(await screen.findByRole("button", { name: /Ver detalles/ }));
  return usuario;
}

describe("qué ve cada rol", () => {
  it.each(["Jefe Auditado", "Empleado Auditado"])("%s ve solo su portal y nunca la lista completa", async (rol) => {
    sesion.usuario = { id: 6, rol };

    render(<VistaPlanesAccion />);

    expect(await screen.findByTestId("portal")).toBeInTheDocument();
    expect(api.listarPlanesAccion).not.toHaveBeenCalled();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("el Jefe de Auditoría ve la bandeja y las prórrogas", async () => {
    sesion.usuario = { id: 2, rol: "Jefe de Auditoría" };
    render(<VistaPlanesAccion />);
    const usuario = userEvent.setup();

    await usuario.click(await screen.findByRole("tab", { name: "Bandeja de revisión" }));
    expect(screen.getByTestId("bandeja")).toBeInTheDocument();

    await usuario.click(screen.getByRole("tab", { name: "Prórrogas" }));
    expect(screen.getByTestId("prorrogas")).toBeInTheDocument();
  });

  it.each(["Administrador", "Auditor Senior", "Auditor", "Solo Lectura"])("%s no ve la bandeja ni las prórrogas", async (rol) => {
    sesion.usuario = { id: 2, rol };
    render(<VistaPlanesAccion />);

    await screen.findByText(/No hay planes de acción/);

    expect(screen.queryByRole("tab", { name: "Bandeja de revisión" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Prórrogas" })).not.toBeInTheDocument();
  });

  it("el equipo de auditoría ve todos los planes, con causa raíz e historial", async () => {
    await abrirDetalle(plan());

    expect(api.listarPlanesAccion).toHaveBeenCalled();
    expect(screen.getByText(/Causa Raíz/)).toBeInTheDocument();
    expect(screen.getByTestId("historial")).toBeInTheDocument();
  });

  it("muestra en qué revisión va el plan", async () => {
    await abrirDetalle(conEstado("Borrador", { etapa: "definicion" }));
    expect(screen.getAllByText("Validación del plan").length).toBeGreaterThan(0);
  });

  it("muestra la etapa de cierre en un plan validado", async () => {
    await abrirDetalle(plan());
    expect(screen.getAllByText("Cierre y evidencia").length).toBeGreaterThan(0);
  });
});

describe("envío a validación", () => {
  it("el Auditor envía un borrador con pasos, aunque no estén completos", async () => {
    vi.mocked(api.enviarPlanARevision).mockResolvedValue(conEstado("Pendiente", { etapa: "definicion" }));
    const usuario = await abrirDetalle(conEstado("Borrador", { etapa: "definicion", pasos: [paso(false, 0)] }));

    await usuario.click(screen.getByRole("button", { name: "Enviar a validación" }));

    await waitFor(() => expect(api.enviarPlanARevision).toHaveBeenCalledWith(7));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Enviar a validación" })).not.toBeInTheDocument());
  });

  it("no se ofrece sin pasos", async () => {
    await abrirDetalle(conEstado("Borrador", { etapa: "definicion", pasos: [] }));
    expect(screen.queryByRole("button", { name: "Enviar a validación" })).not.toBeInTheDocument();
  });

  it("tras un rechazo se ofrece reenviar", async () => {
    vi.mocked(api.obtenerFlujoPlan).mockResolvedValue({ eventos: [], firmaIntegra: null });
    await abrirDetalle(conEstado("Rechazado", { etapa: "definicion", pasos: [paso(false, 0)] }));
    expect(await screen.findByRole("button", { name: "Reenviar a validación" })).toBeInTheDocument();
  });
});

describe("envío al cierre", () => {
  it("con todos los pasos completos y con evidencia lo envía", async () => {
    vi.mocked(api.enviarPlanARevision).mockResolvedValue(conEstado("Pendiente"));
    const usuario = await abrirDetalle(plan());

    await usuario.click(screen.getByRole("button", { name: "Enviar a revisión" }));

    await waitFor(() => expect(api.enviarPlanARevision).toHaveBeenCalledWith(7));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Enviar a revisión" })).not.toBeInTheDocument());
    expect(screen.getAllByText("Pendiente").length).toBeGreaterThan(0);
  });

  it.each([
    ["con pasos incompletos", [paso(false)]],
    ["con un paso sin evidencia", [paso(true, 0)]],
    ["sin pasos", []],
  ])("no se ofrece %s", async (_caso, pasos) => {
    await abrirDetalle(plan({ pasos }));
    expect(screen.queryByRole("button", { name: /Enviar a revisión/ })).not.toBeInTheDocument();
  });

  it.each(["Jefe de Auditoría", "Administrador", "Solo Lectura"])("%s no lo puede enviar", async (rol) => {
    sesion.usuario = { id: 2, rol };
    await abrirDetalle(plan());
    expect(screen.queryByRole("button", { name: /Enviar a revisión/ })).not.toBeInTheDocument();
  });

  it("un Auditor con un paso asignado en un plan anterior no lo envía", async () => {
    sesion.usuario = { id: 6, rol: "Auditor" };
    await abrirDetalle(plan());
    expect(screen.queryByRole("button", { name: /Enviar a revisión/ })).not.toBeInTheDocument();
  });

  it.each(["Pendiente", "En Revisión", "Aprobado"] as const)("no se ofrece con el plan %s", async (estado) => {
    await abrirDetalle(conEstado(estado));
    expect(screen.queryByRole("button", { name: /a revisión/ })).not.toBeInTheDocument();
  });
});

describe("plan rechazado", () => {
  const evento = {
    id: 1,
    planAccionId: 7,
    etapa: "cierre" as const,
    accion: "rechazo" as const,
    estadoAnterior: "En Revisión" as const,
    estadoNuevo: "Rechazado" as const,
    actor: { id: 2, nombre: "María García", rol: "Jefe de Auditoría" },
    motivo: "Falta evidencia del paso 2",
    firmaHash: null,
    fecha: "2026-11-04T10:00:00.000Z",
    evidenciasObservadas: [{ evidenciaId: "EV-1", pasoId: 11, nombre: "conciliacion.pdf" }],
  };

  it("muestra el motivo y los archivos señalados, y permite reenviar", async () => {
    vi.mocked(api.obtenerFlujoPlan).mockResolvedValue({ eventos: [evento], firmaIntegra: null });
    vi.mocked(api.enviarPlanARevision).mockResolvedValue(conEstado("Pendiente"));

    const usuario = await abrirDetalle(conEstado("Rechazado"));

    expect(await screen.findByText(/Falta evidencia del paso 2/)).toBeInTheDocument();
    expect(screen.getByText(/conciliacion\.pdf/)).toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: "Reenviar a revisión" }));

    await waitFor(() => expect(api.enviarPlanARevision).toHaveBeenCalledWith(7));
  });

  it("si no se puede leer el motivo, sigue permitiendo reenviar", async () => {
    vi.mocked(api.obtenerFlujoPlan).mockRejectedValue(new Error("Sin conexión"));

    await abrirDetalle(conEstado("Rechazado"));

    expect(await screen.findByRole("button", { name: "Reenviar a revisión" })).toBeInTheDocument();
  });
});

describe("edición desde Seguimiento", () => {
  it("el Auditor corrige un plan rechazado en definición y la lista se actualiza", async () => {
    vi.mocked(api.obtenerFlujoPlan).mockResolvedValue({ eventos: [], firmaIntegra: null });
    const usuario = await abrirDetalle(conEstado("Rechazado", { etapa: "definicion" }));

    await usuario.click(await screen.findByRole("button", { name: "Editar plan" }));
    await usuario.click(screen.getByRole("button", { name: "Guardar formulario" }));

    expect(await screen.findAllByText("Título corregido")).not.toHaveLength(0);
  });

  it.each(["Pendiente", "En Revisión", "Aprobado"] as const)("no se ofrece con el plan %s", async (estado) => {
    await abrirDetalle(conEstado(estado));
    expect(screen.queryByRole("button", { name: "Editar plan" })).not.toBeInTheDocument();
  });

  it.each(["Jefe de Auditoría", "Administrador"])("%s no edita", async (rol) => {
    sesion.usuario = { id: 2, rol };
    await abrirDetalle(conEstado("Borrador", { etapa: "definicion" }));
    expect(screen.queryByRole("button", { name: "Editar plan" })).not.toBeInTheDocument();
  });
});

describe("marcar un paso desde Seguimiento", () => {
  const pasoDe = (id: number) => ({ ...paso(false), usuarioAsignado: { id, nombre: "Otra persona" } });

  it("el paso de otra persona muestra un error", async () => {
    const usuario = await abrirDetalle(plan({ pasos: [pasoDe(6)] }));

    await usuario.click(screen.getByTitle("Solo el responsable asignado puede cambiar este estatus"));

    expect(toast.error).toHaveBeenCalledWith("Solo puedes modificar el estatus de tus propios pasos asignados.");
    expect(api.actualizarPasoPlanAccion).not.toHaveBeenCalled();
  });

  it("un paso propio se tacha de inmediato", async () => {
    vi.mocked(api.actualizarPasoPlanAccion).mockReturnValue(new Promise(() => {}));
    const usuario = await abrirDetalle(plan({ pasos: [pasoDe(5)] }));

    await usuario.click(screen.getByTitle("Marcar como completado"));

    expect(screen.getByTitle("Marcar como pendiente")).toBeInTheDocument();
  });

  it("si el servidor lo rechaza lo deshace", async () => {
    vi.mocked(api.actualizarPasoPlanAccion).mockRejectedValue(new Error("No se pudo"));
    const usuario = await abrirDetalle(plan({ pasos: [pasoDe(5)] }));

    await usuario.click(screen.getByTitle("Marcar como completado"));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("No se pudo"));
    expect(await screen.findByTitle("Marcar como completado")).toBeInTheDocument();
  });
});

describe("llegar desde una notificación", () => {
  const destino = (pestana: api.PestanaPlanes, planId = 7) => ({ planId, pestana, solicitud: 1 });

  it("el Jefe de Auditoría llega a la bandeja con el plan indicado", async () => {
    sesion.usuario = { id: 2, rol: "Jefe de Auditoría" };

    render(<VistaPlanesAccion destino={destino("revision")} />);

    expect(await screen.findByTestId("bandeja")).toHaveAttribute("data-plan", "7");
  });

  it("el Jefe de Auditoría llega a las prórrogas", async () => {
    sesion.usuario = { id: 2, rol: "Jefe de Auditoría" };

    render(<VistaPlanesAccion destino={destino("prorrogas")} />);

    expect(await screen.findByTestId("prorrogas")).toHaveAttribute("data-plan", "7");
  });

  it("cambia de pestaña si la vista ya estaba abierta", async () => {
    sesion.usuario = { id: 2, rol: "Jefe de Auditoría" };
    const { rerender } = render(<VistaPlanesAccion />);
    await screen.findByRole("tab", { name: "Seguimiento" });

    rerender(<VistaPlanesAccion destino={destino("prorrogas")} />);

    expect(await screen.findByTestId("prorrogas")).toBeInTheDocument();
  });

  it("al cambiar de pestaña a mano, la notificación ya no vuelve a abrir el plan", async () => {
    sesion.usuario = { id: 2, rol: "Jefe de Auditoría" };
    render(<VistaPlanesAccion destino={destino("revision")} />);
    const usuario = userEvent.setup();
    expect(await screen.findByTestId("bandeja")).toHaveAttribute("data-plan", "7");

    await usuario.click(screen.getByRole("tab", { name: "Seguimiento" }));
    await usuario.click(screen.getByRole("tab", { name: "Bandeja de revisión" }));

    expect(screen.getByTestId("bandeja")).not.toHaveAttribute("data-plan");
  });

  it("el auditor llega al plan abierto en Seguimiento", async () => {
    vi.mocked(api.listarPlanesAccion).mockResolvedValue([plan()]);

    render(<VistaPlanesAccion destino={destino("seguimiento")} />);

    expect(await screen.findByTestId("historial")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ocultar detalles/ })).toBeInTheDocument();
  });

  it("si el plan no aparece lo avisa", async () => {
    vi.mocked(api.listarPlanesAccion).mockResolvedValue([plan()]);

    render(<VistaPlanesAccion destino={destino("seguimiento", 99)} />);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("ya no está disponible")));
  });

  it("el auditado llega a su portal con el plan indicado", async () => {
    sesion.usuario = { id: 6, rol: "Jefe Auditado" };

    render(<VistaPlanesAccion destino={destino("seguimiento")} />);

    expect(await screen.findByTestId("portal")).toHaveAttribute("data-plan", "7");
  });
});
