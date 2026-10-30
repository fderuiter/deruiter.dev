import { describe, it, expect, afterEach } from "vitest";
import {
  render,
  screen,
  within,
  fireEvent,
  cleanup,
} from "@testing-library/react";
import { DefineViewer } from "@/components/study-data/DefineViewer";
import {
  DEMO_301_STUDY,
  buildDefine,
  runPipeline,
  type DefineDocument,
} from "@/lib/study-data";

/**
 * The Define-XML viewer rendered from a real pipeline run, with no engine
 * mocks (#3483): every dataset is offered, and every variable row shows its
 * origin and codelist as the document model has them.
 */

const CREATED_AT = "2026-10-29T12:00:00Z";
const run = runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 24 });
const define = {
  sdtm: buildDefine(run, { layer: "sdtm", createdAt: CREATED_AT }),
  adam: buildDefine(run, { layer: "adam", createdAt: CREATED_AT }),
};

afterEach(cleanup);

function datasetSelect(): HTMLSelectElement {
  return screen.getByLabelText("Dataset") as HTMLSelectElement;
}

function variableTable(name: string): HTMLElement {
  return screen.getByRole("table", { name: `${name} variables` });
}

/** Checks every variable row of the selected dataset against the model. */
function expectVariableRows(doc: DefineDocument, oid: string) {
  const group = doc.itemGroups.find((g) => g.oid === oid)!;
  const items = new Map(doc.items.map((item) => [item.oid, item]));
  const lists = new Map(doc.codeLists.map((list) => [list.oid, list]));
  const table = variableTable(group.name);
  for (const ref of group.itemRefs) {
    const item = items.get(ref.itemOid)!;
    const row = within(table)
      .getByRole("rowheader", { name: item.name })
      .closest("tr")!;
    const cells = within(row).getAllByRole("cell");
    // Label, Type, Key, Codelist, Origin, Method.
    const codelist = cells[3].textContent ?? "";
    const origin = cells[4].textContent ?? "";
    expect(origin).toContain(item.origin.type);
    if (item.origin.source) expect(origin).toContain(item.origin.source);
    const list = item.codeListOid ? lists.get(item.codeListOid) : undefined;
    if (list) {
      expect(codelist).toContain(list.name);
      if (list.nciCode) expect(codelist).toContain(list.nciCode);
    } else {
      expect(codelist).toBe("");
    }
  }
}

describe("DefineViewer", () => {
  it("opens on the ADaM document and lists every ADaM dataset", () => {
    render(<DefineViewer define={define} />);
    expect(
      screen
        .getByRole("button", { name: "ADaM define.xml" })
        .getAttribute("aria-pressed")
    ).toBe("true");
    const options = within(datasetSelect()).getAllByRole("option");
    expect(options.map((o) => (o as HTMLOptionElement).value)).toEqual(
      define.adam.itemGroups.map((g) => g.oid)
    );
  });

  it("shows the origin and codelist of every variable in every ADaM dataset", () => {
    render(<DefineViewer define={define} />);
    for (const group of define.adam.itemGroups) {
      fireEvent.change(datasetSelect(), { target: { value: group.oid } });
      expectVariableRows(define.adam, group.oid);
    }
  });

  it("switches to the SDTM document, lists its datasets and shows their variables", () => {
    render(<DefineViewer define={define} />);
    fireEvent.click(screen.getByRole("button", { name: "SDTM define.xml" }));
    expect(
      screen
        .getByRole("button", { name: "SDTM define.xml" })
        .getAttribute("aria-pressed")
    ).toBe("true");
    expect(
      within(datasetSelect())
        .getAllByRole("option")
        .map((o) => (o as HTMLOptionElement).value)
    ).toEqual(define.sdtm.itemGroups.map((g) => g.oid));
    expect(datasetSelect().value).toBe(define.sdtm.itemGroups[0].oid);
    for (const group of define.sdtm.itemGroups) {
      fireEvent.change(datasetSelect(), { target: { value: group.oid } });
      expectVariableRows(define.sdtm, group.oid);
    }
  });

  it("lists the standards and the codelists and methods the dataset uses", () => {
    render(<DefineViewer define={define} />);
    const standards = screen.getByRole("table", { name: "Standards" });
    for (const standard of define.adam.standards) {
      expect(
        within(standards).getAllByText(standard.version).length
      ).toBeGreaterThan(0);
    }
    // Find an ADaM dataset with both a codelist and a derivation method.
    const items = new Map(define.adam.items.map((item) => [item.oid, item]));
    const group = define.adam.itemGroups.find(
      (g) =>
        g.itemRefs.some((ref) => items.get(ref.itemOid)?.codeListOid) &&
        g.itemRefs.some((ref) => ref.methodOid)
    )!;
    fireEvent.change(datasetSelect(), { target: { value: group.oid } });
    const codelists = screen.getByRole("region", { name: "Codelists" });
    const methods = screen.getByRole("region", { name: "Methods" });
    const listOids = new Set(
      group.itemRefs
        .map((ref) => items.get(ref.itemOid)?.codeListOid)
        .filter((oid): oid is string => Boolean(oid))
    );
    for (const oid of listOids) {
      const list = define.adam.codeLists.find((l) => l.oid === oid)!;
      expect(within(codelists).getAllByText(list.id).length).toBeGreaterThan(0);
    }
    const methodOids = new Set(
      group.itemRefs.map((ref) => ref.methodOid).filter(Boolean)
    );
    for (const oid of methodOids) {
      const method = define.adam.methods.find((m) => m.oid === oid)!;
      expect(
        within(methods).getAllByText(method.description).length
      ).toBeGreaterThan(0);
    }
  });

  it("says so when a dataset has no codelist or no method", () => {
    const items = new Map(define.sdtm.items.map((item) => [item.oid, item]));
    const noMethod = define.sdtm.itemGroups.find((g) =>
      g.itemRefs.every((ref) => !ref.methodOid)
    );
    const noList = define.sdtm.itemGroups.find((g) =>
      g.itemRefs.every((ref) => !items.get(ref.itemOid)?.codeListOid)
    );
    render(<DefineViewer define={define} />);
    fireEvent.click(screen.getByRole("button", { name: "SDTM define.xml" }));
    if (noMethod) {
      fireEvent.change(datasetSelect(), { target: { value: noMethod.oid } });
      expect(
        screen.getByText(
          `No variable of ${noMethod.name} is derived by a method.`
        )
      ).toBeTruthy();
    }
    if (noList) {
      fireEvent.change(datasetSelect(), { target: { value: noList.oid } });
      expect(
        screen.getByText(`No variable of ${noList.name} has a codelist.`)
      ).toBeTruthy();
    }
    expect(noMethod ?? noList).toBeDefined();
  });

  it("shows value-level metadata for a dataset that has it", () => {
    const withValues = [
      ...define.adam.itemGroups,
      ...define.sdtm.itemGroups,
    ].find((g) =>
      [...define.adam.valueLists, ...define.sdtm.valueLists].some(
        (list) => list.dataset === g.name
      )
    );
    expect(withValues).toBeDefined();
    const layer = define.adam.itemGroups.includes(withValues!)
      ? "adam"
      : "sdtm";
    render(<DefineViewer define={define} />);
    if (layer === "sdtm") {
      fireEvent.click(screen.getByRole("button", { name: "SDTM define.xml" }));
    }
    fireEvent.change(datasetSelect(), { target: { value: withValues!.oid } });
    expect(
      screen.getByRole("table", { name: "Value-level metadata" })
    ).toBeTruthy();
  });
});
