import { promises as fs } from "node:fs";
import path from "node:path";
import { generatePages } from "./generator.js";

function normalizeTargetFile(target) {
  const clean = target.trim();
  if (!clean) {
    return null;
  }

  const htmlFile = clean.endsWith(".html") ? clean : `${clean}.html`;
  if (htmlFile.includes("/") || htmlFile.includes("\\")) {
    throw new Error(`Target must be a root HTML file name: ${target}`);
  }

  return htmlFile;
}

function parseCreateArgs(argv) {
  const options = {
    updateVite: true,
    targets: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--no-vite") {
      options.updateVite = false;
      continue;
    }

    if (arg === "--root") {
      options.rootDir = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--src-dir") {
      options.srcDir = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--entry-dir") {
      options.entryDir = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--component-dir") {
      options.componentDir = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--vite-config") {
      options.viteConfig = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--css-import") {
      options.appCssImportPath = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--config") {
      options.configPath = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown create argument: ${arg}`);
    }

    options.targets.push(arg);
  }

  if (options.targets.length === 0) {
    throw new Error("Use format: auto-svelte-pages create <name1> [name2] ...");
  }

  return options;
}

async function ensureRootHtmlFiles(rootDir, targets, logs) {
  const htmlTargets = [];

  for (const target of targets) {
    const htmlFile = normalizeTargetFile(target);
    if (!htmlFile) {
      continue;
    }

    const htmlPath = path.join(rootDir, htmlFile);
    let exists = true;
    try {
      await fs.access(htmlPath);
    } catch {
      exists = false;
    }

    if (!exists) {
      await fs.writeFile(htmlPath, "", "utf8");
      logs.push(`CREATED ${htmlFile}`);
    } else {
      logs.push(`SKIPPED ${htmlFile} (already exists)`);
    }

    htmlTargets.push(htmlFile);
  }

  return [...new Set(htmlTargets)];
}

export async function runCreate(argv) {
  const options = parseCreateArgs(argv);
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const logs = [];

  const htmlTargets = await ensureRootHtmlFiles(rootDir, options.targets, logs);
  const result = await generatePages({
    ...options,
    rootDir,
    targets: htmlTargets,
  });

  return [...logs, ...result.logs];
}
