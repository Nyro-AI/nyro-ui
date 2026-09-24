/**
 * PRESET DE TAILWIND COMPARTIDO — @nyro-ai/ui
 *
 * Mapea los tokens de tokens.css a utilidades de Tailwind. Ningún hex vive en
 * las apps: cambiar el color de la plataforma es editar tokens.css y ya.
 *
 * CÓMO SE USA — tailwind.config.js de la app:
 *   import nyro from '@nyro-ai/ui/preset';
 *   export default {
 *     presets: [nyro],
 *     content: ['./index.html', './src/**\/*.{js,ts,jsx,tsx}'],
 *     theme: { extend: { colors: { brand: { ... } } } },   // alias propios
 *   };
 *
 * DOS COSAS QUE PARECEN GRATUITAS Y NO LO SON
 *
 * 1. El color de página se llama `page`, NUNCA `base`. Tailwind ya tiene
 *    `text-base` (tamaño de fuente); un color llamado `base` emite una SEGUNDA
 *    regla `.text-base` que además pinta el texto, y su variante responsive
 *    (`md:text-base`, que sale dentro de un media query y por tanto después) le
 *    gana a cualquier `text-slate-*` sin prefijo. Resultado: texto del color del
 *    fondo, invisible y en silencio. Las variables siguen llamándose --base.
 *
 * 2. `textColor` reasigna primary/juice/warning/critical a OTRO token que el de
 *    `colors`. Es el desdoble superficie/texto: `bg-primary` quiere el teal
 *    pálido, `text-primary` lo quiere oscurecido en tema claro. Las entradas van
 *    como OBJETO y no como string — un string borraría las variantes y dejaría
 *    muertos los `hover:text-primary-dark`.
 */

/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        // Fondos, como CSS var (canales RGB) → siguen al tema.
        page: {
          DEFAULT: 'rgb(var(--base) / <alpha-value>)',
          alt: 'rgb(var(--base-alt) / <alpha-value>)',
        },
        surface: 'rgb(var(--surface) / <alpha-value>)',

        // Tinta legible ENCIMA del acento (text-ink sobre bg-primary). Se llama
        // `ink` y no `page-alt` porque son papeles distintos: `page-alt` es un
        // FONDO y sigue al tema; esto es TEXTO sobre un color que no lo sigue.
        ink: 'rgb(var(--on-primary) / <alpha-value>)',

        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          dark: 'rgb(var(--primary-dark) / <alpha-value>)',
        },

        // Superficies semánticas: hex saturado a propósito. El que voltea con el
        // tema es el token de TEXTO, abajo en textColor.
        juice: 'rgb(var(--juice) / <alpha-value>)',
        warning: '#FF7A2F',
        critical: '#FF4D4D',
      },

      textColor: {
        primary: {
          DEFAULT: 'rgb(var(--primary-text) / <alpha-value>)',
          dark: 'rgb(var(--primary-text-hover) / <alpha-value>)',
        },
        juice: 'rgb(var(--juice-text) / <alpha-value>)',
        warning: 'rgb(var(--warning-text) / <alpha-value>)',
        critical: 'rgb(var(--critical-text) / <alpha-value>)',
      },

      // Las dos familias las sirve `@nyro-ai/ui/fonts.css`, auto-hospedadas
      // dentro del paquete. Si la app no importa esa hoja, esto compila igual y
      // `font-sans`/`font-display` siguen existiendo, pero el navegador no
      // encuentra ninguna de las dos y cae al sans del sistema SIN un error en
      // consola. Ese silencio es lo que tuvo a tres de las cuatro apps de la
      // línea sin tipografía hasta que alguien miró `document.fonts.size`.
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Poppins', 'sans-serif'],
      },

      boxShadow: {
        // Los valores viven en tokens.css, que es lo único que sigue al tema.
        card: 'var(--card-shadow)',
        'card-hover': 'var(--card-shadow-hover)',
      },
    },
  },
};
