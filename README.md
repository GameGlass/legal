# legal

GameGlass's legal documents:

- [EULA.md](EULA.md): End User License Agreement
- [TERMS-OF-SERVICE.md](TERMS-OF-SERVICE.md): Terms of Service
- [PRIVACY-POLICY.md](PRIVACY-POLICY.md): Privacy Policy
- [TODO.md](TODO.md): work outside the documents, before and after publishing

## Third-party notices

Each product ships its own `THIRD-PARTY.md`, listing the third-party components it includes and their license texts (EULA Section 7). The `third-party-notices` command in this package generates it from a project's lockfile. Regenerate it for every release.

```sh
# In the project folder, after installing its dependencies:
npx third-party-notices --name "GameGlass Hub"

# Or pass the project folder, and write the file somewhere else:
npx third-party-notices ../hub --name "GameGlass Hub" --output build/resources/
```

| Option | What it does |
| --- | --- |
| `[project-dir]` | The project to read. Defaults to the current folder. |
| `--output`, `-o` | File to write, or a folder to write `THIRD-PARTY.md` into. Defaults to `THIRD-PARTY.md` in the project folder. |
| `--name` | Product name used in the notice. Defaults to `productName` or `name` from `package.json`, or `name` from `pubspec.yaml`. |
| `--flutter-sdk` | Flutter SDK folder, for Flutter apps. Defaults to `$FLUTTER_ROOT`, then `~/snap/flutter/common/flutter`. |

How it works:

- It reads `pnpm-lock.yaml` (version 9), `yarn.lock` (Yarn 1), `package-lock.json` (npm 7 or later) or `pubspec.lock`, and lists production dependencies only: `dependencies` and `optionalDependencies`, and everything they depend on. Packages that are bundled into the app must be in `dependencies` to be listed.
- License texts come from the installed packages, in `node_modules` or the pub cache. Packages that aren't installed, such as builds for other platforms, are listed with a link to npm instead, and the command prints a warning naming them.
- `@gameglass/*` packages are left out.
- Versions are left out on purpose. Licenses don't require them, and they would point attackers at known vulnerabilities.

Sample output:

```markdown
# Third-Party Notices

Last updated: 2026-10-30

GameGlass Hub includes the third-party components listed below. Each component is licensed to you under its own license, not the GameGlass End User License Agreement (see Section 7 of the EULA).

Where a license requires us to provide source code, such as the GNU Lesser General Public License or the Mozilla Public License, you can request it at [support@gameglass.gg](mailto:support@gameglass.gg).

## Components

1 component.

| Component | License |
| --- | --- |
| example-library | MIT |

## License texts

### example-library

    MIT License

    Copyright (c) ...
```
