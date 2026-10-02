import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "../api/cliente";
import * as api from "../api/usuarios";
import type { Rol, Usuario, UsuarioConPermisos } from "../api/usuarios";
import UsuariosRolesView from "./UsuariosRolesView";

vi.mock("../api/usuarios", async (original) => ({
  ...(await original<typeof api>()),
  listarUsuarios: vi.fn(),
  listarRoles: vi.fn(),
  crearUsuario: vi.fn(),
  cambiarRol: vi.fn(),
}));

const sesion = vi.hoisted(() => ({
  usuario: null as UsuarioConPermisos | null,
  esAdministrador: true,
  recargar: vi.fn(async () => {}),
}));
vi.mock("../auth/SesionContext", () => ({ useSesion: () => sesion }));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const ROLES: Rol[] = [
  { id: 1, nombre: "Administrador", permisos: ["Ver Dashboard", "Gestionar Usuarios", "Aprobar Riesgos"] },
  { id: 2, nombre: "Jefe de Auditoría", permisos: ["Ver Dashboard", "Aprobar Riesgos"] },
  { id: 3, nombre: "Auditor", permisos: ["Ver Dashboard"] },
];

const USUARIOS: Usuario[] = [
  { id: 1, nombre: "Sofía Ramírez", correo: "s.ramirez@expedite.com", rol: "Administrador", estado: "active", ultimoAcceso: "2026-09-30T15:00:00.000Z" },
  { id: 2, nombre: "Ana Rodríguez", correo: "a.rodriguez@expedite.com", rol: "Auditor", estado: "active", ultimoAcceso: null },
  { id: 3, nombre: "Pedro Sánchez", correo: "p.sanchez@expedite.com", rol: "Auditor", estado: "inactive", ultimoAcceso: null },
];

const fila = (nombre: string) => screen.getByRole("row", { name: new RegExp(nombre) });

beforeEach(() => {
  vi.clearAllMocks();
  sesion.usuario = { ...USUARIOS[0]!, permisos: ROLES[0]!.permisos };
  sesion.esAdministrador = true;
  vi.mocked(api.listarUsuarios).mockResolvedValue(USUARIOS);
  vi.mocked(api.listarRoles).mockResolvedValue(ROLES);
});

async function abrir() {
  render(<UsuariosRolesView />);
  await screen.findByRole("row", { name: /Ana Rodríguez/ });
  return userEvent.setup();
}

describe("CA1: tabla centralizada de usuarios", () => {
  it("muestra nombre completo, correo corporativo, rol actual y estado de cuenta", async () => {
    await abrir();

    for (const columna of ["Nombre completo", "Correo corporativo", "Rol actual", "Estado de cuenta"]) {
      expect(screen.getByRole("columnheader", { name: columna })).toBeInTheDocument();
    }

    const ana = within(fila("Ana Rodríguez"));
    expect(ana.getByText("a.rodriguez@expedite.com")).toBeInTheDocument();
    expect(ana.getByRole("combobox", { name: "Rol de Ana Rodríguez" })).toHaveValue("Auditor");
    expect(ana.getByText("Activo")).toBeInTheDocument();

    expect(within(fila("Pedro Sánchez")).getByText("Inactivo")).toBeInTheDocument();
    expect(screen.getByText("3 usuarios")).toBeInTheDocument();
  });

  it("avisa cuando no se puede cargar la lista y permite reintentar", async () => {
    vi.mocked(api.listarUsuarios).mockRejectedValueOnce(new ErrorApi(0, "SIN_CONEXION", "No se pudo conectar con el servidor de Expedite."));
    render(<UsuariosRolesView />);
    const usuario = userEvent.setup();

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo conectar con el servidor de Expedite.");

    await usuario.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("row", { name: /Ana Rodríguez/ })).toBeInTheDocument();
  });
});

describe("CA2: edición del rol con actualización inmediata", () => {
  it("guarda el rol nuevo y lo muestra en la tabla", async () => {
    vi.mocked(api.cambiarRol).mockResolvedValue({ ...USUARIOS[1]!, rol: "Jefe de Auditoría", permisos: ROLES[1]!.permisos });
    const usuario = await abrir();

    await usuario.selectOptions(screen.getByRole("combobox", { name: "Rol de Ana Rodríguez" }), "Jefe de Auditoría");

    expect(api.cambiarRol).toHaveBeenCalledWith(2, "Jefe de Auditoría");
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Rol de Ana Rodríguez" })).toHaveValue("Jefe de Auditoría"),
    );
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Jefe de Auditoría"));
  });

  it("si el servidor rechaza el cambio, conserva el rol anterior y explica el motivo", async () => {
    vi.mocked(api.cambiarRol).mockRejectedValue(
      new ErrorApi(409, "ULTIMO_ADMINISTRADOR", "No se puede cambiar el rol del único Administrador activo."),
    );
    const usuario = await abrir();

    await usuario.selectOptions(screen.getByRole("combobox", { name: "Rol de Sofía Ramírez" }), "Auditor");

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("No se puede cambiar el rol del único Administrador activo."),
    );
    expect(screen.getByRole("combobox", { name: "Rol de Sofía Ramírez" })).toHaveValue("Administrador");
  });

  it("al cambiar el rol propio, recarga los permisos de la sesión", async () => {
    vi.mocked(api.cambiarRol).mockResolvedValue({ ...USUARIOS[0]!, rol: "Auditor", permisos: ROLES[2]!.permisos });
    const usuario = await abrir();

    await usuario.selectOptions(screen.getByRole("combobox", { name: "Rol de Sofía Ramírez" }), "Auditor");

    await waitFor(() => expect(sesion.recargar).toHaveBeenCalled());
  });

  it("no recarga la sesión al cambiar el rol de otra persona", async () => {
    vi.mocked(api.cambiarRol).mockResolvedValue({ ...USUARIOS[1]!, rol: "Jefe de Auditoría", permisos: ROLES[1]!.permisos });
    const usuario = await abrir();

    await usuario.selectOptions(screen.getByRole("combobox", { name: "Rol de Ana Rodríguez" }), "Jefe de Auditoría");

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(sesion.recargar).not.toHaveBeenCalled();
  });

  it("muestra los permisos de cada rol", async () => {
    const usuario = await abrir();
    const permisos = () => within(screen.getByRole("list", { name: /Permisos del rol/ }));

    await usuario.click(screen.getByRole("button", { name: "Auditor" }));
    expect(permisos().getByText("Ver Dashboard")).toHaveAttribute("data-activo", "true");
    expect(permisos().getByText("Gestionar Usuarios")).toHaveAttribute("data-activo", "false");

    await usuario.click(screen.getByRole("button", { name: "Administrador" }));
    expect(permisos().getByText("Gestionar Usuarios")).toHaveAttribute("data-activo", "true");
  });
});

describe("CA3: alta de usuario con validación de dominio corporativo", () => {
  async function llenar(usuario: ReturnType<typeof userEvent.setup>, correo: string) {
    await usuario.click(screen.getByRole("button", { name: "Nuevo usuario" }));
    await usuario.type(screen.getByLabelText("Nombre completo"), "Luis Peña");
    await usuario.type(screen.getByLabelText("Correo corporativo"), correo);
    await usuario.selectOptions(screen.getByLabelText("Rol"), "Auditor");
    await usuario.click(screen.getByRole("button", { name: "Dar de alta" }));
  }

  it("muestra un error explícito cuando el correo no es del dominio corporativo", async () => {
    const mensaje = "El correo no pertenece al dominio corporativo autorizado (@expedite.com).";
    vi.mocked(api.crearUsuario).mockRejectedValue(new ErrorApi(422, "DOMINIO_NO_AUTORIZADO", mensaje));
    const usuario = await abrir();

    await llenar(usuario, "l.pena@gmail.com");

    const correo = screen.getByLabelText("Correo corporativo");
    expect(await screen.findByRole("alert")).toHaveTextContent(mensaje);
    expect(correo).toBeInvalid();
    expect(correo).toHaveAccessibleDescription(mensaje);
    // El formulario sigue abierto con lo que se escribió y el usuario no se agrega.
    expect(correo).toHaveValue("l.pena@gmail.com");
    expect(screen.getByLabelText("Nombre completo")).toHaveValue("Luis Peña");
    expect(screen.queryByRole("row", { name: /Luis Peña/ })).not.toBeInTheDocument();
  });

  it("el error desaparece al corregir el correo", async () => {
    vi.mocked(api.crearUsuario).mockRejectedValue(
      new ErrorApi(422, "DOMINIO_NO_AUTORIZADO", "El correo no pertenece al dominio corporativo autorizado (@expedite.com)."),
    );
    const usuario = await abrir();
    await llenar(usuario, "l.pena@gmail.com");
    await screen.findByRole("alert");

    await usuario.type(screen.getByLabelText("Correo corporativo"), "x");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("da de alta al usuario y lo agrega a la tabla", async () => {
    vi.mocked(api.crearUsuario).mockResolvedValue({
      id: 4, nombre: "Luis Peña", correo: "l.pena@expedite.com", rol: "Auditor", estado: "active", ultimoAcceso: null,
    });
    const usuario = await abrir();

    await llenar(usuario, "l.pena@expedite.com");

    expect(api.crearUsuario).toHaveBeenCalledWith({ nombre: "Luis Peña", correo: "l.pena@expedite.com", rol: "Auditor" });
    expect(await screen.findByRole("row", { name: /Luis Peña/ })).toBeInTheDocument();
    expect(screen.getByText("4 usuarios")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre completo")).not.toBeInTheDocument();
  });

  it("señala el correo cuando ya está registrado", async () => {
    vi.mocked(api.crearUsuario).mockRejectedValue(new ErrorApi(409, "CORREO_DUPLICADO", "Ya existe un usuario con ese correo."));
    const usuario = await abrir();

    await llenar(usuario, "a.rodriguez@expedite.com");

    expect(await screen.findByRole("alert")).toHaveTextContent("Ya existe un usuario con ese correo.");
    expect(screen.getByLabelText("Correo corporativo")).toBeInvalid();
  });

  it("no envía el formulario si faltan datos", async () => {
    const usuario = await abrir();

    await usuario.click(screen.getByRole("button", { name: "Nuevo usuario" }));
    await usuario.click(screen.getByRole("button", { name: "Dar de alta" }));

    expect(api.crearUsuario).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Nombre completo")).toHaveAccessibleDescription("Escribe el nombre completo.");
    expect(screen.getByLabelText("Correo corporativo")).toHaveAccessibleDescription("Escribe el correo corporativo.");
    expect(screen.getByLabelText("Rol")).toHaveAccessibleDescription("Selecciona un rol.");
  });
});

describe("acceso solo para Administrador", () => {
  it("muestra un aviso y no consulta usuarios si el rol no es Administrador", async () => {
    sesion.esAdministrador = false;
    render(<UsuariosRolesView />);

    expect(screen.getByRole("alert")).toHaveTextContent("Solo un Administrador puede gestionar usuarios y roles.");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(api.listarUsuarios).not.toHaveBeenCalled();
  });

  it("si el servidor responde que el rol ya no tiene acceso, recarga la sesión", async () => {
    vi.mocked(api.cambiarRol).mockRejectedValue(new ErrorApi(403, "ROL_NO_AUTORIZADO", "Tu rol no tiene acceso a esta función."));
    const usuario = await abrir();

    await usuario.selectOptions(screen.getByRole("combobox", { name: "Rol de Ana Rodríguez" }), "Jefe de Auditoría");

    await waitFor(() => expect(sesion.recargar).toHaveBeenCalled());
  });
});
