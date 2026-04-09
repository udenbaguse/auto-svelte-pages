# auto-svelte-pages

Generate Svelte `entry` + `component` files from root HTML pages and auto-sync Vite multi-page `rollupOptions.input`.

## Features

- Scan root `*.html` files and generate:
  - `src/entry/<name>.js`
  - `src/component/<Name>.svelte`
- Optional overwrite mode (`--force`)
- Auto-update `vite.config.js` input block using markers
- Reusable as CLI or JavaScript module

## Install

```bash
npm i -D github:udenbaguse/auspages
```

<!-- ## Usage

```bash
npx auto-svelte-pages
```

With overwrite:

```bash
npx auto-svelte-pages --force
``` -->

## Required Vite Markers

In `vite.config.js`, add this marker block inside `build.rollupOptions.input`:

```js
 build: {
    rollupOptions: {
      input: {

      },
    },
  },
```

The CLI replaces only the content between those markers.

## CLI Options

- `--force` overwrite generated entry/component files
- `--no-vite` skip updating `vite.config.js`
- `--root-only` only use root HTML files for Vite input (no recursive scan)
- `--root <path>` project root (default: current directory)
- `--src-dir <dir>` source directory under root (default: `src`)
- `--entry-dir <dir>` entry directory under src (default: `entry`)
- `--component-dir <dir>` component directory under src (default: `component`)
- `--vite-config <file>` Vite config path from root (default: `vite.config.js`)
- `--css-import <path>` CSS import path for generated entry files (default: `../app.css`)

## Script Setup Example

```json
{
  "scripts": {
    "generate:pages": "auspages",
    "generate:pages:force": "auspages --force"
  }
}
```

## Programmatic API

```js
import { generatePages } from 'auto-svelte-pages';

await generatePages({
  force: false,
  updateVite: true,
});
```



## Changelog

- See `CHANGELOG.md` for release notes.
