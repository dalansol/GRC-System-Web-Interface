import { escribir, aplicarEstilo } from "./operaciones";
import { hojaVacia, type Libro } from "./tipos";

// Libros de ejemplo para el modo de respaldo (sin archivo real del backend o documentos
// mock de auditoría). Los totales son fórmulas para que se pueda probar el recálculo.

function llenar(libro: Libro, idx: number, filas: string[][], desde = 0): Libro {
  let actual = libro;
  filas.forEach((fila, f) => fila.forEach((v, c) => v !== "" && (actual = escribir(actual, idx, desde + f, c, v))));
  return actual;
}

function encabezado(libro: Libro, idx: number, columnas: number): Libro {
  return aplicarEstilo(libro, idx, { f1: 0, c1: 0, f2: 0, c2: columnas - 1 }, (e) => ({
    ...e,
    negrita: true,
    alineacion: "centro",
    // Mismo tono que los encabezados de tabla de Expedite (--secondary).
    colorFondo: "#E2E8F3",
    colorTexto: "#0F1B2D",
  }));
}

export function libroDeEjemplo(nombreArchivo: string): Libro {
  const nombre = nombreArchivo.toLowerCase();

  if (/concilia|bancaria|banco|tesor/.test(nombre)) {
    let libro: Libro = { hojas: [hojaVacia("Conciliación"), hojaVacia("Detalle"), hojaVacia("Resumen")] };
    libro = llenar(libro, 0, [
      ["Fecha", "Concepto", "Cargo", "Abono", "Saldo", "Referencia"],
      ["01/06/2025", "Saldo inicial", "", "125,000.00", "=D2-C2", "REF-0601"],
      ["03/06/2025", "Pago proveedor A", "12,500.00", "", "=E2+D3-C3", "CHQ-1042"],
      ["05/06/2025", "Cobro cliente B", "", "38,200.00", "=E3+D4-C4", "TRF-2208"],
      ["07/06/2025", "Nómina quincenal", "45,000.00", "", "=E4+D5-C5", "NOM-0615"],
      ["10/06/2025", "Pago servicios TI", "8,750.00", "", "=E5+D6-C6", "CHQ-1043"],
      ["12/06/2025", "Cobro factura 4412", "", "22,400.00", "=E6+D7-C7", "TRF-2209"],
      ["15/06/2025", "Impuestos ISR", "31,200.00", "", "=E7+D8-C8", "SAT-0615"],
      ["17/06/2025", "Cobro anticipo", "", "15,000.00", "=E8+D9-C9", "TRF-2211"],
      ["20/06/2025", "Pago renta oficinas", "18,500.00", "", "=E9+D10-C10", "CHQ-1044"],
      ["22/06/2025", "Venta activo fijo", "", "9,800.00", "=E10+D11-C11", "TRF-2213"],
      ["24/06/2025", "Pago seguros", "4,200.00", "", "=E11+D12-C12", "CHQ-1045"],
      ["26/06/2025", "Cobro cliente D", "", "55,000.00", "=E12+D13-C13", "TRF-2215"],
      ["28/06/2025", "Pago mantenimiento", "3,100.00", "", "=E13+D14-C14", "CHQ-1046"],
      ["", "TOTAL", "=SUMA(C2:C14)", "=SUMA(D2:D14)", "=D15-C15", ""],
    ]);
    libro = encabezado(libro, 0, 6);
    libro = aplicarEstilo(libro, 0, { f1: 1, c1: 2, f2: 14, c2: 4 }, (e) => ({ ...e, formato: "numero", decimales: 2 }));
    libro = aplicarEstilo(libro, 0, { f1: 14, c1: 0, f2: 14, c2: 5 }, (e) => ({ ...e, negrita: true }));
    libro = {
      hojas: libro.hojas.map((h, i) =>
        i === 0 ? { ...h, anchos: { 0: 96, 1: 180, 2: 110, 3: 110, 4: 110, 5: 100 }, inmovilizar: { filas: 1, columnas: 0 } } : h,
      ),
    };
    libro = llenar(libro, 2, [
      ["Indicador", "Valor"],
      ["Total cargos", "=Conciliación!C15"],
      ["Total abonos", "=Conciliación!D15"],
      ["Saldo final", "=Conciliación!E15"],
      ["Movimientos", "=CONTAR(Conciliación!C2:D14)"],
    ]);
    libro = encabezado(libro, 2, 2);
    libro = aplicarEstilo(libro, 2, { f1: 1, c1: 1, f2: 3, c2: 1 }, (e) => ({ ...e, formato: "moneda", decimales: 2 }));
    return { hojas: libro.hojas.map((h, i) => (i === 2 ? { ...h, anchos: { 0: 140, 1: 120 } } : h)) };
  }

  if (/riesgo|matriz|control/.test(nombre)) {
    let libro: Libro = { hojas: [hojaVacia("Matriz"), hojaVacia("Controles"), hojaVacia("Seguimiento")] };
    libro = llenar(libro, 0, [
      ["ID", "Riesgo", "Probabilidad", "Impacto", "Nivel", "Control", "Estado"],
      ["RIE-001", "Fraude financiero", "Alta", "Crítico", "Crítico", "CTR-001", "Activo"],
      ["RIE-002", "Acceso no autorizado", "Media", "Alto", "Alto", "CTR-002", "Activo"],
      ["RIE-003", "Error en nómina", "Baja", "Medio", "Medio", "CTR-003", "Revisión"],
      ["RIE-004", "Incumplimiento regulatorio", "Media", "Alto", "Alto", "CTR-004", "Activo"],
      ["RIE-005", "Pérdida de datos", "Baja", "Crítico", "Alto", "CTR-005", "Activo"],
      ["", "Riesgos activos", "", "", "", "", '=CONTAR.SI(G2:G6,"Activo")'],
    ]);
    libro = { hojas: libro.hojas.map((h, i) => (i === 0 ? { ...h, anchos: { 0: 72, 1: 190, 2: 96, 3: 80, 4: 80, 5: 72, 6: 80 } } : h)) };
    return encabezado(libro, 0, 7);
  }

  let libro: Libro = { hojas: [hojaVacia("Hoja1"), hojaVacia("Hoja2")] };
  libro = llenar(libro, 0, [["Referencia", "Descripción", "Monto", "Fecha", "Responsable"]]);
  libro = encabezado(libro, 0, 5);
  return { hojas: libro.hojas.map((h, i) => (i === 0 ? { ...h, anchos: { 0: 96, 1: 200, 2: 96, 3: 96, 4: 120 } } : h)) };
}
