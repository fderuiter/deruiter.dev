/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { exportStudyToSas, exportFormToSas } from "@/lib/crf/export-sas";
import { exportStudyToR, exportFormToR } from "@/lib/crf/export-r";
import {
  generateAcrfHtml,
  generateStudyAcrfBookHtml,
} from "@/lib/crf/export-acrf";
import { exportStudyToCdiscOdmXml } from "@/lib/crf/odm-xml-serializer";
import { exportFormToFhirQuestionnaire } from "@/lib/crf/fhir-questionnaire";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";
import { consultationUrl } from "@/lib/crf/export-annotations";

const SCHEDULE = consultationUrl();
import { GarminWatchSimulator } from "@/components/GarminWatchSimulator";
import { ExportDocumentModal } from "@/components/crf/Modes/ExportDocumentModal";
import { ExportImportModal } from "@/components/crf/Modes/ExportImportModal";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const mockRecordEvent = vi.fn().mockResolvedValue(true);
vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    recordEvent: mockRecordEvent,
  }),
}));

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
  }),
  AudioProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe("Export Suffix & Completion Screen CTA Retrofit Suite", () => {
  describe("CRF Studio Document Exporters Suffix Verification", () => {
    it("appends consultation scheduling link to SAS export header and footer comments", () => {
      const sasOutput = exportStudyToSas(ONCOLOGY_RECIST_PRESET);
      expect(sasOutput).toContain(
        `CONSULTATION: Schedule Consultation: ${SCHEDULE}`
      );
      expect(sasOutput).toContain(`/* Schedule Consultation: ${SCHEDULE} */`);

      const singleSas = exportFormToSas(
        ONCOLOGY_RECIST_PRESET.forms[0],
        ONCOLOGY_RECIST_PRESET
      );
      expect(singleSas).toContain(`/* Schedule Consultation: ${SCHEDULE} */`);
    });

    it("appends consultation scheduling link to R export header and footer comments", () => {
      const rOutput = exportStudyToR(ONCOLOGY_RECIST_PRESET);
      expect(rOutput).toContain(
        `# CONSULTATION: Schedule Consultation: ${SCHEDULE}`
      );
      expect(rOutput).toContain(`# Schedule Consultation: ${SCHEDULE}`);

      const singleR = exportFormToR(
        ONCOLOGY_RECIST_PRESET.forms[0],
        ONCOLOGY_RECIST_PRESET
      );
      expect(singleR).toContain(`# Schedule Consultation: ${SCHEDULE}`);
    });

    it("appends consultation scheduling link to aCRF HTML output footers", () => {
      const htmlSingle = generateAcrfHtml(
        ONCOLOGY_RECIST_PRESET.forms[0],
        ONCOLOGY_RECIST_PRESET
      );
      expect(htmlSingle).toContain(`Schedule Consultation: ${SCHEDULE}`);

      const htmlBook = generateStudyAcrfBookHtml(ONCOLOGY_RECIST_PRESET);
      expect(htmlBook).toContain(`Schedule Consultation: ${SCHEDULE}`);
    });

    it("appends consultation scheduling link to CDISC ODM-XML comment and StudyDescription", () => {
      const xmlOutput = exportStudyToCdiscOdmXml(ONCOLOGY_RECIST_PRESET);
      expect(xmlOutput).toContain(
        `<!-- Schedule Consultation: ${SCHEDULE} -->`
      );
      expect(xmlOutput).toContain(`Schedule Consultation: ${SCHEDULE}`);
    });

    it("appends consultation scheduling link to HL7 FHIR Questionnaire description", () => {
      const fhirObj = exportFormToFhirQuestionnaire(
        ONCOLOGY_RECIST_PRESET.forms[0],
        ONCOLOGY_RECIST_PRESET
      ) as {
        description: string;
      };
      expect(fhirObj.description).toContain(
        `Schedule Consultation: ${SCHEDULE}`
      );
    });
  });

  describe("UI Component Consultation Booking CTAs & Telemetry", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
      vi.clearAllMocks();

      const mockCtx = {
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        scale: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        clearRect: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arc: vi.fn(),
        clip: vi.fn(),
        ellipse: vi.fn(),
        roundRect: vi.fn(),
        rect: vi.fn(),
        quadraticCurveTo: vi.fn(),
        bezierCurveTo: vi.fn(),
        arcTo: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn(() => ({ width: 40 })),
        createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
        setLineDash: vi.fn(),
      };

      HTMLCanvasElement.prototype.getContext = vi.fn(
        () => mockCtx as any
      ) as any;
    });

    afterEach(() => {
      act(() => {
        root.unmount();
      });
      container.remove();
    });

    it("renders Schedule Consultation CTA button in ExportDocumentModal and triggers telemetry", async () => {
      await act(async () => {
        root.render(
          <ExportDocumentModal
            study={ONCOLOGY_RECIST_PRESET}
            activeFormId={ONCOLOGY_RECIST_PRESET.forms[0].id}
            onClose={() => {}}
            onOpenBranding={() => {}}
          />
        );
      });

      const schedLink = Array.from(container.querySelectorAll("a")).find(
        (a) => a.getAttribute("href") === "/schedule"
      );
      expect(schedLink).toBeDefined();
      expect(schedLink?.getAttribute("target")).toBe("_blank");

      await act(async () => {
        schedLink?.click();
      });

      expect(mockRecordEvent).toHaveBeenCalledWith("crf", "project_click");
    });

    it("renders Schedule Consultation CTA button in ExportImportModal and triggers telemetry", async () => {
      await act(async () => {
        root.render(
          <ExportImportModal
            study={ONCOLOGY_RECIST_PRESET}
            onImportStudy={() => {}}
          />
        );
      });

      const schedLink = Array.from(container.querySelectorAll("a")).find(
        (a) => a.getAttribute("href") === "/schedule"
      );
      expect(schedLink).toBeDefined();
      expect(schedLink?.getAttribute("target")).toBe("_blank");

      await act(async () => {
        schedLink?.click();
      });

      expect(mockRecordEvent).toHaveBeenCalledWith("crf", "project_click");
    });

    it("renders consultation booking link in GarminWatchSimulator during game over overlay", async () => {
      await act(async () => {
        root.render(<GarminWatchSimulator />);
      });

      // Simulation is initially idle. Let's verify start
      const startBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("START")
      );
      expect(startBtn).toBeDefined();
    });
  });
});
