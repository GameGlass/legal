/**
 * Find the Dart and Flutter packages a Flutter app ships, starting from its "direct main" dependencies.
 *
 * Reads pubspec.lock for versions and sources, then follows each package's pubspec.yaml "dependencies", so packages
 * only needed by dev_dependencies are left out. Does not run `flutter pub`, so lock files are untouched.
 */
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { isFile, licenseFiles, readText } from "./npm.mjs";

const PUB_CACHE = process.env.PUB_CACHE ?? join(homedir(), ".pub-cache");

function parseLock(lockText) {
  const afterHeader = lockText.slice(lockText.indexOf("\npackages:\n") + "\npackages:\n".length);
  const sdksAt = afterHeader.indexOf("\nsdks:");
  const section = sdksAt < 0 ? afterHeader : afterHeader.slice(0, sdksAt);
  return new Map(
    section.split(/\n  (?=[a-z0-9_]+:\n)/).map((block) => {
      const field = (key) => new RegExp(`\\n\\s+${key}: "?([^"\\n]+)"?`).exec(`\n${block}`)?.[1];
      const name = block.trim().split(":")[0];
      return [name, { dependency: field("dependency"), source: field("source"), version: field("version"), path: field("path") }];
    }),
  );
}

/** Names under the top-level `dependencies:` key of a pubspec.yaml. */
function pubspecDependencies(pubspecText) {
  const section = /^dependencies:\s*\n((?:(?:[ \t].*)?\n)*)/m.exec(`${pubspecText}\n`);
  return section ? [...section[1].matchAll(/^ {2}([a-z0-9_]+):/gm)].map((m) => m[1]) : [];
}

/** Recognize common license texts by their wording. */
export function classify(text) {
  const t = text.replace(/\s+/g, " ").toLowerCase();
  const rules = [
    ["Apache-2.0", t.includes("apache license") && t.includes("version 2.0")],
    ["MPL-2.0", t.includes("mozilla public license")],
    ["BSD-3-Clause", t.includes("neither the name") || t.includes("names of its contributors")],
    ["BSD-2-Clause", t.includes("redistributions in binary form")],
    ["MIT", t.includes("permission is hereby granted, free of charge")],
    ["ISC", t.includes("permission to use, copy, modify, and/or distribute")],
    ["Zlib", t.includes("altered source versions must be plainly marked")],
  ];
  return rules.find(([, hit]) => hit)?.[0] ?? "UNKNOWN";
}

function packageDir(app, sdk, name, entry) {
  if (entry.source === "hosted") return join(PUB_CACHE, "hosted", "pub.dev", `${name}-${entry.version}`);
  if (entry.source === "path") return resolve(app, entry.path ?? "");
  if (name === "sky_engine") return join(sdk, "bin", "cache", "pkg", "sky_engine");
  return join(sdk, "packages", name);
}

export const isFlutterProject = (project) => isFile(join(project, "pubspec.lock"));

export function flutterPackages(app, sdk) {
  const lock = parseLock(readText(join(app, "pubspec.lock")));
  const pending = [...lock].filter(([, e]) => e.dependency === "direct main").map(([name]) => name);
  const seen = new Set();
  const packages = [];
  const missing = [];
  // A for...of over an array visits entries appended during the loop, which walks the whole dependency graph.
  for (const name of pending) {
    const entry = lock.get(name);
    if (seen.has(name) || !entry) continue;
    seen.add(name);
    const dir = packageDir(app, sdk, name, entry);
    const pubspecPath = join(dir, "pubspec.yaml");
    if (!isFile(pubspecPath)) {
      missing.push(name);
      continue;
    }
    const pubspec = readText(pubspecPath);
    pending.push(...pubspecDependencies(pubspec));
    const files = licenseFiles(dir);
    const homepage = /^(?:repository|homepage):\s*(\S+)/m.exec(pubspec)?.[1];
    packages.push({
      name,
      version: entry.source === "sdk" ? "Flutter SDK" : (entry.version ?? ""),
      license: classify(Object.values(files)[0] ?? ""),
      homepage: homepage ?? (entry.source === "hosted" ? `https://pub.dev/packages/${name}` : ""),
      licenseFiles: files,
    });
  }
  if (missing.length) console.warn(`Not found (run flutter pub get): ${missing.join(", ")}`);
  console.warn(`Read ${packages.length} packages from pubspec.lock.`);
  return packages;
}
