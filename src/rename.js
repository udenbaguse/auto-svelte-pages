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

function parseRenameArgs(argv) {
  const args = argv.filter(Boolean);
  const toIndex = args.findIndex((value) => value.toLowerCase() === "to");
  if (toIndex <= 0 || toIndex >= args.length - 1) {
    throw new Error("Use format: auto-svelte-pages rename <old> to <new>");
  }

  const oldName = args.slice(0, toIndex).join(" ").trim();
  const newName = args
    .slice(toIndex + 1)
    .join(" ")
    .trim();
  if (!oldName || !newName) {
    throw new Error("Old and new names are required.");
  }

  const oldBase = oldName.endsWith(".html") ? oldName.slice(0, -5) : oldName;
  const newBase = newName.endsWith(".html") ? newName.slice(0, -5) : newName;
  if (oldBase === newBase) {
    throw new Error("Old and new names cannot be identical.");
  }

  return { oldBase, newBase };
}

async function safeRename(oldPath, newPath, logs, rootDir) {
  if (!(await exists(oldPath))) {
    return false;
  }

  if (await exists(newPath)) {
    logs.push(
      `SKIPPED rename ${path.basename(oldPath)} -> ${path.basename(newPath)} (target exists)`,
    );
    return false;
  }

  await fs.mkdir(path.dirname(newPath), { recursive: true });
  await fs.rename(oldPath, newPath);
  logs.push(
    `RENAMED ${path.relative(rootDir, oldPath)} -> ${path.relative(rootDir, newPath)}`,
  );
  return true;
}

async function updateTextFile(filePath, transform, logs, rootDir) {
  if (!(await exists(filePath))) {
    return;
  }

  const current = await fs.readFile(filePath, "utf8");
  const next = transform(current);
  if (next !== current) {
    await fs.writeFile(filePath, next, "utf8");
    logs.push(`UPDATED ${path.relative(rootDir, filePath)}`);
  }
}

export async function runRename(argv, userOptions = {}) {
  const rootDir = path.resolve(userOptions.rootDir ?? process.cwd());
  const logs = [];
  const { oldBase, newBase } = parseRenameArgs(argv);
  const oldPascal = toPascalCase(oldBase);
  const newPascal = toPascalCase(newBase);

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

  const oldHtmlPath = path.join(rootDir, `${oldBase}.html`);
  const newHtmlPath = path.join(rootDir, `${newBase}.html`);
  const hasRenamedHtml = await safeRename(
    oldHtmlPath,
    newHtmlPath,
    logs,
    rootDir,
  );

  if (!(await exists(newHtmlPath))) {
    throw new Error(`Source HTML not found: ${oldBase}.html`);
  }

  await updateTextFile(
    newHtmlPath,
    (text) =>
      text.replace(
        new RegExp(`(src\\s*=\\s*['"][^'"]*/)${oldBase}(\\.(js|ts)['"])`, "g"),
        `$1${newBase}$2`,
      ),
    logs,
    rootDir,
  );

  for (const entryDirName of entryDirs) {
    const normalized =
      entryDirName === "./" || entryDirName === "." ? "" : entryDirName;
    const entryDir = path.join(srcDir, normalized);

    for (const ext of ["js", "ts"]) {
      const oldEntry = path.join(entryDir, `${oldBase}.${ext}`);
      const newEntry = path.join(entryDir, `${newBase}.${ext}`);
      const moved = await safeRename(oldEntry, newEntry, logs, rootDir);
      if (!moved && !(await exists(newEntry))) {
        continue;
      }

      await updateTextFile(
        newEntry,
        (text) =>
          text
            .replace(
              new RegExp(`${oldPascal}\\.svelte`, "g"),
              `${newPascal}.svelte`,
            )
            .replace(
              new RegExp(
                `(src\\s*=\\s*['"][^'"]*/)${oldBase}(\\.${ext}['"])`,
                "g",
              ),
              `$1${newBase}$2`,
            ),
        logs,
        rootDir,
      );
    }
  }

  for (const componentDirName of componentDirs) {
    const componentDir = path.join(srcDir, componentDirName);
    const oldComponent = path.join(componentDir, `${oldPascal}.svelte`);
    const newComponent = path.join(componentDir, `${newPascal}.svelte`);
    const moved = await safeRename(oldComponent, newComponent, logs, rootDir);
    if (!moved && !(await exists(newComponent))) {
      continue;
    }

    await updateTextFile(
      newComponent,
      (text) =>
        text.replace(
          new RegExp(
            `(const\\s+title\\s*=\\s*['"])${oldPascal}(['"]\\s*;)`,
            "g",
          ),
          `$1${newPascal}$2`,
        ),
      logs,
      rootDir,
    );
  }

  const oldKey = toViteInputKey(`${oldBase}.html`);
  const newKey = toViteInputKey(`${newBase}.html`);
  for (const viteFile of ["vite.config.js", "vite.config.ts"]) {
    const vitePath = path.join(rootDir, viteFile);
    await updateTextFile(
      vitePath,
      (text) =>
        text
          .replace(new RegExp(`\\b${oldKey}\\b(?=\\s*:)`, "g"), newKey)
          .replace(
            new RegExp(`(['"])${oldBase}\\.html\\1`, "g"),
            `'${newBase}.html'`,
          ),
      logs,
      rootDir,
    );
  }

  if (hasRenamedHtml) {
    logs.push(`DONE rename: ${oldBase} -> ${newBase}`);
  } else {
    logs.push(`DONE update references: ${oldBase} -> ${newBase}`);
  }

  return logs;
}
