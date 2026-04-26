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
