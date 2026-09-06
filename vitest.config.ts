import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Node ≥22 ships a built-in localStorage stub that lacks `.clear()`; jsdom
// only replaces a localStorage global when none is already present, so on
// Node 22+ jsdom's real localStorage never wins and `.clear()` blows up.
// Passing `--no-experimental-webstorage` to worker threads disables the
// Node stub. The flag did not exist before Node 22 — passing it on Node 20
// (the project's pinned runtime in .nvmrc and CI) would fail with
// "bad option", so we gate it on the runtime major version.
const nodeMajor = Number(process.versions.node.split(".")[0]);
const workerExecArgv = nodeMajor >= 22 ? ["--no-experimental-webstorage"] : [];

export default defineConfig({
  resolve: {
    alias: {
      // `src/lib/data-loaders.js` imports FileAttachment from Observable
      // Framework's virtual stdlib module, which only the framework resolves.
      // Aliasing it to a stub makes the loader registry importable in tests.
      "observablehq:stdlib": fileURLToPath(
        new URL("./tests/stubs/observablehq-stdlib.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    poolOptions: {
      threads: {
        execArgv: workerExecArgv,
      },
    },
  }
});
