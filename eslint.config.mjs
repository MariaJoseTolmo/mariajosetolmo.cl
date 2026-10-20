import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Libraries that must never leak into domain or application code.
const frameworkLibs = [
  'express',
  'typeorm',
  'kafkajs',
  'ioredis',
  'reflect-metadata',
  '@aws-sdk/*',
];

// Layer boundaries (design section 6). Exported so check-boundaries.mjs
// exercises exactly the same rules that `npm run lint` enforces.
export const domainRestrictions = {
  patterns: [
    {
      regex: '^@nestjs/',
      message: 'domain must not depend on NestJS.',
    },
    {
      regex: '(^|/)(application|infrastructure|bootstrap)(/|$)',
      message: 'domain must not import from outer layers.',
    },
    {
      group: frameworkLibs,
      message: 'domain must not depend on framework libraries.',
    },
  ],
};

export const applicationRestrictions = {
  paths: [
    {
      name: '@nestjs/common',
      allowImportNames: ['Injectable', 'Inject'],
      message: 'application may only use Injectable and Inject from NestJS.',
    },
  ],
  patterns: [
    {
      regex: '^@nestjs/(?!common$)',
      message: 'application may only use @nestjs/common.',
    },
    {
      regex: '(^|/)(infrastructure|bootstrap)(/|$)',
      message: 'application must not import from infrastructure or bootstrap.',
    },
    {
      group: frameworkLibs,
      message: 'application must not depend on framework libraries.',
    },
  ],
};

export default defineConfig(
  {
    // 'Dise*' because 'Diseño' does not match under macOS unicode normalization.
    ignores: ['spikes/**', 'Dise*/**', '**/dist/**', '**/coverage/**'],
  },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.{js,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.js'],
    languageOptions: { sourceType: 'commonjs' },
  },
  {
    files: ['apps/api/src/**/domain/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', domainRestrictions] },
  },
  {
    files: ['apps/api/src/**/application/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', applicationRestrictions] },
  },
  prettier,
);
