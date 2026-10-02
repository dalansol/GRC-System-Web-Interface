// Formas de identificar al usuario ante la API: Microsoft Entra ID o modo de desarrollo.

export interface ProveedorAuth {
  modo: "entra" | "dev";
  /** Recupera la sesión existente. Devuelve true si hay una identidad. */
  iniciar(): Promise<boolean>;
  /** Encabezados que identifican cada petición a la API. */
  credenciales(): Promise<Record<string, string>>;
  iniciarSesion(correo?: string): Promise<void>;
  cerrarSesion(): Promise<void>;
}

const CLAVE_DEV = "expedite.dev.usuario";

// Solo para desarrollo local: el backend debe correr con AUTH_MODE=dev.
export function crearProveedorDev(almacen: Storage = window.sessionStorage): ProveedorAuth {
  return {
    modo: "dev",
    async iniciar() {
      return almacen.getItem(CLAVE_DEV) !== null;
    },
    async credenciales(): Promise<Record<string, string>> {
      const correo = almacen.getItem(CLAVE_DEV);
      return correo ? { "X-Dev-Usuario": correo } : {};
    },
    async iniciarSesion(correo) {
      if (correo) almacen.setItem(CLAVE_DEV, correo.trim().toLowerCase());
    },
    async cerrarSesion() {
      almacen.removeItem(CLAVE_DEV);
    },
  };
}

export interface ConfigEntra {
  tenantId: string;
  clientId: string;
  /** Permiso expuesto por la API. Por omisión, api://<clientId>/access_as_user. */
  scope?: string;
}

export function crearProveedorEntra({ tenantId, clientId, scope }: ConfigEntra): ProveedorAuth {
  const scopes = [scope || `api://${clientId}/access_as_user`];

  // MSAL solo se descarga cuando se usa Entra ID.
  const cliente = import("@azure/msal-browser").then(async (msal) => {
    const app = new msal.PublicClientApplication({
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        redirectUri: window.location.origin,
      },
      cache: { cacheLocation: "sessionStorage" },
    });
    await app.initialize();
    return { app, msal };
  });

  return {
    modo: "entra",
    async iniciar() {
      const { app } = await cliente;
      const resultado = await app.handleRedirectPromise();
      const cuenta = resultado?.account ?? app.getActiveAccount() ?? app.getAllAccounts()[0] ?? null;
      app.setActiveAccount(cuenta);
      return cuenta !== null;
    },
    async credenciales(): Promise<Record<string, string>> {
      const { app, msal } = await cliente;
      const cuenta = app.getActiveAccount();
      if (!cuenta) return {};
      try {
        const { accessToken } = await app.acquireTokenSilent({ scopes, account: cuenta });
        return { Authorization: `Bearer ${accessToken}` };
      } catch (error) {
        // La sesión de Microsoft expiró o requiere consentimiento: se vuelve a iniciar.
        if (error instanceof msal.InteractionRequiredAuthError) {
          await app.acquireTokenRedirect({ scopes, account: cuenta });
        }
        return {};
      }
    },
    async iniciarSesion() {
      const { app } = await cliente;
      await app.loginRedirect({ scopes });
    },
    async cerrarSesion() {
      const { app } = await cliente;
      await app.logoutRedirect({ account: app.getActiveAccount() });
    },
  };
}

// Elige el proveedor según las variables de entorno de Vite.
export function proveedorPorDefecto(): ProveedorAuth {
  const env = import.meta.env;
  if (env.VITE_AUTH_MODE === "dev") {
    if (env.PROD) throw new Error("VITE_AUTH_MODE=dev no está permitido en una compilación de producción.");
    return crearProveedorDev();
  }
  if (!env.VITE_ENTRA_TENANT_ID || !env.VITE_ENTRA_CLIENT_ID) {
    throw new Error("Faltan VITE_ENTRA_TENANT_ID y VITE_ENTRA_CLIENT_ID. Revisa el archivo .env.");
  }
  return crearProveedorEntra({
    tenantId: env.VITE_ENTRA_TENANT_ID,
    clientId: env.VITE_ENTRA_CLIENT_ID,
    scope: env.VITE_ENTRA_API_SCOPE,
  });
}
