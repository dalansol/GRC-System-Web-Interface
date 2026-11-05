/** Lleva a la vista un elemento que acaba de pintarse, por ejemplo el plan al que apunta una notificación. */
export function desplazarAElemento(id: string) {
  window.setTimeout(() => {
    document.getElementById(id)?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, 0);
}
