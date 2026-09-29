/**
 * Which data loaders the site reads, so that scripts/build/prefetch-loaders.ts
 * runs the loaders `observable build` would run and no others.
 *
 * Framework runs a loader only when the site asks for its file: a
 * FileAttachment or an asset in a page or module, or a path in the config's
 * dynamicPaths. A loader nothing asks for never runs in a build.
 *
 * The test is textual: a loader counts as read when "data/<file>" appears,
 * as a whole file name, in observablehq.config.ts or in a page or module
 * under src/ outside src/data. It errs towards running a loader (a mention in
 * a comment counts), and it cannot see a path built at run time, such as
 * `data/${id}.json` in a page loader. Framework runs any referenced loader
 * the prefetch left out itself, one at a time.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export interface Loader {
  /** The loader's path, e.g. <root>/src/data/ercot.json.ts. */
  file: string;
  /** "ercot" */
  name: string;
  /** The file it writes, relative to src/data (and to Framework's cache/data): "ercot.json". */
  target: string;
}

/**
 * The loader files in `dataDir`, as the prefetch has always matched them:
 * `x.json.ts` writes `x.json`. (All of this site's loaders are .ts.)
 */
export function listLoaders(dataDir: string): Loader[] {
  return readdirSync(dataDir)
    .filter((f) => /\.[a-z0-9]+\.(ts|js|mjs)$/.test(f))
    .map((f) => {
      const target = f.replace(/\.(ts|js|mjs)$/, "");
      return { file: join(dataDir, f), name: target.replace(/\.[a-z0-9]+$/, ""), target };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * "data/" as a whole path segment, then the file name up to the first
 * character that ends one here: a slash, quote, bracket, space, comma and so
 * on. That covers FileAttachment calls in any quotes, markdown images, srcset
 * lists and unquoted attributes. The lookbehind keeps "metadata/x.json" from
 * reading as "data/x.json". The whole name is compared with each loader's, so
 * "data/ercot-native.json" never counts as "ercot.json", and a loader's own
 * source, "data/ercot.json.ts", counts as neither.
 */
const REFERENCE_RE = /(?<![\w.-])data\/([^\s"'`\\()<>[\]{},;:?#|*=/]+)/g;

/** The data file names ("ercot.json") that these sources mention. */
export function referencedFiles(sources: Iterable<string>): Set<string> {
  const files = new Set<string>();
  for (const source of sources) {
    for (const match of source.matchAll(REFERENCE_RE)) files.add(match[1]);
  }
  return files;
}

/** The files Framework parses for references: pages, page loaders, modules. */
const SOURCE_RE = /\.(?:md|html|js|jsx|mjs|ts|tsx)$/;

const isEnoent = (err: unknown) => (err as NodeJS.ErrnoException)?.code === "ENOENT";

/**
 * The paths under `srcDir` that Framework would visit, walked the way its
 * visitFiles does: `.observablehq` is skipped at any depth, symlinks are
 * followed, and a file that vanishes mid-walk is ignored. The top-level `data`
 * directory is skipped too, because a loader naming its own output is not a
 * reader.
 */
function sourcePaths(srcDir: string): string[] {
  const paths: string[] = [];
  const visited = new Set<number>();
  const queue = [srcDir];
  for (const path of queue) {
    try {
      const status = statSync(path);
      if (status.isDirectory()) {
        if (visited.has(status.ino)) continue;
        visited.add(status.ino);
        for (const entry of readdirSync(path)) {
          if (entry === ".observablehq" || (path === srcDir && entry === "data")) continue;
          queue.push(join(path, entry));
        }
      } else if (SOURCE_RE.test(path)) {
        paths.push(path);
      }
    } catch (err) {
      if (!isEnoent(err)) throw err;
    }
  }
  return paths;
}

/** The text of the site's config and of every page and module under `root/src`. */
export function readSiteSources(root: string): string[] {
  const configs = ["observablehq.config.ts", "observablehq.config.js"]
    .map((name) => join(root, name))
    .filter((path) => existsSync(path));
  return [...configs, ...sourcePaths(join(root, "src"))].flatMap((path) => {
    try {
      return [readFileSync(path, "utf8")];
    } catch (err) {
      if (isEnoent(err)) return [];
      throw err;
    }
  });
}

export interface Selection {
  /** The loaders to prefetch. */
  run: Loader[];
  /** The loaders nothing mentions, which the prefetch skips. */
  skip: Loader[];
  /** Why every loader runs, when the sources could not decide. */
  fallback?: string;
}

/**
 * Split loaders into those the site reads and those it does not. When the
 * sources cannot be read, or mention none of the loaders, every loader runs,
 * as before the prefetch could tell: a failed scan must not leave all of them
 * to Framework's one-at-a-time run.
 */
export function selectLoaders(loaders: Loader[], readSources: () => string[]): Selection {
  let referenced: Set<string>;
  try {
    referenced = referencedFiles(readSources());
  } catch (err) {
    return { run: loaders, skip: [], fallback: `the site's sources could not be read (${(err as Error).message})` };
  }
  const run = loaders.filter((l) => referenced.has(l.target));
  if (run.length === 0 && loaders.length > 0) {
    return { run: loaders, skip: [], fallback: "the site's sources name none of the loaders" };
  }
  return { run, skip: loaders.filter((l) => !referenced.has(l.target)) };
}
