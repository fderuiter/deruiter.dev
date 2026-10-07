import React, { useState } from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from "@testing-library/react";
import axe from "axe-core";
import { LibraryUpgradeModal } from "@/components/crf/LibraryUpgradeModal";
import {
  captureLibraryEntry,
  updateLibraryEntry,
  upsertLibraryEntry,
  PERSONAL_LIBRARY_STORAGE_KEY,
  type CRFField,
  type PersonalLibraryEntry,
  type StudyProtocol,
} from "@/lib/crf";
import { insertLibraryEntryWithLineage } from "@/lib/crf/library-upgrade";

/**
 * #681 UI journey: nonconflicting upgrade, conflicting customization, cancel,
 * apply and undo, driven through the dialog with synthetic data.
 */

class MockStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

function field(id: string, variableName: string, label: string): CRFField {
  return {
    id,
    variableName,
    label,
    dataType: "text",
    columnSpan: 6,
    required: false,
  } as CRFField;
}

function baseStudy(id: string, fields: CRFField[]): StudyProtocol {
  return {
    id,
    protocolNumber: `${id}-P`,
    studyName: id,
    phase: "Phase II",
    sponsor: "Synthetic Sponsor",
    therapeuticArea: "General Medicine",
    version: "1.0",
    lastModified: "2026-01-01T00:00:00.000Z",
    forms: [
      {
        id: "form_vs",
        name: "Vital signs",
        domain: "VS",
        description: "",
        version: "1.0",
        sections: [{ id: "sec_main", title: "Main", fields }],
        rules: [],
      },
    ],
    visits: [],
    codelists: [],
  } as StudyProtocol;
}

/** Mirrors the studio container: every commit is one entry on an undo stack. */
function Harness({
  initialStudy,
  storage,
}: {
  initialStudy: StudyProtocol;
  storage: Storage;
}) {
  const [study, setStudy] = useState(initialStudy);
  const [history, setHistory] = useState<StudyProtocol[]>([]);
  const [open, setOpen] = useState(false);

  const apply = (next: StudyProtocol) => {
    setHistory((previous) => [...previous, study]);
    setStudy(next);
  };
  const undo = () => {
    if (history.length === 0) return;
    setStudy(history[history.length - 1]);
    setHistory(history.slice(0, -1));
  };

  return (
    <main>
      <button type="button" onClick={() => setOpen(true)}>
        Open upgrades
      </button>
      <output data-testid="study-json">{JSON.stringify(study)}</output>
      <output data-testid="history-depth">{history.length}</output>
      <LibraryUpgradeModal
        isOpen={open}
        onClose={() => setOpen(false)}
        study={study}
        onApplyUpgrade={apply}
        onUndoUpgrade={undo}
        storage={storage}
      />
    </main>
  );
}

function currentStudy(): StudyProtocol {
  return JSON.parse(screen.getByTestId("study-json").textContent || "{}");
}

function labelOf(study: StudyProtocol, sectionId: string, variable: string) {
  const section = study.forms[0].sections.find((s) => s.id === sectionId)!;
  return section.fields.find((f) => f.variableName === variable)?.label;
}

describe("[#681] Library upgrade dialog", () => {
  let storage: MockStorage;
  let entry: PersonalLibraryEntry;

  beforeEach(() => {
    storage = new MockStorage();
    const source = baseStudy("lib_src", [
      field("fld_wt", "WEIGHT", "Weight"),
      field("fld_ht", "HEIGHT", "Height"),
    ]);
    entry = captureLibraryEntry({
      study: source,
      form: source.forms[0],
      sectionId: "sec_main",
      name: "Body measures",
    });
    upsertLibraryEntry(entry, storage);
  });

  afterEach(() => {
    cleanup();
  });

  function setup(
    customize?: (study: StudyProtocol, sectionId: string) => void
  ) {
    const { study, use } = insertLibraryEntryWithLineage(
      entry,
      baseStudy("target", []),
      "form_vs"
    );
    customize?.(study, use.sectionId);
    const section = structuredClone(entry.section!);
    section.fields[0].label = "Body weight (kg)";
    updateLibraryEntry(entry.id, { section }, storage);
    render(<Harness initialStudy={study} storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: "Open upgrades" }));
    return { study, use };
  }

  it("applies a nonconflicting upgrade as one step and undoes it", () => {
    const { study, use } = setup((s, sectionId) => {
      s.forms[0].sections.find((x) => x.id === sectionId)!.fields[1].label =
        "Standing height";
    });
    const original = JSON.stringify(study);
    const dialog = screen.getByRole("dialog", {
      name: /library block upgrades/i,
    });
    expect(within(dialog).getByText("Update available")).toBeTruthy();

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: /review upgrade of body measures/i,
      })
    );
    expect(screen.getByTestId("library-upgrade-counts").textContent).toMatch(
      /1 library change\(s\), 1 customization\(s\) kept, 0 matching, 0 conflict\(s\)/
    );
    expect(
      screen.getByTestId("upgrade-change-field:fld_wt:label").textContent
    ).toMatch(/Library change, will be applied/);
    expect(
      screen.getByTestId("upgrade-change-field:fld_ht:label").textContent
    ).toMatch(/Your customization, kept/);

    const apply = screen.getByRole("button", { name: "Apply upgrade" });
    expect((apply as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(apply);

    expect(screen.getByTestId("history-depth").textContent).toBe("1");
    const upgraded = currentStudy();
    expect(labelOf(upgraded, use.sectionId, "WEIGHT")).toBe("Body weight (kg)");
    expect(labelOf(upgraded, use.sectionId, "HEIGHT")).toBe("Standing height");
    expect(upgraded.libraryUses?.[0].entryVersion).toBe(2);
    expect(upgraded.libraryUses?.[0].upgradeHistory?.[0].fromVersion).toBe(1);
    expect(screen.getByTestId("library-upgrade-outcome").textContent).toMatch(
      /from version 1 to 2 as one step/
    );
    expect(screen.getByText("Up to date")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /undo upgrade/i }));
    expect(screen.getByTestId("study-json").textContent).toBe(original);
    expect(screen.getByTestId("history-depth").textContent).toBe("0");
    expect(screen.getByTestId("library-upgrade-outcome").textContent).toMatch(
      /undone/
    );
    expect(screen.getByText("Update available")).toBeTruthy();
  });

  it("requires an explicit choice for a conflicting customization", () => {
    const { use } = setup((s, sectionId) => {
      s.forms[0].sections.find((x) => x.id === sectionId)!.fields[0].label =
        "Weight (site wording)";
    });
    fireEvent.click(screen.getByRole("button", { name: /review upgrade/i }));

    expect(screen.getByText("Conflicts (0 of 1 resolved)")).toBeTruthy();
    const conflict = screen.getByRole("group", { name: /weight.*label/i });
    expect(within(conflict).getByText("Weight")).toBeTruthy();
    expect(within(conflict).getByText("Weight (site wording)")).toBeTruthy();
    expect(within(conflict).getByText("Body weight (kg)")).toBeTruthy();

    const apply = screen.getByRole("button", { name: "Apply upgrade" });
    expect((apply as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText(/choose a version for every conflict/i)
    ).toBeTruthy();

    fireEvent.click(
      within(conflict).getByRole("radio", { name: "Keep my version" })
    );
    expect(screen.getByText("Conflicts (1 of 1 resolved)")).toBeTruthy();
    expect((apply as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(apply);

    const upgraded = currentStudy();
    expect(labelOf(upgraded, use.sectionId, "WEIGHT")).toBe(
      "Weight (site wording)"
    );
    expect(upgraded.libraryUses?.[0].upgradeHistory?.[0].resolutions).toEqual({
      "field:fld_wt:label": "current",
    });
  });

  it("cancel and close change nothing, in the study or in storage", () => {
    const { study } = setup();
    const original = JSON.stringify(study);
    const libraryBytes = storage.getItem(PERSONAL_LIBRARY_STORAGE_KEY);
    const keysBefore = storage.length;

    fireEvent.click(screen.getByRole("button", { name: /review upgrade/i }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Update available")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Apply upgrade" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /review upgrade/i }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    expect(screen.getByTestId("study-json").textContent).toBe(original);
    expect(screen.getByTestId("history-depth").textContent).toBe("0");
    expect(storage.getItem(PERSONAL_LIBRARY_STORAGE_KEY)).toBe(libraryBytes);
    expect(storage.length).toBe(keysBefore);
  });

  it("explains when the study has no library lineage", () => {
    render(<Harness initialStudy={baseStudy("plain", [])} storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: "Open upgrades" }));
    expect(
      screen.getByText(/no blocks inserted from your personal library/i)
    ).toBeTruthy();
  });

  it("has no axe violations in the list and preview states", async () => {
    setup((s, sectionId) => {
      s.forms[0].sections.find((x) => x.id === sectionId)!.fields[0].label =
        "Weight (site wording)";
    });
    const options = {
      runOnly: {
        type: "tag" as const,
        values: ["wcag2a", "wcag2aa", "wcag21aa"],
      },
      rules: { "color-contrast": { enabled: false } },
    };
    const dialog = screen.getByRole("dialog");
    expect((await axe.run(dialog, options)).violations).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: /review upgrade/i }));
    expect(
      (await axe.run(screen.getByRole("dialog"), options)).violations
    ).toEqual([]);
  });
});
