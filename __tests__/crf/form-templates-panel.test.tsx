import React from "react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  act,
} from "@testing-library/react";
import { fromPartial } from "@total-typescript/shoehorn";
import { FormTemplatesPanel } from "@/components/crf/LeftSidebar/FormTemplatesPanel";
import { FormCanvas } from "@/components/crf/CenterCanvas/FormCanvas";
import {
  captureFormTemplate,
  exportFormTemplates,
  listFormTemplates,
  saveFormTemplate,
} from "@/lib/crf/form-templates";
import type { CRFForm, StudyProtocol } from "@/lib/crf/types";

vi.mock("@/lib/download", () => ({
  downloadFile: vi.fn().mockReturnValue(true),
}));
import { downloadFile } from "@/lib/download";

const sourceForm: CRFForm = {
  id: "form-vs",
  name: "Vital Signs",
  domain: "VS",
  description: "",
  version: "1.0",
  sections: [
    {
      id: "sec",
      title: "Vitals",
      fields: [
        {
          id: "f1",
          variableName: "SYSBP",
          label: "Systolic",
          dataType: "number",
          columnSpan: 4,
          required: false,
        },
      ],
    },
  ],
  rules: [],
};

const study = fromPartial<StudyProtocol>({
  id: "s",
  forms: [],
  visits: [],
  codelists: [],
});

let store: Record<string, string>;
beforeEach(() => {
  store = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = String(v);
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        store = {};
      },
    },
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function saveOne(name = "Vitals template") {
  const template = captureFormTemplate({
    form: sourceForm,
    codelists: [],
    name,
  });
  act(() => {
    saveFormTemplate(template);
  });
  return template;
}

describe("FormTemplatesPanel", () => {
  it("shows an empty state", () => {
    render(<FormTemplatesPanel study={study} onInsert={vi.fn()} />);
    expect(screen.getByText(/No saved form templates/)).toBeTruthy();
    expect(screen.getByText(/My form templates \(0\)/)).toBeTruthy();
  });

  it("lists a template saved after it mounted", () => {
    render(<FormTemplatesPanel study={study} onInsert={vi.fn()} />);
    saveOne();
    expect(screen.getByText("Vitals template")).toBeTruthy();
    expect(screen.getByText(/1 sections · 1 fields/)).toBeTruthy();
    expect(screen.getByText(/My form templates \(1\)/)).toBeTruthy();
  });

  it("adds an independent copy to the study at the active visit", () => {
    const onInsert = vi.fn();
    const template = saveOne();
    render(
      <FormTemplatesPanel
        study={study}
        activeVisitId="v-1"
        onInsert={onInsert}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Add template Vitals template/ })
    );
    expect(onInsert).toHaveBeenCalledTimes(1);
    const [form, visitId, codelists] = onInsert.mock.calls[0];
    expect(visitId).toBe("v-1");
    expect(codelists).toEqual([]);
    expect(form.id).not.toBe(template.form.id);
    expect(form.sections[0].fields[0].id).not.toBe("f1");
    expect(screen.getByRole("status").textContent).toMatch(
      /Added Vitals template/
    );
  });

  it("asks before deleting, and keeps the template on Keep", () => {
    saveOne();
    render(<FormTemplatesPanel study={study} onInsert={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", { name: /Delete template Vitals template/ })
    );
    fireEvent.click(screen.getByRole("button", { name: "Keep" }));
    expect(listFormTemplates()).toHaveLength(1);

    fireEvent.click(
      screen.getByRole("button", { name: /Delete template Vitals template/ })
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Confirm delete Vitals template/ })
    );
    expect(listFormTemplates()).toHaveLength(0);
    expect(screen.getByText(/No saved form templates/)).toBeTruthy();
  });

  it("exports the saved templates", () => {
    saveOne();
    render(<FormTemplatesPanel study={study} onInsert={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Export/ }));
    expect(downloadFile).toHaveBeenCalledTimes(1);
    const [text, name] = vi.mocked(downloadFile).mock.calls[0];
    expect(name).toBe("crf-form-templates.json");
    expect(JSON.parse(String(text)).templates).toHaveLength(1);
  });

  it("imports a package and lists it", async () => {
    render(<FormTemplatesPanel study={study} onInsert={vi.fn()} />);
    const pkg = exportFormTemplates([
      captureFormTemplate({ form: sourceForm, codelists: [], name: "Shared" }),
    ]);
    fireEvent.change(screen.getByLabelText("Import form template package"), {
      target: { files: [new File([pkg], "t.json")] },
    });
    expect(await screen.findByText("Shared")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toMatch(
      /Imported 1 template\b/
    );
  });

  it("shows why a bad package was refused", async () => {
    render(<FormTemplatesPanel study={study} onInsert={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Import form template package"), {
      target: { files: [new File(["nope"], "t.json")] },
    });
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toMatch(
        /not a form template package/
      )
    );
    expect(listFormTemplates()).toHaveLength(0);
  });
});

describe("FormCanvas save-as-template button", () => {
  const canvas = (onSaveAsTemplate?: (id: string) => void) => (
    <FormCanvas
      form={sourceForm}
      selectedFieldId={null}
      viewport="desktop"
      codelists={[]}
      onChangeViewport={vi.fn()}
      onSelectField={vi.fn()}
      onUpdateFormMeta={vi.fn()}
      onAddSection={vi.fn()}
      onDeleteSection={vi.fn()}
      onUpdateSectionTitle={vi.fn()}
      onDuplicateField={vi.fn()}
      onDeleteField={vi.fn()}
      onUpdateField={vi.fn()}
      onOpenPalette={vi.fn()}
      onSaveAsTemplate={onSaveAsTemplate}
    />
  );

  it("calls back with the form id", () => {
    const onSave = vi.fn();
    render(canvas(onSave));
    fireEvent.click(
      screen.getAllByRole("button", {
        name: /Save form Vital Signs as a template/,
      })[0]
    );
    expect(onSave).toHaveBeenCalledWith("form-vs");
  });

  it("is absent without a handler", () => {
    render(canvas());
    expect(screen.queryByRole("button", { name: /as a template/ })).toBeNull();
  });
});
