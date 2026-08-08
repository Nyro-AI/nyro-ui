// @nyro-ai/ui — superficie pública.
//
// Lo que NO se exporta desde aquí, porque no es JS:
//   import '@nyro-ai/ui/tokens.css';        // los tokens, antes del index.css
//   import nyro from '@nyro-ai/ui/preset';  // el preset de Tailwind
export { useDialogA11y } from './hooks/useDialogA11y';
export { useMediaQuery } from './hooks/useMediaQuery';
export { createTheme } from './lib/theme';
export type { Theme, ThemeApi } from './lib/theme';
