/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Solo usar false para trabajar deliberadamente sin la API. */
  readonly VITE_USE_REAL_BACKEND?: "true" | "false";
  readonly VITE_AUTH_MODE?: "entra" | "dev";
  readonly VITE_PERMITIR_DEV_EN_PRODUCCION?: string;
  readonly VITE_ENTRA_TENANT_ID?: string;
  readonly VITE_ENTRA_CLIENT_ID?: string;
  readonly VITE_ENTRA_API_SCOPE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
