// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { scaffold, scaffoldArcadeGame } from "@/lib/dx/scaffolder";
import { checkArcadeRegistryParity } from "@/lib/dx/doctor";
import { checkArcadeThreeViews } from "@/lib/dx/three-view-guard";

// `npm run scaffold game` writes a three-view game (#2846, ADR 0062).

const REGISTRIES = [
  "lib/arcade/registry.ts",
  "lib/arcade-data.ts",
  "lib/arcade/progress/catalog.ts",
  "lib/seo-metadata.ts",
  "lib/public-routes.ts",
  "lib/navigation.ts",
  "components/CommandPalette.tsx",
];

const GAME_FILES = [
  "lib/demo-check/index.ts",
  "components/demo-check/actions.ts",
  "components/demo-check/useDemoCheckSession.ts",
  "components/demo-check/DemoCheckSession.tsx",
  "components/demo-check/parts/DemoCheckBoard.tsx",
  "components/demo-check/views/DesktopView.tsx",
  "components/demo-check/views/TabletView.tsx",
  "components/demo-check/views/PhoneView.tsx",
  "components/arcade/DemoCheckClient.tsx",
  "app/arcade/demo-check/page.tsx",
  "app/arcade/demo-check/opengraph-image.tsx",
  "__tests__/demo-check-session.test.ts",
  "__tests__/e2e/demo-check-phone.spec.ts",
  "__tests__/e2e/demo-check-tablet.spec.ts",
];

describe("scaffold game (#2846)", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "dx-scaffold-game-"));
    // The real registries, so the entries land where the live lists end.
    for (const file of REGISTRIES) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.copyFileSync(path.join(process.cwd(), file), path.join(root, file));
    }
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  const read = (file: string) =>
    fs.readFileSync(path.join(root, file), "utf-8");

  it("writes the game's files and updates every registry", () => {
    const generated = scaffoldArcadeGame(root, "demo-check");

    expect(
      generated
        .filter((file) => file.action === "created")
        .map((file) => file.relativePath)
    ).toEqual(GAME_FILES);
    expect(
      generated
        .filter((file) => file.action === "updated")
        .map((file) => file.relativePath)
    ).toEqual(REGISTRIES);
    for (const file of GAME_FILES) {
      expect(fs.existsSync(path.join(root, file))).toBe(true);
    }
  });

  it("passes the three-view guardrails and the registry parity check", () => {
    scaffoldArcadeGame(root, "demo-check");

    expect(checkArcadeThreeViews(root)).toMatchObject({ status: "pass" });
    expect(checkArcadeRegistryParity(root)).toMatchObject({ status: "pass" });
  });

  it("gives the tablet and the phone their own views over one session", () => {
    scaffoldArcadeGame(root, "demo-check");

    const client = read("components/arcade/DemoCheckClient.tsx");
    expect(client).toContain("defineGameViews");
    expect(client).toContain("session: DemoCheckCabinetSession");
    expect(client).toContain(
      'import("@/components/demo-check/views/TabletView")'
    );
    expect(client).toContain(
      'import("@/components/demo-check/views/PhoneView")'
    );
    expect(client).toContain("controls={[...DEMO_CHECK_CONTROLS]}");
    expect(read("components/demo-check/views/TabletView.tsx")).toContain(
      "<TabletStage"
    );
    expect(read("components/demo-check/views/PhoneView.tsx")).toContain(
      "<PhoneStage"
    );
    expect(read("lib/arcade/registry.ts")).toMatch(
      /slug: "demo-check",[\s\S]*?views: READY_EVERYWHERE,/
    );
  });

  it("writes a route page with header clearance and no Navbar", () => {
    scaffoldArcadeGame(root, "demo-check");

    const page = read("app/arcade/demo-check/page.tsx");
    expect(page).toContain("<PageLayout");
    expect(page).toContain("pt-28");
    expect(page).toContain("ROUTE_METADATA_CONFIGS.demoCheck");
    expect(page).not.toContain("<Navbar");
  });

  it("fits the SEO title and description lengths the Doctor checks", () => {
    scaffoldArcadeGame(root, "demo-check");

    const entry =
      /\n {2}demoCheck: \{\s*title: "([^"]+)",\s*description:\s*"([^"]+)"/.exec(
        read("lib/seo-metadata.ts")
      );
    expect(entry).not.toBeNull();
    const rendered = `${entry![1]} | Frederick de Ruiter`;
    expect(rendered.length).toBeGreaterThanOrEqual(50);
    expect(rendered.length).toBeLessThanOrEqual(60);
    expect(entry![2].length).toBeGreaterThanOrEqual(140);
    expect(entry![2].length).toBeLessThanOrEqual(160);
  });

  it("adds each registry entry once when run again", () => {
    scaffoldArcadeGame(root, "demo-check");
    const second = scaffoldArcadeGame(root, "demo-check");

    expect(second.filter((file) => file.action === "updated")).toEqual([]);
    expect(
      read("lib/arcade/registry.ts").match(/slug: "demo-check"/g)
    ).toHaveLength(1);
  });

  it("reports a registry whose list it cannot find, and leaves it alone", () => {
    fs.writeFileSync(path.join(root, "lib/navigation.ts"), "export {};\n");

    const generated = scaffoldArcadeGame(root, "demo-check");

    expect(
      generated.find((file) => file.relativePath === "lib/navigation.ts")
    ).toMatchObject({ action: "skipped" });
    expect(read("lib/navigation.ts")).toBe("export {};\n");
  });

  it("writes nothing on a dry run", () => {
    const before = read("lib/arcade/registry.ts");

    const generated = scaffold({
      type: "game",
      name: "demo-check",
      dryRun: true,
      workspaceRoot: root,
    });

    expect(generated.length).toBe(GAME_FILES.length + REGISTRIES.length);
    expect(fs.existsSync(path.join(root, "lib/demo-check/index.ts"))).toBe(
      false
    );
    expect(read("lib/arcade/registry.ts")).toBe(before);
  });
});
