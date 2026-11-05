import type { EvidenciaExpediente, ExpedienteControl, ExpedienteHallazgo } from "../repos/asistente.js";
import { extraerTexto, LIMITE_CARACTERES } from "./extraerTexto.js";

export interface EvidenciaParaIA {
  nombre: string;
  subidaPor: string | null;
  fecha: string;
  formato: string;
  /** null si no hay texto que mandar; `nota` explica por qué. */
  texto: string | null;
  nota?: string;
  recortado: boolean;
}

const FORMATOS_CON_TEXTO = new Set(["pdf", "xlsx"]);

async function textoDe(evidencia: EvidenciaExpediente): Promise<{ texto: string } | { nota: string }> {
  if (!FORMATOS_CON_TEXTO.has(evidencia.formato)) return { nota: "Formato sin lectura de texto; solo se conocen sus datos." };
  let contenido: Buffer | null;
  try {
    contenido = await evidencia.leer();
  } catch {
    contenido = null;
  }
  if (!contenido) return { nota: "No se pudo leer el archivo." };
  const { texto } = await extraerTexto({ tipo: evidencia.formato as "pdf" | "xlsx", contenido });
  return texto.trim() ? { texto } : { nota: "No se pudo leer texto (puede ser un PDF escaneado)." };
}

// Lee las evidencias del almacenamiento y reparte el tope de caracteres entre ellas: los
// archivos cortos van completos y lo que no usan queda para los largos. Un archivo que
// falla no detiene a los demás.
export async function prepararEvidencias(
  evidencias: EvidenciaExpediente[],
  limite = LIMITE_CARACTERES,
): Promise<EvidenciaParaIA[]> {
  const textos = await Promise.all(evidencias.map(textoDe));
  const porLongitud = textos
    .map((t, i) => ({ i, largo: "texto" in t ? t.texto.length : -1 }))
    .filter((t) => t.largo >= 0)
    .sort((a, b) => a.largo - b.largo);

  const cuotas = new Map<number, number>();
  let restante = limite;
  porLongitud.forEach(({ i, largo }, posicion) => {
    const cuota = Math.min(largo, Math.floor(restante / (porLongitud.length - posicion)));
    cuotas.set(i, cuota);
    restante -= cuota;
  });

  return evidencias.map((evidencia, i) => {
    const datos = { nombre: evidencia.nombre, subidaPor: evidencia.subidaPor, fecha: evidencia.fecha, formato: evidencia.formato };
    const resultado = textos[i]!;
    if ("nota" in resultado) return { ...datos, texto: null, nota: resultado.nota, recortado: false };
    const cuota = cuotas.get(i) ?? 0;
    return { ...datos, texto: resultado.texto.slice(0, cuota), recortado: resultado.texto.length > cuota };
  });
}

/** Datos de las evidencias sin su contenido: lo que se manda cuando no se lee el archivo. */
export function metadatosEvidencias(evidencias: EvidenciaExpediente[]) {
  return evidencias.map(({ nombre, formato, subidaPor, fecha }) => ({ nombre, formato, subidaPor, fecha }));
}

// Marco de una evidencia: el expediente de su control o hallazgo, con las demás evidencias
// solo por nombre (el archivo analizado ya va completo como documento).
export function contextoDeControl(expediente: ExpedienteControl, evidenciaId: string) {
  const { evidencias, ...datos } = expediente;
  return {
    tipo: "control" as const,
    etiqueta: `Control ${datos.control.codigo} · Plan ${datos.plan.codigo}`,
    datos: { ...datos, otrasEvidencias: metadatosEvidencias(evidencias.filter((e) => e.id !== evidenciaId)) },
  };
}

export function contextoDeHallazgo(expediente: ExpedienteHallazgo, evidenciaId: string) {
  const { evidencias, ...datos } = expediente;
  return {
    tipo: "hallazgo" as const,
    etiqueta: `Hallazgo ${datos.hallazgo.folio ?? datos.hallazgo.id}`,
    datos: { ...datos, otrasEvidencias: metadatosEvidencias(evidencias.filter((e) => e.id !== evidenciaId)) },
  };
}
