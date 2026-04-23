import { watch as fsWatch } from "node:fs";
import path from "node:path";
import { generatePages } from "./generator.js";
import { runInit } from "./init.js";
import { runRename } from "./rename.js";
import { runDelete } from "./delete.js";
import { runCreate } from "./create.js";

function parseArgs(argv) {
  const options = {
    updateVite: true,
    includeNestedHtml: true,
    watch: false,
    targets: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--no-vite") {
      options.updateVite = false;
      continue;
    }

    if (arg === "--root-only") {
      options.includeNestedHtml = false;
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

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--watch") {
      options.watch = true;
      continue;
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    options.targets.push(arg);
  }

  return options;
}

function printHelp() {
  console.log(`auto-svelte-pages

Usage:
  npm run <keywoard> <options>

Options:
  --no-vite            Skip updating vite.config.js input block
  --root-only          Use root HTML files only for Vite input (no recursive scan)
  --root <path>        Project root (default: current directory)
  --src-dir <dir>      Source dir under root (default: src)
  --entry-dir <dir>    Entry dir under src (default: entry)
  --component-dir <dir>Component dir under src (default: component)
  --vite-config <file> Vite config path from root (default: vite.config.js)
  --css-import <path>  CSS import path used in generated entry file (default: ../app.css)
  --config <file>      Config file path (default: auto-svelte-pages.config.js)
  --watch              Watch root HTML files and regenerate on changes
  --help, -h           Show help

Examples:
  npm run init:auto-svelte-pages
  npm run generate:all
  npm run generate: -- index --no-vite
  npm run generate: -- header main
  npm run generate:watch
  npm run create: -- header
  npm run create: -- header header
  npm run rename: -- header to nav
  npm run delete: -- footer
`);
}

function parseInitArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") {
      options.rootDir = argv[i + 1];
      i += 1;
      continue;
    }
    throw new Error(`Unknown init argument: ${arg}`);
  }
  return options;
}

function normalizeTargetFileName(target) {
  return target.endsWith(".html") ? target : `${target}.html`;
}

function shouldHandleWatchEvent(options, fileName) {
  if (!fileName || !fileName.endsWith(".html")) {
    return false;
  }

  if (fileName.includes("/") || fileName.includes("\\")) {
    return false;
  }

  if (!options.targets || options.targets.length === 0) {
    return true;
  }

  const targetSet = new Set(
    options.targets.map((target) => normalizeTargetFileName(target.trim())),
  );
  return targetSet.has(fileName);
}

export async function runCli(argv) {
  if (argv[0] === "help") {
    printHelp();
    return;
  }

  if (argv[0] === "init") {
    const initOptions = parseInitArgs(argv.slice(1));
    const logs = await runInit(initOptions);
    for (const line of logs) {
      console.log(line);
    }
    return;
  }

  if (argv[0] === "rename") {
    const logs = await runRename(argv.slice(1));
    for (const line of logs) {
      console.log(line);
    }
    return;
  }

  if (argv[0] === "delete") {
    const logs = await runDelete(argv.slice(1));
    for (const line of logs) {
      console.log(line);
    }
    return;
  }

  if (argv[0] === "create") {
    const logs = await runCreate(argv.slice(1));
    for (const line of logs) {
      console.log(line);
    }
    return;
  }

  const options = parseArgs(argv);

  if (options.help) {
    printHelp();
    return;
  }

  const runOptions = { ...options };
  delete runOptions.help;
  delete runOptions.watch;

  const runGenerate = async () => {
    const result = await generatePages(runOptions);
    for (const line of result.logs) {
      console.log(line);
    }
  };

  await runGenerate();

  if (!options.watch) {
    return;
  }

  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  console.log(`Watching HTML files in ${rootDir}`);

  let timer = null;
  const watcher = fsWatch(
    rootDir,
    { persistent: true },
    (_eventType, fileName) => {
      const normalizedName = typeof fileName === "string" ? fileName : "";
      if (!shouldHandleWatchEvent(options, normalizedName)) {
        return;
      }

      if (timer) {
        clearTimeout(timer);
      }

      timer = setTimeout(async () => {
        try {
          console.log(`[watch] Change detected: ${normalizedName}`);
          await runGenerate();
        } catch (error) {
          console.error(error.message || error);
        }
      }, 120);
    },
  );

  const closeWatcher = () => {
    watcher.close();
    console.log("Watch stopped.");
  };

  process.on("SIGINT", () => {
    closeWatcher();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    closeWatcher();
    process.exit(0);
  });
}
