import ExcelJS from "exceljs";

// Genera un PDF mínimo con una línea de texto por renglón (Helvetica, WinAnsi).
// Sirve para los documentos de ejemplo del modo en memoria y para las pruebas.
export function crearPdfSencillo(paginas: string[][]): Buffer {
  const escapar = (texto: string) => texto.replace(/[\\()]/g, (c) => `\\${c}`);
  const objetos: string[] = [];
  const idsPaginas: number[] = [];
  const primeraPagina = 4;

  paginas.forEach((lineas, i) => {
    const idPagina = primeraPagina + i * 2;
    idsPaginas.push(idPagina);
    const flujo = `BT /F1 11 Tf 14 TL 50 780 Td ${lineas.map((l) => `(${escapar(l)}) Tj T*`).join(" ")} ET`;
    objetos[idPagina] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${idPagina + 1} 0 R >>`;
    objetos[idPagina + 1] = `<< /Length ${Buffer.byteLength(flujo, "latin1")} >>\nstream\n${flujo}\nendstream`;
  });
  objetos[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objetos[2] = `<< /Type /Pages /Kids [${idsPaginas.map((id) => `${id} 0 R`).join(" ")}] /Count ${idsPaginas.length} >>`;
  objetos[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";

  let pdf = "%PDF-1.4\n";
  const posiciones: number[] = [];
  for (let id = 1; id < objetos.length; id++) {
    posiciones[id] = Buffer.byteLength(pdf, "latin1");
    pdf += `${id} 0 obj\n${objetos[id]}\nendobj\n`;
  }
  const inicioXref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objetos.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objetos.length; id++) pdf += `${String(posiciones[id]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objetos.length} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

async function crearXlsx(hojas: Record<string, (string | number)[][]>): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  for (const [nombre, filas] of Object.entries(hojas)) libro.addWorksheet(nombre).addRows(filas);
  return Buffer.from(await libro.xlsx.writeBuffer());
}

export interface EvidenciaEjemplo {
  id: string;
  nombre: string;
  tipo: "pdf" | "xlsx";
  crearContenido: () => Promise<Buffer>;
}

// Mismos ids que las evidencias de prueba del frontend (EvidenciasSection), con contenido ficticio.
export const EVIDENCIAS_EJEMPLO: EvidenciaEjemplo[] = [
  {
    id: "EV-001",
    nombre: "Conciliacion_Bancaria_Jun2025.xlsx",
    tipo: "xlsx",
    crearContenido: () =>
      crearXlsx({
        "Conciliación junio": [
          ["Cuenta", "Banco", "Saldo en libros", "Saldo en banco", "Diferencia", "Estatus"],
          ["1102-01", "BBVA", 1250000, 1250000, 0, "Conciliada"],
          ["1102-02", "Banorte", 845300, 839800, 5500, "Partida en tránsito"],
          ["1102-03", "Santander", 312450, 298450, 14000, "Sin documentar"],
        ],
        Firmas: [
          ["Elaboró", "M. García", "2025-07-05"],
          ["Revisó", "C. Morales", "2025-07-10"],
          ["Autorizó", "Pendiente", ""],
        ],
      }),
  },
  {
    id: "EV-002",
    nombre: "Listado_Accesos_SAP_Q2.pdf",
    tipo: "pdf",
    crearContenido: async () =>
      crearPdfSencillo([
        [
          "Listado de accesos SAP - Segundo trimestre 2025",
          "Alcance: modulos FI y CO, sociedad 1000.",
          "Usuarios revisados: 42. Usuarios con perfiles en conflicto: 3.",
          "Conflicto detectado: un mismo usuario crea y aprueba polizas contables (FI-CO).",
          "Usuarios afectados: JPEREZ, LTORRES, AMARTINEZ.",
        ],
        [
          "Acciones: reasignar roles antes del 15 de septiembre de 2025.",
          "Responsable: Gerencia de Sistemas. Revisado por: C. Morales.",
        ],
      ]),
  },
  {
    id: "EV-003",
    nombre: "Reporte_Accesos_Privilegiados_Jul.pdf",
    tipo: "pdf",
    crearContenido: async () =>
      crearPdfSencillo([
        [
          "Reporte de accesos privilegiados - Julio 2025",
          "Cuentas privilegiadas revisadas: 18 (muestra del 100%).",
          "Cuentas de ex-empleados aun activas: 2 (bajas de mayo y junio de 2025).",
          "Ultimo acceso registrado de una cuenta de ex-empleado: 28 de junio de 2025.",
          "Recomendacion: desactivar de inmediato y revisar la frecuencia trimestral del control.",
        ],
      ]),
  },
  {
    id: "EV-004",
    nombre: "Hallazgo_Segregacion_Evidencia.pdf",
    tipo: "pdf",
    crearContenido: async () =>
      crearPdfSencillo([
        [
          "Evidencia del hallazgo HAL-2025-001 - Segregacion de funciones",
          "Muestra: 25 conciliaciones del cierre contable de junio de 2025.",
          "Conciliaciones elaboradas y aprobadas por la misma persona: 7 de 25 (28%).",
          "Riesgo: errores u omisiones no detectados en el cierre contable.",
          "Criterio: politica de control interno CI-04, aprobacion por un segundo nivel.",
        ],
      ]),
  },
];
