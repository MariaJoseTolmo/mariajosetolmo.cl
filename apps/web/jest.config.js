const nextJest = require('next/jest');

module.exports = nextJest({ dir: './' })({
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/{app,src,scripts}/**/*.test.{ts,tsx,js}'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  collectCoverageFrom: [
    'src/{lib,features,components}/**/*.{ts,tsx}',
    '!**/*.test.*',
    '!src/lib/api/mock/fixtures.ts',
  ],
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
});
