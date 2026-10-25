import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  checkArcadeThreeViews,
  THREE_VIEW_ALLOWLIST,
} from "@/lib/dx/three-view-guard";

const REGISTRY = `
const GATED_ON_PHONE = {
  desktop: "ready",
  tablet: "ready",
  phone: "gated",
} as const;

export const ARCADE_REGISTRY = [
  {
    slug: "demo",
    name: "Demo",
    route: "/arcade/demo",
    listing: "hub",
    views: GATED_ON_PHONE,
    epic: 9999,
    daily: false,
  },
] as const;
`;

const CLIENT = `
<PlayCabinet
  controls={[...DEMO_CONTROLS]}
  views={DEMO_VIEWS}
/>
`;

describe("checkArcadeThreeViews (#2845)", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  /** A workspace with one clean game, plus the files given. */
  function fixture(files: Record<string, string> = {}): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "three-views-"));
    roots.push(root);
    const all: Record<string, string> = {
      "lib/arcade/registry.ts": REGISTRY,
      "lib/demo/engine.ts": "export const step = (n: number) => n + 1;\n",
      "components/demo/useDemoSession.ts":
        "export function useDemoSession() { return {}; }\n",
      "components/demo/views/DesktopView.tsx":
        'import { Hud } from "@/components/demo/parts/Hud";\nexport const DesktopView = () => null;\n',
      "components/demo/views/PhoneView.tsx":
        'export const PhoneView = () => <p className="text-xs">Hi</p>;\n',
      "components/arcade/DemoClient.tsx": CLIENT,
      ...files,
    };
    for (const [file, content] of Object.entries(all)) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), content);
    }
    return root;
  }

  const details = (root: string) => checkArcadeThreeViews(root).details ?? [];

  it("passes a clean game", () => {
    expect(checkArcadeThreeViews(fixture()).status).toBe("pass");
  });

  it("passes the repository as it stands", () => {
    const result = checkArcadeThreeViews(process.cwd());
    expect(result.details ?? []).toEqual([]);
    expect(result.status).toBe("pass");
  });

  it("fails a gated view that names no epic", () => {
    const root = fixture({
      "lib/arcade/registry.ts": REGISTRY.replace("    epic: 9999,\n", ""),
    });
    expect(details(root)).toEqual([
      "demo gates its phone view with no epic; set `epic` to the issue that ships it.",
    ]);
  });

  it("fails a game that declares fewer than three views", () => {
    const root = fixture({
      "lib/arcade/registry.ts": REGISTRY.replace(
        "views: GATED_ON_PHONE,",
        'views: { desktop: "ready", phone: "gated" },'
      ),
    });
    expect(details(root)).toEqual([
      "demo declares no tablet view in lib/arcade/registry.ts.",
    ]);
  });

  it("fails a view that imports another view, by path or as a sibling", () => {
    const root = fixture({
      "components/demo/views/TabletView.tsx":
        'import { DesktopView } from "@/components/demo/views/DesktopView";\nimport { PhoneView } from "./PhoneView";\n',
    });
    expect(details(root)).toEqual([
      "components/demo/views/TabletView.tsx: a view imports another view (@/components/demo/views/DesktopView).",
      "components/demo/views/TabletView.tsx: a view imports another view (./PhoneView).",
    ]);
  });

  it("lets a view use the shared cabinet view plumbing", () => {
    const root = fixture({
      "components/demo/views/TabletView.tsx":
        'import { defineGameViews } from "@/components/arcade/views";\n',
    });
    expect(checkArcadeThreeViews(root).status).toBe("pass");
  });

  it.each([
    ["usePhone", "const phone = usePhone();"],
    ["useCabinetTouch", "const touch = useCabinetTouch();"],
    ["useTouchDevice", "const touch = useTouchDevice();"],
    ["matchMedia", 'window.matchMedia("(pointer: coarse)");'],
    ["a width media query", 'useMediaQuery("(max-width: 767px)");'],
  ])("fails a session, an engine or a view that reads %s", (name, line) => {
    const root = fixture({
      "components/demo/useDemoSession.ts": `${line}\n`,
      "lib/demo/engine.ts": `${line}\n`,
      "components/demo/views/DesktopView.tsx": `${line}\n`,
    });
    expect(details(root).sort()).toEqual(
      [
        `components/demo/useDemoSession.ts: a session reads the device (${name}); the cabinet picks the view.`,
        `lib/demo/engine.ts: an engine reads the device (${name}); the cabinet picks the view.`,
        `components/demo/views/DesktopView.tsx: a view reads the device (${name}); the cabinet picks the view.`,
      ].sort()
    );
  });

  it("allows a reduced-motion query", () => {
    const root = fixture({
      "components/demo/useDemoSession.ts":
        'useMediaQuery("(prefers-reduced-motion: reduce)");\n',
    });
    expect(checkArcadeThreeViews(root).status).toBe("pass");
  });

  it.each(["9", "10", "11"])("fails a phone view with text-[%spx]", (size) => {
    const root = fixture({
      "components/demo/views/PhoneView.tsx": `export const PhoneView = () => <p className="text-[${size}px]">Hi</p>;\n`,
    });
    expect(details(root)).toEqual([
      "components/demo/views/PhoneView.tsx: a phone view sets text under 12px.",
    ]);
  });

  it("leaves small text alone outside phone views", () => {
    const root = fixture({
      "components/demo/views/DesktopView.tsx":
        'export const DesktopView = () => <p className="text-[10px]">Hi</p>;\n',
    });
    expect(checkArcadeThreeViews(root).status).toBe("pass");
  });

  it("fails a cabinet with views whose controls are listed inline", () => {
    const root = fixture({
      "components/arcade/DemoClient.tsx": `
<PlayCabinet
  controls={[
    { key: "Enter", action: "Play" },
  ]}
  views={DEMO_VIEWS}
/>
`,
    });
    expect(details(root)).toEqual([
      "components/arcade/DemoClient.tsx: a cabinet with views lists its controls inline; pass controlsFromActions(<the game's action map>).",
    ]);
  });

  it("skips an allow-listed file, and reports the row once the file is clean", () => {
    const [file, epic] = Object.entries(THREE_VIEW_ALLOWLIST)[0];
    const dirty = fixture({ [file]: "const phone = usePhone();\n" });
    expect(checkArcadeThreeViews(dirty).status).toBe("pass");
    const clean = fixture({ [file]: "export const View = () => null;\n" });
    expect(details(clean)).toEqual([
      `${file} is allow-listed (#${epic}) but no longer breaks a rule; remove its THREE_VIEW_ALLOWLIST row.`,
    ]);
  });
});
