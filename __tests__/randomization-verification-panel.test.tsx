/**
 * @vitest-environment jsdom
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MT19937_BLOCK_ALGORITHM_ID,
  buildImmutableArtifact,
  decideRandomizationExport,
  generateBlockSchedule,
  type BlockRandomizationRequest,
} from "@/lib/randomization";
import { VerificationPanel } from "@/components/randomization/VerificationPanel";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** The verification panel (#4009): local files, latest selection wins. */

function plan(): BlockRandomizationRequest {
  return {
    contractVersion: 1,
    planSchemaVersion: 1,
    id: "plan-panel",
    name: "Panel plan",
    provenance: {
      studyId: "study-1",
      studyVersionId: "v1",
      studyDesignId: "d1",
      workspaceRevisionId: "r1",
      usdmSha256: "0".repeat(64),
    },
    method: "BLOCK",
    algorithmId: MT19937_BLOCK_ALGORITHM_ID,
    arms: [
      { id: "arm-t", code: "T", label: "Treatment", allocationRatio: 1 },
      { id: "arm-c", code: "C", label: "Control", allocationRatio: 1 },
    ],
    sites: [{ id: "site-a", code: "A", label: "Site A", recruitmentWeight: 1 }],
    factors: [],
    seed: { value: "PanelSeed2026", source: "custom" },
    subjectIdMask: { pattern: "{SITE}-{SEQ:3}" },
    enrollmentTarget: 12,
    caps: {
      strategy: "manual",
      capScope: "per-site",
      intersectionCaps: [{ stratumKey: "[]", cap: 12 }],
    },
    blockSettings: {
      defaultRule: { mode: "random-pool", sizes: [2, 4] },
      trackingScope: "per-intersection",
      allowPartialFinalBlock: true,
    },
  };
}

function golden(): Record<string, unknown> {
  const request = plan();
  const generated = generateBlockSchedule(request);
  if (!generated.ok) throw new Error("generation failed");
  const decision = decideRandomizationExport({
    kind: "allocation-json",
    lifecycle: "promoted",
    disclosure: "full",
    fullDisclosureAcknowledged: true,
    useNoticeAcknowledged: true,
  });
  if (!decision.allowed) throw new Error(decision.code);
  const artifact = buildImmutableArtifact({
    request,
    reducedRatios: generated.reducedRatios,
    rows: generated.rows,
  });
  return JSON.parse(
    JSON.stringify({ ...artifact, disclosure: decision.metadata })
  );
}

/** A file whose text arrives when the test says so. */
function file(
  name: string,
  content: string,
  options: { size?: number; read?: Promise<string> } = {}
): File {
  const blob = new File([content], name, { type: "application/json" });
  Object.defineProperty(blob, "text", {
    value: vi.fn(() => options.read ?? Promise.resolve(content)),
  });
  if (options.size !== undefined) {
    Object.defineProperty(blob, "size", { value: options.size });
  }
  return blob;
}

function choose(selected: File) {
  fireEvent.change(screen.getByLabelText(/Artifact file/), {
    target: { files: [selected] },
  });
}

const status = () => screen.getByRole("status");

describe("verification panel", () => {
  it("verifies a golden artifact without any network request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<VerificationPanel />);
    choose(file("golden.json", JSON.stringify(golden())));
    await waitFor(() =>
      expect(status().textContent).toMatch(/golden\.json: Verified\./)
    );
    expect(screen.getByText(/Integrity \(content digest\): Pass/)).toBeTruthy();
    expect(
      screen.getByText(/Regeneration \(every row and field\): Pass/)
    ).toBeTruthy();
    expect(
      screen.getByText(/Expected 12 rows, the file has 12\./)
    ).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("lists field differences for a changed row", async () => {
    const tampered = golden();
    (tampered.rows as { siteId: string }[])[2].siteId = "site-b";
    render(<VerificationPanel />);
    choose(file("tampered.json", JSON.stringify(tampered)));
    await waitFor(() => expect(status().textContent).toMatch(/Not verified/));
    const diffs = screen.getByRole("table", { name: /Row differences/ });
    expect(within(diffs).getByText("siteId")).toBeTruthy();
    expect(within(diffs).getByText('"site-b"')).toBeTruthy();
    expect(screen.getByText(/UNKNOWN_SITE/)).toBeTruthy();
  });

  it("reports a masked file as insufficient evidence", async () => {
    const masked = golden();
    delete masked.disclosure;
    render(<VerificationPanel />);
    choose(file("masked.json", JSON.stringify(masked)));
    await waitFor(() =>
      expect(status().textContent).toMatch(/Insufficient evidence/)
    );
    expect(screen.getByText(/no disclosure metadata/)).toBeTruthy();
    expect(
      screen.getByText(/Regeneration \(every row and field\): Not run/)
    ).toBeTruthy();
  });

  it("refuses an oversized file without reading it", async () => {
    const big = file("big.json", "{}", { size: 9 * 1024 * 1024 });
    render(<VerificationPanel />);
    choose(big);
    await waitFor(() =>
      expect(status().textContent).toMatch(/larger than the 8 MiB limit/)
    );
    expect(big.text).not.toHaveBeenCalled();
  });

  it("shows why a malformed file was rejected", async () => {
    render(<VerificationPanel />);
    choose(file("broken.json", "{oops"));
    await waitFor(() => expect(status().textContent).toMatch(/Not checked/));
    expect(screen.getByText("The file isn't valid JSON.")).toBeTruthy();
  });

  it("lets a newer file supersede an older read that finishes later", async () => {
    let release: (text: string) => void = () => {};
    const slow = new Promise<string>((resolve) => {
      release = resolve;
    });
    const tampered = golden();
    (tampered.rows as { subjectId: string }[])[0].subjectId = "X-1";
    render(<VerificationPanel />);
    choose(file("old.json", "", { read: slow }));
    expect(status().textContent).toMatch(/Verifying old\.json/);
    choose(file("new.json", JSON.stringify(golden())));
    await waitFor(() =>
      expect(status().textContent).toMatch(/new\.json: Verified\./)
    );
    release(JSON.stringify(tampered));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(status().textContent).toMatch(/new\.json: Verified\./);
    expect(status().textContent).not.toMatch(/old\.json/);
  });

  it("clears the busy state when the file can't be read", async () => {
    render(<VerificationPanel />);
    choose(
      file("unreadable.json", "", { read: Promise.reject(new Error("io")) })
    );
    await waitFor(() =>
      expect(status().textContent).toMatch(/couldn't be read/)
    );
    expect(screen.queryByText(/Verifying/)).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Cancel verification" })
    ).toBeNull();
  });

  it("has no axe violations with a failed report on screen", async () => {
    const tampered = golden();
    (tampered.rows as { armCode: string }[])[0].armCode = "Z";
    const { container } = render(<VerificationPanel />);
    choose(file("tampered.json", JSON.stringify(tampered)));
    await waitFor(() => expect(status().textContent).toMatch(/Not verified/));
    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});
