// Copiar/pegar compatible con Excel y Google Sheets: texto separado por tabulaciones
// (TSV) y, al copiar, también una tabla HTML para que Excel conserve las celdas.

export function aTsv(matriz: string[][]): string {
  return matriz
    .map((fila) => fila.map((v) => (/[\t\n\r"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join("\t"))
    .join("\r\n");
}

export function desdeTsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let i = 0;
  let entreComillas = false;
  // Excel agrega un salto de línea al final de lo copiado.
  const fuente = texto.replace(/\r?\n$/, "");

  while (i < fuente.length) {
    const ch = fuente[i];
    if (entreComillas) {
      if (ch === '"' && fuente[i + 1] === '"') {
        campo += '"';
        i += 2;
        continue;
      }
      if (ch === '"') {
        entreComillas = false;
        i++;
        continue;
      }
      campo += ch;
      i++;
      continue;
    }
    if (ch === '"' && campo === "") {
      entreComillas = true;
      i++;
      continue;
    }
    if (ch === "\t") {
      fila.push(campo);
      campo = "";
      i++;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
      i += ch === "\r" && fuente[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    campo += ch;
    i++;
  }
  fila.push(campo);
  filas.push(fila);
  return filas;
}

const escaparHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function aHtml(matriz: string[][]): string {
  const cuerpo = matriz.map((fila) => `<tr>${fila.map((v) => `<td>${escaparHtml(v)}</td>`).join("")}</tr>`).join("");
  return `<table>${cuerpo}</table>`;
}
