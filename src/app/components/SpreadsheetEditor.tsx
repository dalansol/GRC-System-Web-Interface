import EditorHojaCalculo, { type PropsEditorHoja } from "./hoja/EditorHojaCalculo";

// Punto de entrada del editor de Excel en la plataforma (UF-17). La implementación vive
// en components/hoja/ y la lógica en domain/hoja/.
export type { PropsEditorHoja as SpreadsheetEditorProps };

export default function SpreadsheetEditor(props: PropsEditorHoja) {
  return <EditorHojaCalculo {...props} />;
}
