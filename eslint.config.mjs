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
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    ignores: [...restrictedSyntaxHelperFiles, "__tests__/**", "vitest.setup.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        nestedMathRestriction,
        {
          selector:
            "MemberExpression[object.name='navigator'][property.name='clipboard']",
          message:
            "Do not access navigator.clipboard directly. Use copyToClipboard from @/lib/clipboard, useClipboard hook from @/hooks/useClipboard, or <CopyButton /> component instead.",
        },
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
  // so it restates the nested Math.min/max restriction next to process.env.
  // The clipboard and inline-style restrictions are not restated yet: turning
  // them on here needs the call-site migrations tracked in #1123.
  {
    files: applicationModuleFiles,
    ignores: [...envExemptFiles, ...restrictedSyntaxHelperFiles],
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
