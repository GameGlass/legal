/**
 * Find the production npm packages a project depends on, from its lockfile (package-lock.json, yarn.lock v1 or
 * pnpm-lock.yaml v9), and read their license details from the installed copies in node_modules.
 */
import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join } from "node:path";

const LICENSE_FILE_RE = /^(licen[cs]e|copying|notice)/i;

/** Read a text file with Windows line endings turned into "\n", so identical license texts match. */
export const readText = (path) => readFileSync(path, "utf8").replace(/\r\n?/g, "\n");

export function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function safeReaddir(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function safeRealpath(path) {
  try {
    return realpathSync(path);
  } catch {
    return undefined;
  }
}

function readJson(path) {
  try {
    return JSON.parse(readText(path));
  } catch {
    return undefined;
  }
}

/** LICENSE, COPYING and NOTICE files in a package folder, by file name. */
export function licenseFiles(dir) {
  const names = safeReaddir(dir).filter((f) => LICENSE_FILE_RE.test(f) && isFile(join(dir, f))).sort();
  return Object.fromEntries(names.map((f) => [f, readText(join(dir, f))]));
}

function readPackage(dir) {
  const data = readJson(join(dir, "package.json")) ?? {};
  const raw = data.license || data.licenses;
  const license = Array.isArray(raw)
    ? raw.map((x) => (x && typeof x === "object" ? (x.type ?? "") : String(x))).join(" OR ")
    : raw && typeof raw === "object"
      ? raw.type
      : raw;
  const repo = data.repository && typeof data.repository === "object" ? data.repository.url : data.repository;
  return {
    name: data.name,
    version: data.version,
    license: license || "UNKNOWN",
    homepage: data.homepage || repo || "",
    licenseFiles: licenseFiles(dir),
  };
}

/** Every installed package under a node_modules folder, including pnpm's .pnpm store, as "name@version" → folder. */
function indexInstalled(nodeModules) {
  const index = new Map();
  const visited = new Set();
  const visit = (modulesDir) => {
    const real = safeRealpath(modulesDir);
    if (!real || visited.has(real)) return;
    visited.add(real);
    for (const entry of safeReaddir(modulesDir)) {
      if (entry === ".pnpm") {
        for (const d of safeReaddir(join(modulesDir, entry))) visit(join(modulesDir, entry, d, "node_modules"));
        continue;
      }
      if (entry.startsWith(".")) continue;
      const dirs = entry.startsWith("@")
        ? safeReaddir(join(modulesDir, entry)).map((s) => join(modulesDir, entry, s))
        : [join(modulesDir, entry)];
      for (const dir of dirs) {
        const manifest = readJson(join(dir, "package.json"));
        const key = manifest?.name && manifest.version && `${manifest.name}@${manifest.version}`;
        if (key && !index.has(key)) index.set(key, safeRealpath(dir));
        visit(join(dir, "node_modules"));
      }
    }
  };
  visit(nodeModules);
  return index;
}

function unquote(text) {
  if (text.startsWith("'")) return text.slice(1, -1).replaceAll("''", "'");
  if (text.startsWith('"')) return JSON.parse(text);
  return text;
}

/** Production dependencies from package.json, as name → version range. */
function rootDependencies(project) {
  const manifest = readJson(join(project, "package.json")) ?? {};
  return { ...manifest.dependencies, ...manifest.optionalDependencies };
}

function fromPackageLock(project) {
  const lock = readJson(join(project, "package-lock.json"));
  if (!lock?.packages) throw new Error("package-lock.json is lockfileVersion 1; run npm install with npm 7 or later to upgrade it.");
  return Object.entries(lock.packages)
    .filter(([path, entry]) => path.includes("node_modules/") && !entry.dev && !entry.link)
    .map(([path, entry]) => ({
      name: entry.name ?? path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length),
      version: entry.version,
      license: entry.license,
    }));
}

/** The package name a yarn.lock spec such as "react@^18", "@scope/x@1" or "alias@npm:real@^2" resolves to. */
function yarnSpecName(spec) {
  const at = spec.indexOf("@", 1);
  const range = spec.slice(at + 1);
  if (!range.startsWith("npm:")) return spec.slice(0, at);
  const real = range.slice("npm:".length);
  const realAt = real.indexOf("@", 1);
  return realAt < 0 ? real : real.slice(0, realAt);
}

function parseYarnLock(text) {
  const entries = new Map();
  for (const block of text.split(/\n{2,}/)) {
    const lines = block.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
    if (!lines.length || lines[0].startsWith(" ")) continue;
    const specs = lines[0].replace(/:$/, "").split(/,\s*/).map(unquote);
    const entry = { name: yarnSpecName(specs[0]), version: undefined, dependencies: [] };
    // Each line is either a top-level field (two spaces) or a dependency inside the section opened above it.
    lines.slice(1).reduce((section, line) => {
      const match = /^( +)("[^"]+"|\S+)\s*(.*)$/.exec(line);
      if (!match) return section;
      const [, indent, rawKey, value] = match;
      const key = unquote(rawKey.replace(/:$/, ""));
      if (indent.length === 2) {
        if (key === "version") entry.version = unquote(value);
        return value ? undefined : key;
      }
      if (section === "dependencies" || section === "optionalDependencies") entry.dependencies.push(`${key}@${unquote(value)}`);
      return section;
    }, undefined);
    for (const spec of specs) entries.set(spec, entry);
  }
  return entries;
}

function fromYarnLock(project) {
  const text = readText(join(project, "yarn.lock"));
  if (text.includes("\n__metadata:")) throw new Error("yarn.lock is from Yarn 2 or later, which isn't supported yet; only Yarn 1 lockfiles are.");
  const entries = parseYarnLock(text);
  const pending = Object.entries(rootDependencies(project)).map(([name, range]) => `${name}@${range}`);
  const found = new Map();
  // A for...of over an array visits entries appended during the loop, which walks the whole dependency graph.
  for (const spec of pending) {
    const entry = entries.get(spec);
    if (!entry || found.has(`${entry.name}@${entry.version}`)) continue;
    found.set(`${entry.name}@${entry.version}`, { name: entry.name, version: entry.version });
    pending.push(...entry.dependencies);
  }
  return [...found.values()];
}

/**
 * A minimal YAML reader for pnpm-lock.yaml: nested maps of plain or quoted scalars. List items are skipped and flow
 * values such as `{integrity: ...}` are kept as strings, since only the dependency maps are needed.
 */
function parsePnpmYaml(text) {
  const root = {};
  const stack = [{ indent: -1, value: root }];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("- ")) continue;
    const match = /^('(?:[^']|'')*'|"(?:[^"\\]|\\.)*"|[^:]+):(?:\s+(.*))?$/.exec(trimmed);
    if (!match) continue;
    const indent = line.length - line.trimStart().length;
    stack.length = stack.findLastIndex((s) => s.indent < indent) + 1;
    const parent = stack.at(-1).value;
    const key = unquote(match[1]);
    if (match[2] === undefined) {
      parent[key] = {};
      stack.push({ indent, value: parent[key] });
    } else {
      parent[key] = unquote(match[2]);
    }
  }
  return root;
}

/** The snapshot key for a dependency: "name@version(peers)", or the version itself for aliases like "real@1.0.0". */
function pnpmSnapshotKey(name, version) {
  if (typeof version !== "string" || version.startsWith("link:") || version.startsWith("file:")) return undefined;
  return /^@?[^@(]+@/.test(version) ? version : `${name}@${version}`;
}

function fromPnpmLock(project) {
  const lock = parsePnpmYaml(readText(join(project, "pnpm-lock.yaml")));
  if (!String(lock.lockfileVersion).startsWith("9")) {
    throw new Error(`pnpm-lock.yaml version ${lock.lockfileVersion} isn't supported; update it with pnpm 9 or later.`);
  }
  const importer = lock.importers?.["."] ?? {};
  const snapshots = lock.snapshots ?? {};
  const deps = (map) => Object.entries(map ?? {}).map(([name, v]) => pnpmSnapshotKey(name, typeof v === "object" ? v.version : v));
  const pending = deps({ ...importer.dependencies, ...importer.optionalDependencies });
  const found = new Map();
  // A for...of over an array visits entries appended during the loop, which walks the whole dependency graph.
  for (const key of pending) {
    if (!key || found.has(key)) continue;
    const base = key.replace(/\(.*$/, "");
    const at = base.lastIndexOf("@");
    found.set(key, { name: base.slice(0, at), version: base.slice(at + 1) });
    const snapshot = typeof snapshots[key] === "object" ? snapshots[key] : {};
    pending.push(...deps({ ...snapshot.dependencies, ...snapshot.optionalDependencies }));
  }
  return [...found.values()];
}

const LOCKFILES = [
  ["pnpm-lock.yaml", fromPnpmLock],
  ["yarn.lock", fromYarnLock],
  ["package-lock.json", fromPackageLock],
];

/** True if the project has a lockfile this module can read. */
export const hasNpmLockfile = (project) => LOCKFILES.some(([file]) => isFile(join(project, file)));

/** The production packages of an npm project, with license details from node_modules where installed. */
export function npmPackages(project) {
  const [lockfile, read] = LOCKFILES.find(([file]) => isFile(join(project, file)));
  const index = indexInstalled(join(project, "node_modules"));
  const missing = [];
  const packages = read(project).map(({ name, version, license }) => {
    const dir = index.get(`${name}@${version}`);
    if (dir) return readPackage(dir);
    if (!name.startsWith("@gameglass/")) missing.push(`${name}@${version}`);
    return {
      name,
      version,
      license: license || "UNKNOWN",
      homepage: "",
      licenseFiles: {},
      note: `Not installed when this file was generated (often a build for another platform); see https://www.npmjs.com/package/${name}.`,
    };
  });
  if (missing.length) {
    console.warn(`${missing.length} packages aren't installed, so their license texts are missing (often builds for other platforms): ${missing.join(", ")}`);
  }
  console.warn(`Read ${packages.length} production packages from ${lockfile}.`);
  return packages;
}
