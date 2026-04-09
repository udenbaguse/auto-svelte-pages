import { promises as fs } from 'node:fs';
import path from 'node:path';

const INPUT_START_MARKER = '// AUTO-GENERATED VITE INPUT START';
const INPUT_END_MARKER = '// AUTO-GENERATED VITE INPUT END';

function toPascalCase(value) {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function toViteInputKey(relativeHtmlPath) {
  const withoutExt = relativeHtmlPath.replace(/\.html$/i, '');
  const segments = withoutExt.split(/[\\/]+/).filter(Boolean);
  return segments.join('_').toLowerCase();
}

function entryTemplate(componentName, appCssImportPath) {
  return `import { mount } from 'svelte'
import '${appCssImportPath}'
import App from '../component/${componentName}.svelte'

const app = mount(App, {
  target: document.getElementById('app'),
})

export default app
`;
}

function componentTemplate(componentName) {
  return `<script>
  const title = '${componentName}';
</script>

<h1>{title}</h1>
`;
}

async function listHtmlFilesRecursively(rootDir, dir, ignoreDirs) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const htmlFiles = [];

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    const relativePath = path.relative(rootDir, absolutePath);

    if (entry.isDirectory()) {
      if (ignoreDirs.has(entry.name)) {
        continue;
      }

      const nested = await listHtmlFilesRecursively(
        rootDir,
        absolutePath,
        ignoreDirs,
      );
      htmlFiles.push(...nested);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.html')) {
      htmlFiles.push(relativePath);
    }
  }

  return htmlFiles;
}

function createInputBlock(relativeHtmlPaths) {
  const lines = relativeHtmlPaths.map((relativePath) => {
    const key = toViteInputKey(relativePath);
    return `        ${key}: '${normalizePath(relativePath)}',`;
  });

  return [
    `        ${INPUT_START_MARKER}`,
    ...lines,
    `        ${INPUT_END_MARKER}`,
  ].join('\n');
}

async function writeIfNeeded(filePath, content, forceWrite) {
  let exists = true;
  try {
    await fs.access(filePath);
  } catch {
    exists = false;
  }

  if (!exists || forceWrite) {
    await fs.writeFile(filePath, content, 'utf8');
    return exists ? 'overwritten' : 'created';
  }

  return 'skipped';
}

async function updateViteInput({ rootDir, viteConfigPath, htmlFiles }) {
  const viteContent = await fs.readFile(viteConfigPath, 'utf8');
  const escapedStart = INPUT_START_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedEnd = INPUT_END_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const markerPattern = new RegExp(
    `^[ \\t]*${escapedStart}[\\s\\S]*?^[ \\t]*${escapedEnd}`,
    'm',
  );

  if (!markerPattern.test(viteContent)) {
    throw new Error(
      `Cannot update Vite input. Missing markers in ${path.relative(
        rootDir,
        viteConfigPath,
      )}: "${INPUT_START_MARKER}" and "${INPUT_END_MARKER}".`,
    );
  }

  const nextContent = viteContent.replace(markerPattern, createInputBlock(htmlFiles));
  await fs.writeFile(viteConfigPath, nextContent, 'utf8');
}

export async function generatePages(userOptions = {}) {
  const rootDir = path.resolve(userOptions.rootDir ?? process.cwd());
  const srcDir = path.join(rootDir, userOptions.srcDir ?? 'src');
  const entryDir = path.join(srcDir, userOptions.entryDir ?? 'entry');
  const componentDir = path.join(srcDir, userOptions.componentDir ?? 'component');
  const viteConfigPath = path.join(rootDir, userOptions.viteConfig ?? 'vite.config.js');
  const forceWrite = Boolean(userOptions.force);
  const updateVite = userOptions.updateVite !== false;
  const includeNestedHtml = userOptions.includeNestedHtml !== false;
  const ignoreDirs = new Set(userOptions.ignoreDirs ?? ['.git', 'node_modules', 'dist']);
  const appCssImportPath = userOptions.appCssImportPath ?? '../app.css';

  const rootEntries = await fs.readdir(rootDir, { withFileTypes: true });
  const rootHtmlFiles = rootEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => entry.name);

  await fs.mkdir(entryDir, { recursive: true });
  await fs.mkdir(componentDir, { recursive: true });

  const logs = [];
  for (const htmlFile of rootHtmlFiles) {
    const baseName = path.parse(htmlFile).name;
    const componentName = toPascalCase(baseName);
    const entryPath = path.join(entryDir, `${baseName}.js`);
    const componentPath = path.join(componentDir, `${componentName}.svelte`);

    const entryResult = await writeIfNeeded(
      entryPath,
      entryTemplate(componentName, appCssImportPath),
      forceWrite,
    );
    logs.push(`${entryResult.toUpperCase()} ${path.relative(rootDir, entryPath)}`);

    const componentResult = await writeIfNeeded(
      componentPath,
      componentTemplate(componentName),
      forceWrite,
    );
    logs.push(`${componentResult.toUpperCase()} ${path.relative(rootDir, componentPath)}`);
  }

  if (updateVite) {
    const htmlFiles = includeNestedHtml
      ? await listHtmlFilesRecursively(rootDir, rootDir, ignoreDirs)
      : rootHtmlFiles;
    htmlFiles.sort((a, b) => a.localeCompare(b));
    await updateViteInput({ rootDir, viteConfigPath, htmlFiles });
    logs.push(`UPDATED ${path.relative(rootDir, viteConfigPath)} Vite input`);
  }

  if (rootHtmlFiles.length === 0) {
    logs.push('No root HTML files found. Nothing to generate.');
  }

  return {
    rootHtmlFiles,
    logs,
    markers: {
      start: INPUT_START_MARKER,
      end: INPUT_END_MARKER,
    },
  };
}
