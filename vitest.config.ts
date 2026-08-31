import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Playwright specifications run through their own browser runner. / As especificações Playwright usam seu próprio executor de navegador.
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});
