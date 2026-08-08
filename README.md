# @nyro-ai/ui

Tokens, preset de Tailwind y primitivas compartidas por los dos ERPs de Nyro:
[`Nyro-AI/nyro-web`](https://github.com/Nyro-AI/nyro-web) (La Fresquería) y
[`williamflorespr/gm-erp`](https://github.com/williamflorespr/gm-erp) (Generators & More).

## Por qué existe

Las dos apps se ven igual a propósito, pero cada una tenía su propia copia de
todo. Las copias se separaron:

- `--critical-text` se arregló en nyro-erp y no en gm-erp. Estuvo así hasta que
  alguien lo comparó a mano.
- `useDialogA11y.ts` se escribió una vez y se copió a la otra app con un commit
  en cada repo. Cualquier arreglo futuro habría necesitado los dos otra vez.
- El fallo de foco de gm-erp existía **porque** su capa de remaps con
  `!important` no está en nyro-erp. Dos sistemas divergiendo en silencio.

Este paquete es la fuente única de lo que de verdad comparten. No es un design
system: es el suelo común.

## Qué trae

| | |
|---|---|
| `@nyro-ai/ui/tokens.css` | Los 14 tokens compartidos, tema oscuro y claro |
| `@nyro-ai/ui/preset` | Preset de Tailwind: colores, desdoble superficie/texto, fuentes, sombras |
| `useDialogA11y` | Trampa de foco, Escape, bloqueo de scroll con contador, `inert` del fondo |
| `useMediaQuery` | Suscripción a un media query, SSR-safe |
| `createTheme(clave)` | Tema claro/oscuro; la clave de localStorage la pone cada app |

## Cómo se usa

**1. Instalar** (requiere un token con `read:packages`, ver abajo):

```bash
npm install @nyro-ai/ui
```

**2. Los tokens**, arriba del `index.css` de la app — un `@import` de CSS tiene
que preceder a cualquier regla:

```css
@import '@nyro-ai/ui/tokens.css';

@tailwind base;
@tailwind components;
@tailwind utilities;
```

Lo que la app declare después gana, así que los tokens propios de cada una
(`--ov-*`, `--t-*`, `--bd-*` en gm-erp) siguen mandando.

**3. El preset**, en `tailwind.config.js`:

```js
import nyro from '@nyro-ai/ui/preset';

export default {
  presets: [nyro],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: { /* solo lo propio de esta app */ } },
};
```

**4. El tema**, fijando la clave de la app:

```ts
import { createTheme } from '@nyro-ai/ui';
export const { getTheme, setTheme, toggleTheme } = createTheme('nyro_theme');
```

## Lo que NO está aquí, a propósito

**Los remaps de la paleta cruda de Tailwind.** `nyro-erp` remapea `slate` sin
`!important`; `gm-erp` remapea `gray` **con** `!important`. Son compensaciones de
cada app, no vocabulario común — y compartir esa capa es lo que produjo el fallo
de foco: el `!important` mataba los `focus:border-*`. Este paquete declara
valores; no impone utilidades.

**Los componentes con UI.** `ConfirmDialog`, `ErrorBoundary`, `UpdateBanner` y
`ThemeToggle` difieren hoy entre 5 y 49 líneas. Se pueden unificar, pero exige
decidir el aspecto común primero. Queda para una v0.2.

## El desdoble superficie / texto

Cada color semántico tiene **dos** tokens porque son dos papeles:

```
--primary        superficie   bg-primary, border-primary/20   NO cambia con el tema
--primary-text   texto        text-primary                    SÍ cambia
```

Un teal pálido pensado para fondo oscuro cae a 1.38:1 sobre fondo claro. Lo
mismo para `juice`, `warning` y `critical`. Romper el desdoble es reintroducir
el fallo de contraste que costó todo un audit.

## Publicar

```bash
npm version patch      # o minor / major
npm publish
```

Hace falta un token con **`write:packages`**. El token de trabajo habitual
(`gist, read:org, repo, workflow`) **no sirve**.

Para que las apps puedan instalarlo, tanto en local como en CI (Cloudflare
Pages / Vercel), hace falta `NODE_AUTH_TOKEN` con `read:packages` y un `.npmrc`
con:

```
@nyro-ai:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

## Compatibilidad

Cambiar un valor de token afecta a las dos apps a la vez. Antes de tocar
`tokens.css`, medir el contraste en los dos temas: el audit que originó este
paquete encontró fallos que iban de 1.31:1 a 4.47:1, y todos venían de suponer
que un color que funciona sobre un fondo funciona sobre el otro.
