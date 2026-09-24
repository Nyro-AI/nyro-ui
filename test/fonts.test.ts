import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { describe, it, expect } from 'vitest';

// El fallo que originó este archivo NO era un CSS vacío ni un typo: era un
// fichero que no viajaba. El preset declara `sans: ['Inter']` y
// `display: ['Poppins']` desde el primer día, y tres de las cuatro apps de la
// línea pintaban con el sans del sistema — sin un error en consola, sin un
// build roto, con `document.fonts.size` en 0. Nada de eso lo ve un typecheck.
//
// Por eso esta prueba no comprueba que el CSS «tenga texto». Comprueba las
// tres formas reales de romperlo:
//   1. que fonts.css declare las dos familias que el preset promete;
//   2. que cada url() apunte a un woff2 que EXISTE en el paquete;
//   3. que package.json lo exporte y liste `fonts` + `fonts.css` en `files`
//      — si no, npm publica el paquete sin las fuentes y revienta en la app.

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(raiz, 'fonts.css'), 'utf8');
const pkg = JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8')) as {
  files: string[];
  exports: Record<string, unknown>;
};

// Sin los comentarios: la cabecera de fonts.css cita la URL de Google Fonts
// como lo que NO hay que volver a hacer, y leerla como si fuera una regla
// convierte esa prosa en un fallo. Se analizan las reglas, no el archivo.
const reglas = css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Los bloques @font-face, ya sin comentarios. */
const bloques = reglas.match(/@font-face\s*\{[^}]*\}/g) ?? [];

/** Las url() que declara cada `src:`, tal cual están escritas. */
const urls = bloques.flatMap((b) =>
  [...b.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((m) => m[1]),
);

/** Las familias declaradas, normalizadas sin comillas. */
const familias = new Set(
  [...reglas.matchAll(/font-family:\s*['"]?([^;'"]+)['"]?\s*;/g)].map((m) => m[1].trim()),
);

describe('fonts.css declara lo que el preset promete', () => {
  it('declara Inter y Poppins — las dos familias de `fontFamily` en preset.js', () => {
    expect([...familias].sort()).toEqual(['Inter', 'Poppins']);
  });

  it('conserva font-display: swap en TODOS los @font-face', () => {
    expect(bloques.length).toBeGreaterThan(0);
    for (const b of bloques) {
      expect(b, `un @font-face sin font-display: swap deja el texto invisible:\n${b}`).toMatch(
        /font-display:\s*swap/,
      );
    }
  });

  it('conserva los unicode-range que parten latin de latin-ext', () => {
    // Sin ellos el navegador se baja los 85 KB de Inter latin-ext para escribir
    // «Clientes». Hay tantos rangos como @font-face.
    const rangos = reglas.match(/unicode-range:/g) ?? [];
    expect(rangos.length).toBe(bloques.length);
  });
});

describe('cada url() apunta a un fichero que existe en el paquete', () => {
  it('hay al menos una url()', () => {
    expect(urls.length).toBeGreaterThan(0);
  });

  it.each(urls)('%s existe en disco', (url) => {
    expect(existsSync(join(raiz, url))).toBe(true);
  });

  it('las rutas son relativas al paquete, no absolutas al sitio', () => {
    // `/fonts/x.woff2` dentro de un paquete apunta a la raíz del sitio que lo
    // consume, donde no hay nada. Es el fallo silencioso de portar esta hoja.
    for (const url of urls) {
      expect(url.startsWith('/'), `${url} es absoluta al sitio, no al paquete`).toBe(false);
      expect(url).toMatch(/^\.\/fonts\//);
    }
  });
});

describe('package.json hace que las fuentes viajen', () => {
  it('exporta ./fonts.css', () => {
    expect(pkg.exports['./fonts.css']).toBe('./fonts.css');
  });

  it('lista fonts.css y fonts/ en `files`', () => {
    expect(pkg.files).toContain('fonts.css');
    expect(pkg.files).toContain('fonts');
  });

  it('cada woff2 referenciado cae dentro de una entrada de `files`', () => {
    // La comprobación de verdad: que `files` cubra el woff2, no solo que exista
    // en el árbol de trabajo. Un fichero fuera de `files` está aquí y no allá.
    for (const url of urls) {
      const rel = normalize(url); // './fonts/x.woff2' -> 'fonts/x.woff2'
      const cubierto = pkg.files.some((f) => rel === f || rel.startsWith(`${f}/`));
      expect(cubierto, `${rel} no lo cubre ninguna entrada de \`files\`: ${pkg.files.join(', ')}`).toBe(
        true,
      );
    }
  });
});
