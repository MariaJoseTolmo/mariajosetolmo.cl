/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testRegex: '\\.int-spec\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json' }],
  },
  testEnvironment: 'node',
  // One real Redis and one real Postgres are shared: run files one at a time.
  maxWorkers: 1,
  testTimeout: 20000,
};
