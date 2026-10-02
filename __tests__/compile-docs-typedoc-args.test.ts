// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const { execFileSyncMock } = vi.hoisted(() => ({ execFileSyncMock: vi.fn() }));

vi.mock("node:child_process", () => ({
  execFileSync: execFileSyncMock,
  default: { execFileSync: execFileSyncMock },
}));

// Regression coverage for #654: TypeDoc's embedded absolute line-number source links
// (e.g. "Defined in: [lib/x.ts:2716](.../blob/main/lib/x.ts#L2716)") made every symbol's
// generated doc page drift whenever any line above it in the same file shifted, even
// when that symbol's own signature and comments were untouched. Passing --disableSources
// stops TypeDoc from emitting any "Defined in:" reference at all, eliminating the coupling.
describe("compile-docs TypeDoc invocation", () => {
  it("disables source links so generated docs never embed line numbers", async () => {
    const { compileDocumentation } = await import("../scripts/compile-docs");

    compileDocumentation("/workspace", "docs");

    expect(execFileSyncMock).toHaveBeenCalledTimes(1);
    const [, cliArgs] = execFileSyncMock.mock.calls[0] as [string, string[]];

    expect(cliArgs).toContain("--disableSources");
    expect(cliArgs).not.toContain("--sourceLinkTemplate");
    expect(cliArgs).not.toContain("--gitRevision");
  });

  it("regenerates through a scratch directory and syncs only real changes (#951)", async () => {
    const fs = await import("node:fs");
    const os = await import("node:os");
    const path = await import("node:path");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-regen-"));
    execFileSyncMock.mockImplementation((_cmd: string, args: string[]) => {
      const out = args[args.indexOf("--out") + 1];
      fs.writeFileSync(path.join(out, "Page.md"), "# Page\n");
    });
    try {
      const { regenerateDocumentation } =
        await import("../scripts/compile-docs");
      expect(regenerateDocumentation(root)).toEqual(["Page.md"]);
      expect(
        fs.readFileSync(
          path.join(root, "docs", "reference", "api", "Page.md"),
          "utf8"
        )
      ).toBe("# Page\n");
      expect(regenerateDocumentation(root)).toEqual([]);
    } finally {
      execFileSyncMock.mockReset();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
