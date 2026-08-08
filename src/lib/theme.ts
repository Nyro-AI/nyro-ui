// Tema claro/oscuro. Las apps arrancan en oscuro; el usuario cambia a claro con
// el botón (se guarda en localStorage y se aplica como data-theme en <html>).
// Los colores viven en tokens CSS (@nyro-ai/ui/tokens.css), no cableados por
// página: por eso basta con voltear el atributo.
//
// POR QUÉ ES UNA FÁBRICA Y NO UN MÓDULO CON FUNCIONES SUELTAS
// Cada app guarda el tema bajo su propia clave —nyro-erp usa `nyro_theme` y
// gm-erp `gm_theme`— y no se pueden unificar sin desloguear del tema a todo el
// que ya tenga una preferencia guardada. La clave es el único parámetro.
export type Theme = 'dark' | 'light';

export type ThemeApi = {
  getTheme: () => Theme;
  applyTheme: (t: Theme) => void;
  setTheme: (t: Theme) => void;
  toggleTheme: () => Theme;
};

export function createTheme(storageKey: string): ThemeApi {
  function getTheme(): Theme {
    // try/catch y no un `if`: en modo privado de Safari el mero acceso a
    // localStorage lanza, no devuelve null.
    try {
      return localStorage.getItem(storageKey) === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  }

  function applyTheme(t: Theme): void {
    if (typeof document !== 'undefined') document.documentElement.dataset.theme = t;
  }

  function setTheme(t: Theme): void {
    try {
      localStorage.setItem(storageKey, t);
    } catch {
      /* modo privado: se aplica igual, solo no persiste */
    }
    applyTheme(t);
  }

  function toggleTheme(): Theme {
    const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
    setTheme(next);
    return next;
  }

  return { getTheme, applyTheme, setTheme, toggleTheme };
}
