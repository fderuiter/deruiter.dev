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

const vibrateRestriction = {
  object: "navigator",
  property: "vibrate",
  message:
    "Do not call navigator.vibrate directly. Use triggerHaptic from @/lib/haptics, which handles SSR, unsupported browsers and permission errors.",
};

const storageMessage =
  "Do not access Web Storage directly. Use safeGetItem, safeSetItem, safeGetRawItem, safeSetRawItem or safeRemoveItem from @/lib/safe-storage, or the usePersistentState hook from @/hooks/usePersistentState, which handle SSR, blocked storage and quota errors.";

const storagePropertyRestrictions = ["window", "globalThis"].flatMap((object) =>
  ["localStorage", "sessionStorage"].map((property) => ({
    object,
    property,
    message: storageMessage,
  }))
);

const storageGlobalRestrictions = ["localStorage", "sessionStorage"].map(
  (name) => ({ name, message: storageMessage })
);

// Files where direct Web Storage access is deliberate (#1631). Add a file here
// only when lib/safe-storage genuinely cannot be used, with its reason:
//   lib/safe-storage.ts        the wrapper itself.
//   lib/garmin-engine.ts       also bundled alone into public/garmin-engine.js as
//                              a browser IIFE (scripts/build-standalone-engine.ts);
//                              lib/safe-storage pulls in the logger, Sentry and
//                              Next.js code that bundle cannot resolve (#1633).
//   components/patrol/MedicalDisclaimerBanner.tsx
//                              the dismissal is per browser session by design,
//                              and lib/safe-storage wraps localStorage only.
// app/layout.tsx needs no entry: its pre-hydration font-mode script reads
// localStorage inside a string literal, which these rules do not inspect.
const storageExemptFiles = [
  "lib/safe-storage.ts",
  "lib/garmin-engine.ts",
  "components/patrol/MedicalDisclaimerBanner.tsx",
];

// TEMPORARY (#1631): files owned by other work lanes that still call Web
// Storage directly. Each lane migrates its file onto lib/safe-storage and
// removes it from this list. Do not add new files here.
const pendingStorageMigrationFiles = [
  "components/QuasiPerfectPuzzler/QuasiPerfectPuzzler.tsx",
  "components/study-director/career.ts",
  "components/study-director/useStudySave.ts",
  "lib/crf/personal-library.ts",
  "lib/crf/study-draft-storage.ts",
];

const storageUnrestrictedFiles = [
  ...storageExemptFiles,
  ...pendingStorageMigrationFiles,
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
  // Haptics go through triggerHaptic (#1130) and Web Storage goes through
  // lib/safe-storage (#1631). These use no-restricted-properties rather than
  // no-restricted-syntax because flat config replaces a rule's options when a
  // later block matching the same file sets that rule again, so a selector added
  // to the no-restricted-syntax blocks below would be silently dropped for
  // application modules. For the same reason each of the next three blocks
  // restates every restriction that applies to its files.
  {
    files: applicationModuleFiles,
    ignores: ["lib/haptics.ts", ...storageUnrestrictedFiles],
    rules: {
      "no-restricted-properties": [
        "error",
        vibrateRestriction,
        ...storagePropertyRestrictions,
      ],
      "no-restricted-globals": ["error", ...storageGlobalRestrictions],
    },
  },
  {
    files: storageUnrestrictedFiles,
    rules: {
      "no-restricted-properties": ["error", vibrateRestriction],
    },
  },
  {
    files: ["lib/haptics.ts"],
    rules: {
      "no-restricted-properties": ["error", ...storagePropertyRestrictions],
      "no-restricted-globals": ["error", ...storageGlobalRestrictions],
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
