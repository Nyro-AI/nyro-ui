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

**1. Instalar** desde el tag de git — este paquete no está en ningún registro:

```bash
npm install "git+https://github.com/Nyro-AI/nyro-ui.git#v0.1.3"
```

Siempre un tag, nunca una rama: `#main` te instala lo que hubiera ese día y
convierte el lockfile en una promesa que no se cumple.

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

## `useDialogA11y` no pide nada al `onClose`

Pásalo como te salga, flecha inline incluida. No hace falta `useCallback`.

El hook parte el trabajo en tres efectos a propósito, y solo el del teclado
depende de `onClose`. El del fondo inerte y el foco depende **solo de `open`**:
cuando ese efecto llevaba también `onClose`, una flecha inline lo remontaba en
cada render del padre y el foco saltaba al primer campo — quien escribía en el
tercero volvía al primero en cuanto algo re-renderizaba arriba. Los dos casos
están cubiertos en `test/useDialogA11y.test.tsx`, y los dos fallan si alguien
vuelve a juntar los efectos.

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

## Sacar una versión

No hay `npm publish` ni registro: el tag **es** la versión.

```bash
npm version patch      # o minor / major — crea el commit y el tag
git push --follow-tags
```

Después, en cada app, subir el tag al que apunta:

```bash
npm install "git+https://github.com/Nyro-AI/nyro-ui.git#v0.1.4"
```

Eso reescribe el `package-lock.json`, que fija el SHA exacto — el tag es la
etiqueta, el lockfile es el contrato.

**`prepare` y no `prepublishOnly`.** `dist/` no está versionado, así que al
instalar desde git lo que llega es el fuente y npm tiene que compilarlo: eso lo
hace `prepare`, que sí corre en instalaciones desde git. Cambiarlo de vuelta
deja a las dos apps instalando un paquete sin `dist`.

**Los imports relativos de `src/index.ts` llevan `.js`.** Es la resolución ESM
de Node, que no adivina extensiones. Sin ellas, el paquete instalado no resuelve.

## Instalar desde un repo privado

`Nyro-AI/nyro-ui` es privado, y npm normaliza cualquier URL de github.com a
`git+ssh://` en el lockfile — no se puede evitar desde el `package.json`. En
local no se nota porque tu git ya tiene credenciales; en un runner o en un
build de Cloudflare/Vercel, no hay clave SSH y el clone falla.

La salida es reescribir esa URL a https con token, antes del `npm ci`:

```bash
git config --global url."https://x-access-token:$NYRO_UI_TOKEN@github.com/".insteadOf "ssh://git@github.com/"
git config --global url."https://x-access-token:$NYRO_UI_TOKEN@github.com/".insteadOf "git@github.com:"
```

`NYRO_UI_TOKEN` tiene que ser un PAT con **`repo`**. El `GITHUB_TOKEN` de otro
repo **no sirve**: está scopeado a su propio repo y no lee otro privado ni
siendo de la misma org.

## Compatibilidad

Cambiar un valor de token afecta a las dos apps a la vez. Antes de tocar
`tokens.css`, medir el contraste en los dos temas: el audit que originó este
paquete encontró fallos que iban de 1.31:1 a 4.47:1, y todos venían de suponer
que un color que funciona sobre un fondo funciona sobre el otro.
