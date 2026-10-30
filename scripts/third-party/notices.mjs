#!/usr/bin/env node
/**
 * Write a THIRD-PARTY.md listing the third-party components a project ships and their license texts.
 *
 * Usage: third-party-notices [project-dir] [--output <file-or-folder>] [--name <product name>] [--flutter-sdk <dir>]
 *
 * project-dir defaults to the current folder. The packages come from the project's lockfile (pnpm-lock.yaml,
 * yarn.lock, package-lock.json or pubspec.lock), production dependencies only, so install dependencies first to get
 * the license texts. The output defaults to THIRD-PARTY.md in the project folder; a folder writes THIRD-PARTY.md in it.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { classify, flutterPackages, isFlutterProject } from "./flutter.mjs";
import { hasNpmLockfile, isDirectory, isFile, npmPackages, readText } from "./npm.mjs";

const USAGE = "Usage: third-party-notices [project-dir] [--output <file-or-folder>] [--name <product name>] [--flutter-sdk <dir>]";
const FILE_NAME = "THIRD-PARTY.md";
const SKY_ENGINE_NOTE =
  "The Flutter engine's own license and the licenses of its components are shown in the app's open-source licenses screen.";

const byName = (a, b) => {
  const [x, y] = [a.toLowerCase(), b.toLowerCase()];
  return x < y ? -1 : x > y ? 1 : 0;
};
const fence = (text) => `\`\`\`\`text\n${text.replace(/^\n+|\n+$/g, "")}\n\`\`\`\``;
const today = () => {
  const d = new Date();
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()].map((n) => String(n).padStart(2, "0")).join("-");
};

function flutterSdk(option) {
  const candidates = [option, process.env.FLUTTER_ROOT, join(homedir(), "snap", "flutter", "common", "flutter")];
  const sdk = candidates.find((c) => c && isFile(join(c, "LICENSE")) && isDirectory(join(c, "packages")));
  if (!sdk) throw new Error("Flutter SDK not found; pass --flutter-sdk <dir> or set FLUTTER_ROOT.");
  return resolve(sdk);
}

/** The product name, the packages, and any extra intro lines for the project. */
function readProject(project, options) {
  if (isFlutterProject(project)) {
    const sdk = flutterSdk(options["flutter-sdk"]);
    const sdkLicense = readText(join(sdk, "LICENSE"));
    const packages = flutterPackages(project, sdk).map((pkg) => {
      if (pkg.name === "sky_engine") return { ...pkg, licenseFiles: {}, note: SKY_ENGINE_NOTE };
      if (pkg.version === "Flutter SDK" && !Object.keys(pkg.licenseFiles).length) return { ...pkg, licenseFiles: { LICENSE: sdkLicense } };
      return pkg;
    });
    const name = /^name:\s*(\S+)/m.exec(readText(join(project, "pubspec.yaml")))?.[1];
    return { name, packages, intro: [] };
  }
  if (hasNpmLockfile(project)) {
    const manifest = JSON.parse(readText(join(project, "package.json")));
    const all = { ...manifest.dependencies, ...manifest.devDependencies };
    const electron = "electron" in all || "@overwolf/ow-electron" in all;
    const intro = electron
      ? ["This app is built on Electron, which includes Chromium and Node.js. Their licenses are included in the app's installation folder.", ""]
      : [];
    return { name: manifest.productName ?? manifest.name, packages: npmPackages(project), intro };
  }
  throw new Error(`No pnpm-lock.yaml, yarn.lock, package-lock.json or pubspec.lock found in ${project}.`);
}

/** Drop GameGlass's own packages, fill in license types from license texts, and dedupe by name and version. */
function clean(packages) {
  const result = new Map();
  for (const pkg of packages.filter((p) => p.name && !p.name.startsWith("@gameglass/"))) {
    const texts = Object.values(pkg.licenseFiles);
    const license = pkg.license === "UNKNOWN" && texts.length ? classify(texts[0]) : pkg.license;
    result.set(`${pkg.name}@${pkg.version}`, { ...pkg, license });
  }
  return [...result.values()];
}

function render(name, packages, intro) {
  const out = [
    "# Third-Party Notices",
    "",
    `Last updated: ${today()}`,
    "",
    `${name} includes the third-party components listed below. Each component is licensed to you under its own ` +
      "license, not the GameGlass End User License Agreement (see Section 7 of the EULA).",
    "",
    "Where a license requires us to provide source code, such as the GNU Lesser General Public License or the " +
      "Mozilla Public License, you can request it at [support@gameglass.gg](mailto:support@gameglass.gg).",
    "",
    ...intro,
  ];

  // Versions are left out on purpose: licenses don't require them, and they would point attackers at known vulnerabilities.
  const licensesByName = new Map();
  for (const pkg of packages) {
    const license = String(pkg.license).replaceAll("|", "\\|");
    const licenses = licensesByName.get(pkg.name) ?? new Set();
    licensesByName.set(pkg.name, licenses.add(license.length > 60 ? "See license text" : license));
  }
  const rows = [...licensesByName].sort(([a], [b]) => byName(a, b));
  out.push("## Components", "", `${rows.length} ${rows.length === 1 ? "component" : "components"}.`, "", "| Component | License |", "| --- | --- |");
  out.push(...rows.map(([pkgName, licenses]) => `| ${pkgName} | ${[...licenses].sort().join(", ")} |`), "");

  // Group components whose license files are identical, so each text appears once.
  const groups = new Map();
  const sorted = [...packages].sort((a, b) => byName(a.name, b.name) || (a.version < b.version ? -1 : a.version > b.version ? 1 : 0));
  for (const pkg of sorted) {
    const text = Object.values(pkg.licenseFiles).join("\n\n").trim();
    groups.set(text, [...(groups.get(text) ?? []), pkg]);
  }

  out.push("## License texts", "");
  for (const [text, pkgs] of [...groups].sort(([, a], [, b]) => byName(a[0].name, b[0].name))) {
    out.push(`### ${[...new Set(pkgs.map((p) => p.name))].join(", ")}`, "");
    if (text) {
      out.push(fence(text), "");
      continue;
    }
    for (const p of new Map(pkgs.map((p) => [p.name, p])).values()) {
      const note =
        p.note ??
        `License: ${p.license}. The package does not include a license file` + (p.homepage ? `; see ${p.homepage}.` : ".");
      out.push(`${p.name}: ${note}`, "");
    }
  }
  return `${out.join("\n").trimEnd()}\n`;
}

function outputPath(project, option) {
  if (!option) return join(project, FILE_NAME);
  const target = resolve(option);
  return option.endsWith("/") || isDirectory(target) ? join(target, FILE_NAME) : target;
}

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      output: { type: "string", short: "o" },
      name: { type: "string" },
      "flutter-sdk": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) {
    console.log(USAGE);
    return;
  }
  if (positionals.length > 1) throw new Error(USAGE);
  const project = resolve(positionals[0] ?? process.cwd());
  const { name, packages, intro } = readProject(project, values);
  const output = outputPath(project, values.output);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, render(values.name ?? name ?? "This software", clean(packages), intro));
  console.warn(`Wrote ${output}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
