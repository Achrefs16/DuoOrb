import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // The real react-native package ships Flow-typed source that a Node
      // test runner cannot parse. Only `Platform.OS` is needed by the
      // identity/session/socket modules under test.
      'react-native': fileURLToPath(new URL('./src/test/reactNativeStub.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
  },
});
