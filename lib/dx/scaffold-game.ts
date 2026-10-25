import fs from "fs";
import path from "path";

/** The names a scaffolded game is written under. */
export interface GameScaffoldNames {
  /** The route slug and folder name, such as `signal-catch`. */
  readonly kebab: string;
  /** The component prefix, such as `SignalCatch`. */
  readonly pascal: string;
  /** The display title, such as `Signal Catch`. */
  readonly title: string;
}

/** One file the game scaffold writes or one registry it updates. */
export interface GameScaffoldFile {
  readonly filePath: string;
  readonly relativePath: string;
  readonly content: string;
  readonly action: "created" | "updated" | "skipped";
}

/** One registry the game is added to, and where its new entry goes. */
interface RegistryInsert {
  /** The file, relative to the workspace root. */
  readonly file: string;
  /** Text that opens the list the entry joins. */
  readonly listStart: string;
  /** Text that closes the list; the entry goes just before it. */
  readonly listEnd: string;
  /** Text that shows the game is already listed. */
  readonly present: string;
  readonly entry: string;
}

/** The site appends this to every page title. */
const TITLE_TEMPLATE = " | Frederick de Ruiter";

/** The SEO check wants a rendered title of 50 to 60 characters. */
const RENDERED_TITLE = { min: 50, max: 60 };

/** The SEO check wants a description of 140 to 160 characters. */
const SEO_DESCRIPTION =
  "A three-view arcade cabinet: one session drives the desktop, tablet and phone layouts. Press Score to add a point, and press Pause to stop the run.";

/**
 * The route's metadata title: the first wording whose rendered title fits
 * the SEO check, or the bare title when none does.
 */
function seoTitle(title: string): string {
  const fits = (candidate: string) => {
    const rendered = candidate.length + TITLE_TEMPLATE.length;
    return rendered >= RENDERED_TITLE.min && rendered <= RENDERED_TITLE.max;
  };
  return (
    [
      `${title}: Three-View Arcade Cabinet`,
      `${title}: Arcade Cabinet`,
      `${title} Arcade`,
    ].find(fits) ?? title
  );
}

function camel(pascal: string): string {
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function constant(kebab: string): string {
  return kebab.replace(/-/g, "_").toUpperCase();
}

/**
 * The game's own files: an engine, an action map, a session, a board shared
 * by three views, a client that hands the views to the cabinet, the route
 * and its social card, and a unit test with phone and tablet specs.
 */
function gameFiles(
  names: GameScaffoldNames
): ReadonlyArray<{ readonly file: string; readonly content: string }> {
  const { kebab, pascal, title } = names;
  const actions = `${constant(kebab)}_ACTIONS`;
  const controls = `${constant(kebab)}_CONTROLS`;
  const config = camel(pascal);

  const engine = `/**
 * ${title}'s engine (ADR 0062): plain state and a reducer, with no React and
 * no device reads, so every view and the unit tests share one rule set.
 */

/** A run's state. */
export interface ${pascal}State {
  readonly score: number;
  readonly status: "playing" | "paused";
}

/** What a player can do; the names match the game's action map. */
export type ${pascal}Intent = "score" | "pause";

/** A fresh run. */
export const INITIAL_${constant(kebab)}_STATE: ${pascal}State = Object.freeze({
  score: 0,
  status: "playing",
});

/**
 * Applies one intent. A paused run ignores everything but \`pause\`.
 *
 * @param state - The run so far.
 * @param intent - What the player did.
 * @returns The next state, or \`state\` itself when nothing changed.
 */
export function reduce${pascal}(
  state: ${pascal}State,
  intent: ${pascal}Intent
): ${pascal}State {
  if (intent === "pause") {
    return {
      ...state,
      status: state.status === "paused" ? "playing" : "paused",
    };
  }
  if (state.status === "paused") return state;
  return { ...state, score: state.score + 1 };
}
`;

  const actionMap = `import { controlsFromActions, defineActions } from "@/lib/arcade";

/** ${title}'s action map: every key, button and label the game binds. */
export const ${actions} = defineActions({
  score: { kind: "press", keys: ["Space"], label: "Score" },
  pause: { kind: "press", keys: ["KeyP"], label: "Pause" },
});

/** The cabinet's control list, read from the action map. */
export const ${controls} = controlsFromActions(${actions});
`;

  const sessionHook = `"use client";

import { useState } from "react";
import { createArcadeStore, type ArcadeSession } from "@/components/arcade/views";
import {
  INITIAL_${constant(kebab)}_STATE,
  reduce${pascal},
  type ${pascal}Intent,
  type ${pascal}State,
} from "@/lib/${kebab}";

/** ${title}'s session: the run every view reads and dispatches to. */
export type ${pascal}Session = ArcadeSession<${pascal}State, ${pascal}Intent>;

/**
 * Creates the run once for the life of the component, so a view swap
 * keeps it (ADR 0062).
 *
 * @returns The session.
 */
export function use${pascal}Session(): ${pascal}Session {
  const [session] = useState(() =>
    createArcadeStore(INITIAL_${constant(kebab)}_STATE, reduce${pascal})
  );
  return session;
}
`;

  const sessionHolder = `"use client";

import React, { type ReactNode } from "react";
import { ArcadeSessionProvider } from "@/components/arcade/views";
import { use${pascal}Session } from "./use${pascal}Session";

/** The session slot of the game's views: the cabinet mounts it once. */
export function ${pascal}CabinetSession({ children }: { children: ReactNode }) {
  const session = use${pascal}Session();
  return (
    <ArcadeSessionProvider value={session}>{children}</ArcadeSessionProvider>
  );
}
`;

  const board = `"use client";

import React from "react";
import { useActionInput } from "@/lib/arcade";
import {
  useSessionDispatch,
  useSessionSelector,
} from "@/components/arcade/views";
import type { ${pascal}Intent, ${pascal}State } from "@/lib/${kebab}";
import { ${actions} } from "../actions";

/** The playfield every view shows; each view frames it for its device. */
export function ${pascal}Board() {
  const score = useSessionSelector((state: ${pascal}State) => state.score);
  const paused = useSessionSelector(
    (state: ${pascal}State) => state.status === "paused"
  );
  const dispatch = useSessionDispatch<${pascal}Intent>();
  useActionInput(${actions}, (input) => {
    if (input.phase === "down") dispatch(input.action);
  });

  return (
    <div
      data-testid="${kebab}-board"
      className="flex min-h-[200px] w-full flex-col items-center justify-center gap-4 rounded border border-zinc-800 bg-[#13151a] p-6 font-mono text-zinc-100"
    >
      <p className="text-sm text-zinc-300">${title}</p>
      <p aria-live="polite" className="text-3xl tabular-nums">
        Score: {score}
      </p>
      {paused ? <p className="text-sm text-amber-400">Paused</p> : null}
    </div>
  );
}

/** The game's buttons, for the desktop footer and the touch docks. */
export function ${pascal}Buttons({ only }: { only?: ${pascal}Intent }) {
  const dispatch = useSessionDispatch<${pascal}Intent>();
  const intents: readonly ${pascal}Intent[] = only ? [only] : ["score", "pause"];
  return (
    <div className="flex gap-2">
      {intents.map((intent) => (
        <button
          key={intent}
          type="button"
          onClick={() => dispatch(intent)}
          className="min-h-12 min-w-12 rounded border border-zinc-700 px-4 font-mono text-sm text-zinc-100 hover:border-amber-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 active:scale-[0.98]"
        >
          {${actions}.actions[intent].label}
        </button>
      ))}
    </div>
  );
}
`;

  const desktopView = `"use client";

import React from "react";
import { ${pascal}Board, ${pascal}Buttons } from "../parts/${pascal}Board";

/** The desktop view: the board, with its buttons under it. */
export function DesktopView() {
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <${pascal}Board />
      <${pascal}Buttons />
    </div>
  );
}
`;

  const tabletView = `"use client";

import React from "react";
import { TabletStage } from "@/components/arcade/stage";
import { ${pascal}Board, ${pascal}Buttons } from "../parts/${pascal}Board";

/** The tablet view: the board on the tablet stage, a button under each thumb. */
export function TabletView() {
  return (
    <TabletStage
      moveDock={<${pascal}Buttons only="pause" />}
      actionDock={<${pascal}Buttons only="score" />}
    >
      <${pascal}Board />
    </TabletStage>
  );
}
`;

  const phoneView = `"use client";

import React from "react";
import { PhoneStage } from "@/components/arcade/stage";
import { ${pascal}Board, ${pascal}Buttons } from "../parts/${pascal}Board";

/** The phone view: the board on the phone stage, a button under each thumb. */
export function PhoneView() {
  return (
    <PhoneStage
      moveDock={<${pascal}Buttons only="pause" />}
      actionDock={<${pascal}Buttons only="score" />}
    >
      <${pascal}Board />
    </PhoneStage>
  );
}
`;

  const client = `"use client";

import React from "react";
import { IconDeviceGamepad2 } from "@tabler/icons-react";
import { PlayCabinet } from "@/components/arcade/PlayCabinet";
import { defineGameViews } from "@/components/arcade/views";
import { ${controls} } from "@/components/${kebab}/actions";
import { ${pascal}CabinetSession } from "@/components/${kebab}/${pascal}Session";

const loadDesktopView = () =>
  import("@/components/${kebab}/views/DesktopView").then((mod) => ({
    default: mod.DesktopView,
  }));

/** The cabinet's views (ADR 0062): one session above three layouts. */
const ${constant(kebab)}_VIEWS = defineGameViews({
  session: ${pascal}CabinetSession,
  desktop: loadDesktopView,
  tablet: () =>
    import("@/components/${kebab}/views/TabletView").then((mod) => ({
      default: mod.TabletView,
    })),
  phone: () =>
    import("@/components/${kebab}/views/PhoneView").then((mod) => ({
      default: mod.PhoneView,
    })),
});

export function ${pascal}Client() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 pb-24">
      <PlayCabinet
        gameId="${kebab}"
        title="${title}"
        icon={<IconDeviceGamepad2 className="h-8 w-8 text-amber-500" />}
        instructions="Press Score to add a point. Pause stops the run."
        controls={[...${controls}]}
        importComponent={loadDesktopView}
        views={${constant(kebab)}_VIEWS}
      />
    </div>
  );
}
`;

  const page = `import type { Metadata } from "next";
import { PageLayout } from "@/components/PageLayout";
import { ${pascal}Client } from "@/components/arcade/${pascal}Client";
import { buildRouteMetadata, ROUTE_METADATA_CONFIGS } from "@/lib/seo-metadata";

export const metadata: Metadata = buildRouteMetadata(
  ROUTE_METADATA_CONFIGS.${config}
);

export default function ${pascal}Page() {
  return (
    <PageLayout variant="studio" className="pt-28">
      <${pascal}Client />
    </PageLayout>
  );
}
`;

  const ogImage = `import {
  createSocialImageResponse,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = "${title} | Arcade";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

export default function Image() {
  return createSocialImageResponse({
    category: "ARCADE",
    title: "${title}",
    description: "A three-view arcade cabinet: desktop, tablet and phone.",
    tags: ["Desktop", "Tablet", "Phone"],
  });
}
`;

  const sessionTest = `import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { use${pascal}Session } from "@/components/${kebab}/use${pascal}Session";
import { INITIAL_${constant(kebab)}_STATE, reduce${pascal} } from "@/lib/${kebab}";

describe("${title} engine", () => {
  it("scores while playing and ignores Score while paused", () => {
    const scored = reduce${pascal}(INITIAL_${constant(kebab)}_STATE, "score");
    expect(scored.score).toBe(1);
    const paused = reduce${pascal}(scored, "pause");
    expect(reduce${pascal}(paused, "score")).toBe(paused);
    expect(reduce${pascal}(paused, "pause").status).toBe("playing");
  });
});

describe("use${pascal}Session", () => {
  it("keeps one run across renders", () => {
    const { result, rerender } = renderHook(() => use${pascal}Session());
    const session = result.current;
    act(() => session.dispatch("score"));
    rerender();
    expect(result.current).toBe(session);
    expect(result.current.getState().score).toBe(1);
  });
});
`;

  const deviceSpec = (
    view: "phone" | "tablet",
    projects: string
  ) => `import { test, expect } from "@playwright/test";
import { expectView, launchCabinet } from "./mobile-harness";

// The ${projects} projects run this file (ADR 0061, ADR 0062).
test("${title} mounts its ${view} view", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.use.hasTouch, "touch projects only");
  await launchCabinet(page, "${kebab}");
  await expectView(page, "${view}");
  await expect(page.getByTestId("${kebab}-board")).toBeVisible();
  await page.getByRole("button", { name: "Score" }).tap();
  await expect(page.getByText("Score: 1")).toBeVisible();
});
`;

  return [
    { file: `lib/${kebab}/index.ts`, content: engine },
    { file: `components/${kebab}/actions.ts`, content: actionMap },
    {
      file: `components/${kebab}/use${pascal}Session.ts`,
      content: sessionHook,
    },
    {
      file: `components/${kebab}/${pascal}Session.tsx`,
      content: sessionHolder,
    },
    { file: `components/${kebab}/parts/${pascal}Board.tsx`, content: board },
    { file: `components/${kebab}/views/DesktopView.tsx`, content: desktopView },
    { file: `components/${kebab}/views/TabletView.tsx`, content: tabletView },
    { file: `components/${kebab}/views/PhoneView.tsx`, content: phoneView },
    { file: `components/arcade/${pascal}Client.tsx`, content: client },
    { file: `app/arcade/${kebab}/page.tsx`, content: page },
    { file: `app/arcade/${kebab}/opengraph-image.tsx`, content: ogImage },
    { file: `__tests__/${kebab}-session.test.ts`, content: sessionTest },
    {
      file: `__tests__/e2e/${kebab}-phone.spec.ts`,
      content: deviceSpec("phone", "phone"),
    },
    {
      file: `__tests__/e2e/${kebab}-tablet.spec.ts`,
      content: deviceSpec("tablet", "iPad"),
    },
  ];
}

/**
 * The registries a game joins: the arcade registry and its metadata and
 * progress catalog, and the discovery matrix (AGENTS.md §3).
 */
function registryInserts(names: GameScaffoldNames): readonly RegistryInsert[] {
  const { kebab, pascal, title } = names;
  const route = `/arcade/${kebab}`;
  return [
    {
      file: "lib/arcade/registry.ts",
      listStart: "export const ARCADE_REGISTRY",
      listEnd: "\n] as const satisfies readonly ArcadeRegistryEntry[];",
      present: `slug: "${kebab}"`,
      entry: `
  {
    slug: "${kebab}",
    name: "${title}",
    route: "${route}",
    listing: "hub",
    views: READY_EVERYWHERE,
    daily: false,
  },`,
    },
    {
      file: "lib/arcade-data.ts",
      listStart: "export const ARCADE_GAMES_METADATA",
      listEnd: "\n];",
      present: `slug: "${kebab}"`,
      entry: `
  {
    id: "${kebab}",
    slug: "${kebab}",
    title: "${title}",
    subtitle: "Three-View Arcade Cabinet",
    genre: "Arcade",
    description: "Press Score to add a point. Pause stops the run.",
    mechanics: ["Score", "Pause"],
    techStack: ["React 19", "Arcade Session Store"],
    accentColor: "text-amber-400",
    borderHover: "hover:border-amber-500/50",
    badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    route: "${route}",
  },`,
    },
    {
      file: "lib/arcade/progress/catalog.ts",
      listStart: "export const ARCADE_PROGRESS_CATALOG",
      listEnd: "\n];",
      present: `slug: "${kebab}"`,
      entry: `
  { slug: "${kebab}", slices: [] },`,
    },
    {
      file: "lib/seo-metadata.ts",
      listStart: "export const ROUTE_METADATA_CONFIGS",
      listEnd: "\n};",
      present: `path: "${route}"`,
      entry: `
  ${camel(pascal)}: {
    title: "${seoTitle(title)}",
    description: "${SEO_DESCRIPTION}",
    path: "${route}",
    keywords: ["Arcade", "${title}"],
    inLanguage: "en-US",
    locale: "en-US",
    isAccessibleForFree: true,
  },`,
    },
    {
      file: "lib/public-routes.ts",
      listStart: "export const PUBLIC_ROUTE_REGISTRY",
      listEnd: "\n] as const satisfies readonly PublicRouteDefinition[];",
      present: `path: "${route}"`,
      entry: `
  {
    path: "${route}",
    name: "Game: ${title}",
    category: "arcade",
  },`,
    },
    {
      file: "lib/navigation.ts",
      listStart: "const ARCADE_ITEMS",
      listEnd: "\n];",
      present: `href: "${route}"`,
      entry: `
  {
    id: "${kebab}",
    title: "${title}",
    subtitle: "Three-view arcade cabinet",
    href: "${route}",
    icon: "arcade",
    tone: "cyan",
  },`,
    },
    {
      file: "components/CommandPalette.tsx",
      listStart: "const staticNavs: PaletteItem[] = [",
      listEnd: "\n    ];",
      present: `url: "${route}"`,
      entry: `
      {
        id: "nav-${kebab}",
        title: "${title}",
        subtitle: "Three-view arcade cabinet",
        category: "navigation",
        url: "${route}",
        icon: <IconDeviceGamepad2 className="w-4 h-4 text-accent" />,
        badge: "Arcade",
        status: "Scaffolded",
        description: "Press Score to add a point. Pause stops the run.",
        techStack: ["React 19", "Arcade Session Store"],
        highlights: ["Desktop, tablet and phone views over one session"],
      },`,
    },
  ];
}

/**
 * Inserts `entry` at the end of the list that opens at `listStart`. Returns
 * null when the list is not found, so a moved registry is reported rather
 * than written in the wrong place.
 */
function insertEntry(content: string, insert: RegistryInsert): string | null {
  const start = content.indexOf(insert.listStart);
  if (start === -1) return null;
  const end = content.indexOf(insert.listEnd, start);
  if (end === -1) return null;
  return content.slice(0, end) + insert.entry + content.slice(end);
}

/**
 * Scaffolds a three-view arcade game (ADR 0062, #2846): the game's files,
 * and its entries in the arcade registry, the arcade metadata, the progress
 * catalog and the discovery matrix. A registry that already lists the game
 * is left alone, and one whose list cannot be found is reported as skipped.
 *
 * @param root - The workspace root.
 * @param names - The game's slug, component prefix and title.
 * @param dryRun - When true, nothing is written.
 * @returns Each file created and each registry updated or skipped.
 */
export function scaffoldThreeViewGame(
  root: string,
  names: GameScaffoldNames,
  dryRun = false
): GameScaffoldFile[] {
  const results: GameScaffoldFile[] = [];

  for (const { file, content } of gameFiles(names)) {
    const filePath = path.join(root, file);
    if (!dryRun) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, "utf-8");
    }
    results.push({ filePath, relativePath: file, content, action: "created" });
  }

  for (const insert of registryInserts(names)) {
    const filePath = path.join(root, insert.file);
    if (!fs.existsSync(filePath)) continue;
    const current = fs.readFileSync(filePath, "utf-8");
    if (current.includes(insert.present)) continue;
    const updated = insertEntry(current, insert);
    if (updated === null) {
      results.push({
        filePath,
        relativePath: insert.file,
        content: current,
        action: "skipped",
      });
      continue;
    }
    if (!dryRun) fs.writeFileSync(filePath, updated, "utf-8");
    results.push({
      filePath,
      relativePath: insert.file,
      content: updated,
      action: "updated",
    });
  }

  return results;
}
