import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

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
      "lib/game-utils.ts",
      "components/providers/AudioProvider.tsx",
      "lib/clipboard.ts",
      "__tests__/**",
      "vitest.setup.ts",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.object.name='Math'][callee.property.name=/^(min|max)$/] CallExpression[callee.object.name='Math'][callee.property.name=/^(min|max)$/]",
          message:
            "Do not use inline nested Math.min or Math.max. Use clamp() or lerp() from lib/game-utils.ts instead.",
        },
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
  {
    files: [
      "app/**/*.{ts,tsx,js,jsx}",
      "lib/**/*.{ts,tsx,js,jsx}",
      "components/**/*.{ts,tsx,js,jsx}",
      "hooks/**/*.{ts,tsx,js,jsx}",
    ],
    ignores: ["lib/env.ts", "lib/dx/**", "app/generated/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.name='process'][property.name='env']",
          message:
            "Direct access to process.env is forbidden in application modules. Access configuration exclusively through validated schema exports in '@/lib/env'.",
        },
      ],
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
