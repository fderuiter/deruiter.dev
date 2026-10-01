import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import {
  useTouchDragAndDrop,
  PolyfillDataTransfer,
  createSynthesizedDragEvent,
} from "@/hooks/useTouchDragAndDrop";
import { FormCanvas } from "@/components/crf/CenterCanvas/FormCanvas";
import { StudySpine } from "@/components/crf/LeftSidebar/StudySpine";
import { WidgetPalette } from "@/components/crf/LeftSidebar/WidgetPalette";
import { CRFForm, StudyProtocol } from "@/lib/crf/types";

beforeEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  if (typeof document.elementFromPoint !== "function") {
    document.elementFromPoint = (_x: number, _y: number) => document.body;
  }
});

describe("PolyfillDataTransfer", () => {
  it("stores and retrieves data with format keys case-insensitively", () => {
    const dt = new PolyfillDataTransfer();
    dt.setData("application/json", '{"test": true}');
    dt.setData("text/plain", "hello");

    expect(dt.getData("APPLICATION/JSON")).toBe('{"test": true}');
    expect(dt.getData("text/plain")).toBe("hello");
    expect(dt.types).toEqual(["application/json", "text/plain"]);

    dt.clearData("text/plain");
    expect(dt.getData("text/plain")).toBe("");
    expect(dt.types).toEqual(["application/json"]);

    dt.clearData();
    expect(dt.types).toEqual([]);
  });
});

describe("createSynthesizedDragEvent", () => {
  it("creates a DragEvent with attached dataTransfer payload", () => {
    const dt = new PolyfillDataTransfer();
    dt.setData("text/plain", "payload");
    const event = createSynthesizedDragEvent("dragstart", 100, 200, dt);

    expect(event.type).toBe("dragstart");
    expect(event.clientX).toBe(100);
    expect(event.clientY).toBe(200);
    expect(event.dataTransfer?.getData("text/plain")).toBe("payload");
  });
});

const DummyTouchDragComponent = ({
  onDropSuccess,
}: {
  onDropSuccess: (data: string) => void;
}) => {
  useTouchDragAndDrop();
  const [dropped, setDropped] = React.useState<string | null>(null);

  return (
    <div>
      <div
        data-testid="draggable-source"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", "source-data");
        }}
      >
        Drag Handle
      </div>
      <div
        data-testid="drop-target"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const text = e.dataTransfer.getData("text/plain");
          setDropped(text);
          onDropSuccess(text);
        }}
      >
        Drop Target {dropped}
      </div>
      <button data-testid="regular-button" onClick={() => {}}>
        Normal Button
      </button>
    </div>
  );
};

describe("useTouchDragAndDrop Hook", () => {
  it("initiates touch drag when movement exceeds threshold (5px)", () => {
    const onDropSuccess = vi.fn();
    render(<DummyTouchDragComponent onDropSuccess={onDropSuccess} />);

    const source = screen.getByTestId("draggable-source");
    const target = screen.getByTestId("drop-target");

    // Mock elementFromPoint to return target when coordinates match target
    vi.spyOn(document, "elementFromPoint").mockImplementation((x, y) => {
      if (x === 100 && y === 100) return target;
      return source;
    });

    // Touch start
    fireEvent.pointerDown(source, {
      clientX: 10,
      clientY: 10,
      pointerType: "touch",
    });

    // Touch move > 5px
    fireEvent.pointerMove(window, {
      clientX: 100,
      clientY: 100,
      pointerType: "touch",
    });

    // Ghost element should be created in body
    const ghost = document.body.querySelector('[style*="position: fixed"]');
    expect(ghost).not.toBeNull();

    // Touch end over target
    fireEvent.pointerUp(window, {
      clientX: 100,
      clientY: 100,
      pointerType: "touch",
    });

    expect(onDropSuccess).toHaveBeenCalledWith("source-data");
    // Ghost element should be removed
    expect(
      document.body.querySelector('[style*="position: fixed"]')
    ).toBeNull();
  });

  it("initiates touch drag when duration exceeds 150ms without movement", async () => {
    vi.useFakeTimers();
    const onDropSuccess = vi.fn();
    render(<DummyTouchDragComponent onDropSuccess={onDropSuccess} />);

    const source = screen.getByTestId("draggable-source");

    fireEvent.pointerDown(source, {
      clientX: 10,
      clientY: 10,
      pointerType: "touch",
    });

    act(() => {
      vi.advanceTimersByTime(160);
    });

    fireEvent.pointerMove(window, {
      clientX: 12,
      clientY: 12,
      pointerType: "touch",
    });

    const ghost = document.body.querySelector('[style*="position: fixed"]');
    expect(ghost).not.toBeNull();

    fireEvent.pointerUp(window, {
      clientX: 12,
      clientY: 12,
      pointerType: "touch",
    });

    vi.useRealTimers();
  });

  it("does NOT initiate touch drag for small movements under 150ms (allows standard tap)", () => {
    const onDropSuccess = vi.fn();
    render(<DummyTouchDragComponent onDropSuccess={onDropSuccess} />);

    const source = screen.getByTestId("draggable-source");

    fireEvent.pointerDown(source, {
      clientX: 10,
      clientY: 10,
      pointerType: "touch",
    });
    fireEvent.pointerMove(window, {
      clientX: 12,
      clientY: 12,
      pointerType: "touch",
    });
    fireEvent.pointerUp(window, {
      clientX: 12,
      clientY: 12,
      pointerType: "touch",
    });

    expect(onDropSuccess).not.toHaveBeenCalled();
    expect(
      document.body.querySelector('[style*="position: fixed"]')
    ).toBeNull();
  });
});

const dummyForm: CRFForm = {
  id: "form_1",
  name: "Vital Signs",
  description: "Vitals form",
  domain: "VS",
  version: "1",
  rules: [],
  sections: [
    {
      id: "sec_1",
      title: "Section 1",
      fields: [
        {
          id: "f_1",
          variableName: "SYSBP",
          label: "Systolic BP",
          dataType: "number",
          columnSpan: 6,
          required: true,
        },
        {
          id: "f_2",
          variableName: "DIABP",
          label: "Diastolic BP",
          dataType: "number",
          columnSpan: 6,
          required: true,
        },
      ],
    },
  ],
};

describe("CRF Studio Touch Drag and Drop Integration", () => {
  const dummyStudy: StudyProtocol = {
    id: "study_1",
    title: "Oncology Protocol",
    studyName: "Oncology Protocol",
    protocolId: "ONC-2026",
    protocolNumber: "PN-01",
    phase: "Phase II",
    therapeuticArea: "Oncology",
    version: "1.0",
    sponsor: "PharmaCorp",
    lastModified: new Date().toISOString(),
    forms: [dummyForm],
    codelists: [],
    visits: [
      {
        id: "visit_1",
        oid: "VISIT_1",
        name: "Screening Visit",
        targetDay: 0,
        visitType: "Scheduled",
        windowBefore: 0,
        windowAfter: 0,
        assignedFormIds: [],
      },
    ],
  };

  it("FormCanvas reorders fields when dropping a field target", () => {
    const onUpdateFormMeta = vi.fn();

    render(
      <FormCanvas
        form={dummyForm}
        selectedFieldId={null}
        viewport="desktop"
        codelists={[]}
        onChangeViewport={() => {}}
        onSelectField={() => {}}
        onUpdateFormMeta={onUpdateFormMeta}
        onAddSection={() => {}}
        onDeleteSection={() => {}}
        onUpdateSectionTitle={() => {}}
        onDuplicateField={() => {}}
        onDeleteField={() => {}}
        onOpenPalette={() => {}}
      />
    );

    const field1 = screen
      .getByText("Systolic BP")
      .closest("[draggable='true']")!;
    const field2 = screen
      .getByText("Diastolic BP")
      .closest("[draggable='true']")!;

    // Trigger drag start on field 1
    fireEvent.dragStart(field1, {
      dataTransfer: new PolyfillDataTransfer(),
    });

    // Drag over field 2 position
    fireEvent.dragOver(field2);

    // Drop onto field 2
    fireEvent.drop(field2);

    expect(onUpdateFormMeta).toHaveBeenCalled();
  });

  it("StudySpine assigns a form to a visit upon dropping", () => {
    const onAssignFormToVisit = vi.fn();

    render(
      <StudySpine
        study={dummyStudy}
        activeFormId="form_1"
        activeTab="spine"
        onChangeTab={() => {}}
        onSelectVisit={() => {}}
        onSelectForm={() => {}}
        onAddVisit={() => {}}
        onDeleteVisit={() => {}}
        onAddForm={() => {}}
        onDuplicateForm={() => {}}
        onDeleteForm={() => {}}
        onOpenCdashScaffolder={() => {}}
        onAddField={() => {}}
        onAssignFormToVisit={onAssignFormToVisit}
        onUnassignFormFromVisit={() => {}}
        onInjectCdashForm={() => {}}
      />
    );

    const visitCard = screen
      .getByText("Screening Visit")
      .closest("[onaddvisit], div")!;

    const dt = new PolyfillDataTransfer();
    dt.setData(
      "application/json",
      JSON.stringify({ type: "form", formId: "form_1" })
    );

    const dropEvent = createSynthesizedDragEvent("drop", 100, 100, dt);
    visitCard.dispatchEvent(dropEvent);

    expect(onAssignFormToVisit).toHaveBeenCalledWith("visit_1", "form_1");
  });

  it("WidgetPalette enables dragging a widget into FormCanvas", () => {
    const onUpdateFormMeta = vi.fn();

    render(
      <>
        <WidgetPalette onAddField={() => {}} />
        <FormCanvas
          form={dummyForm}
          selectedFieldId={null}
          viewport="desktop"
          codelists={[]}
          onChangeViewport={() => {}}
          onSelectField={() => {}}
          onUpdateFormMeta={onUpdateFormMeta}
          onAddSection={() => {}}
          onDeleteSection={() => {}}
          onUpdateSectionTitle={() => {}}
          onDuplicateField={() => {}}
          onDeleteField={() => {}}
          onOpenPalette={() => {}}
        />
      </>
    );

    const widgetButton = screen
      .getAllByText("Single-Line Text")[0]
      .closest("button")!;
    expect(widgetButton.getAttribute("draggable")).toBe("true");

    const dt = new PolyfillDataTransfer();
    const dragStartEvent = createSynthesizedDragEvent("dragstart", 0, 0, dt);
    widgetButton.dispatchEvent(dragStartEvent);

    const fieldElement = document.querySelector('[data-field-id="f_1"]')!;
    const dropEvent = createSynthesizedDragEvent("drop", 100, 100, dt);
    fieldElement.dispatchEvent(dropEvent);

    expect(onUpdateFormMeta).toHaveBeenCalled();
  });
});
