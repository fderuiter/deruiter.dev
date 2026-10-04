import type { DirectAnnotation } from "./types";

/**
 * Curated purpose and reason for every direct dependency. A test fails when a
 * dependency is added to package.json without an entry here.
 */
export const RUNTIME_ANNOTATIONS: Record<string, DirectAnnotation> = {
  next: {
    group: "Framework and runtime",
    reason:
      "The React framework that routes, renders and builds the whole site.",
  },
  react: {
    group: "Framework and runtime",
    reason: "The UI library every page and game is written in.",
  },
  "react-dom": {
    group: "Framework and runtime",
    reason: "Renders React in the browser and on the server.",
  },
  ws: {
    group: "Framework and runtime",
    reason:
      "WebSocket transport the Neon serverless driver uses outside edge runtimes.",
  },
  zod: {
    group: "Framework and runtime",
    reason:
      "Validates every API request body and shared data shape at runtime.",
  },
  zustand: {
    group: "Framework and runtime",
    reason: "Small state store behind the Protocol Drift workbench.",
  },
  clsx: {
    group: "Framework and runtime",
    reason: "Composes conditional class names.",
  },
  "tailwind-merge": {
    group: "Framework and runtime",
    reason:
      "Resolves conflicting Tailwind classes when components are composed.",
  },
  "framer-motion": {
    group: "Interface and motion",
    reason: "Page, card and modal animation.",
  },
  "@tabler/icons-react": {
    group: "Interface and motion",
    reason: "The icon set used across navigation and tools.",
  },
  "@chenglou/pretext": {
    group: "Interface and motion",
    reason:
      "Measures and lays out text without DOM reflow, for zero layout shift.",
  },
  "@fontsource/opendyslexic": {
    group: "Interface and motion",
    reason:
      "Self-hosted OpenDyslexic font for the reading accessibility option.",
  },
  "@xyflow/react": {
    group: "Interface and motion",
    reason: "Node-and-wire canvas for the Protocol Drift pipeline editor.",
  },
  three: {
    group: "Visualization and 3D",
    reason: "WebGL engine for the neuroimaging viewer and 3D scenes.",
  },
  "@types/three": {
    group: "Visualization and 3D",
    reason: "Type definitions for three.",
  },
  mermaid: {
    group: "Visualization and 3D",
    reason: "Renders proof diagrams in the Proof Workspace.",
  },
  "@prisma/client": {
    group: "Data and storage",
    reason: "Type-safe database client.",
  },
  "@prisma/adapter-neon": {
    group: "Data and storage",
    reason: "Connects Prisma to Neon serverless Postgres.",
  },
  "@neondatabase/serverless": {
    group: "Data and storage",
    reason: "Serverless Postgres driver for Neon.",
  },
  "@upstash/redis": {
    group: "Data and storage",
    reason: "Serverless Redis for read-through caching and buffered counters.",
  },
  "@upstash/ratelimit": {
    group: "Data and storage",
    reason: "Rate limiting for the few mutating API routes.",
  },
  "@upstash/qstash": {
    group: "Data and storage",
    reason: "Durable delayed retries for outbound email.",
  },
  "@clerk/nextjs": {
    group: "Authentication and email",
    reason: "Sign-in for the administrator area.",
  },
  "@clerk/themes": {
    group: "Authentication and email",
    reason: "Matches the Clerk sign-in screen to the site theme.",
  },
  resend: {
    group: "Authentication and email",
    reason: "Sends contact and newsletter email.",
  },
  "@sentry/nextjs": {
    group: "Observability and delivery",
    reason: "Error and performance monitoring.",
  },
  "@vercel/analytics": {
    group: "Observability and delivery",
    reason: "Privacy-friendly page analytics.",
  },
  "@vercel/speed-insights": {
    group: "Observability and delivery",
    reason: "Real-user Core Web Vitals measurement.",
  },
  "@serwist/next": {
    group: "Offline and PWA",
    reason: "Builds the service worker that makes the site work offline.",
  },
  "@serwist/sw": {
    group: "Offline and PWA",
    reason: "Service worker runtime and caching strategies.",
  },
  docx: {
    group: "Documents and export",
    reason: "Exports CRF studies as Word documents.",
  },
  jspdf: {
    group: "Documents and export",
    reason: "Exports CRF studies and review packages as PDF.",
  },
  "jspdf-autotable": {
    group: "Documents and export",
    reason: "Table layout inside the PDF exports.",
  },
  jszip: {
    group: "Documents and export",
    reason: "Bundles review packages into a single ZIP.",
  },
  "isomorphic-dompurify": {
    group: "Documents and export",
    reason: "Sanitizes rich text and uploaded SVG before it is rendered.",
  },
};

/** Curated purpose and reason for every direct dev dependency. */
export const TOOLING_ANNOTATIONS: Record<string, DirectAnnotation> = {
  vitest: { group: "Testing", reason: "Unit and integration test runner." },
  "@vitest/coverage-v8": {
    group: "Testing",
    reason: "Coverage reporting and thresholds.",
  },
  "@testing-library/react": {
    group: "Testing",
    reason: "Renders components in tests the way a user sees them.",
  },
  "@testing-library/dom": {
    group: "Testing",
    reason: "DOM queries for component tests.",
  },
  jsdom: {
    group: "Testing",
    reason: "Browser-like DOM for unit tests and server-side sanitizing.",
  },
  "@playwright/test": {
    group: "Testing",
    reason: "Real-browser end-to-end and benchmark tests.",
  },
  "@axe-core/playwright": {
    group: "Testing",
    reason: "Automated accessibility checks in the browser.",
  },
  "fast-check": {
    group: "Testing",
    reason: "Property-based fuzz testing of the engines.",
  },
  "@stryker-mutator/core": {
    group: "Testing",
    reason: "Mutation testing that checks the tests catch bugs.",
  },
  "@stryker-mutator/vitest-runner": {
    group: "Testing",
    reason: "Runs Vitest under Stryker.",
  },
  "@total-typescript/shoehorn": {
    group: "Testing",
    reason: "Type-safe partial mocks in tests.",
  },
  typescript: {
    group: "Build and types",
    reason: "Type checking for the whole codebase.",
  },
  tsx: {
    group: "Build and types",
    reason: "Runs TypeScript scripts directly.",
  },
  esbuild: {
    group: "Build and types",
    reason: "Bundles the standalone engine files.",
  },
  tailwindcss: {
    group: "Build and types",
    reason: "Utility-first CSS framework.",
  },
  "@tailwindcss/postcss": {
    group: "Build and types",
    reason: "Tailwind's PostCSS integration.",
  },
  prisma: {
    group: "Build and types",
    reason: "Schema, migrations and client generation.",
  },
  "@types/node": {
    group: "Build and types",
    reason: "Node.js type definitions.",
  },
  "@types/react": {
    group: "Build and types",
    reason: "React type definitions.",
  },
  "@types/react-dom": {
    group: "Build and types",
    reason: "React DOM type definitions.",
  },
  "@types/jsdom": {
    group: "Build and types",
    reason: "jsdom type definitions.",
  },
  "@types/ws": { group: "Build and types", reason: "ws type definitions." },
  eslint: {
    group: "Linting and docs",
    reason: "Static analysis with zero warnings allowed.",
  },
  "eslint-config-next": {
    group: "Linting and docs",
    reason: "Next.js lint rules.",
  },
  "eslint-plugin-react-hooks": {
    group: "Linting and docs",
    reason: "Enforces React hook correctness.",
  },
  prettier: { group: "Linting and docs", reason: "Code formatting." },
  "markdownlint-cli": {
    group: "Linting and docs",
    reason: "Lints the documentation.",
  },
  typedoc: {
    group: "Linting and docs",
    reason: "Generates the API reference.",
  },
  "typedoc-plugin-markdown": {
    group: "Linting and docs",
    reason: "Emits the API reference as Markdown.",
  },
  "dependency-cruiser": {
    group: "Linting and docs",
    reason: "Enforces module boundaries and forbids cycles.",
  },
  husky: {
    group: "Developer workflow",
    reason: "Git hooks for commit, push and branch rules.",
  },
  "lint-staged": {
    group: "Developer workflow",
    reason: "Runs checks only on staged files.",
  },
  concurrently: {
    group: "Developer workflow",
    reason: "Runs the dev server and type checker together.",
  },
  dotenv: {
    group: "Developer workflow",
    reason: "Reads environment files in the setup tooling.",
  },
};

/** Every curated annotation, runtime and tooling. */
export const DIRECT_ANNOTATIONS: Record<string, DirectAnnotation> = {
  ...RUNTIME_ANNOTATIONS,
  ...TOOLING_ANNOTATIONS,
};

/** Display order of the purpose groups on the acknowledgments page. */
export const GROUP_ORDER: readonly string[] = [
  "Framework and runtime",
  "Interface and motion",
  "Visualization and 3D",
  "Data and storage",
  "Authentication and email",
  "Observability and delivery",
  "Offline and PWA",
  "Documents and export",
  "Testing",
  "Build and types",
  "Linting and docs",
  "Developer workflow",
];

/**
 * Packages that publish no license file of their own but come from a parent
 * package that does (one repository, one license). They reuse the parent's text
 * so the notice carries the real copyright holder. `prefix` matches the start of
 * a package name; `name` matches exactly. The parent must be in the lockfile
 * and ship a license file, or generation fails.
 */
export const LICENSE_TEXT_INHERITANCE: readonly {
  prefix?: string;
  name?: string;
  parent: string;
}[] = [
  { prefix: "@rollup/rollup-", parent: "rollup" },
  { prefix: "@next/swc-", parent: "next" },
  { name: "@next/env", parent: "next" },
  { prefix: "@oxc-parser/binding-", parent: "oxc-parser" },
  { prefix: "@sentry/server-", parent: "@sentry/core" },
  { name: "@radix-ui/react-compose-refs", parent: "@radix-ui/react-slot" },
  {
    name: "@radix-ui/react-use-layout-effect",
    parent: "@radix-ui/react-slot",
  },
];

/**
 * Copyright holder for a package that ships no license file, declares no author
 * and has no parent to inherit from. Without an entry here, generation fails
 * rather than guess. Reviewed against each package's registry page.
 */
export const LICENSE_HOLDER_OVERRIDES: Record<string, string> = {
  "client-only":
    "client-only package authors (the package publishes no copyright line)",
  "server-only":
    "server-only package authors (the package publishes no copyright line)",
};
