import { useEffect, useRef } from 'react';

// A11y para modales existentes sin reestructurar su JSX (audit 18: los modales
// viejos no tenían focus-trap/Escape/role). Uso:
//   const ref = useDialogA11y(isOpen, onClose);
//   <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="...">…</div>
// Hace: foco inicial al primer enfocable, Escape cierra, Tab atrapa el foco dentro,
// y al cerrar devuelve el foco al elemento que abrió el modal.
// Cuántos diálogos hay abiertos ahora mismo. El scroll del fondo se bloquea al
// abrirse el primero y se devuelve al cerrarse el último: con un booleano, cerrar
// un diálogo abierto sobre otro devolvía el scroll con el segundo todavía en
// pantalla.
let abiertos = 0;
let overflowPrevio = '';

// Los enfocables vivos del diálogo, en orden de tabulación. Vive fuera del hook
// porque no depende de nada suyo: así los dos efectos de abajo la comparten sin
// que ninguno tenga que llevarla en sus dependencias.
function enfocables(el: HTMLElement | null): HTMLElement[] {
  if (!el) return [];
  return Array.from(
    el.querySelectorAll<HTMLElement>(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
    ),
  ).filter((n) => n.offsetParent !== null);
}

// Genérico en el tipo de elemento: el panel no siempre es un <div> — en el
// dealer varios modales cuelgan de un <form>, y una ref de HTMLDivElement ahí
// no compila. Por defecto sigue siendo div, así que quien no lo necesite no
// escribe nada.
export function useDialogA11y<T extends HTMLElement = HTMLDivElement>(open: boolean, onClose: () => void) {
  const ref = useRef<T>(null);

  // Bloqueo del scroll de fondo. Va en su propio efecto porque no depende de
  // `onClose`: si compartiera efecto, cada cambio de esa función lo soltaría y
  // lo volvería a poner.
  useEffect(() => {
    if (!open) return;
    if (abiertos === 0) {
      overflowPrevio = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    abiertos++;
    return () => {
      abiertos--;
      if (abiertos === 0) document.body.style.overflow = overflowPrevio;
    };
  }, [open]);

  // Fondo inerte, foco inicial y devolución del foco al cerrar.
  //
  // Las dependencias son SOLO `open`, y eso es la mitad del trabajo de este
  // efecto. Llevar aquí `onClose` era un bug: las apps lo pasan como flecha
  // inline (`onClose={() => setOpen(false)}`), que tiene identidad nueva en cada
  // render del padre, así que el efecto se limpiaba y se volvía a montar sin que
  // el diálogo hubiera cambiado — y el remontaje devolvía el foco al abridor y
  // lo reponía en el primer enfocable. Quien estuviera escribiendo en el tercer
  // campo saltaba al primero en cuanto algo re-renderizaba arriba.
  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    const opener = document.activeElement as HTMLElement | null;

    // ── Fondo inerte ──────────────────────────────────────────────────────────
    // Apaga clics, foco y lector de pantalla en todo lo que NO es el diálogo.
    // No hace falta mover nada a un portal: se sube por los ancestros del
    // diálogo y se marca inerte a los HERMANOS de cada nivel. El resultado es el
    // mismo que portalear + inert en la raíz (lo único que queda vivo es la
    // cadena de contenedores que lleva al diálogo, que no tiene nada operable),
    // y no obliga a reescribir el JSX de los 19 diálogos.
    // Cada instancia deshace solo lo que ella marcó, así que un diálogo abierto
    // sobre otro se destapa bien al cerrarse.
    const inertados: (HTMLElement & { inert?: boolean })[] = [];
    for (let n: HTMLElement | null = el; n && n !== document.body; n = n.parentElement) {
      const padre = n.parentElement;
      if (!padre) break;
      for (const h of Array.from(padre.children)) {
        if (h === n || !(h instanceof HTMLElement)) continue;
        const x = h as HTMLElement & { inert?: boolean };
        if (x.inert) continue; // ya lo apagó un diálogo de más abajo
        x.inert = true;
        x.setAttribute('aria-hidden', 'true');
        inertados.push(x);
      }
    }

    enfocables(el)[0]?.focus();

    return () => {
      for (const x of inertados) { x.inert = false; x.removeAttribute('aria-hidden'); }
      opener?.focus?.(); // devuelve el foco al abridor
    };
  }, [open]);

  // El teclado va en su propio efecto porque es lo único que necesita el
  // `onClose` de este render: si el de arriba lo llevara, el diálogo entero se
  // remontaría cada vez que cambia. Aquí re-colgar el listener es gratis — no
  // toca el DOM del diálogo ni mueve el foco.
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab') {
        const f = enfocables(ref.current);
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return ref;
}
