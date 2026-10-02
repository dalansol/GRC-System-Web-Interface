import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { PuertaSesion } from "./app/auth/PuertaSesion";
import { proveedorPorDefecto } from "./app/auth/proveedores";
import { ProveedorSesion } from "./app/auth/SesionContext";
import "./styles/index.css";

const raiz = createRoot(document.getElementById("root")!);

try {
  const proveedor = proveedorPorDefecto();
  raiz.render(
    <ProveedorSesion proveedor={proveedor}>
      <PuertaSesion>
        <App />
      </PuertaSesion>
    </ProveedorSesion>,
  );
} catch (error) {
  // Configuración incompleta: se explica en pantalla en lugar de dejarla en blanco.
  raiz.render(
    <div role="alert" style={{ padding: 32, fontFamily: "sans-serif" }}>
      <strong>Expedite no pudo iniciar.</strong>
      <p>{error instanceof Error ? error.message : "Error de configuración."}</p>
      <p>Copia <code>.env.example</code> a <code>.env</code> y reinicia el servidor de desarrollo.</p>
    </div>,
  );
}
