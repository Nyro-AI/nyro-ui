// Chequeo de contraste de tokens.css — WCAG 2.1 AA para texto normal (4.5:1).
//
// POR QUÉ EXISTE
// El README manda medir el contraste en los dos temas antes de tocar
// tokens.css. Esa regla vivía solo en prosa, y el audit que originó este
// paquete encontró fallos de 1.31:1 a 4.47:1 — todos por suponer que un color
// que funciona sobre un fondo funciona sobre el otro. Aquí un cambio que rompa
// el desdoble superficie/texto falla en CI, no en producción.
//
// Sin dependencias a propósito: es la única cosa que tiene que poder correr
// aunque el resto del paquete no compile.
//
// Uso:  node scripts/contraste.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(raiz, 'tokens.css'), 'utf8');

const UMBRAL = 4.5; // AA, texto normal

// ── Lectura de tokens ────────────────────────────────────────────────────────
// Solo interesan los tokens que son un triplete de canales RGB (`--x: 11 15 13`).
// Los demás (--card-shadow y compañía) se ignoran solos al no matchear.
function bloque(selector) {
  const i = css.indexOf(selector);
  if (i === -1) throw new Error(`No encuentro el bloque \`${selector}\` en tokens.css.`);
  const abre = css.indexOf('{', i);
  const cierra = css.indexOf('}', abre);
  return css.slice(abre + 1, cierra);
}

function tokens(texto) {
  const mapa = {};
  for (const [, nombre, valor] of texto.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    const m = valor.trim().match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})$/);
    if (m) mapa[nombre] = [Number(m[1]), Number(m[2]), Number(m[3])];
  }
  return mapa;
}

const oscuro = tokens(bloque(':root {'));
// El tema claro solo redeclara lo que cambia; el resto lo hereda por cascada.
const claro = { ...oscuro, ...tokens(bloque(":root[data-theme='light']")) };

// ── Contraste ────────────────────────────────────────────────────────────────
const lineal = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminancia = ([r, g, b]) =>
  0.2126 * lineal(r) + 0.7152 * lineal(g) + 0.0722 * lineal(b);

const ratio = (a, b) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// Un `bg-juice/10` es el color semántico al 10% sobre el fondo que tenga
// debajo. CSS compone el alpha en sRGB, no en luz lineal: por eso la mezcla va
// sobre los canales 0-255 tal cual.
const mezcla = (color, fondo, alpha) =>
  color.map((c, i) => Math.round(c * alpha + fondo[i] * (1 - alpha)));

const hex = ([r, g, b]) =>
  '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0').toUpperCase()).join('');

// ── Qué se comprueba ─────────────────────────────────────────────────────────
// Los fondos sobre los que de verdad cae el texto en las dos apps: la página,
// los paneles, las tarjetas — y el tinte del propio color, que es donde vive
// cada badge (`bg-warning/10 text-warning`) y donde el saturado se queda al
// filo de AA.
const FONDOS = ['base', 'base-alt', 'surface'];

// [token de texto, token de la superficie de su tinte]
const TEXTOS = [
  ['primary-text', 'primary'],
  ['primary-text-hover', 'primary'],
  ['juice-text', 'juice'],
  ['warning-text', null], // la superficie de warning/critical es un hex del
  ['critical-text', null], // preset, no un token; solo van sobre los fondos
];

function comprobar(tema, mapa) {
  const fallos = [];
  const filas = [];

  const exige = (nombre) => {
    const v = mapa[nombre];
    if (!v) throw new Error(`Falta el token --${nombre} en el tema ${tema}.`);
    return v;
  };

  for (const [texto, tinte] of TEXTOS) {
    const fg = exige(texto);

    for (const fondo of FONDOS) {
      const bg = exige(fondo);
      const r = ratio(fg, bg);
      filas.push([`--${texto}`, `--${fondo}`, hex(bg), r]);
      if (r < UMBRAL) fallos.push({ texto, sobre: `--${fondo}`, r });
    }

    // El badge: el tinte al 10% sobre la tarjeta y sobre la página.
    if (tinte) {
      for (const fondo of ['base', 'surface']) {
        const bg = mezcla(exige(tinte), exige(fondo), 0.1);
        const r = ratio(fg, bg);
        filas.push([`--${texto}`, `--${tinte}/10 sobre --${fondo}`, hex(bg), r]);
        if (r < UMBRAL) fallos.push({ texto, sobre: `--${tinte}/10 sobre --${fondo}`, r });
      }
    }
  }

  // La tinta que va ENCIMA del acento. No sigue al tema a propósito, así que
  // tiene que aguantar en los dos.
  for (const superficie of ['primary', 'primary-dark']) {
    const fg = exige('on-primary');
    const bg = exige(superficie);
    const r = ratio(fg, bg);
    filas.push(['--on-primary', `--${superficie}`, hex(bg), r]);
    if (r < UMBRAL) fallos.push({ texto: 'on-primary', sobre: `--${superficie}`, r });
  }

  return { filas, fallos };
}

// ── Salida ───────────────────────────────────────────────────────────────────
let rotos = 0;

for (const [tema, mapa] of [['oscuro', oscuro], ['claro', claro]]) {
  const { filas, fallos } = comprobar(tema, mapa);
  console.log(`\nTema ${tema.toUpperCase()}`);
  for (const [texto, sobre, bg, r] of filas) {
    const ok = r >= UMBRAL;
    console.log(
      `  ${ok ? 'ok  ' : 'FALLA'} ${r.toFixed(2).padStart(6)}:1  ${texto.padEnd(20)} sobre ${sobre} (${bg})`,
    );
  }
  for (const f of fallos) {
    // Formato de anotación de GitHub Actions: sale marcado en el PR.
    console.log(
      `::error::--${f.texto} da ${f.r.toFixed(2)}:1 sobre ${f.sobre} en tema ${tema}. AA pide ${UMBRAL}:1.`,
    );
  }
  rotos += fallos.length;
}

console.log(
  rotos === 0
    ? `\nTodo pasa AA (${UMBRAL}:1) en los dos temas.`
    : `\n${rotos} par(es) por debajo de AA.`,
);

process.exit(rotos === 0 ? 0 : 1);
