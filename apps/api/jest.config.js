/** @type {import('jest').Config} */
module.exports = {
  rootDir: 'src',
  // test/support holds pure helpers (content rules) with their own specs.
  roots: ['<rootDir>', '<rootDir>/../test/support'],
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }],
  },
  testEnvironment: 'node',
  collectCoverageFrom: [
    '**/domain/**/*.ts',
    '**/application/**/*.ts',
    '!**/ports/**',
    '!**/*.spec.ts',
  ],
  coverageDirectory: '../coverage',
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
};
