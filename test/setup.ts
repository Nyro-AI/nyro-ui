// jsdom no implementa layout, así que `offsetParent` es null SIEMPRE — incluso
// para un elemento perfectamente visible. useDialogA11y filtra los enfocables
// con `offsetParent !== null` (su forma de saltarse lo que está oculto), así
// que sin esto la lista de enfocables sale vacía en todos los tests y no se
// comprueba nada: pasarían igual con el hook roto.
//
// El stub replica lo justo del contrato real: null si el elemento (o alguno de
// sus ancestros) está oculto, y el padre en cualquier otro caso.
const oculto = (el: HTMLElement): boolean =>
  el.hasAttribute('hidden') || el.style.display === 'none' || el.style.visibility === 'hidden';

Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
  configurable: true,
  get(this: HTMLElement): Element | null {
    if (this === document.body) return null;
    for (let n: HTMLElement | null = this; n; n = n.parentElement) {
      if (oculto(n)) return null;
    }
    return this.parentElement;
  },
});
