// @vitest-environment jsdom
/**
 * One form catalog behind one insertion surface (#2927 item 11).
 */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  FORM_CATALOG_SOURCES,
  buildFormCatalog,
  catalogBlockCommand,
  instantiateCatalogForm,
  searchFormCatalog,
  CDASH_DOMAIN_CATALOG,
  CLINICAL_SMART_BLOCKS,
} from "@/lib/crf";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";
import { FormCatalogList } from "@/components/crf/FormCatalogList";
import { FormCatalogModal } from "@/components/crf/FormCatalogModal";

afterEach(cleanup);

const variableNames = (form: {
  sections: { fields: { variableName: string }[] }[];
}) => form.sections.flatMap((s) => s.fields.map((f) => f.variableName));

describe("form catalog", () => {
  const entries = buildFormCatalog();

  it("holds every CDASH domain and smart block once, with unique ids", () => {
    expect(entries.filter((e) => e.source === "cdash")).toHaveLength(
      CDASH_DOMAIN_CATALOG.length
    );
    expect(entries.filter((e) => e.source === "block")).toHaveLength(
      CLINICAL_SMART_BLOCKS.length
    );
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
    expect(
      FORM_CATALOG_SOURCES.map((s) => s.source).filter((source) =>
        entries.some((e) => e.source === source)
      )
    ).toEqual(["cdash", "preset", "block"]);
  });

  it("offers each example-study form once and skips names a CDASH domain already has", () => {
    const presetTitles = entries
      .filter((e) => e.source === "preset")
      .map((e) => e.title);
    expect(new Set(presetTitles).size).toBe(presetTitles.length);
    expect(presetTitles).toContain("PHQ-9 Depression Inventory");
    expect(presetTitles).not.toContain("Demographics & Informed Consent");
    expect(presetTitles).not.toContain("Demographics Baseline");
  });

  it("instantiates every form entry and maps every block to its slash command", () => {
    for (const entry of entries) {
      if (entry.target === "visit") {
        const added = instantiateCatalogForm(entry.id, ONCOLOGY_RECIST_PRESET);
        expect(added?.form.sections.length, entry.id).toBeGreaterThan(0);
        expect(catalogBlockCommand(entry.id)).toBeNull();
      } else {
        expect(catalogBlockCommand(entry.id)?.action).toBe(
          "insert_smart_block"
        );
        expect(
          instantiateCatalogForm(entry.id, ONCOLOGY_RECIST_PRESET)
        ).toBeNull();
      }
    }
    expect(instantiateCatalogForm("cdash:ZZ", ONCOLOGY_RECIST_PRESET)).toBe(
      null
    );
  });

  it("copies an example-study form with fresh ids and no variable collisions", () => {
    const vitals = ONCOLOGY_RECIST_PRESET.forms.find((f) => f.domain === "VS")!;
    const study = { ...ONCOLOGY_RECIST_PRESET };
    const added = instantiateCatalogForm("preset:form_ecg_cardio", study)!;
    expect(added.form.id).not.toBe("form_ecg_cardio");
    const existing = new Set(study.forms.flatMap((f) => variableNames(f)));
    for (const name of variableNames(added.form)) {
      expect(existing.has(name), name).toBe(false);
    }
    expect(vitals).toBeDefined();
  });

  it("searches every word across title, description, domain and origin", () => {
    const qtc = searchFormCatalog(entries, "qtc").map((e) => e.id);
    expect(qtc).toContain("preset:form_ecg_cardio");
    expect(qtc).toContain("block:ecg");
    expect(qtc).not.toContain("cdash:DM");
    expect(
      searchFormCatalog(entries, "oncology tumor").map((e) => e.id)
    ).toContain("preset:form_recist_onc");
    expect(
      searchFormCatalog(entries, "adverse", "block").map((e) => e.source)
    ).toEqual(["block"]);
    expect(searchFormCatalog(entries, "  ")).toHaveLength(entries.length);
  });
});

describe("form catalog surface", () => {
  const entries = buildFormCatalog();

  it("filters by source and disables blocks when no form is open", () => {
    const onAdd = vi.fn();
    render(
      <FormCatalogList
        entries={entries}
        onAdd={onAdd}
        canInsertBlocks={false}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /^Blocks \(/ }));
    const insert = screen.getAllByRole("button", {
      name: /into the open form/,
    });
    expect(insert).toHaveLength(CLINICAL_SMART_BLOCKS.length);
    expect(insert.every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.queryAllByRole("button", { name: /to the study$/ })).toEqual(
      []
    );
  });

  it("adds from the modal and closes it", () => {
    const onAdd = vi.fn();
    const onClose = vi.fn();
    render(
      <FormCatalogModal
        isOpen
        onClose={onClose}
        entries={entries}
        onAdd={onAdd}
        canInsertBlocks
        targetLabel="Screening"
      />
    );
    expect(
      screen.getByRole("dialog", { name: "Add a form or block" })
    ).toBeTruthy();
    expect(screen.getByText(/Forms go to Screening/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search the form catalog"), {
      target: { value: "disposition" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Add Subject Disposition & Milestones to the study",
      })
    );
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ id: "cdash:DS" })
    );
    expect(onClose).toHaveBeenCalled();
  });
});
