import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['shared/js/firebase-rtdb-auth-merge.test.js'],
  },
});
