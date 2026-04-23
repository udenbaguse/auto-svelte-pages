# Changelog

All notable changes to `auto-svelte-pages` will be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning.

## [3.0.1] - 2026-04-24

### Fixed
- fixed delete & rename on initial setup.
- add init script without downloading package.

## [3.0.0] - 2026-04-24

### Fixed
- Vite input keys are now normalized to safe identifiers when HTML filenames contain special characters (for example `nama-file.html` becomes key `nama_file`).
- Key normalization is now consistent across generate, rename, and delete flows.

### Changed
- `create` respects config file settings for generated paths (`src`, `entry`, `component`) and `cssImport`.

### Added
- New onboarding command: `auto-svelte-pages init`.
- `init` now auto-sets:
  - package.json scripts (`generate:all`, `generate:`, `generate:watch`)
  - marker block in `vite.config.js` (or creates file if missing)
  - default `auto-svelte-pages.config.js` (if missing)
- Native rename command:
  - `auto-svelte-pages rename <old> to <new>`
- Native delete command:
  - `auto-svelte-pages delete <name>`
- Both commands update related HTML, entry/component files, and Vite input references.  
- New native `create` command:
  - `auto-svelte-pages create <name1> [name2 ...]`
- `create` supports creating multiple pages in one command.
- `create` supports `--no-vite` to skip Vite input updates.
- `init` now also adds `create:` script in `package.json`.

## [2.2.2] - 2026-04-11

### Added
- Config file support via `auto-svelte-pages.config.js`.
- New `--config <file>` option to load config from a custom path.
- Configurable defaults for:
  - directories (`src`, `entry`, `component`)
  - Vite input markers (`start`, `end`)
  - CSS import path for generated entry files

### Changed
- Option priority is now: CLI args > config file > built-in defaults.

## [2.1.2] - 2026-04-10

### Added
- fixed `--watch` mode to monitor root HTML files and regenerate automatically on changes.

## [2.1.1] - 2026-04-10

### Added
-`--watch` mode to monitor root HTML files and regenerate automatically on changes.


## [2.0.0] - 2026-04-10

### Added
- Targeted scan by single file without full project scan:
  - `auto-svelte-pages naruto`
- Targeted scan by multiple files without full project scan:
  - `auto-svelte-pages naruto sasuke.html`
- NPM script alias for full scan mode:
  - `npm run generate:all`

### Removed
- `--force` option removed.
- `--force-html` option removed.
- Overwrite behavior removed from runtime generation flow.

### Changed
- Existing HTML/entry/component files are always skipped if already present.
- In targeted mode, Vite input update now upserts only selected targets without full re-scan.

## [1.1.0] - 2026-04-10

### Rename auto-svelte-pages to auspages

### Added
- HTML boilerplate templating for empty root HTML files:
  - `<div id="app"></div>`
  - `<script type="module" src="./src/entry/<name>.js"></script>`
- `--force-html` option to overwrite existing HTML files with boilerplate.
- Additional CLI options:
  - `--no-vite`
  - `--root-only`
  - `--root`
  - `--src-dir`
  - `--entry-dir`
  - `--component-dir`
  - `--vite-config`
  - `--css-import`

## [1.0.0] - 2026-04-10

### Added
- Initial CLI release: `auto-svelte-pages`.
- Generate `src/entry/<name>.js` from root `*.html` files.
- Generate `src/component/<Name>.svelte` from root `*.html` files.
- `--force` option to overwrite generated entry/component files.
- Auto-sync `build.rollupOptions.input` in `vite.config.js` via marker block:
  - `// AUTO-GENERATED VITE INPUT START`
  - `// AUTO-GENERATED VITE INPUT END`


### Changed
- Generator logic extracted into reusable package module API: `generatePages()`.
- Root project script now acts as a wrapper to the package CLI implementation.
