# auto-svelte-pages

Generate Svelte `entry` + `component` files from root HTML pages and auto-sync Vite multi-page `rollupOptions.input`.

## Features

-create, rename, delete, and generate Svelte `entry` + `component` files from root HTML pages.
-auto-sync Vite multi-page `rollupOptions.input` with root HTML pages.

## Installation

```bash
npm i -D auto-svelte-pages
```
### Initialize script setup:
```bash
npx auto-svelte-pages init
```

## Use CLI

### Create one page:
```bash
npm run create: -- file-name
```

### Create multiple pages:
```bash
npm run create: -- file-name1 file-name2
```

### Rename page:
```bash
npm run rename: -- old-name to new-name
```
### Delete page:
```bash
npm run delete: -- file-name
```


### Generate one pages:
```bash
npm run generate: -- file-name
```
### Generate multiple pages:
```bash
npm run generate: -- file-name1 file-name2
```
### Generate all pages:
```bash
npm run generate:all
```
### Generate watch mode:
```bash
npm run generate:watch
```
### Show help:
```bash
npm run help:auto-svelte-pages
```

## CLI Options

- `--no-vite` skip updating `vite.config.js`
- `--root-only` only use root HTML files for Vite input (no recursive scan)
- `--root <path>` project root (default: current directory)
- `--src-dir <dir>` source directory under root (default: `src`)
- `--entry-dir <dir>` entry directory under src (default: `entry`)
- `--component-dir <dir>` component directory under src (default: `component`)
- `--vite-config <file>` Vite config path from root (default: `vite.config.js`)
- `--css-import <path>` CSS import path for generated entry files (default: `../app.css`)


## Programmatic API

```js
import { generatePages } from "auto-svelte-pages";

await generatePages({
  force: false,
  updateVite: true,
});
```

## Changelog

- See `CHANGELOG.md` for release notes.
