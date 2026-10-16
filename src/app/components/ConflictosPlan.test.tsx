import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "../api/cliente";
import * as api from "../api/conflictos";
import type { DeclaracionConflicto, MiDeclaracion } from "../api/conflictos";
import { AvisoDeclaracionesPendientes, EtiquetaConflictoPlan, SeccionConflictosPlan } from "./ConflictosPlan";

vi.mock("../api/conflictos", async (original) => ({
  ...(await original<typeof api>()),
  obtenerMiDeclaracion: vi.fn(),
  listarDeclaraciones: vi.fn(),
  listarPlanesPendientes: vi.fn(),
  declararConflictos: vi.fn(),
}));

const sesion = vi.hoisted(() => ({ usuario: { id: 5, nombre: "Ana Rodríguez", rol: "Auditor" } }));
vi.mock("../auth/SesionContext", () => ({ useSesion: () => sesion }));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const PLAN = { id: 2, codigo: "PAI-2025-002", nombre: "Plan Auditoría TI & Ciberseguridad" };

const pendiente: MiDeclaracion = { plan: PLAN, asignado: true, declaracion: null, puedeEvaluar: false };

const conConflicto: DeclaracionConflicto = {
  id: 1,
  plan: PLAN,
  auditor: { id: 5, nombre: "Ana Rodríguez" },
  tieneConflicto: true,
  justificacion: "Mi hermano trabaja en el área auditada.",
  declaradoEn: "2026-10-15T22:36:27.622Z",
};

// Igual que la fila del plan en VistaPlanesAudito: la etiqueta junto al nombre y la sección en el detalle.
function Plan() {
  return (
    <div>
      <EtiquetaConflictoPlan planId="2" />
      <SeccionConflictosPlan planId="2" />
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sesion.usuario.rol = "Auditor";
  vi.mocked(api.obtenerMiDeclaracion).mockResolvedValue(pendiente);
  vi.mocked(api.listarDeclaraciones).mockResolvedValue([]);
  vi.mocked(api.listarPlanesPendientes).mockResolvedValue([PLAN]);
});

async function abrirFormulario() {
  render(<Plan />);
  const usuario = userEvent.setup();
  await usuario.click(await screen.findByRole("button", { name: "Declarar conflictos" }));
  return usuario;
}

describe("auditor asignado sin declaración", () => {
  it("avisa que no puede evaluar los controles del plan", async () => {
    render(<Plan />);
    expect(await screen.findByText(/No puedes evaluar los controles de este plan/)).toBeInTheDocument();
    expect(screen.queryByText("Conflicto declarado")).not.toBeInTheDocument();
  });

  it("no consulta todas las declaraciones si no es jefatura", async () => {
    render(<Plan />);
    await screen.findByText(/No puedes evaluar/);
    expect(api.listarDeclaraciones).not.toHaveBeenCalled();
  });
});

describe("formulario de declaración", () => {
  it("pide elegir una opción antes de enviar", async () => {
    const usuario = await abrirFormulario();
    await usuario.click(screen.getByRole("button", { name: "Enviar declaración" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Indica si tienes o no un conflicto de interés.");
    expect(api.declararConflictos).not.toHaveBeenCalled();
  });

  it("la justificación solo aparece al elegir que sí hay conflicto", async () => {
    const usuario = await abrirFormulario();
    expect(screen.queryByLabelText("Justificación (obligatoria)")).not.toBeInTheDocument();
    await usuario.click(screen.getByLabelText("Sí, tengo un conflicto de interés"));
    expect(screen.getByLabelText("Justificación (obligatoria)")).toBeInTheDocument();
  });

  it("exige la justificación cuando hay conflicto y no envía nada", async () => {
    const usuario = await abrirFormulario();
    await usuario.click(screen.getByLabelText("Sí, tengo un conflicto de interés"));
    await usuario.type(screen.getByLabelText("Justificación (obligatoria)"), "   ");
    await usuario.click(screen.getByRole("button", { name: "Enviar declaración" }));

    expect(screen.getByRole("alert")).toHaveTextContent(api.MENSAJE_JUSTIFICACION_OBLIGATORIA);
    expect(api.declararConflictos).not.toHaveBeenCalled();
  });

  it("declara sin conflicto y desbloquea la evaluación", async () => {
    vi.mocked(api.declararConflictos).mockResolvedValue({ ...conConflicto, tieneConflicto: false, justificacion: null });
    const usuario = await abrirFormulario();
    vi.mocked(api.obtenerMiDeclaracion).mockResolvedValue({
      ...pendiente,
      declaracion: { ...conConflicto, tieneConflicto: false, justificacion: null },
      puedeEvaluar: true,
    });
    await usuario.click(screen.getByLabelText("No tengo conflictos de interés"));
    await usuario.click(screen.getByRole("button", { name: "Enviar declaración" }));

    expect(api.declararConflictos).toHaveBeenCalledWith(2, { tieneConflicto: false });
    expect(await screen.findByText(/Evaluación de controles habilitada/)).toBeInTheDocument();
    expect(screen.queryByText(/No puedes evaluar/)).not.toBeInTheDocument();
    expect(screen.queryByText("Conflicto declarado")).not.toBeInTheDocument();
  });

  it("declara un conflicto con justificación y muestra la alerta visual", async () => {
    vi.mocked(api.declararConflictos).mockResolvedValue(conConflicto);
    const usuario = await abrirFormulario();
    vi.mocked(api.obtenerMiDeclaracion).mockResolvedValue({ ...pendiente, declaracion: conConflicto, puedeEvaluar: true });
    await usuario.click(screen.getByLabelText("Sí, tengo un conflicto de interés"));
    await usuario.type(screen.getByLabelText("Justificación (obligatoria)"), "  Mi hermano trabaja en el área auditada.  ");
    await usuario.click(screen.getByRole("button", { name: "Enviar declaración" }));

    expect(api.declararConflictos).toHaveBeenCalledWith(2, {
      tieneConflicto: true,
      justificacion: "Mi hermano trabaja en el área auditada.",
    });
    expect(await screen.findByText("Conflicto declarado")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("La jefatura de auditoría fue notificada");
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("jefatura"));
  });

  it("muestra el mensaje del servidor si rechaza la declaración", async () => {
    vi.mocked(api.declararConflictos).mockRejectedValue(
      new ErrorApi(409, "DECLARACION_DUPLICADA", "Ya presentaste tu declaración de conflictos en este plan."),
    );
    const usuario = await abrirFormulario();
    await usuario.click(screen.getByLabelText("No tengo conflictos de interés"));
    await usuario.click(screen.getByRole("button", { name: "Enviar declaración" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Ya presentaste tu declaración"));
  });
});

describe("aviso en la pantalla de controles", () => {
  it("lista los planes pendientes y permite declarar desde ahí", async () => {
    vi.mocked(api.declararConflictos).mockResolvedValue({ ...conConflicto, tieneConflicto: false, justificacion: null });
    render(<AvisoDeclaracionesPendientes pendientes={[PLAN]} />);
    expect(screen.getByText(/No puedes registrar horas ni enviar a revisión/)).toBeInTheDocument();
    expect(screen.getByText("PAI-2025-002")).toBeInTheDocument();

    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole("button", { name: "Declarar conflictos" }));
    await usuario.click(screen.getByLabelText("No tengo conflictos de interés"));
    await usuario.click(screen.getByRole("button", { name: "Enviar declaración" }));

    expect(api.declararConflictos).toHaveBeenCalledWith(2, { tieneConflicto: false });
    await waitFor(() => expect(screen.queryByRole("form")).not.toBeInTheDocument());
  });

  it("no muestra nada si no hay planes pendientes", () => {
    const { container } = render(<AvisoDeclaracionesPendientes pendientes={[]} />);
    expect(container.textContent).toBe("");
  });
});

describe("alerta visual en el plan", () => {
  it("el auditor que ya declaró un conflicto ve la etiqueta y su justificación", async () => {
    vi.mocked(api.obtenerMiDeclaracion).mockResolvedValue({ ...pendiente, declaracion: conConflicto, puedeEvaluar: true });
    render(<Plan />);

    expect(await screen.findByText("Conflicto declarado")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Mi hermano trabaja en el área auditada.");
    expect(screen.queryByRole("button", { name: "Declarar conflictos" })).not.toBeInTheDocument();
  });

  it("la jefatura ve los conflictos declarados por los auditores", async () => {
    sesion.usuario.rol = "Jefe de Auditoría";
    vi.mocked(api.obtenerMiDeclaracion).mockResolvedValue({ ...pendiente, asignado: false, puedeEvaluar: true });
    vi.mocked(api.listarDeclaraciones).mockResolvedValue([conConflicto]);
    render(<Plan />);

    expect(await screen.findByText("Conflicto declarado")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Ana Rodríguez declaró un conflicto de interés");
    expect(screen.queryByRole("button", { name: "Declarar conflictos" })).not.toBeInTheDocument();
  });

  it("la jefatura ve que no hay conflictos cuando nadie los declaró", async () => {
    sesion.usuario.rol = "Administrador";
    vi.mocked(api.obtenerMiDeclaracion).mockResolvedValue({ ...pendiente, asignado: false, puedeEvaluar: true });
    vi.mocked(api.listarDeclaraciones).mockResolvedValue([{ ...conConflicto, tieneConflicto: false, justificacion: null }]);
    render(<Plan />);

    expect(await screen.findByText(/Sin conflictos declarados en este plan \(1 declaración recibida\)/)).toBeInTheDocument();
    expect(screen.queryByText("Conflicto declarado")).not.toBeInTheDocument();
  });

  it("quien no está asignado ni es jefatura no ve la sección", async () => {
    sesion.usuario.rol = "Solo Lectura";
    vi.mocked(api.obtenerMiDeclaracion).mockResolvedValue({ ...pendiente, asignado: false, puedeEvaluar: true });
    const { container } = render(<Plan />);

    await waitFor(() => expect(api.obtenerMiDeclaracion).toHaveBeenCalled());
    await waitFor(() => expect(container.textContent).toBe(""));
  });

  it("si el servidor falla lo indica sin romper el plan", async () => {
    vi.mocked(api.obtenerMiDeclaracion).mockRejectedValue(new ErrorApi(0, "SIN_CONEXION", "No se pudo conectar con el servidor de Expedite."));
    render(<Plan />);
    expect(await screen.findByText(/No se pudo consultar la declaración de conflictos/)).toBeInTheDocument();
  });
});
