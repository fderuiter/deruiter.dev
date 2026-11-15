import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { DatasetViewer } from "@/components/study-data/DatasetViewer";
import type { DatasetSummary, RowWindow } from "@/components/study-data/protocol";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const MOCK_DATASETS: readonly DatasetSummary[] = [
  {
    key: "sdtm:DM",
    name: "DM",
    label: "Demographics",
    layer: "sdtm",
    datasetClass: "Special Purpose",
    keys: ["STUDYID", "USUBJID"],
    rowCount: 3,
    variables: [
      { name: "STUDYID", label: "Study Identifier", type: "text" },
      { name: "USUBJID", label: "Unique Subject Identifier", type: "text" },
      { name: "AGE", label: "Age", type: "integer" },
      { name: "SEX", label: "Sex", type: "text" },
      { name: "ARM", label: "Description of Planned Arm", type: "text" },
    ],
  },
  {
    key: "sdtm:AE",
    name: "AE",
    label: "Adverse Events",
    layer: "sdtm",
    datasetClass: "Events",
    keys: ["STUDYID", "USUBJID", "AESEQ"],
    rowCount: 2,
    variables: [
      { name: "STUDYID", label: "Study Identifier", type: "text" },
      { name: "USUBJID", label: "Unique Subject Identifier", type: "text" },
      { name: "AETERM", label: "Reported Term for the Adverse Event", type: "text" },
      { name: "AESEV", label: "Severity/Intensity", type: "text" },
    ],
  },
];

const DM_ROWS = [
  ["DEMO-301", "DEMO-301-001", 45, "M", "Placebo"],
  ["DEMO-301", "DEMO-301-002", 52, "F", "Active 50mg"],
  ["DEMO-301", "DEMO-301-003", 61, "M", "Active 100mg"],
];

const AE_ROWS = [
  ["DEMO-301", "DEMO-301-001", "Headache", "MILD"],
  ["DEMO-301", "DEMO-301-002", "Nausea", "MODERATE"],
];

function createMockLoadRows() {
  return vi.fn((key: string, offset: number, limit: number): Promise<RowWindow> => {
    const allRows = key === "sdtm:AE" ? AE_ROWS : DM_ROWS;
    return Promise.resolve({
      key,
      offset,
      rows: allRows.slice(offset, offset + limit),
    });
  });
}

describe("DatasetViewer", () => {
  it("renders table rows and columns from loaded dataset", async () => {
    const loadRows = createMockLoadRows();
    const onTrace = vi.fn();
    const onSelectKey = vi.fn();

    await act(async () => {
      render(
        <DatasetViewer
          runId={1}
          datasets={MOCK_DATASETS}
          selectedKey="sdtm:DM"
          onSelectKey={onSelectKey}
          loadRows={loadRows}
          onTrace={onTrace}
          tracedRow={null}
          reveal={null}
        />
      );
    });

    // Check header columns
    expect(screen.getByRole("columnheader", { name: "USUBJID" })).not.toBeNull();
    expect(screen.getByRole("columnheader", { name: "AGE" })).not.toBeNull();

    // Check initial rows rendered
    expect(screen.getByText("DEMO-301-001")).not.toBeNull();
    expect(screen.getByText("DEMO-301-002")).not.toBeNull();
    expect(screen.getByText("DEMO-301-003")).not.toBeNull();

    // Search input and clear button exist
    const searchInput = screen.getByRole("searchbox", { name: /search rows/i }) as HTMLInputElement;
    expect(searchInput.value).toBe("");

    const clearButton = screen.getByRole("button", { name: /clear/i }) as HTMLButtonElement;
    expect(clearButton.disabled).toBe(true);
  });

  it("debounces query input by 200ms before filtering rows", async () => {
    vi.useFakeTimers();
    const loadRows = createMockLoadRows();

    await act(async () => {
      render(
        <DatasetViewer
          runId={1}
          datasets={MOCK_DATASETS}
          selectedKey="sdtm:DM"
          onSelectKey={vi.fn()}
          loadRows={loadRows}
          onTrace={vi.fn()}
          tracedRow={null}
          reveal={null}
        />
      );
    });

    const searchInput = screen.getByRole("searchbox", { name: /search rows/i }) as HTMLInputElement;

    // Type query
    act(() => {
      fireEvent.change(searchInput, { target: { value: "002" } });
    });

    // Immediately, the input reflects the query, but rows are not yet filtered
    expect(searchInput.value).toBe("002");
    expect(screen.queryByText("DEMO-301-001")).not.toBeNull();
    expect(screen.queryByText("DEMO-301-002")).not.toBeNull();
    expect(screen.queryByText("DEMO-301-003")).not.toBeNull();

    // Advance 100ms: still not filtered
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.queryByText("DEMO-301-001")).not.toBeNull();

    // Advance remaining 100ms (total 200ms): filter applies
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.queryByText("DEMO-301-001")).toBeNull();
    expect(screen.getByText("DEMO-301-002")).not.toBeNull();
    expect(screen.queryByText("DEMO-301-003")).toBeNull();

    // Match count badge is rendered
    const badge = screen.getByLabelText("Match count");
    expect(badge.textContent).toContain("1 of 3 rows (1 match)");
  });

  it("filters rows by USUBJID and variable values in place", async () => {
    vi.useFakeTimers();
    const loadRows = createMockLoadRows();

    await act(async () => {
      render(
        <DatasetViewer
          runId={1}
          datasets={MOCK_DATASETS}
          selectedKey="sdtm:DM"
          onSelectKey={vi.fn()}
          loadRows={loadRows}
          onTrace={vi.fn()}
          tracedRow={null}
          reveal={null}
        />
      );
    });

    const searchInput = screen.getByRole("searchbox", { name: /search rows/i });

    // Search by planned arm "Placebo"
    act(() => {
      fireEvent.change(searchInput, { target: { value: "Placebo" } });
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByText("DEMO-301-001")).not.toBeNull();
    expect(screen.queryByText("DEMO-301-002")).toBeNull();
    expect(screen.queryByText("DEMO-301-003")).toBeNull();

    // Search by age "52"
    act(() => {
      fireEvent.change(searchInput, { target: { value: "52" } });
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByText("DEMO-301-001")).toBeNull();
    expect(screen.getByText("DEMO-301-002")).not.toBeNull();
    expect(screen.queryByText("DEMO-301-003")).toBeNull();
  });

  it("clears query and restores full table display when clicking clear button", async () => {
    vi.useFakeTimers();
    const loadRows = createMockLoadRows();

    await act(async () => {
      render(
        <DatasetViewer
          runId={1}
          datasets={MOCK_DATASETS}
          selectedKey="sdtm:DM"
          onSelectKey={vi.fn()}
          loadRows={loadRows}
          onTrace={vi.fn()}
          tracedRow={null}
          reveal={null}
        />
      );
    });

    const searchInput = screen.getByRole("searchbox", { name: /search rows/i }) as HTMLInputElement;
    const clearButton = screen.getByRole("button", { name: /clear/i }) as HTMLButtonElement;

    act(() => {
      fireEvent.change(searchInput, { target: { value: "001" } });
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByText("DEMO-301-002")).toBeNull();
    expect(clearButton.disabled).toBe(false);

    // Click clear
    act(() => {
      fireEvent.click(clearButton);
    });

    expect(searchInput.value).toBe("");
    expect(clearButton.disabled).toBe(true);

    // All rows are restored immediately
    expect(screen.getByText("DEMO-301-001")).not.toBeNull();
    expect(screen.getByText("DEMO-301-002")).not.toBeNull();
    expect(screen.getByText("DEMO-301-003")).not.toBeNull();
  });

  it("clears query when Escape key is pressed in the search input", async () => {
    vi.useFakeTimers();
    const loadRows = createMockLoadRows();

    await act(async () => {
      render(
        <DatasetViewer
          runId={1}
          datasets={MOCK_DATASETS}
          selectedKey="sdtm:DM"
          onSelectKey={vi.fn()}
          loadRows={loadRows}
          onTrace={vi.fn()}
          tracedRow={null}
          reveal={null}
        />
      );
    });

    const searchInput = screen.getByRole("searchbox", { name: /search rows/i }) as HTMLInputElement;

    act(() => {
      fireEvent.change(searchInput, { target: { value: "002" } });
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByText("DEMO-301-001")).toBeNull();

    act(() => {
      fireEvent.keyDown(searchInput, { key: "Escape" });
    });

    expect(searchInput.value).toBe("");
    expect(screen.getByText("DEMO-301-001")).not.toBeNull();
    expect(screen.getByText("DEMO-301-002")).not.toBeNull();
  });

  it("shows polite empty state message on empty results without breaking navigation", async () => {
    vi.useFakeTimers();
    const loadRows = createMockLoadRows();

    await act(async () => {
      render(
        <DatasetViewer
          runId={1}
          datasets={MOCK_DATASETS}
          selectedKey="sdtm:DM"
          onSelectKey={vi.fn()}
          loadRows={loadRows}
          onTrace={vi.fn()}
          tracedRow={null}
          reveal={null}
        />
      );
    });

    const searchInput = screen.getByRole("searchbox", { name: /search rows/i });

    act(() => {
      fireEvent.change(searchInput, { target: { value: "UNKNOWN_SUBJECT" } });
      vi.advanceTimersByTime(200);
    });

    // Empty state message is shown
    expect(screen.getByText(/No records matching “UNKNOWN_SUBJECT”/)).not.toBeNull();

    // Badge reflects 0 matches
    const badge = screen.getByLabelText("Match count");
    expect(badge.textContent).toContain("0 of 3 rows (0 matches)");

    // Grid arrow key navigation still functions without error
    const grid = screen.getByRole("grid");
    expect(() => {
      fireEvent.keyDown(grid, { key: "ArrowRight" });
      fireEvent.keyDown(grid, { key: "ArrowLeft" });
      fireEvent.keyDown(grid, { key: "ArrowDown" });
      fireEvent.keyDown(grid, { key: "ArrowUp" });
    }).not.toThrow();
  });

  it("clears search query when switching datasets", async () => {
    vi.useFakeTimers();
    const loadRows = createMockLoadRows();
    const onSelectKey = vi.fn();

    const { rerender } = render(
      <DatasetViewer
        runId={1}
        datasets={MOCK_DATASETS}
        selectedKey="sdtm:DM"
        onSelectKey={onSelectKey}
        loadRows={loadRows}
        onTrace={vi.fn()}
        tracedRow={null}
        reveal={null}
      />
    );

    // Initial load
    await act(async () => {
      vi.runAllTimers();
    });

    const searchInput = screen.getByRole("searchbox", { name: /search rows/i }) as HTMLInputElement;

    act(() => {
      fireEvent.change(searchInput, { target: { value: "001" } });
      vi.advanceTimersByTime(200);
    });

    expect(searchInput.value).toBe("001");

    // Change dataset via select
    const select = screen.getByLabelText("Dataset");
    act(() => {
      fireEvent.change(select, { target: { value: "sdtm:AE" } });
    });

    expect(onSelectKey).toHaveBeenCalledWith("sdtm:AE");

    // Parent updates selectedKey prop
    await act(async () => {
      rerender(
        <DatasetViewer
          runId={1}
          datasets={MOCK_DATASETS}
          selectedKey="sdtm:AE"
          onSelectKey={onSelectKey}
          loadRows={loadRows}
          onTrace={vi.fn()}
          tracedRow={null}
          reveal={null}
        />
      );
      vi.runAllTimers();
    });

    // Query is cleared
    expect(searchInput.value).toBe("");
    expect(screen.getByText("Headache")).not.toBeNull();
    expect(screen.getByText("Nausea")).not.toBeNull();
  });

  it("traces original dataset row index when row is clicked or Enter is pressed", async () => {
    vi.useFakeTimers();
    const loadRows = createMockLoadRows();
    const onTrace = vi.fn();

    await act(async () => {
      render(
        <DatasetViewer
          runId={1}
          datasets={MOCK_DATASETS}
          selectedKey="sdtm:DM"
          onSelectKey={vi.fn()}
          loadRows={loadRows}
          onTrace={onTrace}
          tracedRow={null}
          reveal={null}
        />
      );
    });

    const searchInput = screen.getByRole("searchbox", { name: /search rows/i });

    // Filter to only row index 1 ("DEMO-301-002")
    act(() => {
      fireEvent.change(searchInput, { target: { value: "002" } });
      vi.advanceTimersByTime(200);
    });

    // Click the matching cell
    const cell = screen.getByText("DEMO-301-002");
    act(() => {
      fireEvent.click(cell);
    });

    // onTrace called with original dataset row index (1)
    expect(onTrace).toHaveBeenCalledWith("sdtm", "DM", 1);

    // Also test Enter key navigation on active row
    const grid = screen.getByRole("grid");
    onTrace.mockClear();

    act(() => {
      fireEvent.keyDown(grid, { key: "Enter" });
    });

    expect(onTrace).toHaveBeenCalledWith("sdtm", "DM", 1);
  });

  it("outputs rendered markup for visual inspection", async () => {
    vi.useFakeTimers();
    const loadRows = createMockLoadRows();
    const { container } = render(
      <DatasetViewer
        runId={1}
        datasets={MOCK_DATASETS}
        selectedKey="sdtm:DM"
        onSelectKey={vi.fn()}
        loadRows={loadRows}
        onTrace={vi.fn()}
        tracedRow={null}
        reveal={null}
      />
    );

    await act(async () => {
      vi.runAllTimers();
    });

    const wrap = (html: string) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>body { background: #0d0e11; color: #f4f4f6; padding: 2rem; }</style>
</head>
<body>
  <div class="max-w-4xl mx-auto p-4 bg-[#13151a] border border-white/10 rounded">${html}</div>
</body>
</html>`;

    const fs = await import("fs");
    fs.writeFileSync("/tmp/screen-initial.html", wrap(container.innerHTML));

    const searchInput = screen.getByRole("searchbox", { name: /search rows/i });
    act(() => {
      fireEvent.change(searchInput, { target: { value: "002" } });
      vi.advanceTimersByTime(200);
    });
    fs.writeFileSync("/tmp/screen-filtered.html", wrap(container.innerHTML));

    act(() => {
      fireEvent.change(searchInput, { target: { value: "NO_MATCH" } });
      vi.advanceTimersByTime(200);
    });
    fs.writeFileSync("/tmp/screen-empty.html", wrap(container.innerHTML));
  });
});
