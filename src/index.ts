// @nyro-ai/ui — superficie pública.
//
// Lo que NO se exporta desde aquí, porque no es JS:
//   import '@nyro-ai/ui/tokens.css';        // los tokens, antes del index.css
//   import nyro from '@nyro-ai/ui/preset';  // el preset de Tailwind
// Los `.js` son deliberados y no son un error: el paquete es "type": "module",
// así que Node lee dist/*.js como ESM, donde la extensión en un import relativo
// es obligatoria. tsc emite el especificador tal cual lo escribes — sin el .js
// el paquete funciona bajo un bundler y revienta en Node puro (vitest, SSR).
// Con moduleResolution "bundler", './x.js' resuelve a './x.ts' al compilar.
export { useDialogA11y } from './hooks/useDialogA11y.js';
export { useMediaQuery } from './hooks/useMediaQuery.js';
export { createTheme } from './lib/theme.js';
export type { Theme, ThemeApi } from './lib/theme.js';
