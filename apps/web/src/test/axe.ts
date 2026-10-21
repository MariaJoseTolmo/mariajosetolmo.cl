import { configureAxe } from 'jest-axe';

// jsdom cannot compute colors; contrast is covered by src/styles/contrast.test.ts.
export const axe = configureAxe({
  rules: { 'color-contrast': { enabled: false } },
});
