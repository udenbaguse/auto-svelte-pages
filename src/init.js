import { promises as fs } from "node:fs";
import path from "node:path";

const START_MARKER = "// AUTO-GENERATED VITE INPUT START";
const END_MARKER = "// AUTO-GENERATED VITE INPUT END";

function findMatchingBrace(content, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < content.length; i += 1) {
    const ch = content[i];
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

function lineIndentAt(content, index) {
  const lineStart = content.lastIndexOf("\n", index) + 1;
  const line = content.slice(lineStart, index);
  const match = line.match(/^\s*/);
  return match ? match[0] : "";
}

function blockWithMarkers(indent) {
  return `\n${indent}  ${START_MARKER}\n${indent}  ${END_MARKER}\n${indent}`;
}

function inputBlock(indent) {
  return `\n${indent}input: {\n${indent}  ${START_MARKER}\n${indent}  ${END_MARKER}\n${indent}},`;
}

function rollupBlock(indent) {
  return `\n${indent}rollupOptions: {\n${indent}  input: {\n${indent}    ${START_MARKER}\n${indent}    ${END_MARKER}\n${indent}  },\n${indent}},`;
}

function buildBlock(indent) {
  return `\n${indent}build: {\n${indent}  rollupOptions: {\n${indent}    input: {\n${indent}      ${START_MARKER}\n${indent}      ${END_MARKER}\n${indent}    },\n${indent}  },\n${indent}},`;
}

function tryInsertMarkersIntoObject(content, pattern) {
  const match = pattern.exec(content);
  if (!match) {
    return null;
  }

  const openIndex = match.index + match[0].lastIndexOf("{");
  const closeIndex = findMatchingBrace(content, openIndex);
  if (closeIndex < 0) {
    return null;
  }

  const objectIndent = lineIndentAt(content, openIndex);
  const insertion = blockWithMarkers(objectIndent);
  return (
    content.slice(0, openIndex + 1) + insertion + content.slice(openIndex + 1)
  );
}

function ensureMarkersInViteContent(content) {
  if (content.includes(START_MARKER) && content.includes(END_MARKER)) {
    return { content, changed: false, mode: "already" };
  }

  const inputUpdated = tryInsertMarkersIntoObject(content, /input\s*:\s*{/m);
  if (inputUpdated) {
    return { content: inputUpdated, changed: true, mode: "input" };
  }

  const rollupMatch = /rollupOptions\s*:\s*{/m.exec(content);
  if (rollupMatch) {
    const openIndex = rollupMatch.index + rollupMatch[0].lastIndexOf("{");
    const indent = lineIndentAt(content, openIndex) + "  ";
    const next =
      content.slice(0, openIndex + 1) +
      inputBlock(indent) +
      content.slice(openIndex + 1);
    return { content: next, changed: true, mode: "rollup" };
  }

  const buildMatch = /build\s*:\s*{/m.exec(content);
  if (buildMatch) {
    const openIndex = buildMatch.index + buildMatch[0].lastIndexOf("{");
    const indent = lineIndentAt(content, openIndex) + "  ";
    const next =
      content.slice(0, openIndex + 1) +
      rollupBlock(indent) +
      content.slice(openIndex + 1);
    return { content: next, changed: true, mode: "build" };
  }

  const defineMatch = /defineConfig\s*\(\s*{/m.exec(content);
  if (defineMatch) {
    const openIndex = defineMatch.index + defineMatch[0].lastIndexOf("{");
    const indent = lineIndentAt(content, openIndex) + "  ";
    const next =
      content.slice(0, openIndex + 1) +
      buildBlock(indent) +
      content.slice(openIndex + 1);
    return { content: next, changed: true, mode: "config" };
  }

  return { content, changed: false, mode: "unsupported" };
}

function defaultViteConfig() {
  return `import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        ${START_MARKER}
        ${END_MARKER}
      },
    },
  },
})
`;
}

function defaultConfigFile() {
  return `export default {
  dirs: {
    src: 'src',
    entry: './',
    component: 'lib',
  },
  cssImport: './app.css',
  markers: {
    start: '${START_MARKER}',
    end: '${END_MARKER}',
  },
}
`;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeJson(filePath, value) {
  const formatted = `${JSON.stringify(value, null, 2)}\n`;
  await fs.writeFile(filePath, formatted, "utf8");
}

export async function runInit(userOptions = {}) {
  const rootDir = path.resolve(userOptions.rootDir ?? process.cwd());
  const packageJsonPath = path.join(rootDir, "package.json");
  const viteConfigPath = path.join(rootDir, "vite.config.js");
  const configFilePath = path.join(rootDir, "auto-svelte-pages.config.js");
  const logs = [];

  const pkg = await readJson(packageJsonPath);
  pkg.scripts = pkg.scripts ?? {};
  const desiredScripts = {
    "init:auto-svelte-pages": "auto-svelte-pages init",
    "generate:all": "auto-svelte-pages",
    "generate:": "auto-svelte-pages",
    "generate:watch": "auto-svelte-pages --watch",
    "create:": "auto-svelte-pages create",
    "rename:": "auto-svelte-pages rename",
    "delete:": "auto-svelte-pages delete",
    "help:auto-svelte-pages": "auto-svelte-pages help",
  };

  for (const [key, value] of Object.entries(desiredScripts)) {
    if (!pkg.scripts[key]) {
      pkg.scripts[key] = value;
      logs.push(`ADDED script ${key}`);
    } else {
      logs.push(`SKIPPED script ${key} (already exists)`);
    }
  }
  await writeJson(packageJsonPath, pkg);

  try {
    await fs.access(viteConfigPath);
  } catch {
    await fs.writeFile(viteConfigPath, defaultViteConfig(), "utf8");
    logs.push("CREATED vite.config.js with marker block");
  }

  const viteContent = await fs.readFile(viteConfigPath, "utf8");
  const viteResult = ensureMarkersInViteContent(viteContent);
  if (viteResult.changed) {
    await fs.writeFile(viteConfigPath, viteResult.content, "utf8");
    logs.push(`UPDATED vite.config.js markers (mode: ${viteResult.mode})`);
  } else if (viteResult.mode === "already") {
    logs.push("SKIPPED vite.config.js markers (already exists)");
  } else {
    logs.push("SKIPPED vite.config.js markers (unsupported structure)");
  }

  try {
    await fs.access(configFilePath);
    logs.push("SKIPPED auto-svelte-pages.config.js (already exists)");
  } catch {
    await fs.writeFile(configFilePath, defaultConfigFile(), "utf8");
    logs.push("CREATED auto-svelte-pages.config.js");
  }

  return logs;
}
