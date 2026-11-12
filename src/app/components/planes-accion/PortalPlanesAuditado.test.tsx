import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "../../api/cliente";
import * as api from "../../api/planesAccion";
import type { PasoAuditado, PlanAuditado, SolicitudProrroga } from "../../api/planesAccion";
import PortalPlanesAuditado from "./PortalPlanesAuditado";

vi.mock("../../api/planesAccion", async (original) => ({
  ...(await original<typeof api>()),
  listarPlanesAuditado: vi.fn(),
  actualizarPasoPlanAccion: vi.fn(),
  solicitarProrroga: vi.fn(),
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const evidencias = vi.hoisted(() => vi.fn());
vi.mock("../EvidenciasSection", () => ({
  default: (props: Record<string, unknown>) => {
    evidencias(props);
    return <div data-testid="evidencias" />;
  },
}));

const paso = (cambios: Partial<PasoAuditado> = {}): PasoAuditado => ({
  id: 11,
  descripcion: "Revisar conciliaciones",
  fechaCompromiso: "2027-01-01",
  completado: false,
  evidenciasCount: 1,
  usuarioAsignado: { id: 6, nombre: "Javier Ejemplo" },
  esMio: true,
  ...cambios,
});

const plan = (cambios: Partial<PlanAuditado> = {}): PlanAuditado => ({
  id: 7,
  publicId: "PACC-2026-007",
  titulo: "Corregir conciliaciones",
  estado: "Asignado",
  fechaCompromiso: "2027-01-15",
  hallazgo: { folio: "HAL-2025-003", titulo: "Falta de revisión mensual" },
  esResponsable: true,
  pasos: [paso()],
  rechazo: null,
  prorroga: null,
  ...cambios,
});

const prorroga = (cambios: Partial<SolicitudProrroga> = {}): SolicitudProrroga => ({
  id: 3,
  planAccionId: 7,
  folioPlan: "PACC-2026-007",
  solicitadaPor: { id: 6, nombre: "Javier Ejemplo" },
  fechaActual: "2027-01-15",
  fechaPropuesta: "2027-03-01",
  justificacion: "Depende de un proveedor",
  estado: "Pendiente",
  motivoDecision: null,
  creadaEn: "2026-11-01T00:00:00.000Z",
  ...cambios,
});

beforeEach(() => {
  vi.clearAllMocks();
});

async function abrir(planes: PlanAuditado[]) {
  vi.mocked(api.listarPlanesAuditado).mockResolvedValue(planes);
  render(<PortalPlanesAuditado />);
  return userEvent.setup();
}

describe("lo que ve el auditado", () => {
  it("muestra el folio, el título, el hallazgo, la fecha y el estado", async () => {
    await abrir([plan()]);

    expect(await screen.findByText("PACC-2026-007")).toBeInTheDocument();
    expect(screen.getByText("Corregir conciliaciones")).toBeInTheDocument();
    expect(screen.getByText(/HAL-2025-003/)).toBeInTheDocument();
    expect(screen.getByText(/Falta de revisión mensual/)).toBeInTheDocument();
    expect(screen.getByText(/2027-01-15/)).toBeInTheDocument();
    expect(screen.getByText("Asignado")).toBeInTheDocument();
  });

  it("no muestra historial, causa raíz, severidad ni firma", async () => {
    await abrir([plan()]);
    await screen.findByText("PACC-2026-007");

    for (const texto of [/Historial/, /Causa Raíz/i, /Severidad/, /Firmado/, /Huella/]) {
      expect(screen.queryByText(texto)).not.toBeInTheDocument();
    }
  });

  it("no ofrece crear, editar ni enviar a revisión", async () => {
    await abrir([plan({ pasos: [paso({ completado: true })] })]);
    await screen.findByText("PACC-2026-007");

    for (const nombre of [/Crear/, /Editar/, /Enviar/, /Reenviar/]) {
      expect(screen.queryByRole("button", { name: nombre })).not.toBeInTheDocument();
    }
  });

  it("avisa cuando no tiene planes", async () => {
    await abrir([]);
    expect(await screen.findByText(/No tienes planes de acción asignados/)).toBeInTheDocument();
  });

  it("muestra un error si no se pueden cargar", async () => {
    vi.mocked(api.listarPlanesAuditado).mockRejectedValue(new ErrorApi(0, "SIN_CONEXION", "Sin conexión"));
    render(<PortalPlanesAuditado />);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Sin conexión"));
  });
});

describe("sus pasos", () => {
  it("al marcar su paso se tacha de inmediato, sin esperar al servidor", async () => {
    vi.mocked(api.actualizarPasoPlanAccion).mockReturnValue(new Promise(() => {}));
    const usuario = await abrir([plan()]);

    await usuario.click(await screen.findByRole("button", { name: "Marcar como completado" }));

    expect(api.actualizarPasoPlanAccion).toHaveBeenCalledWith(7, 11, true);
    expect(screen.getByRole("button", { name: "Marcar como pendiente" })).toBeInTheDocument();
    expect(screen.getByText("Revisar conciliaciones")).toHaveClass("line-through");
  });

  it("no recarga la lista al marcar un paso", async () => {
    vi.mocked(api.actualizarPasoPlanAccion).mockResolvedValue({} as never);
    const usuario = await abrir([plan()]);

    await usuario.click(await screen.findByRole("button", { name: "Marcar como completado" }));

    await waitFor(() => expect(api.actualizarPasoPlanAccion).toHaveBeenCalledTimes(1));
    expect(api.listarPlanesAuditado).toHaveBeenCalledTimes(1);
  });

  it("si el servidor lo rechaza lo deshace y muestra el error", async () => {
    vi.mocked(api.actualizarPasoPlanAccion).mockRejectedValue(new ErrorApi(409, "PLAN_BLOQUEADO", "El plan ya está en revisión."));
    const usuario = await abrir([plan()]);

    await usuario.click(await screen.findByRole("button", { name: "Marcar como completado" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("El plan ya está en revisión."));
    expect(await screen.findByRole("button", { name: "Marcar como completado" })).toBeInTheDocument();
    expect(screen.getByText("Revisar conciliaciones")).not.toHaveClass("line-through");
  });

  it("un doble clic mientras se guarda solo manda un cambio", async () => {
    vi.mocked(api.actualizarPasoPlanAccion).mockReturnValue(new Promise(() => {}));
    const usuario = await abrir([plan()]);

    await usuario.dblClick(await screen.findByRole("button", { name: "Marcar como completado" }));

    expect(api.actualizarPasoPlanAccion).toHaveBeenCalledTimes(1);
  });

  it("marcar el paso de otra persona muestra un error y no cambia nada", async () => {
    const usuario = await abrir([plan({ pasos: [paso({ esMio: false, usuarioAsignado: { id: 8, nombre: "Charlie Ejemplo" } })] })]);

    await usuario.click(await screen.findByRole("button", { name: "Paso asignado a Charlie Ejemplo" }));

    expect(toast.error).toHaveBeenCalledWith("Solo Charlie Ejemplo puede marcar este paso.");
    expect(api.actualizarPasoPlanAccion).not.toHaveBeenCalled();
    expect(screen.getByText("Revisar conciliaciones")).not.toHaveClass("line-through");
  });

  it("sin evidencia no lo completa y lo explica", async () => {
    const usuario = await abrir([plan({ pasos: [paso({ evidenciasCount: 0 })] })]);

    await usuario.click(await screen.findByRole("button", { name: "Marcar como completado" }));

    expect(api.actualizarPasoPlanAccion).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("evidencia"));
  });

  it("un paso ajeno se ve, pero no se cambia ni se sube evidencia", async () => {
    const usuario = await abrir([plan({ pasos: [paso({ esMio: false, usuarioAsignado: { id: 8, nombre: "Charlie Ejemplo" } })] })]);

    expect(await screen.findByText("Charlie Ejemplo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar como completado" })).not.toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: "Ver evidencia" }));

    expect(evidencias).toHaveBeenCalledWith(expect.objectContaining({ entityId: "11", entityType: "action_plan_step", puedeSubir: false }));
  });

  it("en su paso puede subir evidencia", async () => {
    const usuario = await abrir([plan()]);

    await usuario.click(await screen.findByRole("button", { name: "Ver evidencia" }));

    expect(evidencias).toHaveBeenCalledWith(expect.objectContaining({ puedeSubir: true }));
  });

  it.each(["Pendiente", "En Revisión", "Aprobado"] as const)("con el plan %s no se cambia nada", async (estado) => {
    const usuario = await abrir([plan({ estado })]);

    expect(await screen.findByText(estado)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar como completado" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Solicitar prórroga" })).not.toBeInTheDocument();

    await usuario.click(screen.getByRole("button", { name: "Paso bloqueado" }));
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("no puede modificarse"));
    expect(api.actualizarPasoPlanAccion).not.toHaveBeenCalled();

    await usuario.click(screen.getByRole("button", { name: "Ver evidencia" }));

    expect(evidencias).toHaveBeenCalledWith(expect.objectContaining({ puedeSubir: false }));
  });
});

describe("plan rechazado", () => {
  const rechazado = plan({
    estado: "Rechazado",
    rechazo: {
      motivo: "Falta el soporte de marzo",
      fecha: "2026-11-01T00:00:00.000Z",
      evidenciasObservadas: [{ evidenciaId: "EV-1", pasoId: 11, nombre: "conciliacion.pdf" }],
    },
  });

  it("muestra el motivo", async () => {
    await abrir([rechazado]);
    expect(await screen.findByText(/Falta el soporte de marzo/)).toBeInTheDocument();
  });

  it("señala los archivos observados en su paso", async () => {
    await abrir([rechazado]);

    const aviso = await screen.findByTestId("observados-11");

    expect(within(aviso).getByText(/conciliacion\.pdf/)).toBeInTheDocument();
    expect(within(aviso).getByText(/vuelve a marcar el paso/)).toBeInTheDocument();
  });

  it("no marca archivos en los pasos sin observaciones", async () => {
    await abrir([{ ...rechazado, rechazo: { ...rechazado.rechazo!, evidenciasObservadas: [] } }]);
    await screen.findByText(/Falta el soporte de marzo/);

    expect(screen.queryByTestId("observados-11")).not.toBeInTheDocument();
  });

  it("puede volver a trabajar en su paso", async () => {
    await abrir([rechazado]);
    expect(await screen.findByRole("button", { name: "Marcar como completado" })).toBeInTheDocument();
  });

  it("al volver a marcar el paso señalado desaparecen sus avisos", async () => {
    vi.mocked(api.actualizarPasoPlanAccion).mockResolvedValue(undefined as never);
    const usuario = await abrir([rechazado]);
    await screen.findByTestId("observados-11");

    await usuario.click(screen.getByRole("button", { name: "Marcar como completado" }));

    await waitFor(() => expect(screen.queryByTestId("observados-11")).not.toBeInTheDocument());
    expect(screen.queryByText(/Falta el soporte de marzo/)).not.toBeInTheDocument();
    expect(api.actualizarPasoPlanAccion).toHaveBeenCalledWith(7, 11, true);
  });

  it("si el servidor no acepta el cambio, los avisos vuelven", async () => {
    vi.mocked(api.actualizarPasoPlanAccion).mockRejectedValue(new Error("Sin conexión"));
    const usuario = await abrir([rechazado]);
    await screen.findByTestId("observados-11");

    await usuario.click(screen.getByRole("button", { name: "Marcar como completado" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(await screen.findByTestId("observados-11")).toBeInTheDocument();
    expect(screen.getByText(/Falta el soporte de marzo/)).toBeInTheDocument();
  });

  it("al recargar, un paso señalado ya corregido no muestra avisos", async () => {
    await abrir([{ ...rechazado, pasos: [paso({ completado: true })] }]);
    await screen.findByText("PACC-2026-007");

    expect(screen.queryByTestId("observados-11")).not.toBeInTheDocument();
    expect(screen.queryByText(/Falta el soporte de marzo/)).not.toBeInTheDocument();
  });

  it("un rechazo sin archivos señalados mantiene el motivo aunque los pasos estén completos", async () => {
    await abrir([{ ...rechazado, pasos: [paso({ completado: true })], rechazo: { ...rechazado.rechazo!, evidenciasObservadas: [] } }]);
    expect(await screen.findByText(/Falta el soporte de marzo/)).toBeInTheDocument();
  });
});

describe("solicitud de prórroga", () => {
  async function abrirDialogo(datos = plan()) {
    const usuario = await abrir([datos]);
    await usuario.click(await screen.findByRole("button", { name: "Solicitar prórroga" }));
    return usuario;
  }

  it("el responsable la envía con fecha y justificación", async () => {
    vi.mocked(api.solicitarProrroga).mockResolvedValue(prorroga());
    const usuario = await abrirDialogo();

    await usuario.type(await screen.findByLabelText("Nueva fecha propuesta"), "2027-03-01");
    await usuario.type(screen.getByLabelText("Justificación"), "  Depende de un proveedor  ");
    await usuario.click(screen.getByRole("button", { name: "Enviar solicitud" }));

    await waitFor(() =>
      expect(api.solicitarProrroga).toHaveBeenCalledWith(7, { fechaPropuesta: "2027-03-01", justificacion: "Depende de un proveedor" }),
    );
    expect(toast.success).toHaveBeenCalled();
    await waitFor(() => expect(api.listarPlanesAuditado).toHaveBeenCalledTimes(2));
  });

  it("sin fecha o sin justificación no la envía y lo pide", async () => {
    const usuario = await abrirDialogo();

    await usuario.click(await screen.findByRole("button", { name: "Enviar solicitud" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Indica la nueva fecha y la justificación.");
    expect(api.solicitarProrroga).not.toHaveBeenCalled();
  });

  it("muestra el error del servidor", async () => {
    vi.mocked(api.solicitarProrroga).mockRejectedValue(new ErrorApi(400, "DATOS_INVALIDOS", "La fecha propuesta debe ser posterior."));
    const usuario = await abrirDialogo();

    await usuario.type(await screen.findByLabelText("Nueva fecha propuesta"), "2027-03-01");
    await usuario.type(screen.getByLabelText("Justificación"), "Motivo");
    await usuario.click(screen.getByRole("button", { name: "Enviar solicitud" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("La fecha propuesta debe ser posterior.");
  });

  it("un asignado que no es responsable no la ve", async () => {
    await abrir([plan({ esResponsable: false })]);
    await screen.findByText("PACC-2026-007");

    expect(screen.queryByRole("button", { name: "Solicitar prórroga" })).not.toBeInTheDocument();
  });

  it("con una solicitud abierta muestra la fecha propuesta y no permite otra", async () => {
    await abrir([plan({ prorroga: prorroga() })]);

    expect(await screen.findByText(/Prórroga solicitada.*2027-03-01/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Solicitar prórroga" })).not.toBeInTheDocument();
  });

  it("muestra el motivo si se rechazó y permite pedir otra", async () => {
    await abrir([plan({ prorroga: prorroga({ estado: "Rechazada", motivoDecision: "No procede" }) })]);

    expect(await screen.findByText(/Prórroga rechazada.*No procede/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Solicitar prórroga" })).toBeInTheDocument();
  });
});

describe("llegar desde una notificación", () => {
  it("resalta el plan", async () => {
    vi.mocked(api.listarPlanesAuditado).mockResolvedValue([plan(), plan({ id: 8, publicId: "PACC-2026-008" })]);
    render(<PortalPlanesAuditado destino={{ planId: 7, pestana: "seguimiento", solicitud: 1 }} />);

    expect((await screen.findByText("PACC-2026-007")).closest("[data-destacado]")).not.toBeNull();
    expect(screen.getByText("PACC-2026-008").closest("[data-destacado]")).toBeNull();
    expect(api.listarPlanesAuditado).toHaveBeenCalledTimes(1);
  });

  it("si ya no lo tiene asignado lo avisa", async () => {
    vi.mocked(api.listarPlanesAuditado).mockResolvedValue([plan()]);
    render(<PortalPlanesAuditado destino={{ planId: 99, pestana: "seguimiento", solicitud: 1 }} />);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("ya no está entre tus planes")));
  });
});
