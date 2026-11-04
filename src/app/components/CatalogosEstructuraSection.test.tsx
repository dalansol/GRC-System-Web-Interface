import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "../api/cliente";
import * as api from "../api/catalogos";
import type { OpcionCatalogo, TipoCatalogo } from "../api/catalogos";
import { CatalogosEstructuraSection } from "./CatalogosEstructuraSection";

vi.mock("../api/catalogos", async (original) => ({
  ...(await original<typeof api>()),
  listarOpciones: vi.fn(),
  crearOpcion: vi.fn(),
  renombrarOpcion: vi.fn(),
  eliminarOpcion: vi.fn(),
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

let datos: Record<TipoCatalogo, OpcionCatalogo[]>;

beforeEach(() => {
  vi.clearAllMocks();
  datos = {
    area: [
      { id: 1, valor: "Compras", usos: 0 },
      { id: 2, valor: "Nómina", usos: 3 },
    ],
    pais: [{ id: 10, valor: "México", usos: 1 }],
  };
  vi.mocked(api.listarOpciones).mockImplementation(async (tipo) => datos[tipo]);
});

describe("Catálogos de la estructura en Ajustes (SF-03)", () => {
  it("muestra las opciones de cada catálogo con sus usos", async () => {
    const usuario = userEvent.setup();
    render(<CatalogosEstructuraSection />);

    expect(await screen.findByTestId("opcion-area-2")).toHaveTextContent("En uso por 3");
    expect(screen.getByTestId("opcion-area-1")).toHaveTextContent("Sin uso");

    await usuario.click(screen.getByRole("tab", { name: /Países o regiones/ }));
    expect(screen.getByTestId("opcion-pais-10")).toHaveTextContent("México");
    expect(screen.queryByTestId("opcion-area-1")).not.toBeInTheDocument();
  });

  it("filtra con el buscador sin distinguir acentos", async () => {
    const usuario = userEvent.setup();
    render(<CatalogosEstructuraSection />);
    await screen.findByTestId("opcion-area-1");

    await usuario.type(screen.getByLabelText("Buscar área"), "nomina");
    expect(screen.getByTestId("opcion-area-2")).toBeInTheDocument();
    expect(screen.queryByTestId("opcion-area-1")).not.toBeInTheDocument();
  });

  it("agrega una opción y vuelve a leer el catálogo", async () => {
    const usuario = userEvent.setup();
    vi.mocked(api.crearOpcion).mockImplementation(async (_tipo, valor) => {
      const nueva = { id: 3, valor, usos: 0 };
      datos.area = [...datos.area, nueva];
      return nueva;
    });
    render(<CatalogosEstructuraSection />);
    await screen.findByTestId("opcion-area-1");

    await usuario.type(screen.getByLabelText("Nueva opción de área"), "Auditoría Forense");
    await usuario.click(screen.getByRole("button", { name: "Agregar" }));

    expect(api.crearOpcion).toHaveBeenCalledWith("area", "Auditoría Forense");
    expect(await screen.findByTestId("opcion-area-3")).toHaveTextContent("Auditoría Forense");
    expect(screen.getByLabelText("Nueva opción de área")).toHaveValue("");
  });

  it("muestra el aviso del servidor si la opción ya existe", async () => {
    const usuario = userEvent.setup();
    const mensaje = 'Ya existe una opción con el nombre "compras".';
    vi.mocked(api.crearOpcion).mockRejectedValue(new ErrorApi(409, "NOMBRE_DUPLICADO", mensaje));
    render(<CatalogosEstructuraSection />);
    await screen.findByTestId("opcion-area-1");

    await usuario.type(screen.getByLabelText("Nueva opción de área"), "compras");
    await usuario.click(screen.getByRole("button", { name: "Agregar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(mensaje);
  });

  it("renombra una opción en uso y avisa cuántos registros actualizó", async () => {
    const usuario = userEvent.setup();
    vi.mocked(api.renombrarOpcion).mockResolvedValue({ id: 2, valor: "Nómina y Compensaciones", usos: 3 });
    render(<CatalogosEstructuraSection />);
    await screen.findByTestId("opcion-area-2");

    await usuario.click(screen.getByRole("button", { name: "Renombrar Nómina" }));
    const campo = screen.getByLabelText("Nuevo valor para Nómina");
    await usuario.clear(campo);
    await usuario.type(campo, "Nómina y Compensaciones{Enter}");

    expect(api.renombrarOpcion).toHaveBeenCalledWith("area", 2, "Nómina y Compensaciones");
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        'Se renombró "Nómina" a "Nómina y Compensaciones" y se actualizaron 3 registros.',
      ),
    );
  });

  it("no deja eliminar una opción en uso; una libre se elimina tras confirmar", async () => {
    const usuario = userEvent.setup();
    vi.mocked(api.eliminarOpcion).mockImplementation(async () => {
      datos.area = datos.area.filter((o) => o.id !== 1);
    });
    render(<CatalogosEstructuraSection />);
    await screen.findByTestId("opcion-area-1");

    expect(screen.getByRole("button", { name: "Eliminar Nómina" })).toBeDisabled();

    await usuario.click(screen.getByRole("button", { name: "Eliminar Compras" }));
    await usuario.click(within(screen.getByTestId("opcion-area-1")).getByRole("button", { name: "Eliminar" }));

    expect(api.eliminarOpcion).toHaveBeenCalledWith("area", 1);
    await waitFor(() => expect(screen.queryByTestId("opcion-area-1")).not.toBeInTheDocument());
  });
});
