import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

// Flat config replaces, never merges, a rule's options when a later block that
// matches the same file sets the rule again. A block that sets
// no-restricted-syntax must restate every restriction it means to keep, so the
// shared ones are named here and spread into each block (#1119, #1123).
const nestedMathRestriction = {
  selector:
    "CallExpression[callee.object.name='Math'][callee.property.name=/^(min|max)$/] CallExpression[callee.object.name='Math'][callee.property.name=/^(min|max)$/]",
  message:
    "Do not use inline nested Math.min or Math.max. Use clamp() or lerp() from lib/game-utils.ts instead.",
};

const processEnvRestriction = {
  selector: "MemberExpression[object.name='process'][property.name='env']",
  message:
    "Direct access to process.env is forbidden in application modules. Access configuration exclusively through validated schema exports in '@/lib/env'.",
};

const clipboardRestriction = {
  selector:
    "MemberExpression[object.name='navigator'][property.name='clipboard']",
  message:
    "Do not access navigator.clipboard directly. Use copyToClipboard from @/lib/clipboard, useClipboard hook from @/hooks/useClipboard, or <CopyButton /> component instead.",
};

// Call sites that still write to navigator.clipboard directly. They sit in
// files owned by other work lanes (CRF Studio, Laser Loon) and migrate with
// that work (#1123); until then they keep every other restriction.
const pendingClipboardMigrationFiles = [
  "components/crf/RightInspector/InspectorPanel.tsx",
  "components/crf/Terminal/StudioTerminal.tsx",
  "components/laser-loon/AssetDistributionHub.tsx",
];

// The files that implement what the global restrictions point callers to.
// lib/arcade/utils.ts holds clamp() itself; lib/game-utils.ts re-exports it.
const restrictedSyntaxHelperFiles = [
  "lib/game-utils.ts",
  "lib/arcade/utils.ts",
  "components/providers/AudioProvider.tsx",
  "lib/clipboard.ts",
];

const applicationModuleFiles = [
  "app/**/*.{ts,tsx,js,jsx}",
  "lib/**/*.{ts,tsx,js,jsx}",
  "components/**/*.{ts,tsx,js,jsx}",
  "hooks/**/*.{ts,tsx,js,jsx}",
];

const envExemptFiles = ["lib/env.ts", "lib/dx/**", "app/generated/**"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      "react-hooks": reactHooks,
    },
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Application logging goes through the StructuredLogger in lib/logger.ts,
  // which sanitizes errors and reports to Sentry (#1137, #1475). no-console sits
  // in a block of its own because flat config replaces a rule's options when a
  // later block matching the same file sets that rule again. The exemptions are
  // the places where console output is the point, or where the logger cannot
  // be used:
  //   lib/dx/**                  CLIs whose console output is their interface
  //                              (scripts/ is outside the block for the same reason).
  //   lib/logger.ts              the logger's own console sink.
  //   lib/env.ts                 the logger depends on it, so it cannot log through it.
  //   lib/client-sentry.ts       lazy-loads the Sentry SDK; the logger imports it
  //                              statically, which would defeat the lazy load, and
  //                              its one warning reports that Sentry failed to load.
  //   lib/build-integrity.ts     build-time stderr is deliberate.
  //   hooks/useConsoleArt.ts     the console art Easter egg.
  // instrumentation-client.ts is exempt by not being listed: it runs before the
  // logger exists.
  {
    files: [
      "app/**/*.{ts,tsx,js,jsx}",
      "components/**/*.{ts,tsx,js,jsx}",
      "lib/**/*.{ts,tsx,js,jsx}",
      "hooks/**/*.{ts,tsx,js,jsx}",
    ],
    ignores: [
      "app/generated/**",
      "lib/dx/**",
      "lib/logger.ts",
      "lib/env.ts",
      "lib/client-sentry.ts",
      "lib/build-integrity.ts",
      "hooks/useConsoleArt.ts",
    ],
    rules: {
      "no-console": "error",
    },
  },
  // Haptics go through triggerHaptic (#1130). This uses no-restricted-properties
  // rather than no-restricted-syntax because flat config replaces a rule's
  // options when a later block matching the same file sets that rule again, so a
  // selector added to the no-restricted-syntax blocks below would be silently
  // dropped for application modules.
  {
    files: [
      "app/**/*.{ts,tsx,js,jsx}",
      "lib/**/*.{ts,tsx,js,jsx}",
      "components/**/*.{ts,tsx,js,jsx}",
      "hooks/**/*.{ts,tsx,js,jsx}",
    ],
    ignores: ["lib/haptics.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "navigator",
          property: "vibrate",
          message:
            "Do not call navigator.vibrate directly. Use triggerHaptic from @/lib/haptics, which handles SSR, unsupported browsers and permission errors.",
        },
      ],
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    ignores: [
      ...restrictedSyntaxHelperFiles,
      "__tests__/**",
      "vitest.setup.ts",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        nestedMathRestriction,
        clipboardRestriction,
        {
          selector:
            "JSXAttribute[name.name='style'] ObjectExpression > Property[key.type='Identifier']",
          message:
            "Unconstrained raw inline style property detected in JSX. Replace raw inline style properties with Tailwind utility classes or CSS custom variables (--*).",
        },
        {
          selector:
            "JSXAttribute[name.name='style'] ObjectExpression > Property[key.type='Literal'][key.value=/^(?!--).*/]",
          message:
            "Unconstrained raw inline style property detected in JSX. Replace raw inline style properties with Tailwind utility classes or CSS custom variables (--*).",
        },
      ],
    },
  },
  // Application modules. This block replaces the one above for these files,
  // so it restates the nested Math.min/max and navigator.clipboard
  // restrictions next to process.env. The inline-style restriction is not
  // restated yet: turning it on here needs its own call-site migration.
  {
    files: applicationModuleFiles,
    ignores: [...envExemptFiles, ...restrictedSyntaxHelperFiles],
    rules: {
      "no-restricted-syntax": [
        "error",
        nestedMathRestriction,
        clipboardRestriction,
        processEnvRestriction,
      ],
    },
  },
  // Application modules awaiting their clipboard migration keep the other
  // restrictions from the block above, without the clipboard one.
  {
    files: pendingClipboardMigrationFiles,
    rules: {
      "no-restricted-syntax": [
        "error",
        nestedMathRestriction,
        processEnvRestriction,
      ],
    },
  },
  // The helper files keep only the process.env restriction, as before.
  {
    files: restrictedSyntaxHelperFiles,
    rules: {
      "no-restricted-syntax": ["error", processEnvRestriction],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".vercel/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    ".stryker-tmp/**",
    "public/*.js",
    // Agent worktrees are full second checkouts of this repository living inside
    // it. Without this, ESLint lints every file twice -- and the copies sit at
    // .claude/worktrees/<name>/..., which no rule-scoped ignore pattern such as
    // "__tests__/**" matches, so test files get linted under production rules.
    ".claude/**",
  ]),
]);

export default eslintConfig;
