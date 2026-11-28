import path from "node:path";

/**
 * Root-relative directory paths that hold duplicate worktrees, mutation
 * sandboxes, or generated build/reference outputs and should be excluded from
 * IDE file/search indexes and `lib/dx/` source tree walks.
 */
export const WORKSPACE_EXCLUDED_PATHS = [
  ".agents/worktrees",
  ".claude/worktrees",
  ".stryker-tmp",
  "docs/reference/api",
  "app/generated/prisma",
] as const;

/**
 * Directory basenames ignored at any depth during `lib/dx/` tree walks.
 */
export const DEFAULT_IGNORED_DIR_NAMES = [
  "node_modules",
  ".git",
  ".next",
  "dist",
] as const;

/**
 * Default Prettier line width synchronized with `.vscode/settings.json` rulers.
 */
export const DEFAULT_PRETTIER_PRINT_WIDTH = 80;

/**
 * Canonical VS Code default formatter extension identifier.
 */
export const REQUIRED_VSCODE_DEFAULT_FORMATTER = "esbenp.prettier-vscode";

/**
 * Workspace TypeScript 6 fallback SDK directory containing `tsserver.js` for
 * VS Code built-in TypeScript and Next.js plugin support (ADR 0072).
 */
export const REQUIRED_TYPESCRIPT_TSDK = "node_modules/@typescript/old/lib";

/**
 * Loopback placeholder PostgreSQL URL for offline local test and debug runs.
 * Uses port 59999 on 127.0.0.1 so local suites fail fast without network hangs
 * or real database connections, while passing repository secret allowlists.
 */
export const OFFLINE_DEBUG_DATABASE_URL =
  "postgresql://dummy:dummy@127.0.0.1:59999/dummy";

/**
 * Canonical VS Code extension recommendations from `.vscode/extensions.json`.
 */
export const REQUIRED_VSCODE_EXTENSIONS = [
  "TypeScriptTeam.native-preview",
  "dbaeumer.vscode-eslint",
  "esbenp.prettier-vscode",
  "EditorConfig.EditorConfig",
  "bradlc.vscode-tailwindcss",
  "vitest.explorer",
  "DavidAnson.vscode-markdownlint",
  "ms-playwright.playwright",
  "Prisma.prisma",
] as const;

/**
 * Deprecated VS Code extension identifiers mapped to their maintained replacements.
 */
export const DEPRECATED_VSCODE_EXTENSIONS: Readonly<Record<string, string>> = {
  "davidlday.vscode-markdownlint": "DavidAnson.vscode-markdownlint",
};

/**
 * Valid `<publisher>.<name>` VS Code extension identifier pattern.
 */
export const VSCODE_EXTENSION_ID_PATTERN = /^[A-Za-z0-9-]+\.[A-Za-z0-9-]+$/;

/**
 * Baseline generated asset paths synchronized between `lint-staged.config.cjs`
 * and `.prettierignore`.
 */
export const BASELINE_GENERATED_ARTIFACTS = [
  "app/icon.svg",
  "public/favicon.svg",
  "app/favicon.ico",
  "public/favicon.ico",
  "public/apple-touch-icon.png",
  "public/icon-192.png",
  "public/icon-512.png",
  "lib/design-manifest.ts",
  "public/garmin-engine.js",
  "public/monkey-c-mayhem.js",
] as const;

/**
 * Duplicate worktree and mutation-sandbox paths required in `.prettierignore`.
 */
export const REQUIRED_PRETTIER_DUPLICATE_TREE_IGNORES = [
  ".agents/worktrees",
  ".claude/worktrees",
  ".stryker-tmp",
] as const;

/**
 * Generated notice and open-source credit datasets required in `.prettierignore`.
 */
export const REQUIRED_PRETTIER_GENERATED_NOTICE_IGNORES = [
  "public/third-party-notices.txt",
  "lib/oss-credits/internal/credits.generated.json",
  "lib/oss-credits/internal/registry-facts.generated.json",
] as const;

/**
 * Broad dot-folder ignore patterns in `.prettierignore` that hide tracked
 * skills or settings when used instead of `<dir>/worktrees`.
 */
export const BROAD_AGENTS_PRETTIER_IGNORES = [
  ".agents",
  ".agents/*",
  ".agents/**",
] as const;

/**
 * Broad `.claude` ignore patterns in `.prettierignore` that hide tracked files
 * when used instead of `.claude/worktrees`.
 */
export const BROAD_CLAUDE_PRETTIER_IGNORES = [
  ".claude",
  ".claude/*",
  ".claude/**",
] as const;

/**
 * Broad `.agents` and `.claude` keys forbidden in VS Code `files.exclude` and
 * `search.exclude` maps because they hide `.agents/skills/` or `.claude/`.
 */
export const FORBIDDEN_BROAD_VSCODE_EXCLUDE_KEYS = [
  ".agents",
  "**/.agents",
  ".agents/*",
  ".agents/**",
  "**/.agents/*",
  "**/.agents/**",
  ".claude",
  "**/.claude",
  ".claude/*",
  ".claude/**",
  "**/.claude/*",
  "**/.claude/**",
] as const;

/**
 * Baseline `files.exclude` entries for `.vscode/settings.json`.
 */
export const BASELINE_VSCODE_FILES_EXCLUDE: Readonly<Record<string, boolean>> =
  {
    "**/.git": true,
    "**/.svn": true,
    "**/.hg": true,
    "**/CVS": true,
    "**/.DS_Store": true,
    "**/Thumbs.db": true,
    "**/.next": true,
    "**/coverage": true,
    "**/.turbo": true,
    ".agents/worktrees": true,
    ".claude/worktrees": true,
    ".stryker-tmp": true,
    "docs/reference/api": true,
    "app/generated/prisma": true,
  };

/**
 * Baseline `search.exclude` entries for `.vscode/settings.json`.
 */
export const BASELINE_VSCODE_SEARCH_EXCLUDE: Readonly<Record<string, boolean>> =
  {
    "**/node_modules": true,
    "**/bower_components": true,
    "**/.next": true,
    "**/coverage": true,
    "**/scratch": true,
    "**/tmp": true,
    ".agents/worktrees": true,
    ".claude/worktrees": true,
    ".stryker-tmp": true,
    "docs/reference/api": true,
    "app/generated/prisma": true,
  };

/**
 * Canonical `.editorconfig` file contents including `[*.md]` trailing-space preservation.
 */
export const CANONICAL_EDITORCONFIG = [
  "root = true",
  "",
  "[*]",
  "indent_style = space",
  "indent_size = 2",
  "end_of_line = lf",
  "charset = utf-8",
  "trim_trailing_whitespace = true",
  "insert_final_newline = true",
  "",
  "[*.md]",
  "trim_trailing_whitespace = false",
  "insert_final_newline = true",
  "",
  "[*.{json,yml,yaml}]",
  "indent_size = 2",
  "",
  "[Makefile]",
  "indent_style = tab",
  "",
].join("\n");

/**
 * Required `.editorconfig` section rules enforced by `checkWorkspaceIdeConfig`.
 */
export const REQUIRED_EDITORCONFIG_SECTIONS: Readonly<
  Record<string, Readonly<Record<string, string>>>
> = {
  "*": {
    indent_style: "space",
    indent_size: "2",
    end_of_line: "lf",
    charset: "utf-8",
    trim_trailing_whitespace: "true",
    insert_final_newline: "true",
  },
  "*.md": {
    trim_trailing_whitespace: "false",
    insert_final_newline: "true",
  },
};

/**
 * Problem matcher pattern definition for VS Code tasks.
 */
export interface VscodeProblemPattern {
  regexp: string;
  file: number;
  line: number;
  column: number;
  severity: number;
  code: number;
  message: number;
}

/**
 * Background watch matcher definition for VS Code tasks.
 */
export interface VscodeBackgroundMatcher {
  activeOnStart: boolean;
  beginsPattern: { regexp: string };
  endsPattern: { regexp: string };
}

/**
 * Custom VS Code problem matcher object for `[tsc]`-prefixed `concurrently` watch output.
 */
export interface VscodeProblemMatcher {
  owner: string;
  source: string;
  applyTo: string;
  fileLocation: readonly [string, string];
  pattern: VscodeProblemPattern;
  background: VscodeBackgroundMatcher;
}

/**
 * Custom VS Code problem matcher parsing `[tsc]`-prefixed TypeScript 7 watch
 * lines emitted by `concurrently -n "turbo,tsc"` in `npm run dev`.
 */
export const TSC_WATCH_PROBLEM_MATCHER: VscodeProblemMatcher = {
  owner: "typescript",
  source: "ts",
  applyTo: "closedDocuments",
  fileLocation: ["relative", "${workspaceFolder}"],
  pattern: {
    regexp:
      "^\\[tsc\\]\\s+([^\\s].*?)(?:\\(|:)(\\d+)(?:,|:)(\\d+)(?:\\):|\\s+-)\\s+(error|warning|info)\\s+TS(\\d+)\\s*:\\s*(.*)$",
    file: 1,
    line: 2,
    column: 3,
    severity: 4,
    code: 5,
    message: 6,
  },
  background: {
    activeOnStart: true,
    beginsPattern: {
      regexp:
        "^\\[tsc\\]\\s+.*(?:Starting compilation in watch mode|File change detected\\. Starting incremental compilation)\\.\\.\\.",
    },
    endsPattern: {
      regexp:
        "^\\[tsc\\]\\s+.*Found \\d+ errors?\\. Watching for file changes\\.",
    },
  },
};

/**
 * Canonical VS Code task entry in `.vscode/tasks.json`.
 */
export interface VscodeTaskDefinition {
  type: string;
  script: string;
  isBackground?: boolean;
  problemMatcher: ReadonlyArray<string | VscodeProblemMatcher>;
  group?: string | { kind: string; isDefault: boolean };
  label: string;
}

/**
 * Canonical `.vscode/tasks.json` configuration.
 */
export const CANONICAL_VSCODE_TASKS: {
  version: string;
  tasks: readonly VscodeTaskDefinition[];
} = {
  version: "2.0.0",
  tasks: [
    {
      type: "npm",
      script: "dev",
      isBackground: true,
      problemMatcher: [TSC_WATCH_PROBLEM_MATCHER],
      group: {
        kind: "build",
        isDefault: true,
      },
      label: "npm: dev",
    },
    {
      type: "npm",
      script: "quality",
      group: "test",
      problemMatcher: [],
      label: "npm: quality",
    },
    {
      type: "npm",
      script: "verify",
      group: "test",
      problemMatcher: [],
      label: "npm: verify",
    },
    {
      type: "npm",
      script: "doctor:fix",
      problemMatcher: [],
      label: "npm: doctor:fix",
    },
  ],
};

/**
 * Canonical VS Code launch profile entry in `.vscode/launch.json`.
 */
export interface VscodeLaunchConfiguration {
  name: string;
  type: string;
  request: string;
  command?: string;
  runtimeExecutable?: string;
  runtimeArgs?: readonly string[];
  env?: Readonly<Record<string, string>>;
  cwd?: string;
  console?: string;
  internalConsoleOptions?: string;
}

/**
 * Canonical `.vscode/launch.json` debug configurations.
 */
export const CANONICAL_VSCODE_LAUNCH: {
  version: string;
  configurations: readonly VscodeLaunchConfiguration[];
} = {
  version: "0.2.0",
  configurations: [
    {
      name: "Next.js: Debug Fullstack",
      type: "node-terminal",
      request: "launch",
      command: "npm run dev",
    },
    {
      name: "Vitest: Debug Current Test File",
      type: "node",
      request: "launch",
      runtimeExecutable: "npx",
      runtimeArgs: ["--no-install", "vitest", "run", "${relativeFile}"],
      env: {
        DATABASE_URL: OFFLINE_DEBUG_DATABASE_URL,
      },
      cwd: "${workspaceFolder}",
      console: "integratedTerminal",
      internalConsoleOptions: "neverOpen",
    },
    {
      name: "Playwright: Debug Synthetic Probes",
      type: "node",
      request: "launch",
      runtimeExecutable: "npx",
      runtimeArgs: [
        "--no-install",
        "playwright",
        "test",
        "__tests__/e2e/synthetic-probes.spec.ts",
        "--project=chromium",
        "--debug",
      ],
      env: {
        DATABASE_URL: OFFLINE_DEBUG_DATABASE_URL,
      },
      cwd: "${workspaceFolder}",
      console: "integratedTerminal",
    },
    {
      name: "DX: Run Doctor Diagnostics",
      type: "node-terminal",
      request: "launch",
      command: "npm run dx doctor",
      env: {
        DATABASE_URL: OFFLINE_DEBUG_DATABASE_URL,
      },
    },
  ],
};

/**
 * Canonical Claude Code launch configuration entry in `.claude/launch.json`.
 */
export interface ClaudeLaunchConfiguration {
  name: string;
  runtimeExecutable: string;
  runtimeArgs: readonly string[];
  port: number;
}

/**
 * Canonical `.claude/launch.json` configuration invoking `npm run dev`.
 */
export const CANONICAL_CLAUDE_LAUNCH: {
  version: string;
  configurations: readonly ClaudeLaunchConfiguration[];
} = {
  version: "0.0.1",
  configurations: [
    {
      name: "portfolio-dev",
      runtimeExecutable: "npm",
      runtimeArgs: ["run", "dev"],
      port: 3000,
    },
  ],
};

/**
 * Normalizes a workspace-relative path or ignore rule to forward-slash POSIX
 * form without leading `./`, `/`, or trailing slashes.
 *
 * @param rawPath - Raw path or ignore entry string.
 * @returns Normalized relative path.
 */
export function normalizeWorkspaceRelativePath(rawPath: string): string {
  return rawPath
    .trim()
    .replace(/\\/g, "/")
    .replace(/^(?:\.\/|\/)+/, "")
    .replace(/\/+$/, "");
}

/**
 * Determines whether a candidate directory should be skipped during a
 * workspace tree walk based on basename rules (`node_modules`, `.git`,
 * `.next`, `dist`), canonical root-relative workspace exclusions
 * (`.agents/worktrees`, `.claude/worktrees`, `.stryker-tmp`,
 * `docs/reference/api`, `app/generated/prisma`), and optional caller overrides.
 *
 * @param root - Workspace root directory.
 * @param candidateDir - Absolute path of the directory being inspected.
 * @param extraIgnored - Optional additional directory basenames or root-relative paths.
 * @returns True when the directory should be excluded from traversal.
 */
export function shouldSkipWorkspaceDirectory(
  root: string,
  candidateDir: string,
  extraIgnored: readonly string[] = []
): boolean {
  const baseName = path.basename(candidateDir);
  const relRaw = path.relative(root, candidateDir).replace(/\\/g, "/");
  const relToRoot = relRaw.startsWith("..")
    ? ""
    : normalizeWorkspaceRelativePath(relRaw);

  const rules = [
    ...DEFAULT_IGNORED_DIR_NAMES,
    ...WORKSPACE_EXCLUDED_PATHS,
    ...extraIgnored,
  ];

  const segments = relToRoot ? relToRoot.split("/") : [];

  for (const rawRule of rules) {
    const rule = normalizeWorkspaceRelativePath(rawRule);
    if (!rule) continue;

    if (!rule.includes("/")) {
      if (baseName === rule || segments.includes(rule)) {
        return true;
      }
      continue;
    }

    if (relToRoot === rule || relToRoot.startsWith(`${rule}/`)) {
      return true;
    }

    if (
      (rule === ".agents/worktrees" || rule === ".claude/worktrees") &&
      (relToRoot.endsWith(`/${rule}`) || relToRoot.includes(`/${rule}/`))
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Builds the canonical `.prettierrc` configuration object.
 *
 * @param printWidth - Target Prettier line width.
 * @returns Canonical Prettier configuration record.
 */
export function buildCanonicalPrettierrc(
  printWidth = DEFAULT_PRETTIER_PRINT_WIDTH
): Record<string, unknown> {
  return {
    useTabs: false,
    tabWidth: 2,
    printWidth,
    singleQuote: false,
    trailingComma: "es5",
    semi: true,
    arrowParens: "always",
  };
}

/**
 * Builds the canonical `.vscode/settings.json` configuration object.
 *
 * @param printWidth - Target ruler column matching Prettier `printWidth`.
 * @returns Canonical VS Code workspace settings record.
 */
export function buildCanonicalVscodeSettings(
  printWidth = DEFAULT_PRETTIER_PRINT_WIDTH
): Record<string, unknown> {
  return {
    "editor.tabSize": 2,
    "editor.insertSpaces": true,
    "editor.formatOnSave": true,
    "editor.defaultFormatter": REQUIRED_VSCODE_DEFAULT_FORMATTER,
    "editor.codeActionsOnSave": {
      "source.fixAll.eslint": "explicit",
    },
    "editor.rulers": [printWidth],
    "typescript.tsdk": REQUIRED_TYPESCRIPT_TSDK,
    "typescript.enablePromptUseWorkspaceTsdk": true,
    "tailwindCSS.experimental.classRegex": [
      ["clsx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"],
      ["cn\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"],
    ],
    "files.exclude": { ...BASELINE_VSCODE_FILES_EXCLUDE },
    "search.exclude": { ...BASELINE_VSCODE_SEARCH_EXCLUDE },
  };
}
