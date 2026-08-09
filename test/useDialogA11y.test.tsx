import { useState } from 'react';
import { render, fireEvent, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDialogA11y } from '../src/hooks/useDialogA11y';

// Este hook es la pieza con más lógica sutil del paquete y la consumen los 19
// diálogos de las dos apps a la vez: contador de diálogos abiertos, inert de
// los hermanos de cada nivel, trampa de Tab y devolución del foco. Nada de eso
// se ve en un typecheck, y hasta ahora CI solo hacía typecheck y build.

function Dialogo({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  const ref = useDialogA11y<HTMLDivElement>(open, onClose);
  if (!open) return null;
  return (
    <div ref={ref} role="dialog" aria-modal="true">
      {children}
    </div>
  );
}

const campos = (
  <>
    <input data-testid="primero" />
    <input data-testid="medio" />
    <button data-testid="ultimo">Guardar</button>
  </>
);

beforeEach(() => {
  // El contador de diálogos abiertos y el overflow previo son estado de módulo:
  // un test que dejara un diálogo abierto envenenaría a los siguientes. RTL
  // desmonta solo entre tests, pero el overflow del body se comprueba tan a
  // menudo que conviene partir siempre del mismo sitio.
  document.body.style.overflow = '';
});

describe('foco', () => {
  it('al abrir, el foco va al primer enfocable', () => {
    render(<Dialogo open onClose={() => {}}>{campos}</Dialogo>);
    expect(document.activeElement).toBe(screen.getByTestId('primero'));
  });

  it('al cerrar, el foco vuelve al elemento que abrió', () => {
    function App() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button data-testid="abridor" onClick={() => setOpen(true)}>
            Abrir
          </button>
          <Dialogo open={open} onClose={() => setOpen(false)}>
            {campos}
          </Dialogo>
        </>
      );
    }
    render(<App />);
    const abridor = screen.getByTestId('abridor');
    abridor.focus();
    fireEvent.click(abridor);
    expect(document.activeElement).toBe(screen.getByTestId('primero'));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(abridor);
  });
});

describe('teclado', () => {
  it('Escape llama a onClose', () => {
    const onClose = vi.fn();
    render(<Dialogo open onClose={onClose}>{campos}</Dialogo>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Tab en el último enfocable vuelve al primero', () => {
    render(<Dialogo open onClose={() => {}}>{campos}</Dialogo>);
    screen.getByTestId('ultimo').focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByTestId('primero'));
  });

  it('Shift+Tab en el primero va al último', () => {
    render(<Dialogo open onClose={() => {}}>{campos}</Dialogo>);
    screen.getByTestId('primero').focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByTestId('ultimo'));
  });

  it('Tab en medio del diálogo lo deja pasar (no lo secuestra)', () => {
    render(<Dialogo open onClose={() => {}}>{campos}</Dialogo>);
    const medio = screen.getByTestId('medio');
    medio.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    // El hook solo interviene en los extremos; en el medio manda el navegador,
    // que en jsdom no mueve nada. Lo que importa es que NO lo haya reposicionado.
    expect(document.activeElement).toBe(medio);
  });

  it('un diálogo sin nada enfocable no rompe con Tab', () => {
    render(<Dialogo open onClose={() => {}}><p>Solo texto</p></Dialogo>);
    expect(() => fireEvent.keyDown(document, { key: 'Tab' })).not.toThrow();
  });
});

describe('scroll del fondo', () => {
  it('se bloquea al abrir y se devuelve al cerrar', () => {
    document.body.style.overflow = 'scroll'; // lo que hubiera antes se respeta
    const { rerender } = render(
      <Dialogo open onClose={() => {}}>{campos}</Dialogo>,
    );
    expect(document.body.style.overflow).toBe('hidden');

    rerender(<Dialogo open={false} onClose={() => {}} />);
    expect(document.body.style.overflow).toBe('scroll');
  });

  // La razón de que el contador exista y no sea un booleano, en palabras del
  // propio comentario del hook: con un booleano, cerrar un diálogo abierto
  // sobre otro devolvía el scroll con el segundo todavía en pantalla.
  it('con dos diálogos, cerrar el de arriba NO devuelve el scroll', () => {
    function Dos({ arriba }: { arriba: boolean }) {
      return (
        <>
          <Dialogo open onClose={() => {}}>{campos}</Dialogo>
          <Dialogo open={arriba} onClose={() => {}}>
            <button data-testid="confirmar">Confirmar</button>
          </Dialogo>
        </>
      );
    }
    const { rerender, unmount } = render(<Dos arriba />);
    expect(document.body.style.overflow).toBe('hidden');

    rerender(<Dos arriba={false} />); // se cierra el de arriba, queda el de abajo
    expect(document.body.style.overflow).toBe('hidden');

    unmount(); // se cierra el último
    expect(document.body.style.overflow).toBe('');
  });
});

describe('fondo inerte', () => {
  it('marca inertes a los hermanos y los destapa al cerrar', () => {
    function App({ open }: { open: boolean }) {
      return (
        <div>
          <aside data-testid="fondo">
            <button>Del fondo</button>
          </aside>
          <Dialogo open={open} onClose={() => {}}>{campos}</Dialogo>
        </div>
      );
    }
    const { rerender } = render(<App open />);
    const fondo = screen.getByTestId('fondo') as HTMLElement & { inert?: boolean };
    expect(fondo.inert).toBe(true);
    expect(fondo.getAttribute('aria-hidden')).toBe('true');

    rerender(<App open={false} />);
    expect(fondo.inert).toBe(false);
    expect(fondo.hasAttribute('aria-hidden')).toBe(false);
  });

  // Cada instancia deshace SOLO lo que ella marcó. Si el de arriba destapara lo
  // que ya había apagado el de abajo, al cerrar un confirm el fondo volvería a
  // ser operable con el modal principal todavía abierto.
  it('el diálogo de arriba no destapa lo que marcó el de abajo', () => {
    function App({ arriba }: { arriba: boolean }) {
      return (
        <div>
          <aside data-testid="fondo">
            <button>Del fondo</button>
          </aside>
          <Dialogo open onClose={() => {}}>{campos}</Dialogo>
          <Dialogo open={arriba} onClose={() => {}}>
            <button data-testid="confirmar">Confirmar</button>
          </Dialogo>
        </div>
      );
    }
    const { rerender } = render(<App arriba />);
    const fondo = screen.getByTestId('fondo') as HTMLElement & { inert?: boolean };
    expect(fondo.inert).toBe(true);

    rerender(<App arriba={false} />);
    expect(fondo.inert).toBe(true); // sigue apagado: el de abajo no se ha cerrado
  });
});

describe('estabilidad de onClose', () => {
  // La regresión que este bloque cuida: `onClose` estuvo en las dependencias
  // del efecto que monta el fondo inerte y coloca el foco. Como las dos apps lo
  // pasan como flecha inline, cada render del padre lo remontaba y devolvía el
  // foco al primer campo — el usuario que escribía en el tercero saltaba al
  // primero. Ahora ese efecto depende solo de `open` y el teclado va aparte.
  it('un re-render con onClose inline no mueve el foco', () => {
    function App() {
      return (
        <Dialogo open onClose={() => {}}>
          {campos}
        </Dialogo>
      );
    }
    const { rerender } = render(<App />);

    const medio = screen.getByTestId('medio');
    act(() => medio.focus());
    expect(document.activeElement).toBe(medio);

    rerender(<App />); // nueva identidad de onClose → el efecto se remonta
    expect(document.activeElement).toBe(medio);
  });

  it('un re-render con onClose inline no toca el fondo inerte', () => {
    function App() {
      return (
        <div>
          <aside data-testid="fondo">
            <button>Del fondo</button>
          </aside>
          <Dialogo open onClose={() => {}}>{campos}</Dialogo>
        </div>
      );
    }
    const { rerender } = render(<App />);
    const fondo = screen.getByTestId('fondo') as HTMLElement & { inert?: boolean };
    expect(fondo.inert).toBe(true);

    // Mirar el estado FINAL aquí no sirve de nada: el código viejo destapaba y
    // volvía a tapar dentro del mismo commit, así que al terminar el rerender
    // `inert` valía true igual y el test no podía fallar. Lo que distingue a los
    // dos es el churn, no el resultado — de ahí el observador.
    // `takeRecords()` y no el callback: MutationObserver entrega en microtask y
    // esto tiene que leerse sincrónicamente.
    const obs = new MutationObserver(() => {});
    obs.observe(fondo, { attributes: true, attributeFilter: ['aria-hidden'] });

    rerender(<App />);

    const registros = obs.takeRecords();
    obs.disconnect();
    expect(registros).toHaveLength(0);
    expect(fondo.inert).toBe(true);
  });

  // La otra cara del arreglo: sacar onClose de un efecto no puede dejarlo
  // congelado en el primero que se pasó. El efecto del teclado sí lo lleva en
  // sus dependencias justamente para esto.
  it('Escape llama al onClose más reciente, no al del primer render', () => {
    const viejo = vi.fn();
    const nuevo = vi.fn();
    const { rerender } = render(<Dialogo open onClose={viejo}>{campos}</Dialogo>);

    rerender(<Dialogo open onClose={nuevo}>{campos}</Dialogo>);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(nuevo).toHaveBeenCalledTimes(1);
    expect(viejo).not.toHaveBeenCalled();
  });

  it('con onClose estable, un re-render deja el foco donde estaba', () => {
    const onClose = () => {};
    function App() {
      return <Dialogo open onClose={onClose}>{campos}</Dialogo>;
    }
    const { rerender } = render(<App />);

    const medio = screen.getByTestId('medio');
    act(() => medio.focus());
    rerender(<App />);
    expect(document.activeElement).toBe(medio);
  });
});
