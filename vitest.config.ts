import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
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

// `src/globe.js` and every module in `src/components/` import sibling
// TypeScript with a `.js` specifier — `import { regionGWAtHour } from
// "../lib/calc.js"` for what is really `calc.ts`. That is what Observable
// Framework's client bundler expects, and it is what ships. Vite resolves
// specifiers literally, so a test that imports one of those modules fails with
// "Failed to resolve import ../lib/calc.js" (first hit: the /regions directory
// filter, which is the first component with a lib dependency to get a jsdom
// test). This plugin only acts when the `.js` file genuinely does not exist:
// it tries the specifier as written first and falls back to the extensionless
// form, so nothing about how the existing tests resolve changes.
const resolveJsToTs: Plugin = {
  name: "elj-resolve-js-to-ts",
  enforce: "pre",
  async resolveId(source, importer, options) {
    if (!importer || !source.startsWith(".") || !source.endsWith(".js")) return null;
    const asWritten = await this.resolve(source, importer, { ...options, skipSelf: true });
    if (asWritten) return asWritten;
    return this.resolve(source.slice(0, -".js".length), importer, {
      ...options,
      skipSelf: true,
    });
  },
};

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
  plugins: [resolveJsToTs],
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
