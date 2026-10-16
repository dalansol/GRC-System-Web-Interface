import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "../../api/cliente";
import * as apiEstructura from "../../api/estructura";
import * as apiUsuarios from "../../api/usuarios";
import type { PeriodoFiscal, UnidadNegocio } from "../../api/estructura";
import type { Usuario } from "../../api/usuarios";
import { HierarchyView } from "./HierarchyView";

vi.mock("../../api/estructura", async (original) => ({
  ...(await original<typeof apiEstructura>()),
  obtenerPeriodoActivo: vi.fn(),
  listarPeriodos: vi.fn(),
  listarUnidades: vi.fn(),
  obtenerUnidadPorId: vi.fn(),
  crearUnidadNegocio: vi.fn(),
  editarUnidadNegocio: vi.fn(),
  eliminarUnidadNegocio: vi.fn(),
  crearProceso: vi.fn(),
  editarProceso: vi.fn(),
  eliminarProceso: vi.fn(),
}));

vi.mock("../../api/usuarios", async (original) => ({
  ...(await original<typeof apiUsuarios>()),
  listarUsuarios: vi.fn(),
}));

const sesion = vi.hoisted(() => ({
  usuario: {
    id: 1,
    nombre: "Sofía Ramírez",
    correo: "s.ramirez@expedite.com",
    rol: "Administrador",
    estado: "active" as const,
    ultimoAcceso: null,
    permisos: ["Ver Dashboard"],
  },
  esAdministrador: true,
  recargar: vi.fn(async () => {}),
}));

vi.mock("../../auth/SesionContext", () => ({
  useSesion: () => sesion,
}));

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({ toast }));

const PERIODO_ACTIVO: PeriodoFiscal = {
  id: 1,
  nombre: "Fiscal 2026",
  fechaInicio: "2026-01-01",
  fechaFin: "2026-12-31",
  activo: true,
};

const USUARIOS: Usuario[] = [
  { id: 1, nombre: "Sofía Ramírez", correo: "s.ramirez@expedite.com", rol: "Administrador", estado: "active", ultimoAcceso: null },
  { id: 2, nombre: "María García", correo: "m.garcia@expedite.com", rol: "Jefe de Auditoría", estado: "active", ultimoAcceso: null },
  { id: 3, nombre: "Carlos Morales", correo: "c.morales@expedite.com", rol: "Auditor Senior", estado: "active", ultimoAcceso: null },
];

const UNIDADES: UnidadNegocio[] = [
  {
    id: 10,
    nombre: "Banca Minorista",
    responsableId: 2,
    responsableNombre: "María García",
    periodoFiscalId: 1,
    periodoFiscalNombre: "Fiscal 2026",
    creadoPor: 1,
    creadoEn: "2026-02-01T10:00:00Z",
    procesos: [
      { id: 101, nombre: "Originación de Créditos", unidadNegocioId: 10, creadoEn: "2026-02-01T10:00:00Z" },
    ],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  sesion.usuario = {
    id: 1,
    nombre: "Sofía Ramírez",
    correo: "s.ramirez@expedite.com",
    rol: "Administrador",
    estado: "active",
    ultimoAcceso: null,
    permisos: ["Ver Dashboard"],
  };
  sesion.esAdministrador = true;

  vi.mocked(apiEstructura.obtenerPeriodoActivo).mockResolvedValue(PERIODO_ACTIVO);
  vi.mocked(apiEstructura.listarPeriodos).mockResolvedValue([PERIODO_ACTIVO]);
  vi.mocked(apiEstructura.listarUnidades).mockResolvedValue(UNIDADES);
  vi.mocked(apiUsuarios.listarUsuarios).mockResolvedValue(USUARIOS);
});

describe("Catálogo de Estructura Organizacional (HierarchyView Frontend)", () => {
  it("CP-FE-01 (AC1): Renderiza la jerarquía cargada desde la API y muestra el badge del periodo fiscal activo", async () => {
    render(<HierarchyView />);

    await waitFor(() => {
      expect(screen.getByText(/Periodo Activo: Fiscal 2026/i)).toBeInTheDocument();
    });

    expect(screen.getByText("Banca Minorista")).toBeInTheDocument();
    expect(screen.getByText("Originación de Créditos")).toBeInTheDocument();
    expect(screen.getByText(/María García/i)).toBeInTheDocument();
  });

  it("CP-FE-02 (AC1): Abre modal y al enviar formulario exitoso, crea la unidad y muestra toast de éxito", async () => {
    const usuario = userEvent.setup();
    const nuevaUnidad: UnidadNegocio = {
      id: 20,
      nombre: "Tesorería Global",
      responsableId: 1,
      responsableNombre: "Sofía Ramírez",
      periodoFiscalId: 1,
      periodoFiscalNombre: "Fiscal 2026",
      creadoPor: 1,
      creadoEn: "2026-02-02T10:00:00Z",
      procesos: [
        { id: 201, nombre: "Gestión de Liquidez", unidadNegocioId: 20, creadoEn: "2026-02-02T10:00:00Z" },
      ],
    };
    vi.mocked(apiEstructura.crearUnidadNegocio).mockResolvedValue(nuevaUnidad);

    render(<HierarchyView />);

    await waitFor(() => {
      expect(screen.getByTestId("btn-nueva-unidad")).toBeInTheDocument();
    });

    // Abrir modal
    await usuario.click(screen.getByTestId("btn-nueva-unidad"));

    // Llenar formulario
    await usuario.type(
      screen.getByPlaceholderText(/Banca Minorista, Logística/i),
      "Tesorería Global",
    );
    await usuario.type(
      screen.getByPlaceholderText(/Originación de Créditos, Gestión de Compras/i),
      "Gestión de Liquidez",
    );
    await usuario.selectOptions(
      screen.getByRole("combobox"),
      "1", // Sofía Ramírez
    );

    // Guardar
    await usuario.click(screen.getByRole("button", { name: /Guardar Unidad/i }));

    await waitFor(() => {
      expect(apiEstructura.crearUnidadNegocio).toHaveBeenCalledWith({
        nombre: "Tesorería Global",
        proceso: "Gestión de Liquidez",
        responsableId: 1,
      });
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('Unidad de negocio "Tesorería Global" creada exitosamente'),
      );
    });
  });

  it("CP-FE-03 (AC2): Cuando la API responde con NOMBRE_DUPLICADO, muestra error y mantiene modal abierto", async () => {
    const usuario = userEvent.setup();
    vi.mocked(apiEstructura.crearUnidadNegocio).mockRejectedValue(
      new ErrorApi(409, "NOMBRE_DUPLICADO", 'Ya existe una unidad de negocio con el nombre "Banca Minorista".'),
    );

    render(<HierarchyView />);

    await waitFor(() => {
      expect(screen.getByTestId("btn-nueva-unidad")).toBeInTheDocument();
    });

    await usuario.click(screen.getByTestId("btn-nueva-unidad"));

    await usuario.type(
      screen.getByPlaceholderText(/Banca Minorista, Logística/i),
      "Banca Minorista",
    );
    await usuario.type(
      screen.getByPlaceholderText(/Originación de Créditos/i),
      "Proceso Prueba",
    );
    await usuario.selectOptions(screen.getByRole("combobox"), "2");

    await usuario.click(screen.getByRole("button", { name: /Guardar Unidad/i }));

    await waitFor(() => {
      expect(screen.getByText(/Ya existe una unidad de negocio con el nombre "Banca Minorista"/i)).toBeInTheDocument();
      expect(toast.error).toHaveBeenCalledWith(
        'Ya existe una unidad de negocio con el nombre "Banca Minorista".',
      );
    });

    // El modal debe permanecer abierto
    expect(screen.getByRole("button", { name: /Guardar Unidad/i })).toBeInTheDocument();
  });

  it("CP-FE-04 (AC3): Al intentar eliminar unidad con auditorías activas, muestra notificación de bloqueo", async () => {
    const usuario = userEvent.setup();
    vi.mocked(apiEstructura.eliminarUnidadNegocio).mockRejectedValue(
      new ErrorApi(
        409,
        "AUDITORIAS_ACTIVAS",
        "No se puede eliminar la unidad de negocio porque tiene auditorías activas asociadas.",
      ),
    );

    render(<HierarchyView />);

    await waitFor(() => {
      expect(screen.getByTestId("btn-eliminar-unidad-10")).toBeInTheDocument();
    });

    // Clic en botón eliminar de la tarjeta
    await usuario.click(screen.getByTestId("btn-eliminar-unidad-10"));

    // Modal de confirmación
    await waitFor(() => {
      expect(screen.getByTestId("btn-confirmar-eliminar")).toBeInTheDocument();
    });

    await usuario.click(screen.getByTestId("btn-confirmar-eliminar"));

    await waitFor(() => {
      expect(apiEstructura.eliminarUnidadNegocio).toHaveBeenCalledWith(10);
      expect(toast.error).toHaveBeenCalledWith(
        "No se puede eliminar la unidad de negocio porque tiene auditorías activas asociadas.",
      );
    });
  });

  it("CP-FE-05 (Seguridad): Botones de gestión no se muestran a usuarios con rol Auditor", async () => {
    sesion.usuario = {
      id: 3,
      nombre: "Carlos Morales",
      correo: "c.morales@expedite.com",
      rol: "Auditor Senior",
      estado: "active",
      ultimoAcceso: null,
      permisos: ["Ver Dashboard"],
    };
    sesion.esAdministrador = false;

    render(<HierarchyView />);

    await waitFor(() => {
      expect(screen.getByText("Banca Minorista")).toBeInTheDocument();
    });

    // El botón "+ Nueva Unidad de Negocio" NO debe existir
    expect(screen.queryByTestId("btn-nueva-unidad")).not.toBeInTheDocument();

    // Los botones de eliminación NO deben existir
    expect(screen.queryByTestId("btn-eliminar-unidad-10")).not.toBeInTheDocument();
  });

  it("permite a un Jefe de Auditoría gestionar unidades de negocio", async () => {
    sesion.usuario = {
      id: 2,
      nombre: "María García",
      correo: "m.garcia@expedite.com",
      rol: "Jefe de Auditoría",
      estado: "active",
      ultimoAcceso: null,
      permisos: ["Ver Dashboard"],
    };
    sesion.esAdministrador = false;

    render(<HierarchyView />);

    await waitFor(() => {
      expect(screen.getByTestId("btn-nueva-unidad")).toBeInTheDocument();
      expect(screen.getByTestId("btn-eliminar-unidad-10")).toBeInTheDocument();
    });
  });
});
