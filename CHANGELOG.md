# Changelog

All notable changes to `auto-svelte-pages` will be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning.

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
