// Comprueba la conexión con el proveedor de IA configurado en .env: corepack pnpm ia:probar
import "dotenv/config";
import { cargarConfigIA } from "../config.js";
import { crearProveedor, ErrorIA } from "../asistente/proveedor.js";

try {
  const config = cargarConfigIA(process.env);
  const proveedor = crearProveedor(config);
  if (!proveedor) {
    console.log("La IA está desactivada (IA_PROVEEDOR=ninguno). Configura 'gemini' o 'azure' en backend/.env.");
    process.exit(1);
  }

  const modelo = config.proveedor === "gemini" ? config.modelo : config.proveedor === "azure" ? config.despliegue : "";
  console.log(`Probando ${proveedor.nombre} (${modelo})...`);
  const inicio = Date.now();
  const texto = await proveedor.completar([
    { rol: "sistema", contenido: "Eres un asistente de prueba. Responde solo con la palabra OK." },
    { rol: "usuario", contenido: "¿Me escuchas?" },
  ]);
  console.log(`Conexión correcta en ${Date.now() - inicio} ms. Respuesta: ${texto.trim()}`);
} catch (error) {
  if (error instanceof ErrorIA) {
    console.error(`Falló (${error.codigo}): ${error.detalle}`);
  } else {
    console.error(`Falló: ${(error as Error).message}`);
  }
  process.exit(1);
}
