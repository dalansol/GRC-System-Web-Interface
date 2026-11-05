import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../../api/evidencias";
import { ErrorApi } from "../../api/cliente";
import { escribir } from "../../domain/hoja/operaciones";
import { hojaVacia, type Libro } from "../../domain/hoja/tipos";
import { escribirXlsx } from "../../domain/hoja/xlsx";
import SpreadsheetEditor from "../SpreadsheetEditor";

vi.mock("../../api/evidencias", async (original) => ({
  ...(await original<typeof api>()),
  descargarArchivoEvidencia: vi.fn(),
  guardarVersionEvidencia: vi.fn(),
  listarVersionesEvidencia: vi.fn(),
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const entrada = () => screen.getByTestId("hoja-entrada");
const celda = (ref: string) => document.querySelector(`[data-celda="${ref}"]`)?.textContent ?? "";
const barra = () => screen.getByLabelText("Barra de fórmulas") as HTMLInputElement;

/** Escribe como lo haría el usuario: la primera tecla entra a la entrada de la celda. */
function teclear(texto: string, tecla = "Enter", opciones: Partial<KeyboardEventInit> = {}) {
  fireEvent.change(entrada(), { target: { value: texto } });
  fireEvent.keyDown(entrada(), { key: tecla, ...opciones });
}

beforeEach(() => vi.clearAllMocks());

describe("Editor de hojas de cálculo", () => {
  it("escribir, Enter y fórmulas recalculan como en Excel", async () => {
    render(<SpreadsheetEditor filename="Libro.xlsx" onClose={() => {}} />);
    await screen.findByTestId("hoja-entrada");
    expect(screen.getByRole("alert")).toHaveTextContent("Vista de ejemplo");

    fireEvent.keyDown(entrada(), { key: "ArrowDown" });
    teclear("5");
    teclear("7");
    teclear("=suma(a2:a3");
    expect(celda("A4")).toBe("12");

    fireEvent.keyDown(entrada(), { key: "ArrowUp" });
    expect(barra().value).toBe("=SUMA(A2:A3)");
    expect(screen.getByLabelText("Cuadro de nombres")).toHaveValue("A4");

    // Cambiar un valor recalcula la fórmula.
    fireEvent.keyDown(entrada(), { key: "ArrowUp" });
    teclear("10");
    expect(celda("A4")).toBe("15");
  });

  it("Combinar y centrar une el rango, avisa si pierde datos y Separar lo deshace", async () => {
    render(<SpreadsheetEditor filename="Libro.xlsx" onClose={() => {}} />);
    await screen.findByTestId("hoja-entrada");
    fireEvent.keyDown(entrada(), { key: "ArrowDown" });
    teclear("Título", "Tab");
    teclear("se pierde", "Enter");
    fireEvent.keyDown(entrada(), { key: "ArrowUp" });
    fireEvent.keyDown(entrada(), { key: "ArrowLeft" });
    fireEvent.keyDown(entrada(), { key: "ArrowRight", shiftKey: true });
    fireEvent.keyDown(entrada(), { key: "ArrowRight", shiftKey: true });

    fireEvent.click(screen.getByLabelText("Combinar y centrar"));
    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-combinada="A2:C2"]')).not.toBeNull();
    expect(celda("A2")).toBe("Título");
    expect(celda("B2")).toBe("");
    expect(screen.getByLabelText("Combinar y centrar")).toHaveAttribute("aria-pressed", "true");
    // Al moverse, la combinación se selecciona completa y la flecha la salta.
    fireEvent.keyDown(entrada(), { key: "ArrowRight" });
    expect(screen.getByLabelText("Cuadro de nombres")).toHaveValue("D2");
    fireEvent.keyDown(entrada(), { key: "ArrowLeft" });
    expect(screen.getByLabelText("Cuadro de nombres")).toHaveValue("A2");

    fireEvent.click(screen.getByLabelText("Combinar y centrar: más opciones"));
    fireEvent.click(screen.getByRole("menuitem", { name: "Separar celdas" }));
    expect(document.querySelector("[data-combinada]")).toBeNull();
    expect(screen.getByLabelText("Combinar y centrar")).toHaveAttribute("aria-pressed", "false");
  });

  it("Ctrl+Z deshace y la barra de estado suma el rango seleccionado", async () => {
    render(<SpreadsheetEditor filename="Libro.xlsx" onClose={() => {}} />);
    await screen.findByTestId("hoja-entrada");
    fireEvent.keyDown(entrada(), { key: "ArrowDown" });
    teclear("4");
    teclear("6");
    fireEvent.keyDown(entrada(), { key: "ArrowUp", shiftKey: true });
    fireEvent.keyDown(entrada(), { key: "ArrowUp", shiftKey: true });
    expect(screen.getByTestId("hoja-resumen")).toHaveTextContent("Promedio: 5");
    expect(screen.getByTestId("hoja-resumen")).toHaveTextContent("Suma: 10");

    fireEvent.keyDown(entrada(), { key: "z", ctrlKey: true });
    expect(celda("A3")).toBe("");
    expect(celda("A2")).toBe("4");
  });

  it("en modo Escribir las flechas señalan referencias", async () => {
    render(<SpreadsheetEditor filename="Libro.xlsx" onClose={() => {}} />);
    await screen.findByTestId("hoja-entrada");
    fireEvent.keyDown(entrada(), { key: "ArrowDown" });
    teclear("3");
    fireEvent.change(entrada(), { target: { value: "=" } });
    expect(screen.getByTestId("hoja-modo")).toHaveTextContent("Señalar");
    fireEvent.keyDown(entrada(), { key: "ArrowUp" });
    expect((entrada() as HTMLTextAreaElement).value).toBe("=A2");
    fireEvent.change(entrada(), { target: { value: "=A2*2" } });
    fireEvent.keyDown(entrada(), { key: "Enter" });
    expect(celda("A3")).toBe("6");
  });

  it("sugiere funciones al escribir una fórmula y Tab la inserta", async () => {
    render(<SpreadsheetEditor filename="Libro.xlsx" onClose={() => {}} />);
    await screen.findByTestId("hoja-entrada");
    fireEvent.keyDown(entrada(), { key: "ArrowDown" });
    fireEvent.change(entrada(), { target: { value: "=su" } });
    const lista = screen.getByTestId("hoja-autocompletado");
    expect(within(lista).getAllByRole("option").map((o) => o.textContent)).toEqual(expect.arrayContaining([expect.stringContaining("SUMA")]));
    fireEvent.keyDown(entrada(), { key: "Tab" });
    expect((entrada() as HTMLTextAreaElement).value).toBe("=SUMA(");
    expect(screen.getByTestId("hoja-firma")).toHaveTextContent("SUMA(número1; [número2]; …)");
    fireEvent.keyDown(entrada(), { key: "Escape" });
    expect(screen.queryByTestId("hoja-autocompletado")).toBeNull();
  });

  it("Ctrl+F busca en el libro y Enter recorre las coincidencias", async () => {
    render(<SpreadsheetEditor filename="Conciliacion_Bancaria.xlsx" onClose={() => {}} />);
    await screen.findByTestId("hoja-entrada");
    fireEvent.keyDown(entrada(), { key: "f", ctrlKey: true });
    const campo = screen.getByLabelText("Texto a buscar");
    fireEvent.change(campo, { target: { value: "cobro" } });
    expect(screen.getByTestId("hoja-buscar-conteo")).toHaveTextContent("4 coincidencias");
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(screen.getByTestId("hoja-buscar-conteo")).toHaveTextContent("1 de 4");
    expect(screen.getByLabelText("Cuadro de nombres")).toHaveValue("B4");
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(screen.getByLabelText("Cuadro de nombres")).toHaveValue("B7");
    fireEvent.change(campo, { target: { value: "zzz" } });
    expect(screen.getByTestId("hoja-buscar-conteo")).toHaveTextContent("Sin resultados");
    fireEvent.keyDown(campo, { key: "Escape" });
    expect(screen.queryByLabelText("Texto a buscar")).toBeNull();
  });

  it("solo lectura no permite editar", async () => {
    render(<SpreadsheetEditor filename="Libro.xlsx" soloLectura onClose={() => {}} />);
    await screen.findByTestId("hoja-entrada");
    fireEvent.keyDown(entrada(), { key: "ArrowDown" });
    teclear("99");
    expect(celda("A2")).toBe("");
    expect(screen.getAllByText("Solo lectura").length).toBeGreaterThan(0);
  });

  it("abre el archivo real de la evidencia y guarda una versión nueva con Ctrl+S", async () => {
    let libro: Libro = { hojas: [hojaVacia("Datos")] };
    libro = escribir(libro, 0, 0, 0, "Monto");
    libro = escribir(libro, 0, 1, 0, "250");
    const datos = await (await escribirXlsx(libro)).arrayBuffer();
    vi.mocked(api.descargarArchivoEvidencia).mockResolvedValue(datos);
    vi.mocked(api.guardarVersionEvidencia).mockResolvedValue({ version: 2, hash: "a".repeat(64), fecha: "", autor: "", comentario: "" });
    const onGuardado = vi.fn();

    render(<SpreadsheetEditor filename="Montos.xlsx" evidenciaId="EV-9" onClose={() => {}} onGuardado={onGuardado} />);
    await waitFor(() => expect(celda("A2")).toBe("250"));
    expect(api.descargarArchivoEvidencia).toHaveBeenCalledWith("EV-9");
    expect(within(screen.getByRole("tablist", { name: "Hojas" })).getByRole("tab", { name: "Datos" })).toBeInTheDocument();

    fireEvent.keyDown(entrada(), { key: "ArrowDown" });
    fireEvent.keyDown(entrada(), { key: "ArrowDown" });
    teclear("=A2*2");
    expect(screen.getByTestId("hoja-estado-archivo")).toHaveTextContent("Sin guardar");

    fireEvent.keyDown(entrada(), { key: "s", ctrlKey: true });
    await waitFor(() => expect(onGuardado).toHaveBeenCalled());
    const [id, archivo, nombre] = vi.mocked(api.guardarVersionEvidencia).mock.calls[0];
    expect(id).toBe("EV-9");
    expect(nombre).toBe("Montos.xlsx");
    expect(archivo.size).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByTestId("hoja-estado-archivo")).toHaveTextContent("Guardado"));
  });

  it("si el servidor aún no entrega el archivo, abre un ejemplo y lo avisa", async () => {
    vi.mocked(api.descargarArchivoEvidencia).mockRejectedValue(new ErrorApi(404, "NO_ENCONTRADO", "No existe"));
    render(<SpreadsheetEditor filename="Conciliacion_Bancaria.xlsx" evidenciaId="EV-001" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("todavía no entrega el archivo"));
    expect(celda("C15")).toBe("123,250.00");
  });

  it("al cerrar con cambios pregunta si se desea guardar", async () => {
    const onClose = vi.fn();
    render(<SpreadsheetEditor filename="Libro.xlsx" onClose={onClose} />);
    await screen.findByTestId("hoja-entrada");
    fireEvent.keyDown(entrada(), { key: "ArrowDown" });
    teclear("1");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "No guardar" }));
    expect(onClose).toHaveBeenCalled();
  });
});
