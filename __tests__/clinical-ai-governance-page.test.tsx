/**
 * @vitest-environment jsdom
 */
import type { ReactElement } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import axe from "axe-core";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import ClinicalAiGovernancePage, {
  metadata,
} from "@/app/clinical/ai-governance/page";
import {
  AI_GOVERNANCE_PAGE_COPY,
  COU_WORKFLOW_PRESETS,
  DEFAULT_AI_VENDOR_CRITERIA,
  DEFAULT_AI_VENDOR_SCENARIO,
  FICTIONAL_AI_VENDORS,
  GOVERNANCE_CROSSWALK,
  acceptGovernanceProposal,
  advanceSimulatedStudyRevision,
  createInitialReviewSimulatorState,
  evaluateAiVendorScorecard,
  evaluateContextOfUseRisk,
  inspectProposalDiff,
  rebaseGovernanceProposal,
  rejectGovernanceProposal,
  undoGovernanceProposal,
} from "@/lib/clinical-ai-governance";
import {
  checkRegulatoryWording,
  findClinicalClaims,
  scoreVendors,
} from "@/lib/clinical-platform";

let pageElement: ReactElement;

beforeAll(async () => {
  pageElement = await ClinicalAiGovernancePage();
}, 30000);

afterEach(cleanup);

describe("clinical AI governance workspace (/clinical/ai-governance)", () => {
  it("renders title, synthetic non-advice banner, draft guidance labels, all four sections and zero issue stubs", () => {
    render(pageElement);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "AI governance in clinical data work",
      })
    ).toBeTruthy();

    const note = screen.getByRole("note");
    expect(note.textContent).toContain("synthetic");
    expect(note.textContent).toContain(
      "not regulatory, legal or compliance advice"
    );
    expect(note.textContent).toContain("not a validated system");
    expect(note.textContent).toContain("DEMO-301");

    expect(String(metadata.title)).toContain("AI Governance");

    for (const section of AI_GOVERNANCE_PAGE_COPY.sections) {
      expect(
        screen.getByRole("heading", { level: 2, name: section.heading })
      ).toBeTruthy();
    }

    const bodyText = document.body.textContent ?? "";
    expect(bodyText).toContain("FDA-2024-D-4689");
    expect(bodyText).toContain(
      "Draft guidance (January 2025, docket FDA-2024-D-4689)"
    );
    expect(bodyText).toContain("2025 consultation draft");
    expect(bodyText).toContain("Industry guide (July 2025)");

    expect(bodyText).not.toContain("Planned in issue");
    expect(bodyText).not.toContain("#3549");
    expect(bodyText).not.toContain("#3550");
    expect(bodyText).not.toContain("#3551");
    expect(bodyText).not.toContain("#3552");
  });

  it("Section 1 filters clinical AI failure modes and displays deterministic CRF and pipeline checks", () => {
    render(pageElement);

    expect(
      screen.getByText(
        /Showing 6 of 6 failure modes evaluated on synthetic study DEMO-301/
      )
    ).toBeTruthy();

    const bodyInitial = document.body.textContent ?? "";
    for (const ruleId of ["SD0001", "SD0002", "SD0003", "SD0004", "SD0005"]) {
      expect(bodyInitial).toContain(ruleId);
    }

    fireEvent.click(
      screen.getByRole("button", { name: /Schema and naming \(2\)/ })
    );
    expect(
      screen.getByText(
        /Showing 2 of 6 failure modes evaluated on synthetic study DEMO-301/
      )
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Invented variable names exceeding 8-character SDTM limit"
      )
    ).toBeTruthy();
    expect(
      screen.queryByText("Locale-formatted or impossible calendar dates")
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: /Terminology and dates \(2\)/ })
    );
    expect(
      screen.getByText("Locale-formatted or impossible calendar dates")
    ).toBeTruthy();
    expect(
      screen.queryByText(
        "Invented variable names exceeding 8-character SDTM limit"
      )
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: /Lineage and schedule \(2\)/ })
    );
    expect(
      screen.getByText(
        "Orphaned forms disconnected from the Schedule of Activities"
      )
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: /All categories \(6\)/ })
    );
    expect(
      screen.getByText(
        /Showing 6 of 6 failure modes evaluated on synthetic study DEMO-301/
      )
    ).toBeTruthy();
  });

  it("Section 2 updates the 7-step Context-of-Use risk evaluator and filters the safeguard crosswalk", () => {
    render(pageElement);

    expect(screen.getByText("Moderate model risk")).toBeTruthy();
    expect(screen.getByText("Step 1 of 7")).toBeTruthy();
    expect(screen.getByText("Step 7 of 7")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Influence: Low" }));
    fireEvent.click(screen.getByRole("button", { name: "Consequence: Low" }));
    expect(screen.getByText("Low model risk")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Influence: High" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Consequence: Medium" })
    );
    expect(screen.getByText("High model risk")).toBeTruthy();

    const workflowSelect = screen.getByLabelText(
      "Synthetic clinical workflow"
    ) as HTMLSelectElement;
    fireEvent.change(workflowSelect, {
      target: { value: "autonomous-submission-derivation" },
    });
    expect(
      screen.getByText("Critical risk (outside intended use)")
    ).toBeTruthy();
    expect(
      screen.getByText("Outside intended-use bounds: keep step LLM-free")
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "EU GMP Annex 22 draft" })
    );
    const annexRows = screen.getAllByText(
      "EU GMP Annex 22 (consultation draft)"
    );
    expect(annexRows.length).toBe(4);
    expect(screen.queryByText("ISPE GAMP AI guide (July 2025)")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "ISPE GAMP AI guide" }));
    expect(screen.getAllByText("ISPE GAMP AI guide (July 2025)").length).toBe(
      2
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Audit-trail controls" })
    );
    expect(
      screen.getByText("Part 11-style audit controls (simulation)")
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "All sources" }));
    fireEvent.change(workflowSelect, {
      target: { value: "crf-field-draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Influence: Low" }));
    fireEvent.click(screen.getByRole("button", { name: "Consequence: Low" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Scope to low model risk" })
    );
    expect(
      screen.queryByText("FDA AI draft guidance (FDA-2024-D-4689)")
    ).toBeNull();
  });

  it("Section 3 switches between clean DEMO-301 baseline and injected defect scenarios with SHA-256 digests", () => {
    render(pageElement);

    expect(
      screen.getByText("Pinned clinical standards profile (DEMO-301)")
    ).toBeTruthy();
    expect(
      screen.getByText(
        /Clean seeded DEMO-301 baseline: zero local errors across 90 synthetic subjects/
      )
    ).toBeTruthy();

    const baselineManifestTerm = screen.getByText(
      /Reproducible MANIFEST\.json SHA-256/
    );
    const baselineManifestSha =
      baselineManifestTerm.parentElement?.querySelector("dd")?.textContent ??
      "";
    expect(baselineManifestSha).toMatch(/^[0-9a-f]{64}$/);

    fireEvent.click(
      screen.getByRole("button", {
        name: /Off-codelist term, non-extensible list \(injected defect\)/,
      })
    );
    expect(screen.getByText("Injected defect")).toBeTruthy();
    expect(screen.getByText(/\+1 local error/)).toBeTruthy();

    const defectManifestSha =
      baselineManifestTerm.parentElement?.querySelector("dd")?.textContent ??
      "";
    expect(defectManifestSha).toMatch(/^[0-9a-f]{64}$/);
    expect(defectManifestSha).not.toBe(baselineManifestSha);
    expect(screen.getAllByText("Changed").length).toBeGreaterThan(0);

    fireEvent.click(
      screen.getByRole("button", {
        name: /Impossible date \(injected defect\)/,
      })
    );
    expect(screen.getByText(/\+1 local error/)).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: /Randomized, never dosed \(injected defect\)/,
      })
    );
    expect(screen.getAllByText("Changed").length).toBeGreaterThan(0);
  });

  it("Section 4A enforces ADR 0035 and ADR 0067 diff preview, Needs review badge, stale-revision block, reject and single-step undo", () => {
    render(pageElement);

    expect(screen.getByText("Study revision: r1")).toBeTruthy();

    const detCard = screen.getByTestId("proposal-card-prop-det-sd0003");
    const factCard = screen.getByTestId("proposal-card-prop-fact-usdm-vs");
    const hypCard = screen.getByTestId("proposal-card-prop-hyp-ae-grade");

    expect(within(detCard).getByText("Deterministic finding")).toBeTruthy();
    expect(within(factCard).getByText("Source-backed fact")).toBeTruthy();
    expect(within(hypCard).getByText("Model hypothesis")).toBeTruthy();
    expect(within(hypCard).getByText("Needs review")).toBeTruthy();

    const acceptDetBtn = within(detCard).getByRole("button", {
      name: "Accept (Deterministic finding)",
    }) as HTMLButtonElement;
    const acceptHypBtn = within(hypCard).getByRole("button", {
      name: "Accept (Model hypothesis)",
    }) as HTMLButtonElement;
    const undoBtn = screen.getByRole("button", {
      name: "Undo last accepted edit",
    }) as HTMLButtonElement;

    expect(acceptDetBtn.disabled).toBe(true);
    expect(acceptHypBtn.disabled).toBe(true);
    expect(undoBtn.disabled).toBe(true);

    // Rejecting logs disposition without mutating study revision
    fireEvent.click(
      within(hypCard).getByRole("button", { name: "Reject (Model hypothesis)" })
    );
    expect(within(hypCard).getByText("Rejected")).toBeTruthy();
    expect(screen.getByText("Study revision: r1")).toBeTruthy();

    // Previewing diff enables Accept
    fireEvent.click(
      within(detCard).getByRole("button", {
        name: "Preview diff (Deterministic finding)",
      })
    );
    expect(
      within(detCard).getByText(/Semantic diff on AE\.AESER\.codelist/)
    ).toBeTruthy();
    expect(acceptDetBtn.disabled).toBe(false);

    // Accepting advances revision r1 -> r2 and enables single-step Undo
    fireEvent.click(acceptDetBtn);
    expect(screen.getByText("Study revision: r2")).toBeTruthy();
    expect(screen.getByText("Applied via prop-det-sd0003")).toBeTruthy();
    expect(undoBtn.disabled).toBe(false);

    // Pending proposal from r1 is now stale on r2 and blocked until rebased
    expect(
      within(factCard).getByText("Stale revision (r1 vs r2)")
    ).toBeTruthy();
    const acceptFactBtn = within(factCard).getByRole("button", {
      name: "Accept (Source-backed fact)",
    }) as HTMLButtonElement;
    expect(acceptFactBtn.disabled).toBe(true);

    // Single-step Undo restores exact prior state at r1
    fireEvent.click(undoBtn);
    expect(screen.getByText("Study revision: r1")).toBeTruthy();
    expect(screen.queryByText("Applied via prop-det-sd0003")).toBeNull();

    // Concurrent manual edit advances r1 -> r2 and blocks stale proposals until rebased
    fireEvent.click(
      screen.getByRole("button", { name: "Simulate manual edit" })
    );
    expect(screen.getByText("Study revision: r2")).toBeTruthy();
    fireEvent.click(
      within(factCard).getByRole("button", { name: "Rebase onto r2" })
    );
    fireEvent.click(
      within(factCard).getByRole("button", {
        name: "Preview diff (Source-backed fact)",
      })
    );
    expect(acceptFactBtn.disabled).toBe(false);
    fireEvent.click(acceptFactBtn);
    expect(screen.getByText("Study revision: r3")).toBeTruthy();
    expect(screen.getByText("Applied via prop-fact-usdm-vs")).toBeTruthy();
  });

  it("enforces proposal state-machine guards directly when called out of order", () => {
    const initial = createInitialReviewSimulatorState();
    const unpreviewedAttempt = acceptGovernanceProposal(
      initial,
      "prop-det-sd0003"
    );
    expect(unpreviewedAttempt.studyRevision).toBe(1);
    expect(unpreviewedAttempt.lastBlockedReason).toContain(
      "inspect the semantic diff"
    );

    const previewed = inspectProposalDiff(initial, "prop-det-sd0003");
    const staleState = advanceSimulatedStudyRevision(previewed);
    const staleAttempt = acceptGovernanceProposal(
      staleState,
      "prop-det-sd0003"
    );
    expect(staleAttempt.studyRevision).toBe(2);
    expect(staleAttempt.lastBlockedReason).toContain("Stale revision blocked");

    const rebased = rebaseGovernanceProposal(staleAttempt, "prop-det-sd0003");
    const repreviewed = inspectProposalDiff(rebased, "prop-det-sd0003");
    const accepted = acceptGovernanceProposal(repreviewed, "prop-det-sd0003");
    expect(accepted.studyRevision).toBe(3);

    const reverted = undoGovernanceProposal(accepted);
    expect(reverted.studyRevision).toBe(2);
    expect(undoGovernanceProposal(reverted)).toBe(reverted);

    const rejected = rejectGovernanceProposal(reverted, "prop-hyp-ae-grade");
    expect(
      rejected.proposals.find((p) => p.id === "prop-hyp-ae-grade")?.status
    ).toBe("rejected");
  });

  it("undoes only the accepted change while preserving later rejection decisions", () => {
    const acceptedId = "prop-det-sd0003";
    const rejectedId = "prop-hyp-ae-grade";
    const rebasedId = "prop-fact-usdm-vs";
    const initial = createInitialReviewSimulatorState();
    const accepted = acceptGovernanceProposal(
      inspectProposalDiff(initial, acceptedId),
      acceptedId
    );
    const rejected = rejectGovernanceProposal(accepted, rejectedId);
    const reconsidered = inspectProposalDiff(
      rebaseGovernanceProposal(rejected, rebasedId),
      rebasedId
    );

    const undone = undoGovernanceProposal(reconsidered);

    expect(undone.studyRevision).toBe(initial.studyRevision);
    expect(undone.fields).toEqual(initial.fields);
    expect(undone.proposals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: acceptedId, status: "pending" }),
        expect.objectContaining({ id: rejectedId, status: "rejected" }),
        expect.objectContaining({
          id: rebasedId,
          baseStudyRevision: initial.studyRevision,
          diffPreviewed: false,
        }),
      ])
    );
    expect(undone.reviewLog.map((entry) => entry.action)).toContain("reject");
  });

  it("Section 4B recomputes fictional vendor rankings and +-25% sensitivity via @/lib/clinical-platform", () => {
    expect(scoreVendors(DEFAULT_AI_VENDOR_SCENARIO)).toHaveLength(
      FICTIONAL_AI_VENDORS.length
    );

    render(pageElement);

    for (const vendor of FICTIONAL_AI_VENDORS) {
      expect(screen.getAllByText(vendor.name).length).toBeGreaterThan(0);
    }

    // Shift weights heavily toward portability and CDISC lint so Fictional Beacon Studio moves to #1
    const portabilitySlider = document.getElementById(
      "vendor-weight-portability"
    ) as HTMLInputElement;
    const cdiscSlider = document.getElementById(
      "vendor-weight-cdiscLint"
    ) as HTMLInputElement;
    const humanSlider = document.getElementById(
      "vendor-weight-humanReview"
    ) as HTMLInputElement;
    const provSlider = document.getElementById(
      "vendor-weight-provenance"
    ) as HTMLInputElement;
    const privSlider = document.getElementById(
      "vendor-weight-privacy"
    ) as HTMLInputElement;

    fireEvent.change(portabilitySlider, { target: { value: "5" } });
    fireEvent.change(cdiscSlider, { target: { value: "5" } });
    fireEvent.change(humanSlider, { target: { value: "0" } });
    fireEvent.change(provSlider, { target: { value: "0" } });
    fireEvent.change(privSlider, { target: { value: "0" } });

    const shifted = evaluateAiVendorScorecard({
      humanReview: 0,
      provenance: 0,
      cdiscLint: 5,
      privacy: 0,
      auditTrail: 3,
      portability: 5,
    });
    expect(shifted.rankings[0]?.name).toBe("Fictional Beacon Studio");

    // Setting all weights to 0 yields unranked state without NaN
    for (const criterion of DEFAULT_AI_VENDOR_CRITERIA) {
      const slider = document.getElementById(
        `vendor-weight-${criterion.id}`
      ) as HTMLInputElement;
      fireEvent.change(slider, { target: { value: "0" } });
    }
    expect(screen.getAllByText("Unranked (zero weights)")).toHaveLength(
      FICTIONAL_AI_VENDORS.length
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset weights" }));
    expect(screen.queryByText("Unranked (zero weights)")).toBeNull();
  });

  it("makes no prohibited clinical compliance or validation claims across static and interactive states", () => {
    const couOutputs = (["low", "medium", "high"] as const).flatMap((inf) =>
      (["low", "medium", "high"] as const).map((con) =>
        evaluateContextOfUseRisk({
          workflowId: COU_WORKFLOW_PRESETS[0]!.id,
          modelInfluence: inf,
          decisionConsequence: con,
        })
      )
    );

    const allModelCopy = [
      AI_GOVERNANCE_PAGE_COPY.eyebrow,
      AI_GOVERNANCE_PAGE_COPY.title,
      AI_GOVERNANCE_PAGE_COPY.intro,
      AI_GOVERNANCE_PAGE_COPY.banner,
      AI_GOVERNANCE_PAGE_COPY.referencesHeading,
      AI_GOVERNANCE_PAGE_COPY.referencesIntro,
      ...AI_GOVERNANCE_PAGE_COPY.references.flatMap((r) => [
        r.title,
        r.status,
        r.summary,
      ]),
      ...AI_GOVERNANCE_PAGE_COPY.sections.flatMap((s) => [
        s.heading,
        s.summary,
      ]),
      ...COU_WORKFLOW_PRESETS.flatMap((p) => [
        p.label,
        p.questionOfInterest,
        p.contextOfUse,
        p.deterministicCompanion,
      ]),
      ...GOVERNANCE_CROSSWALK.flatMap((row) => [
        row.sourceBadge,
        row.externalExpectation,
        row.platformSafeguard,
        row.verificationMechanism,
      ]),
      ...couOutputs.flatMap((out) => [
        out.riskLabel,
        out.oversightStringency,
        out.humanReviewGate,
        ...out.steps.flatMap((step) => [
          step.title,
          step.detail,
          step.artifactOrControl,
        ]),
      ]),
    ].join("\n");

    expect(findClinicalClaims(allModelCopy)).toEqual([]);
    expect(checkRegulatoryWording(allModelCopy)).toEqual([]);

    const { container } = render(pageElement);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Preview diff (Model hypothesis)",
      })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Simulate manual edit" })
    );

    const renderedText = container.textContent ?? "";
    expect(findClinicalClaims(renderedText)).toEqual([]);
    expect(checkRegulatoryWording(renderedText)).toEqual([]);
  });

  it("has no WCAG 2.1 AA violations across initial and expanded states", async () => {
    const { container } = render(pageElement);

    // Every horizontal scroll wrapper must be a named keyboard-focusable region (scrollable-region-focusable)
    const expectedScrollRegions = [
      "Safeguard crosswalk table",
      "Recorded CDISC CORE findings table",
      "Selected eCTD module 5 file digests table",
      "Fictional vendor weight sensitivity table",
    ];
    for (const label of expectedScrollRegions) {
      const region = screen.getByRole("region", { name: label });
      expect(region.getAttribute("tabindex")).toBe("0");
    }
    expect(container.querySelectorAll(".overflow-x-auto")).toHaveLength(
      expectedScrollRegions.length
    );

    // Vendor criterion sliders meet 44px minimum touch-target height on phone viewports
    for (const criterion of DEFAULT_AI_VENDOR_CRITERIA) {
      const slider = document.getElementById(`vendor-weight-${criterion.id}`);
      expect(slider?.className).toContain("min-h-11");
    }

    const initialAudit = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    });
    expect(initialAudit.violations.map((v) => v.id)).toEqual([]);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Preview diff (Model hypothesis)",
      })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Simulate manual edit" })
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /Off-codelist term, non-extensible list \(injected defect\)/,
      })
    );

    const interactiveAudit = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    });
    expect(interactiveAudit.violations.map((v) => v.id)).toEqual([]);
  });
});
