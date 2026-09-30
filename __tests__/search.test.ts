import { describe, it, expect } from "vitest";
import {
  filterFuzzySearch,
  getLevenshteinDistance,
  getClosestMatches,
  type SearchItem,
} from "@/lib/search-utils";

describe("filterFuzzySearch", () => {
  const items: SearchItem[] = [
    {
      id: "1",
      title: "React Hooks",
      subtitle: "Frontend development with React",
    },
    {
      id: "2",
      title: "TypeScript Deep Dive",
      subtitle: "Advanced TS topics and patterns",
    },
    {
      id: "3",
      title: "Vitest Unit Testing",
      subtitle: "Testing frontend code",
    },
  ];

  it("returns all items if query is empty", () => {
    const result = filterFuzzySearch("", items);
    expect(result).toHaveLength(3);
  });

  it("filters items matching title (case-insensitive)", () => {
    const result = filterFuzzySearch("react", items);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("filters items matching subtitle (case-insensitive)", () => {
    const result = filterFuzzySearch("frontend", items);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("1");
    expect(result[1].id).toBe("3");
  });

  it("trims leading/trailing whitespace in query", () => {
    const result = filterFuzzySearch("  typescript   ", items);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("2");
  });

  it("returns empty array if no match", () => {
    const result = filterFuzzySearch("svelte", items);
    expect(result).toHaveLength(0);
  });

  it("handles items with missing/null string fields safely", () => {
    const brokenItems: SearchItem[] = [
      { id: "1", title: null as never, subtitle: "react" },
      { id: "2", title: "angular", subtitle: undefined as never },
    ];

    expect(filterFuzzySearch("react", brokenItems)).toHaveLength(1);
    expect(filterFuzzySearch("angular", brokenItems)).toHaveLength(1);
  });

  it("filters items matching description, badge, tags, or techStack", () => {
    const richItems: SearchItem[] = [
      {
        id: "1",
        title: "CRF Studio: Validate CDASH Rules",
        subtitle: "Validation check",
        description:
          "Automated CDASH rule verification and compliance diagnostics",
        badge: "Validation",
        tags: ["cdash", "compliance", "crf"],
        techStack: ["CRF Studio", "CDASH"],
      },
      {
        id: "2",
        title: "Proof Canvas: Verify Premises",
        subtitle: "Logic tactic",
        description: "Discharge deduction rules on active proof tree",
        badge: "Tactic",
        tags: ["proof", "logic", "tactic"],
        techStack: ["Proof Canvas"],
      },
    ];

    expect(filterFuzzySearch("compliance", richItems)).toHaveLength(1);
    expect(filterFuzzySearch("compliance", richItems)[0].id).toBe("1");

    expect(filterFuzzySearch("logic", richItems)).toHaveLength(1);
    expect(filterFuzzySearch("logic", richItems)[0].id).toBe("2");

    expect(filterFuzzySearch("tactic", richItems)).toHaveLength(1);
    expect(filterFuzzySearch("tactic", richItems)[0].id).toBe("2");
  });
});

describe("getLevenshteinDistance", () => {
  it("computes correct distance", () => {
    expect(getLevenshteinDistance("kitten", "sitting")).toBe(3);
    expect(getLevenshteinDistance("schemaflow", "schemafloww")).toBe(1);
    expect(getLevenshteinDistance("same", "same")).toBe(0);
  });
});

describe("getClosestMatches", () => {
  const items = [
    {
      id: "1",
      slug: "schemaflow",
      title: "SchemaFlow",
      primary_language: "TypeScript",
      tags: "ORM, Database",
    },
    {
      id: "2",
      slug: "clinical-mapper",
      title: "Clinical Mapper",
      primary_language: "Python",
      tags: "Clinical, Mapper, SDTM",
    },
    {
      id: "3",
      slug: "healthcare-portal",
      title: "Healthcare Portal",
      primary_language: "Go",
      tags: "Go, Health, API",
    },
  ];

  it("returns first 3 items if path is empty", () => {
    const result = getClosestMatches("", items);
    expect(result).toHaveLength(3);
  });

  it("handles exact slug mismatch typo using Levenshtein distance", () => {
    const result = getClosestMatches("/schemafloww", items);
    expect(result[0].id).toBe("1");
  });

  it("matches keyword inside slug/title/tags", () => {
    const result = getClosestMatches("/clinical-mapper-tool", items);
    expect(result[0].id).toBe("2");
  });

  it("matches primary language", () => {
    const result = getClosestMatches("/go-api", items);
    expect(result[0].id).toBe("3");
  });
});
