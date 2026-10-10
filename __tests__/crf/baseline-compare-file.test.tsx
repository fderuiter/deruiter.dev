import React from "react";
import { fromPartial } from "@total-typescript/shoehorn";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { BaselineCompareModal } from "@/components/crf/BaselineCompareModal";
import type { StudyProtocol } from "@/lib/crf/types";

type Parse = typeof import("@/lib/crf/file-ingestion").detectAndParseStudyFile;

// Stands in for the parser unless a test leaves `stub` empty, in which case
// the real parser runs.
const parser = vi.hoisted(() => ({
  stub: null as null | ((...args: unknown[]) => unknown),
  calls: [] as unknown[][],
}));
vi.mock("@/lib/crf/file-ingestion", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/crf/file-ingestion")>();
  return {
    ...original,
    detectAndParseStudyFile: ((...args: Parameters<Parse>) => {
      parser.calls.push(args);
      return parser.stub
        ? parser.stub(...args)
        : original.detectAndParseStudyFile(...args);
    }) as Parse,
  };
});

function makeStudy(id: string, label: string): StudyProtocol {
  return {
    id,
    protocolNumber: "P-1",
    studyName: "Study",
    phase: "Phase I",
    sponsor: "Acme",
    therapeuticArea: "Oncology",
    version: "1.0",
    lastModified: "2026-01-01T00:00:00.000Z",
    forms: [
      {
        id: `${id}-form`,
        name: "Vital Signs",
        domain: "VS",
        description: "",
        version: "1.0",
        sections: [
          {
            id: `${id}-sec`,
            title: "Vitals",
            fields: [
              {
                id: `${id}-fld`,
                variableName: "SYSBP",
                label,
                dataType: "number",
                columnSpan: 4,
                required: false,
              },
            ],
          },
        ],
        rules: [],
      },
    ],
    visits: [],
    codelists: [],
  };
}

function renderModal() {
  const storage = new Map<string, string>();
  return render(
    <BaselineCompareModal
      isOpen={true}
      onClose={vi.fn()}
      study={makeStudy("mine", "Systolic")}
      onSelectBaseline={vi.fn()}
      onNavigate={vi.fn()}
      storage={fromPartial<Storage>({
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => void storage.set(k, v),
        removeItem: (k: string) => void storage.delete(k),
      })}
    />
  );
}

async function pick(file: File) {
  fireEvent.click(screen.getByRole("button", { name: "Study file" }));
  const input = screen.getByLabelText(/Study file \(JSON, XML or CSV\)/i);
  fireEvent.change(input, { target: { files: [file] } });
}

describe("Baseline comparison against a study file", () => {
  beforeEach(() => {
    parser.stub = null;
    parser.calls = [];
  });
  afterEach(cleanup);

  it("switches to the file source and asks for a file", () => {
    renderModal();
    expect(
      screen
        .getByRole("button", { name: "Saved baseline" })
        .getAttribute("aria-pressed")
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Study file" }));
    expect(
      screen.getByText(/Choose a study file above to compare/i)
    ).toBeTruthy();
  });

  it("compares the draft with a file from another study", async () => {
    parser.stub = () => ({
      study: makeStudy("theirs", "Systolic BP"),
      fileName: "theirs.json",
      formatLabel: "Universal CRF",
    });
    renderModal();
    await pick(new File(["{}"], "theirs.json", { type: "application/json" }));
    await waitFor(() => expect(parser.calls).toHaveLength(1));
    expect(parser.calls[0][1]).toBe("theirs.json");
    // Different study ids, same field name: one modified entry, not add + remove.
    expect(await screen.findByText(/Modified/)).toBeTruthy();
    expect(screen.queryByText(/^Added$/)).toBeNull();
    expect(screen.queryByText(/^Removed$/)).toBeNull();
  });

  it("says so when the file matches the draft", async () => {
    parser.stub = () => ({
      study: makeStudy("theirs", "Systolic"),
      fileName: "same.json",
      formatLabel: "Universal CRF",
    });
    renderModal();
    await pick(new File(["{}"], "same.json"));
    expect(await screen.findByText("No differences detected")).toBeTruthy();
    expect(screen.getByText("same.json")).toBeTruthy();
  });

  it("shows the parser's message for a bad file and keeps no comparison", async () => {
    renderModal();
    await pick(new File(["   "], "bad.json"));
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /Cannot parse empty file content/
    );
    expect(screen.getByText(/Choose a study file above/i)).toBeTruthy();
  });

  it("rejects an oversized file without reading it", async () => {
    renderModal();
    const big = new File(["x"], "big.json");
    Object.defineProperty(big, "size", { value: 60 * 1024 * 1024 });
    await pick(big);
    expect((await screen.findByRole("alert")).textContent).toMatch(/50MB/);
    expect(parser.calls).toHaveLength(0);
  });

  it("disables the exports until a file has been compared", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Study file" }));
    expect(
      (screen.getByRole("button", { name: "Export CSV" }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });
});
