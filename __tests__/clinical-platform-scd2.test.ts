// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SCD2_OPEN_END, buildScd2Versions } from "@/lib/clinical-platform";

const initial = {
  effectiveOn: "2025-01-06",
  attributes: { site_status: "start-up", principal_investigator_id: "INV-A" },
};

describe("buildScd2Versions", () => {
  it("keeps a member with no changes as one open, current version", () => {
    expect(buildScd2Versions(initial, [])).toEqual([
      {
        version: 1,
        validFrom: "2025-01-06",
        validTo: SCD2_OPEN_END,
        isCurrent: true,
        attributes: initial.attributes,
      },
    ]);
  });

  it("opens a version per change, with half-open contiguous ranges", () => {
    const versions = buildScd2Versions(initial, [
      {
        effectiveOn: "2025-09-01",
        attributes: { principal_investigator_id: "INV-B" },
      },
      { effectiveOn: "2025-03-10", attributes: { site_status: "active" } },
    ]);
    expect(
      versions.map((v) => [v.version, v.validFrom, v.validTo, v.isCurrent])
    ).toEqual([
      [1, "2025-01-06", "2025-03-10", false],
      [2, "2025-03-10", "2025-09-01", false],
      [3, "2025-09-01", SCD2_OPEN_END, true],
    ]);
    expect(versions[1].attributes).toEqual({
      site_status: "active",
      principal_investigator_id: "INV-A",
    });
    expect(versions[2].attributes).toEqual({
      site_status: "active",
      principal_investigator_id: "INV-B",
    });
  });

  it("merges same-day changes and ignores changes that alter nothing", () => {
    const versions = buildScd2Versions(initial, [
      { effectiveOn: "2025-03-10", attributes: { site_status: "active" } },
      {
        effectiveOn: "2025-03-10",
        attributes: { principal_investigator_id: "INV-B" },
      },
      { effectiveOn: "2025-04-01", attributes: { site_status: "active" } },
      {
        effectiveOn: "2025-01-06",
        attributes: { principal_investigator_id: "INV-A" },
      },
    ]);
    expect(versions).toHaveLength(2);
    expect(versions[1]).toMatchObject({
      validFrom: "2025-03-10",
      attributes: { site_status: "active", principal_investigator_id: "INV-B" },
    });
  });

  it("folds a same-day reversal back into the previous version", () => {
    const versions = buildScd2Versions(initial, [
      { effectiveOn: "2025-03-10", attributes: { site_status: "active" } },
      { effectiveOn: "2025-03-10", attributes: { site_status: "start-up" } },
    ]);
    expect(versions).toHaveLength(1);
    expect(versions[0].validTo).toBe(SCD2_OPEN_END);
  });

  it("applies a change on the first day to the first version", () => {
    const versions = buildScd2Versions(
      {
        ...initial,
        attributes: { ...initial.attributes, principal_investigator_id: null },
      },
      [
        {
          effectiveOn: "2025-01-06",
          attributes: { principal_investigator_id: "INV-A" },
        },
      ]
    );
    expect(versions).toHaveLength(1);
    expect(versions[0].attributes.principal_investigator_id).toBe("INV-A");
  });

  it("rejects a change before the first day or a date that is not ISO 8601", () => {
    expect(() =>
      buildScd2Versions(initial, [
        { effectiveOn: "2024-12-31", attributes: { site_status: "active" } },
      ])
    ).toThrow(RangeError);
    expect(() =>
      buildScd2Versions(initial, [
        { effectiveOn: "10/03/2025", attributes: { site_status: "active" } },
      ])
    ).toThrow(RangeError);
  });
});
