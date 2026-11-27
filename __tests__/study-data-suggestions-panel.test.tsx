import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { RecordedSuggestionsSection } from "@/components/study-data/RecordedSuggestionsSection";
import { findClinicalClaims } from "@/lib/clinical-platform";
import { loadRecordedSdtmSuggestions } from "@/lib/study-data";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const FORBIDDEN_CLAIMS =
  /\bcompliant\b|\bvalidated\b|\bPart\s*11\b|\b21\s*CFR\b|100\s*%\s*CDISC/i;

describe("RecordedSuggestionsSection (#3531)", () => {
  it("renders one synthetic suggestion row per DEMO-301 raw column with method and version in each row header and footer", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const expectedSet = loadRecordedSdtmSuggestions("DEMO-301");
    expect(expectedSet).not.toBeNull();
    if (!expectedSet) return;

    const { container } = render(<RecordedSuggestionsSection />);

    const region = screen.getByRole("region", {
      name: /Recorded SDTM mapping suggestions/i,
    });
    const table = within(region).getByRole("table", {
      name: /Recorded SDTM mapping suggestions/i,
    });
    const body = table.querySelector("tbody");
    expect(body).not.toBeNull();
    if (!body) return;

    const rows = within(body).getAllByRole("row");
    expect(rows).toHaveLength(expectedSet.suggestions.length);

    for (const [index, suggestion] of expectedSet.suggestions.entries()) {
      const row = rows[index];
      const rowHeader = within(row).getByRole("rowheader");
      expect(rowHeader.textContent).toContain(suggestion.rawColumn);
      expect(rowHeader.textContent).toContain(suggestion.method);
      expect(rowHeader.textContent).toContain(suggestion.suggesterVersion);

      expect(row.textContent).toContain(suggestion.domain);
      expect(row.textContent).toContain(suggestion.suggestedVariable);
      expect(row.textContent).toContain(suggestion.key);
      expect(row.textContent).toMatch(/synthetic/i);
    }

    const footer = screen.getByTestId("recorded-suggestions-footer");
    expect(footer.textContent).toContain(expectedSet.method);
    expect(footer.textContent).toContain(expectedSet.suggesterVersion);
    expect(footer.textContent).toMatch(/synthetic/i);

    const renderedText = container.textContent ?? "";
    expect(findClinicalClaims(renderedText)).toEqual([]);
    expect(renderedText).not.toMatch(FORBIDDEN_CLAIMS);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
