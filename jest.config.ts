import { InitialOptionsTsJest } from 'ts-jest/dist/types';

const config: InitialOptionsTsJest = {
  testMatch: ['**.spec.ts', '!**/*.integration.spec.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'esbuild-jest',
      {
        sourcemap: true,
        loaders: {
          '.spec.ts': 'tsx',
        },
      },
    ],
  },
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  clearMocks: true,
  testEnvironment: 'node',
  rootDir: './src',
  coverageDirectory: '../coverage',
  setupFiles: ['./tests/unit/setupFiles.ts'],
  setupFilesAfterEnv: ['./tests/unit/setupFilesAfterEnv.ts'],
};

export default config;
