import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import {
  BLINDED_TREATMENT_MARKER,
  DEFAULT_DISPLAY_PROFILE,
  DISPLAY_PERSONAS,
  DISPLAY_SEGMENTS,
  MAX_DISPLAY_LABEL_LENGTH,
  RANDOMIZATION_DISCLOSURE_POLICY_VERSION,
  RANDOMIZATION_EXPORT_KINDS,
  RANDOMIZATION_USE_POLICY_VERSION,
  assessVerificationEvidence,
  decideRandomizationExport,
  normalizeDisplayProfile,
  presentAllocationRows,
  presentTreatmentSummary,
  presentTreatmentValue,
  requestPromotion,
  resolvePresentation,
  sanitizeDisplayLabel,
  type AllocationRow,
  type ArmSpec,
  type DisplayProfile,
  type RandomizationExportKind,
  type RandomizationExportRequest,
} from "@/lib/randomization";
import { DisclosureControls } from "@/components/randomization/DisclosureControls";

afterEach(() => {
  cleanup();
});

const ARMS: readonly ArmSpec[] = [
  { id: "arm-a", code: "A", label: "Active 10 mg", allocationRatio: 1 },
  { id: "arm-p", code: "P", label: "Placebo", allocationRatio: 1 },
];

const ROWS: readonly AllocationRow[] = Object.freeze([
  Object.freeze({
    sequence: 1,
    subjectId: "S01-001",
    siteId: "site-1",
    stratumKey: "[]",
    stratumLevels: {},
    armId: "arm-a",
    armCode: "A",
    blockIndex: 0,
    blockSize: 2,
    positionInBlock: 0,
  }),
  Object.freeze({
    sequence: 2,
    subjectId: "S01-002",
    siteId: "site-1",
    stratumKey: "[]",
    stratumLevels: {},
    armId: "arm-p",
    armCode: "P",
    blockIndex: 0,
    blockSize: 2,
    positionInBlock: 1,
  }),
]);

function profile(overrides: Partial<DisplayProfile>): DisplayProfile {
  return { ...DEFAULT_DISPLAY_PROFILE, ...overrides };
}

function exportRequest(
  overrides: Partial<RandomizationExportRequest>
): RandomizationExportRequest {
  return {
    kind: "csv",
    lifecycle: "promoted",
    disclosure: "masked",
    fullDisclosureAcknowledged: false,
    useNoticeAcknowledged: false,
    ...overrides,
  };
}

describe("randomization display profiles (RND-DISCL-001, RND-DISCL-002)", () => {
  it("offers the three personas and three segments, defaulting to a masked Sponsor trial manager", () => {
    expect(DISPLAY_PERSONAS).toEqual([
      "Biostatistician",
      "TrialManager",
      "ComplianceOfficer",
    ]);
    expect(DISPLAY_SEGMENTS).toEqual(["Sponsor", "Academic", "CRO"]);
    expect(DEFAULT_DISPLAY_PROFILE).toEqual({
      persona: "TrialManager",
      segment: "Sponsor",
      unblindRequested: false,
    });
    expect(resolvePresentation(DEFAULT_DISPLAY_PROFILE).maskTreatment).toBe(
      true
    );
  });

  it("falls back to the default for unknown or hostile saved preferences", () => {
    expect(normalizeDisplayProfile(null)).toEqual(DEFAULT_DISPLAY_PROFILE);
    expect(
      normalizeDisplayProfile({
        persona: "Admin",
        segment: "Regulator",
        unblindRequested: "yes",
      })
    ).toEqual(DEFAULT_DISPLAY_PROFILE);
  });

  it("recomputes masking, the unmask toggle and visible export actions when the segment changes", () => {
    const sponsor = resolvePresentation(profile({ segment: "Sponsor" }));
    const academic = resolvePresentation(
      profile({ segment: "Academic", unblindRequested: true })
    );
    expect(sponsor.canToggleUnblind).toBe(false);
    expect(sponsor.visibleExportKinds).not.toContain("allocation-json");
    expect(sponsor.visibleExportKinds).not.toContain("executable-code");
    expect(academic.canToggleUnblind).toBe(true);
    expect(academic.maskTreatment).toBe(false);
    expect(academic.visibleExportKinds).toEqual(RANDOMIZATION_EXPORT_KINDS);
  });
});

describe("treatment masking (RND-DISCL-003)", () => {
  it("lets biostatisticians bypass masking and keeps ordinary Sponsor and CRO views masked", () => {
    for (const segment of DISPLAY_SEGMENTS) {
      expect(
        resolvePresentation(profile({ persona: "Biostatistician", segment }))
          .maskTreatment
      ).toBe(false);
    }
    for (const segment of ["Sponsor", "CRO"] as const) {
      const masked = resolvePresentation(
        profile({
          persona: "ComplianceOfficer",
          segment,
          unblindRequested: true,
        })
      );
      expect(masked.maskTreatment).toBe(true);
      expect(masked.canToggleUnblind).toBe(false);
    }
  });

  it("masks arm values in tables, labels and summaries with one marker", () => {
    const masked = resolvePresentation(DEFAULT_DISPLAY_PROFILE);
    const shown = presentAllocationRows(ROWS, masked);
    expect(shown.map((row) => [row.armId, row.armCode])).toEqual([
      [BLINDED_TREATMENT_MARKER, BLINDED_TREATMENT_MARKER],
      [BLINDED_TREATMENT_MARKER, BLINDED_TREATMENT_MARKER],
    ]);
    expect(presentTreatmentValue("Placebo", masked)).toBe(
      BLINDED_TREATMENT_MARKER
    );
    expect(
      presentTreatmentSummary(ARMS, { "arm-a": 3, "arm-p": 1 }, masked)
    ).toEqual([
      {
        key: BLINDED_TREATMENT_MARKER,
        label: BLINDED_TREATMENT_MARKER,
        count: 4,
      },
    ]);
  });

  it("never changes the immutable numerical result when the profile switches", () => {
    const before = JSON.stringify(ROWS);
    for (const persona of DISPLAY_PERSONAS) {
      for (const segment of DISPLAY_SEGMENTS) {
        for (const unblindRequested of [false, true]) {
          presentAllocationRows(
            ROWS,
            resolvePresentation({ persona, segment, unblindRequested })
          );
        }
      }
    }
    expect(JSON.stringify(ROWS)).toBe(before);
    const unmasked = resolvePresentation(
      profile({ persona: "Biostatistician" })
    );
    expect(presentAllocationRows(ROWS, unmasked)).toBe(ROWS);
  });
});

describe("host authorization boundary (RND-DISCL-004)", () => {
  it("never reports protected access, whatever profile the visitor picks", () => {
    for (const persona of DISPLAY_PERSONAS) {
      for (const segment of DISPLAY_SEGMENTS) {
        const presentation = resolvePresentation({
          persona,
          segment,
          unblindRequested: true,
        });
        expect(presentation.grantsProtectedAccess).toBe(false);
      }
    }
  });
});

describe("export disclosure gate (RND-DISCL-005, RND-DISCL-006)", () => {
  const sensitive: readonly RandomizationExportKind[] = [
    "allocation-json",
    "seed-config",
    "executable-code",
  ];

  it("never exports seed, config, code or full JSON under a masked label", () => {
    for (const kind of sensitive) {
      expect(
        decideRandomizationExport(
          exportRequest({
            kind,
            disclosure: "masked",
            useNoticeAcknowledged: true,
          })
        )
      ).toEqual({ allowed: false, code: "FULL_DISCLOSURE_REQUIRED" });
      const full = decideRandomizationExport(
        exportRequest({
          kind,
          disclosure: "full",
          fullDisclosureAcknowledged: true,
          useNoticeAcknowledged: true,
        })
      );
      expect(full).toEqual({
        allowed: true,
        metadata: {
          disclosurePolicyVersion: RANDOMIZATION_DISCLOSURE_POLICY_VERSION,
          usePolicyVersion: RANDOMIZATION_USE_POLICY_VERSION,
          disclosure: "full",
          label: "full-disclosure",
          lifecycle: "promoted",
          containsAuthoritativeAssignments: true,
        },
      });
    }
  });

  it("requires the reviewed use notice before generation and code actions", () => {
    expect(
      decideRandomizationExport(
        exportRequest({
          kind: "executable-code",
          disclosure: "full",
          fullDisclosureAcknowledged: true,
        })
      )
    ).toEqual({ allowed: false, code: "USE_NOTICE_REQUIRED" });
  });

  it("requires an explicit acknowledgment for any full-disclosure export", () => {
    expect(
      decideRandomizationExport(
        exportRequest({ kind: "csv", disclosure: "full" })
      )
    ).toEqual({ allowed: false, code: "FULL_DISCLOSURE_NOT_ACKNOWLEDGED" });
  });

  it("labels masked CSV, XLSX and PDF files as presentations without authoritative assignments", () => {
    for (const kind of ["csv", "xlsx", "pdf"] as const) {
      const decision = decideRandomizationExport(exportRequest({ kind }));
      expect(decision.allowed).toBe(true);
      if (decision.allowed) {
        expect(decision.metadata.label).toBe("masked-presentation");
        expect(decision.metadata.containsAuthoritativeAssignments).toBe(false);
      }
    }
  });

  it("applies one lifecycle rule to every export while a result is in exploration", () => {
    for (const kind of RANDOMIZATION_EXPORT_KINDS) {
      expect(
        decideRandomizationExport(
          exportRequest({
            kind,
            lifecycle: "exploration",
            disclosure: "full",
            fullDisclosureAcknowledged: true,
            useNoticeAcknowledged: true,
          })
        )
      ).toEqual({ allowed: false, code: "EXPLORATION_EXPORT_BLOCKED" });
    }
  });

  it("fails closed on unknown kinds, lifecycles and modes from a direct call", () => {
    const cast = (value: string) => value as never;
    expect(
      decideRandomizationExport(exportRequest({ kind: cast("raw-response") }))
    ).toEqual({ allowed: false, code: "UNKNOWN_EXPORT_KIND" });
    expect(
      decideRandomizationExport(exportRequest({ lifecycle: cast("PROMOTED") }))
    ).toEqual({ allowed: false, code: "UNKNOWN_LIFECYCLE" });
    expect(
      decideRandomizationExport(exportRequest({ disclosure: cast("blinded") }))
    ).toEqual({ allowed: false, code: "UNKNOWN_DISCLOSURE_MODE" });
  });

  it("promotes only through explicit state and invalidates demo results", () => {
    expect(
      requestPromotion({
        lifecycle: "exploration",
        metadataComplete: false,
        acknowledged: true,
      })
    ).toEqual({ ok: false, code: "PROMOTION_METADATA_INCOMPLETE" });
    expect(
      requestPromotion({
        lifecycle: "exploration",
        metadataComplete: true,
        acknowledged: false,
      })
    ).toEqual({ ok: false, code: "PROMOTION_NOT_ACKNOWLEDGED" });
    expect(
      requestPromotion({
        lifecycle: "exploration",
        metadataComplete: true,
        acknowledged: true,
      })
    ).toEqual({
      ok: true,
      lifecycle: "promoted",
      invalidatesDemoResults: true,
    });
  });
});

describe("verification evidence", () => {
  it("reports insufficient evidence for a masked presentation file", () => {
    const masked = decideRandomizationExport(exportRequest({ kind: "csv" }));
    expect(masked.allowed).toBe(true);
    if (masked.allowed) {
      expect(assessVerificationEvidence(masked.metadata)).toEqual({
        status: "insufficient-evidence",
        code: "MASKED_PRESENTATION",
      });
    }
    expect(assessVerificationEvidence(undefined)).toEqual({
      status: "insufficient-evidence",
      code: "MISSING_DISCLOSURE_METADATA",
    });
    expect(
      assessVerificationEvidence({
        disclosurePolicyVersion: 1,
        disclosure: "full",
        label: "full-disclosure",
        containsAuthoritativeAssignments: false,
      })
    ).toEqual({
      status: "insufficient-evidence",
      code: "NO_AUTHORITATIVE_ASSIGNMENTS",
    });
  });
});

describe("imported labels", () => {
  it("strips control and bidi override characters and caps the length", () => {
    expect(sanitizeDisplayLabel("Arm‮A\u0000\n  B")).toBe("Arm A B");
    expect(Array.from(sanitizeDisplayLabel("x".repeat(500)))).toHaveLength(
      MAX_DISPLAY_LABEL_LENGTH
    );
    expect(sanitizeDisplayLabel(42)).toBe("42");
  });

  it("renders a hostile arm label as text, never as markup or a link", () => {
    const hostile =
      '<img src=x onerror="alert(1)"><a href="javascript:alert(1)">x</a>';
    const unmasked = resolvePresentation(
      profile({ persona: "Biostatistician" })
    );
    const [entry] = presentTreatmentSummary(
      [{ id: "arm-x", code: "X", label: hostile, allocationRatio: 1 }],
      { "arm-x": 1 },
      unmasked
    );
    const { container } = render(<span>{entry.label}</span>);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toBe(hostile);
  });
});

describe("DisclosureControls", () => {
  function Harness({
    onChange,
  }: {
    onChange?: (next: DisplayProfile) => void;
  }) {
    const [value, setValue] = useState<DisplayProfile>(DEFAULT_DISPLAY_PROFILE);
    return (
      <DisclosureControls
        profile={value}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
      />
    );
  }

  it("shows the unmask toggle only for segments that allow it", () => {
    render(<Harness />);
    expect(screen.queryByLabelText("Show treatment values")).toBeNull();
    fireEvent.change(screen.getByLabelText("Organization"), {
      target: { value: "Academic" },
    });
    const toggle = screen.getByLabelText(
      "Show treatment values"
    ) as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    fireEvent.click(toggle);
    expect(
      screen.getByTestId("randomization-disclosure-status").textContent
    ).toContain("You chose to unmask them.");
  });

  it("resets an unmask request when the organization changes", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Organization"), {
      target: { value: "Academic" },
    });
    fireEvent.click(screen.getByLabelText("Show treatment values"));
    fireEvent.change(screen.getByLabelText("Organization"), {
      target: { value: "CRO" },
    });
    expect(onChange).toHaveBeenLastCalledWith({
      persona: "TrialManager",
      segment: "CRO",
      unblindRequested: false,
    });
  });

  it("states that the view is a display preference and that full artifacts reveal assignments", () => {
    render(<Harness />);
    const status = screen.getByTestId("randomization-disclosure-status");
    expect(status.textContent).toContain("not access control");
    expect(status.textContent).toContain("can rebuild every assignment");
    expect(status.textContent).not.toMatch(/complian|validated|no network/i);
  });
});
