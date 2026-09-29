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
  plugins: [
    {
      name: 'duoorb-sound-asset-stub',
      // Binary sound assets are unparseable in Node, and Metro's asset
      // require only exists at bundle time. Regex aliases do not apply to
      // relative imports, so a resolveId hook does the routing instead.
      resolveId(source: string) {
        if (/\.(wav|mp3)$/.test(source)) {
          return fileURLToPath(new URL('./src/test/assetStub.ts', import.meta.url));
        }
        return null;
      },
    },
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
  },
});
