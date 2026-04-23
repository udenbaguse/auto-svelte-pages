import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function toPascalCase(value) {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

function toViteInputKey(relativeHtmlPath) {
  const withoutExt = relativeHtmlPath.replace(/\.html$/i, "");
  const segments = withoutExt.split(/[\\/]+/).filter(Boolean);
  const raw = segments.join("_").toLowerCase();
  const normalized = raw
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!normalized) {
    return "page";
  }
  return /^[0-9]/.test(normalized) ? `page_${normalized}` : normalized;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function unique(values) {
  return [...new Set(values)];
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadConfig(rootDir) {
  const jsConfigPath = path.join(rootDir, "auto-svelte-pages.config.js");
  if (!(await exists(jsConfigPath))) {
    return {};
  }

  const configModule = await import(pathToFileURL(jsConfigPath).href);
  return configModule.default ?? configModule ?? {};
}

function parseDeleteArgs(argv) {
  const args = argv.filter(Boolean);
  if (args.length < 1) {
    throw new Error("Use format: auto-svelte-pages delete <name1> [name2] ...");
  }
  const baseNames = args
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => (raw.endsWith(".html") ? raw.slice(0, -5) : raw));
  if (baseNames.length === 0) {
    throw new Error("Name is required.");
  }
  return [...new Set(baseNames)];
}

async function safeDelete(filePath, logs, rootDir) {
  if (!(await exists(filePath))) {
    return false;
  }
  await fs.unlink(filePath);
  logs.push(`DELETED ${path.relative(rootDir, filePath)}`);
  return true;
}

async function updateTextFile(filePath, transform, logs, rootDir) {
  if (!(await exists(filePath))) {
    return false;
  }

  const current = await fs.readFile(filePath, "utf8");
  const next = transform(current);
  if (next !== current) {
    await fs.writeFile(filePath, next, "utf8");
    logs.push(`UPDATED ${path.relative(rootDir, filePath)}`);
    return true;
  }
  return false;
}

function removeViteInputEntry(content, key, baseName) {
  const keyPattern = new RegExp(
    `^\\s*${escapeRegex(key)}\\s*:\\s*['"][^'"]*${escapeRegex(baseName)}\\.html['"],?\\s*\\r?\\n`,
    "gm",
  );
  let next = content.replace(keyPattern, "");

  const htmlPattern = new RegExp(
    `^\\s*[a-z0-9_]+\\s*:\\s*['"][^'"]*${escapeRegex(baseName)}\\.html['"],?\\s*\\r?\\n`,
    "gm",
  );
  next = next.replace(htmlPattern, "");
  return next;
}

export async function runDelete(argv, userOptions = {}) {
  const rootDir = path.resolve(userOptions.rootDir ?? process.cwd());
  const logs = [];
  const baseNames = parseDeleteArgs(argv);
  const config = await loadConfig(rootDir);

  const srcDirName =
    config.srcDir ?? config.dirs?.src ?? config.dir?.src ?? "src";
  const srcDir = path.join(rootDir, srcDirName);

  const entryDirs = unique(
    [
      config.entryDir,
      config.dirs?.entry,
      config.dir?.entry,
      "entry",
      "entrys",
      "./",
      ".",
    ].filter(Boolean),
  );

  const componentDirs = unique(
    [
      config.componentDir,
      config.dirs?.component,
      config.dir?.component,
      "component",
      "components",
      "lib",
    ].filter(Boolean),
  );

  let actionCount = 0;

  for (const baseName of baseNames) {
    const pascalName = toPascalCase(baseName);

    if (
      await safeDelete(path.join(rootDir, `${baseName}.html`), logs, rootDir)
    ) {
      actionCount += 1;
    }

    for (const entryDirName of entryDirs) {
      const normalized =
        entryDirName === "./" || entryDirName === "." ? "" : entryDirName;
      const dir = path.join(srcDir, normalized);
      for (const ext of ["js", "ts"]) {
        if (
          await safeDelete(path.join(dir, `${baseName}.${ext}`), logs, rootDir)
        ) {
          actionCount += 1;
        }
      }
    }

    for (const componentDirName of componentDirs) {
      if (
        await safeDelete(
          path.join(srcDir, componentDirName, `${pascalName}.svelte`),
          logs,
          rootDir,
        )
      ) {
        actionCount += 1;
      }
    }
  }

  for (const viteFile of ["vite.config.js", "vite.config.ts"]) {
    const changed = await updateTextFile(
      path.join(rootDir, viteFile),
      (text) => {
        let next = text;
        for (const baseName of baseNames) {
          const viteKey = toViteInputKey(`${baseName}.html`);
          next = removeViteInputEntry(next, viteKey, baseName);
        }
        return next;
      },
      logs,
      rootDir,
    );
    if (changed) {
      actionCount += 1;
    }
  }

  if (actionCount === 0) {
    throw new Error(`Nothing found for "${baseNames.join(", ")}".`);
  }

  logs.push(`DONE delete: ${baseNames.join(", ")}`);
  return logs;
}
