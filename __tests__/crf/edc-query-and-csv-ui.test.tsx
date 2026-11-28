// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { LiveEdcSimulator } from "@/components/crf/Modes/LiveEdcSimulator";
import { ExportImportModal } from "@/components/crf/Modes/ExportImportModal";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";
import {
  exportStudyToCdiscOdmXml,
  exportSimulationQueriesCsv,
  exportSimulationAuditsCsv,
  exportSimulationSubjectsCsv,
} from "@/lib/crf";
import {
  checkRegulatoryWording,
  findClinicalClaims,
} from "@/lib/clinical-platform";
import * as downloadModule from "@/lib/download";
import type { EdcSimulationState, StudyProtocol } from "@/lib/crf/types";

function setReactInputValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string
) {
  const proto =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("LiveEdcSimulator role-based query lifecycle & CSV/ODM UI controls", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    if (container.parentNode) {
      document.body.removeChild(container);
    }
    vi.restoreAllMocks();
  });

  it("supports CRA Monitor and Data Manager manual query creation, PI response with currentRole audit logging, reopen, close, and cancel", async () => {
    let latestState: EdcSimulationState | undefined;
    const handleSimUpdate = vi.fn((next: EdcSimulationState) => {
      latestState = next;
    });

    await act(async () => {
      root.render(
        <LiveEdcSimulator
          study={ONCOLOGY_RECIST_PRESET}
          onUpdateSimulationState={handleSimUpdate}
        />
      );
    });

    // Verify rendered clinical exchange panel and full container copy
    const exchangePanel = container.querySelector(
      'aside[aria-label="CDISC Clinical Data Exchange"]'
    );
    expect(exchangePanel).not.toBeNull();
    expect(checkRegulatoryWording(exchangePanel?.textContent || "")).toEqual(
      []
    );
    expect(findClinicalClaims(container.textContent || "")).toEqual([]);

    // Site Coordinator should NOT see Raise Manual Query button
    expect(
      Array.from(container.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Raise Manual Query")
      )
    ).toBeUndefined();

    // Switch to CRA Monitor role
    const craBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "CRA Monitor"
    );
    await act(async () => {
      craBtn?.click();
    });

    const raiseBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Raise Manual Query")
    );
    expect(raiseBtn).toBeDefined();

    await act(async () => {
      raiseBtn?.click();
    });

    const messageTextarea = container.querySelector(
      "#manual-query-message"
    ) as HTMLTextAreaElement;
    expect(messageTextarea).not.toBeNull();

    await act(async () => {
      setReactInputValue(
        messageTextarea,
        "Systolic BP differs from triage sheet; please confirm."
      );
    });

    const submitManualBtn = Array.from(
      container.querySelectorAll("button")
    ).find((b) => b.textContent?.trim() === "Submit Manual Query");
    expect(submitManualBtn).toBeDefined();

    await act(async () => {
      submitManualBtn?.click();
    });

    expect(latestState?.queries).toHaveLength(1);
    expect(latestState?.queries?.[0]).toMatchObject({
      status: "Open",
      message: "Systolic BP differs from triage sheet; please confirm.",
    });
    expect(latestState?.auditLog?.[0]).toMatchObject({
      userRole: "CRA Monitor",
      newValue: "Open",
    });

    // Switch to Principal Investigator to respond (verifying currentRole is recorded, not hardcoded Site Coordinator)
    const piBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Principal Investigator"
    );
    await act(async () => {
      piBtn?.click();
    });

    const respondBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Respond to Query")
    );
    expect(respondBtn).toBeDefined();

    await act(async () => {
      respondBtn?.click();
    });

    const responseTextareas = Array.from(
      container.querySelectorAll("textarea")
    );
    const answerBox = responseTextareas.at(-1)!;
    await act(async () => {
      setReactInputValue(
        answerBox,
        "Confirmed resting seated BP after 5 minutes."
      );
    });

    const submitResponseBtn = Array.from(
      container.querySelectorAll("button")
    ).find((b) => b.textContent?.includes("Submit Response"));
    await act(async () => {
      submitResponseBtn?.click();
    });

    expect(latestState?.queries?.[0]).toMatchObject({
      status: "Answered",
      respondedBy: "Dr. A. Patel, MD (PI)",
      response: "Confirmed resting seated BP after 5 minutes.",
    });
    expect(latestState?.auditLog?.[0]).toMatchObject({
      userRole: "Principal Investigator",
      previousValue: "Open",
      newValue: "Answered",
    });

    // Switch to Data Manager role to reopen, then close, and raise + cancel an open query
    const dmBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Data Manager"
    );
    await act(async () => {
      dmBtn?.click();
    });

    const reopenBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Reopen Query"
    );
    expect(reopenBtn).toBeDefined();

    await act(async () => {
      reopenBtn?.click();
    });
    expect(latestState?.queries?.[0]?.status).toBe("Open");
    expect(latestState?.auditLog?.[0]).toMatchObject({
      userRole: "Data Manager",
      previousValue: "Answered",
      newValue: "Open",
    });

    // Site Coordinator answers again
    const scBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Site Coordinator"
    );
    await act(async () => {
      scBtn?.click();
    });
    const respondAgainBtn = Array.from(
      container.querySelectorAll("button")
    ).find((b) => b.textContent?.includes("Respond to Query"));
    await act(async () => {
      respondAgainBtn?.click();
    });
    const answerBox2 = Array.from(container.querySelectorAll("textarea")).at(
      -1
    )!;
    await act(async () => {
      setReactInputValue(answerBox2, "Uploaded source vitals log.");
    });
    const submitResponseBtn2 = Array.from(
      container.querySelectorAll("button")
    ).find((b) => b.textContent?.includes("Submit Response"));
    await act(async () => {
      submitResponseBtn2?.click();
    });

    // Data Manager closes answered query with resolution note
    await act(async () => {
      dmBtn?.click();
    });
    const qId = latestState!.queries![0]!.id;
    const noteInput = container.querySelector(
      `input[aria-label="Resolution note for query ${qId}"]`
    ) as HTMLInputElement;
    expect(noteInput).not.toBeNull();
    await act(async () => {
      setReactInputValue(noteInput, "Vitals log verified by DM");
    });

    const closeBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Close Query")
    );
    expect(closeBtn).toBeDefined();
    await act(async () => {
      closeBtn?.click();
    });

    expect(latestState?.queries?.[0]).toMatchObject({
      status: "Closed",
      resolvedBy: "K. Lin, CCDM (Data Manager)",
      resolutionReason: "Vitals log verified by DM",
    });
    expect(latestState?.auditLog?.[0]).toMatchObject({
      userRole: "Data Manager",
      previousValue: "Answered",
      newValue: "Closed",
    });

    // Data Manager raises a second manual query and cancels it while Open
    const raiseBtnDm = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Raise Manual Query")
    );
    await act(async () => {
      raiseBtnDm?.click();
    });
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    await act(async () => {
      raiseBtnDm?.click();
    });
    const subjectSelect = container.querySelector(
      "#manual-query-subject"
    ) as HTMLSelectElement;
    if (subjectSelect.options[0]) {
      await act(async () => {
        setReactInputValue(subjectSelect, subjectSelect.options[0]!.value);
      });
    }
    const visitSelect = container.querySelector(
      "#manual-query-visit"
    ) as HTMLSelectElement;
    if (visitSelect.options[1]) {
      await act(async () => {
        setReactInputValue(visitSelect, visitSelect.options[1]!.value);
      });
    }
    const formSelect = container.querySelector(
      "#manual-query-form"
    ) as HTMLSelectElement;
    if (ONCOLOGY_RECIST_PRESET.forms[1]) {
      await act(async () => {
        setReactInputValue(formSelect, ONCOLOGY_RECIST_PRESET.forms[1]!.id);
      });
    }
    const fieldSelect = container.querySelector(
      "#manual-query-field"
    ) as HTMLSelectElement;
    if (fieldSelect.options[1]) {
      await act(async () => {
        setReactInputValue(fieldSelect, fieldSelect.options[1]!.value);
      });
    }
    const severitySelect = container.querySelector(
      "#manual-query-severity"
    ) as HTMLSelectElement;
    await act(async () => {
      setReactInputValue(severitySelect, "error");
    });
    const modalCancelBtn = Array.from(
      container.querySelectorAll("button")
    ).find((b) => b.textContent?.trim() === "Cancel");
    await act(async () => {
      modalCancelBtn?.click();
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();

    await act(async () => {
      raiseBtnDm?.click();
    });
    const messageTextarea2 = container.querySelector(
      "#manual-query-message"
    ) as HTMLTextAreaElement;
    await act(async () => {
      setReactInputValue(messageTextarea2, "Accidental duplicate query");
    });
    const submitManualBtn2 = Array.from(
      container.querySelectorAll("button")
    ).find((b) => b.textContent?.trim() === "Submit Manual Query");
    await act(async () => {
      submitManualBtn2?.click();
    });

    const cancelBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Cancel Query"
    );
    expect(cancelBtn).toBeDefined();
    await act(async () => {
      cancelBtn?.click();
    });

    const cancelledQuery = latestState?.queries?.find(
      (q) => q.message === "Accidental duplicate query"
    );
    expect(cancelledQuery?.status).toBe("Cancelled");
    expect(latestState?.auditLog?.[0]).toMatchObject({
      userRole: "Data Manager",
      previousValue: "Open",
      newValue: "Cancelled",
    });
  });

  it("exports and imports ODM-XML and RFC 4180 CSVs from LiveEdcSimulator and ExportImportModal", async () => {
    const downloadSpy = vi
      .spyOn(downloadModule, "downloadFile")
      .mockImplementation(() => true);

    let liveSimState: EdcSimulationState | undefined;
    await act(async () => {
      root.render(
        <LiveEdcSimulator
          study={ONCOLOGY_RECIST_PRESET}
          onUpdateSimulationState={(s) => {
            liveSimState = s;
          }}
        />
      );
    });

    const exportPrimaryBtn = () =>
      Array.from(container.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Export ")
      );

    // Export default CDISC ODM-XML first, then SAS and R live scripts
    await act(async () => {
      exportPrimaryBtn()?.click();
    });
    expect(downloadSpy).toHaveBeenLastCalledWith(
      expect.stringContaining("<ODM"),
      expect.stringContaining("-clinical-odm.xml"),
      { mimeType: "application/xml" }
    );

    const statTabBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "SAS / R Script"
    );
    await act(async () => {
      statTabBtn?.click();
    });
    await act(async () => {
      exportPrimaryBtn()?.click();
    });
    expect(downloadSpy).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.stringContaining("-live.sas"),
      { mimeType: "text/x-sas" }
    );
    const rLangBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "R (tibble)"
    );
    await act(async () => {
      rLangBtn?.click();
    });
    await act(async () => {
      exportPrimaryBtn()?.click();
    });
    expect(downloadSpy).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.stringContaining("-live.R"),
      { mimeType: "text/x-r" }
    );
    const sasLangBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "SAS (CARDS;)"
    );
    await act(async () => {
      sasLangBtn?.click();
    });

    const odmTabBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "CDISC ODM-XML"
    );
    await act(async () => {
      odmTabBtn?.click();
    });

    // Switch exchange panel to RFC 4180 CSV and export Subjects, Queries, Audits
    const csvTabBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "RFC 4180 CSV"
    );
    expect(csvTabBtn).toBeDefined();
    await act(async () => {
      csvTabBtn?.click();
    });

    await act(async () => {
      exportPrimaryBtn()?.click();
    });
    expect(downloadSpy).toHaveBeenLastCalledWith(
      expect.stringContaining("STUDYID,SUBJECT_ID,VISIT_ID"),
      expect.stringContaining("-subjects.csv"),
      { mimeType: "text/csv" }
    );

    const queriesCsvBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Queries CSV"
    );
    await act(async () => {
      queriesCsvBtn?.click();
    });
    await act(async () => {
      exportPrimaryBtn()?.click();
    });
    expect(downloadSpy).toHaveBeenLastCalledWith(
      expect.stringContaining("QUERY_ID,SUBJECT_ID"),
      expect.stringContaining("-queries.csv"),
      { mimeType: "text/csv" }
    );

    const auditsCsvBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim() === "Audits CSV"
    );
    await act(async () => {
      auditsCsvBtn?.click();
    });
    await act(async () => {
      exportPrimaryBtn()?.click();
    });
    expect(downloadSpy).toHaveBeenLastCalledWith(
      expect.stringContaining("AUDIT_ID,TIMESTAMP"),
      expect.stringContaining("-audits.csv"),
      { mimeType: "text/csv" }
    );

    // Import an ODM-XML file into LiveEdcSimulator
    const sourceStudyWithSim: StudyProtocol = {
      ...ONCOLOGY_RECIST_PRESET,
      auditTrail: [],
      simulationState: {
        availableSubjects: ["009-999"],
        formValues: {
          [`009-999_${ONCOLOGY_RECIST_PRESET.visits[0]!.id}_${ONCOLOGY_RECIST_PRESET.forms[0]!.sections[0]!.fields[0]!.id}`]: 1975,
        },
        auditLog: [],
        signatures: [],
        queries: [],
      },
    };
    const xmlPayload = exportStudyToCdiscOdmXml(sourceStudyWithSim);
    const liveFileInput = container.querySelector(
      'input[aria-label="Import ODM-XML or RFC 4180 CSV file"]'
    ) as HTMLInputElement;
    expect(liveFileInput).not.toBeNull();

    const xmlFile = new File([xmlPayload], "study-import.xml", {
      type: "application/xml",
    });
    Object.defineProperty(liveFileInput, "files", {
      value: [xmlFile],
      configurable: true,
    });
    await act(async () => {
      liveFileInput.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(liveSimState?.availableSubjects).toContain("009-999");

    // Now render ExportImportModal and verify RFC 4180 CSV export and import controls
    let modalUpdatedSim: EdcSimulationState | undefined;
    await act(async () => {
      root.render(
        <ExportImportModal
          study={sourceStudyWithSim}
          onImportStudy={vi.fn()}
          onUpdateSimulationState={(s) => {
            modalUpdatedSim = s;
          }}
        />
      );
    });

    const modalExportSubjectsBtn = Array.from(
      container.querySelectorAll("button")
    ).find((b) => b.textContent?.includes("Export Subjects CSV"));
    expect(modalExportSubjectsBtn).toBeDefined();

    const csvCardClone = container
      .querySelector('[data-testid="clinical-csv-exchange-card"]')
      ?.cloneNode(true) as HTMLElement | undefined;
    csvCardClone?.querySelector('[data-testid="no-phi-notice"]')?.remove();
    expect(checkRegulatoryWording(csvCardClone?.textContent || "")).toEqual([]);
    expect(findClinicalClaims(container.textContent || "")).toEqual([]);
    await act(async () => {
      modalExportSubjectsBtn?.click();
    });
    expect(downloadSpy).toHaveBeenLastCalledWith(
      expect.stringContaining("009-999"),
      expect.stringContaining("-subjects.csv"),
      { mimeType: "text/csv" }
    );

    // Import Queries CSV via ExportImportModal
    const sampleQueriesCsv = exportSimulationQueriesCsv({
      ...ONCOLOGY_RECIST_PRESET,
      simulationState: {
        availableSubjects: ["009-999"],
        formValues: {},
        queries: [
          {
            id: "qry_csv_modal_1",
            subjectId: "009-999",
            visitId: ONCOLOGY_RECIST_PRESET.visits[0]!.id,
            formId: ONCOLOGY_RECIST_PRESET.forms[0]!.id,
            fieldId:
              ONCOLOGY_RECIST_PRESET.forms[0]!.sections[0]!.fields[0]!.id,
            fieldName: "BRTHYR",
            severity: "warning",
            status: "Open",
            message: "Imported from RFC 4180 CSV",
            raisedBy: "K. Lin, CCDM (Data Manager)",
            raisedAt: "2026-10-01T10:00:00Z",
          },
        ],
      },
    });

    const modalCsvInput = container.querySelector(
      'input[aria-label="Import Clinical Data CSV file"]'
    ) as HTMLInputElement;
    expect(modalCsvInput).not.toBeNull();
    const csvFile = new File([sampleQueriesCsv], "queries.csv", {
      type: "text/csv",
    });
    Object.defineProperty(modalCsvInput, "files", {
      value: [csvFile],
      configurable: true,
    });
    await act(async () => {
      modalCsvInput.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(modalUpdatedSim?.queries?.[0]).toMatchObject({
      id: "qry_csv_modal_1",
      message: "Imported from RFC 4180 CSV",
    });

    expect(exportSimulationSubjectsCsv(sourceStudyWithSim)).toContain(
      "009-999"
    );
    expect(exportSimulationAuditsCsv(sourceStudyWithSim)).toContain("AUDIT_ID");
  });
});
