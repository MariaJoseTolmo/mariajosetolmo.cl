// Self-test for the layer rules in eslint.config.mjs: lints throwaway code
// as if it lived in domain/ and application/, so no broken files sit in src.
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';

// Virtual files are not in any tsconfig, so type-aware linting is switched off.
const eslint = new ESLint({
  cwd: process.cwd(),
  overrideConfig: tseslint.configs.disableTypeChecked,
});
const src = 'apps/api/src/health';

const cases = [
  {
    name: 'domain imports Nest',
    filePath: `${src}/domain/probe.ts`,
    code: "import { Injectable } from '@nestjs/common';\nexport const x = Injectable;\n",
    expectViolation: true,
  },
  {
    name: 'domain imports jose',
    filePath: `${src}/domain/probe.ts`,
    code: "import { SignJWT } from 'jose';\nexport const x = SignJWT;\n",
    expectViolation: true,
  },
  {
    name: 'application imports pg',
    filePath: `${src}/application/probe.ts`,
    code: "import { Pool } from 'pg';\nexport const x = Pool;\n",
    expectViolation: true,
  },
  {
    name: 'application imports infrastructure',
    filePath: `${src}/application/probe.ts`,
    code: "import { ProcessProbe } from '../infrastructure/probes/process.probe';\nexport const x = ProcessProbe;\n",
    expectViolation: true,
  },
  {
    name: 'application imports a disallowed Nest symbol',
    filePath: `${src}/application/probe.ts`,
    code: "import { Controller } from '@nestjs/common';\nexport const x = Controller;\n",
    expectViolation: true,
  },
  {
    name: 'application imports Injectable and domain (valid)',
    filePath: `${src}/application/probe.ts`,
    code: "import { Injectable } from '@nestjs/common';\nimport { aggregate } from '../domain/health-report';\nexport const x = [Injectable, aggregate];\n",
    expectViolation: false,
  },
];

let failed = false;
for (const { name, filePath, code, expectViolation } of cases) {
  const [result] = await eslint.lintText(code, { filePath });
  const violated = result.messages.some(
    (m) => m.ruleId === 'no-restricted-imports',
  );
  const ok = violated === expectViolation;
  if (!ok) failed = true;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

process.exit(failed ? 1 : 0);
