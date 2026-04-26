import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    poolOptions: {
      threads: {
        // Node ≥22 ships a built-in localStorage stub that lacks .clear().
        // jsdom replaces it only when the Node stub is absent.
        execArgv: ["--no-experimental-webstorage"],
      },
    },
  }
});
