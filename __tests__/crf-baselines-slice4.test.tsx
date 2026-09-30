import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  StudyProtocolEngine,
  saveStudyBaseline,
  listStudyBaselines,
  getStudyBaseline,
  restoreBaselineAsDraft,
  deleteStudyBaseline,
  clearStudyBaselines,
  exportBaselinesBundle,
  importBaselinesBundle,
  incrementStudyVersion,
  computeStudyChecksum,
  STUDY_BASELINES_STORAGE_KEY,
  STUDY_BASELINES_CORRUPT_BACKUP_KEY,
} from "@/lib/crf/study-engine";
import { BaselineManagerModal } from "@/components/crf/BaselineManagerModal";
import type { StudyProtocol, CRFForm } from "@/lib/crf/types";

class MockStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe("CRF Features Track 3 Slice 4: Save Named Baselines & Restore Into New Draft (#672)", () => {
  afterEach(() => {
    cleanup();
  });

  const buildTestStudy = (): StudyProtocol => {
    const initial = StudyProtocolEngine.createInitialStudy();
    const demographicsForm: CRFForm = {
      id: "form_dm_1",
      name: "Demographics",
      domain: "DM",
      description: "Subject demographic assessments",
      version: "1.0",
      sections: [
        {
          id: "sec_dm_1",
          title: "Demographics Section",
          fields: [
            {
              id: "fld_age",
              variableName: "AGE",
              label: "Age in Years",
              dataType: "integer",
              required: true,
              columnSpan: 6,
            },
            {
              id: "fld_sex",
              variableName: "SEX",
              label: "Sex Assigned at Birth",
              dataType: "single_select",
              required: true,
              columnSpan: 6,
            },
          ],
        },
      ],
      rules: [],
    };

    return {
      ...initial,
      protocolNumber: "ONC-2026-TEST",
      studyName: "Phase III Immuno-Oncology Study",
      version: "1.0",
      forms: [demographicsForm],
    };
  };

  describe("1. Baseline Creation, Metadata & Deep-Clone Immutability", () => {
    it("persists an immutable baseline snapshot with version identity, timestamps, and actor metadata", () => {
      const storage = new MockStorage();
      const study = buildTestStudy();

      const saveRes = saveStudyBaseline(
        study,
        {
          versionTag: "v1.0.0",
          label: "Initial Protocol Lock",
          description: "Formal freeze for clinical site distribution",
          actor: {
            name: "Dr. Evelyn Reed",
            role: "Principal Investigator",
            email: "ereed@clinical.org",
          },
        },
        storage
      );

      expect(saveRes.status).toBe("saved");
      if (saveRes.status !== "saved") return;

      const { baseline } = saveRes;
      expect(baseline.id).toMatch(/^base_/);
      expect(baseline.versionTag).toBe("v1.0.0");
      expect(baseline.label).toBe("Initial Protocol Lock");
      expect(baseline.description).toBe(
        "Formal freeze for clinical site distribution"
      );
      expect(baseline.actor.name).toBe("Dr. Evelyn Reed");
      expect(baseline.actor.role).toBe("Principal Investigator");
      expect(baseline.createdAt).toBeTruthy();
      expect(baseline.checksum).toBeTruthy();

      // Check provenance stats
      expect(baseline.provenance?.totalForms).toBe(1);
      expect(baseline.provenance?.totalFields).toBe(2);

      // Verify listStudyBaselines reflects the saved baseline
      const list = listStudyBaselines(storage);
      expect(list.length).toBe(1);
      expect(list[0].id).toBe(baseline.id);
      expect(list[0].versionTag).toBe("v1.0.0");
    });

    it("guarantees complete immutability: mutations to working study do not modify saved baseline", () => {
      const storage = new MockStorage();
      const study = buildTestStudy();

      const saveRes = saveStudyBaseline(
        study,
        {
          versionTag: "v1.0",
          label: "Frozen Baseline",
          actor: { name: "Lead Data Manager" },
        },
        storage
      );
      expect(saveRes.status).toBe("saved");

      // Now aggressively mutate the working study in-memory
      study.protocolNumber = "MODIFIED-PROTOCOL-999";
      study.studyName = "Completely Mutated Study";
      study.version = "99.0";
      study.forms[0].name = "Mutated Form Title";
      study.forms[0].sections[0].fields.push({
        id: "fld_mutated",
        variableName: "MUTATED",
        label: "Mutated Field",
        dataType: "text",
        required: false,
        columnSpan: 12,
      });

      // Verify the persisted baseline snapshot is 100% UNCHANGED
      const retrieved = getStudyBaseline("v1.0", storage);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.study.protocolNumber).toBe("ONC-2026-TEST");
      expect(retrieved!.study.studyName).toBe(
        "Phase III Immuno-Oncology Study"
      );
      expect(retrieved!.study.version).toBe("1.0");
      expect(retrieved!.study.forms[0].name).toBe("Demographics");
      expect(retrieved!.study.forms[0].sections[0].fields.length).toBe(2);
      expect(
        retrieved!.study.forms[0].sections[0].fields.some(
          (f) => f.variableName === "MUTATED"
        )
      ).toBe(false);
    });

    it("enforces validation on required metadata and rejects duplicate version tags", () => {
      const storage = new MockStorage();
      const study = buildTestStudy();

      // Empty version tag
      const emptyTag = saveStudyBaseline(
        study,
        {
          versionTag: "",
          label: "Valid Label",
          actor: { name: "Author" },
        },
        storage
      );
      expect(emptyTag.status).toBe("validation_error");

      // Empty label
      const emptyLabel = saveStudyBaseline(
        study,
        {
          versionTag: "v1.0",
          label: "  ",
          actor: { name: "Author" },
        },
        storage
      );
      expect(emptyLabel.status).toBe("validation_error");

      // Empty actor name
      const emptyActor = saveStudyBaseline(
        study,
        {
          versionTag: "v1.0",
          label: "Valid Label",
          actor: { name: "" },
        },
        storage
      );
      expect(emptyActor.status).toBe("validation_error");

      // Save initial baseline
      const initialSave = saveStudyBaseline(
        study,
        {
          versionTag: "v1.0",
          label: "Initial",
          actor: { name: "Author" },
        },
        storage
      );
      expect(initialSave.status).toBe("saved");

      // Duplicate version tag (case-insensitive)
      const duplicateTag = saveStudyBaseline(
        study,
        {
          versionTag: "V1.0",
          label: "Second Attempt",
          actor: { name: "Author" },
        },
        storage
      );
      expect(duplicateTag.status).toBe("validation_error");
      if (duplicateTag.status === "validation_error") {
        expect(duplicateTag.message).toContain("already exists");
      }
    });
  });

  describe("2. Restoration as New Draft with Lineage Provenance", () => {
    it("restores baseline as a fresh draft with provenance while leaving original baseline untouched", () => {
      const storage = new MockStorage();
      const study = buildTestStudy();

      const saveRes = saveStudyBaseline(
        study,
        {
          versionTag: "v1.0",
          label: "Baseline v1.0",
          actor: { name: "Protocol Author" },
        },
        storage
      );
      expect(saveRes.status).toBe("saved");
      if (saveRes.status !== "saved") return;

      const restoreRes = restoreBaselineAsDraft(
        saveRes.baseline.id,
        {
          actorName: "Amending Editor",
          incrementVersion: true,
        },
        storage
      );

      expect(restoreRes.status).toBe("restored");
      if (restoreRes.status !== "restored") return;

      const { study: restoredStudy, baseline } = restoreRes;

      // Verify baseline identity is preserved in storage
      const baselineInStore = getStudyBaseline(baseline.id, storage);
      expect(baselineInStore).not.toBeNull();
      expect(baselineInStore!.versionTag).toBe("v1.0");

      // Verify restored draft has updated provenance
      expect(restoredStudy.provenance).toBeDefined();
      expect(restoredStudy.provenance!.derivedFromBaselineId).toBe(baseline.id);
      expect(restoredStudy.provenance!.derivedFromVersionTag).toBe("v1.0");
      expect(restoredStudy.provenance!.restoredBy).toBe("Amending Editor");
      expect(restoredStudy.provenance!.restoredAt).toBeTruthy();
      expect(restoredStudy.version).toBe("1.1"); // Incremented from 1.0

      // Mutate restored draft to verify full detachment from stored baseline
      restoredStudy.studyName = "Restored Study Draft Amended";
      restoredStudy.forms = [];

      const freshCheck = getStudyBaseline(baseline.id, storage);
      expect(freshCheck!.study.studyName).toBe(
        "Phase III Immuno-Oncology Study"
      );
      expect(freshCheck!.study.forms.length).toBe(1);
    });

    it("handles version incrementation patterns cleanly", () => {
      expect(incrementStudyVersion("1.0")).toBe("1.1");
      expect(incrementStudyVersion("v1.0.0")).toBe("v1.0.1");
      expect(incrementStudyVersion("2.9")).toBe("2.10");
      expect(incrementStudyVersion("Alpha")).toBe("Alpha-draft");
    });
  });

  describe("3. Storage Corruption Resilience, Recovery & Bundle Export/Import", () => {
    it("backs up unreadable baselines storage to corrupt backup key rather than silently destroying it", () => {
      const storage = new MockStorage();

      // Write corrupt payload into primary baselines key
      storage.setItem(STUDY_BASELINES_STORAGE_KEY, "INVALID_CORRUPTED_JSON{]");

      const list = listStudyBaselines(storage);
      expect(list).toEqual([]);

      // Verify backup key contains the corrupt data for forensic recovery
      const backup = storage.getItem(STUDY_BASELINES_CORRUPT_BACKUP_KEY);
      expect(backup).toBe("INVALID_CORRUPTED_JSON{]");
    });

    it("exports and imports baseline bundles cleanly, skipping duplicates", () => {
      const storage = new MockStorage();
      const study = buildTestStudy();

      saveStudyBaseline(
        study,
        {
          versionTag: "v1.0",
          label: "First Baseline",
          actor: { name: "Author A" },
        },
        storage
      );

      saveStudyBaseline(
        study,
        {
          versionTag: "v2.0",
          label: "Second Baseline",
          actor: { name: "Author B" },
        },
        storage
      );

      const bundleJson = exportBaselinesBundle(storage);
      const parsedBundle = JSON.parse(bundleJson);
      expect(parsedBundle.count).toBe(2);
      expect(parsedBundle.baselines.length).toBe(2);

      // Now import bundle into a fresh storage
      const freshStorage = new MockStorage();
      const importRes = importBaselinesBundle(bundleJson, freshStorage);
      expect(importRes.imported).toBe(2);
      expect(importRes.skipped).toBe(0);

      const importedList = listStudyBaselines(freshStorage);
      expect(importedList.length).toBe(2);

      // Attempt duplicate import
      const secondImport = importBaselinesBundle(bundleJson, freshStorage);
      expect(secondImport.imported).toBe(0);
      expect(secondImport.skipped).toBe(2);
    });

    it("deletes a single baseline without destroying other baselines", () => {
      const storage = new MockStorage();
      const study = buildTestStudy();

      const b1 = saveStudyBaseline(
        study,
        { versionTag: "v1.0", label: "B1", actor: { name: "A" } },
        storage
      );
      const b2 = saveStudyBaseline(
        study,
        { versionTag: "v2.0", label: "B2", actor: { name: "B" } },
        storage
      );

      if (b1.status !== "saved" || b2.status !== "saved") return;

      expect(listStudyBaselines(storage).length).toBe(2);

      const deleted = deleteStudyBaseline(b1.baseline.id, storage);
      expect(deleted).toBe(true);

      const remaining = listStudyBaselines(storage);
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe(b2.baseline.id);

      // Verify clearStudyBaselines empties the baseline store
      clearStudyBaselines(storage);
      expect(listStudyBaselines(storage).length).toBe(0);
    });
  });

  describe("4. End-to-End User Journey: Baseline → Amend → Refresh → Restore As Draft", () => {
    it("demonstrates the complete lifecycle with unchanged original baseline", () => {
      const storage = new MockStorage();
      const initialStudy = buildTestStudy();

      // Step 1: Save initial baseline
      const b1 = StudyProtocolEngine.saveBaseline(
        initialStudy,
        {
          versionTag: "v1.0-freeze",
          label: "Interim Lock",
          actor: { name: "Dr. Evelyn Reed" },
        },
        storage
      );
      expect(b1.status).toBe("saved");
      if (b1.status !== "saved") return;

      // Step 2: Author amends working study (adds Vital Signs form)
      const formRemovalResult = StudyProtocolEngine.duplicateForm(
        initialStudy,
        initialStudy.forms[0].id
      );
      const amendedStudy: StudyProtocol = {
        ...formRemovalResult.study,
        protocolNumber: "ONC-2026-AMENDED",
        version: "1.1-amendment",
      };
      expect(amendedStudy.forms.length).toBe(2);
      expect(amendedStudy.protocolNumber).toBe("ONC-2026-AMENDED");

      // Step 3: Simulate refresh / reload from storage
      const storedBaselines = StudyProtocolEngine.listBaselines(storage);
      expect(storedBaselines.length).toBe(1);
      expect(storedBaselines[0].versionTag).toBe("v1.0-freeze");

      // Verify frozen baseline still has only 1 form
      expect(storedBaselines[0].study.forms.length).toBe(1);
      expect(storedBaselines[0].study.protocolNumber).toBe("ONC-2026-TEST");

      // Step 4: Restore baseline as a new draft
      const restoreResult = StudyProtocolEngine.restoreBaselineAsDraft(
        storedBaselines[0].id,
        {
          actorName: "Dr. Evelyn Reed",
          incrementVersion: false,
        },
        storage
      );
      expect(restoreResult.status).toBe("restored");
      if (restoreResult.status !== "restored") return;

      const restoredDraft = restoreResult.study;
      expect(restoredDraft.protocolNumber).toBe("ONC-2026-TEST");
      expect(restoredDraft.forms.length).toBe(1);
      expect(restoredDraft.provenance?.derivedFromVersionTag).toBe(
        "v1.0-freeze"
      );

      // Verify the frozen baseline in storage is still 100% identical and unchanged
      const baselineAfter = StudyProtocolEngine.getBaseline(
        "v1.0-freeze",
        storage
      );
      expect(baselineAfter).not.toBeNull();
      expect(computeStudyChecksum(baselineAfter!.study)).toBe(
        computeStudyChecksum(b1.baseline.study)
      );
    });
  });

  describe("5. BaselineManagerModal UI Component & Accessibility", () => {
    it("renders modal with saved baselines and allows creating new baseline", () => {
      const storage = new MockStorage();
      const study = buildTestStudy();
      const handleClose = vi.fn();
      const handleRestore = vi.fn();

      render(
        <BaselineManagerModal
          isOpen={true}
          onClose={handleClose}
          study={study}
          onRestoreBaselineAsDraft={handleRestore}
          storage={storage}
        />
      );

      // Modal title and empty state
      expect(
        screen.getByText(/Study Baselines & Version History/i)
      ).toBeTruthy();
      expect(screen.getByText(/No Baselines Recorded/i)).toBeTruthy();

      // Switch to Create New Baseline tab
      const createTabBtn = screen.getByRole("tab", {
        name: /Save New Baseline/i,
      });
      fireEvent.click(createTabBtn);

      expect(screen.getByLabelText(/Version Tag/i)).toBeTruthy();
      expect(screen.getByLabelText(/Baseline Label/i)).toBeTruthy();

      // Fill out form
      const tagInput = screen.getByLabelText(/Version Tag/i);
      const labelInput = screen.getByLabelText(/Baseline Label/i);
      fireEvent.change(tagInput, { target: { value: "v1.0.0" } });
      fireEvent.change(labelInput, {
        target: { value: "First Formal Freeze" },
      });

      // Submit form
      const submitBtn = screen.getByRole("button", {
        name: /Create Immutable Baseline/i,
      });
      fireEvent.click(submitBtn);

      // Should show success feedback and list the created baseline
      expect(
        screen.getByText(/Immutable baseline 'v1.0.0' created successfully/i)
      ).toBeTruthy();
      expect(screen.getByText("First Formal Freeze")).toBeTruthy();
    });

    it("prompts confirmation when restoring a baseline and invokes callback", () => {
      const storage = new MockStorage();
      const study = buildTestStudy();
      saveStudyBaseline(
        study,
        {
          versionTag: "v1.0",
          label: "Phase 1 Baseline",
          actor: { name: "Author" },
        },
        storage
      );

      const handleClose = vi.fn();
      const handleRestore = vi.fn();

      render(
        <BaselineManagerModal
          isOpen={true}
          onClose={handleClose}
          study={study}
          onRestoreBaselineAsDraft={handleRestore}
          storage={storage}
        />
      );

      expect(screen.getByText("Phase 1 Baseline")).toBeTruthy();

      // Click Restore Draft button
      const restoreBtn = screen.getByRole("button", {
        name: /Restore Draft/i,
      });
      fireEvent.click(restoreBtn);

      // Confirmation dialog should appear
      expect(
        screen.getByText(/Restore Baseline 'v1.0' as New Draft\?/i)
      ).toBeTruthy();

      // Click confirm
      const confirmBtn = screen.getByRole("button", {
        name: /Confirm & Begin New Draft/i,
      });
      fireEvent.click(confirmBtn);

      expect(handleRestore).toHaveBeenCalledTimes(1);
      expect(handleClose).toHaveBeenCalledTimes(1);
      const [restoredStudy, baseline] = handleRestore.mock.calls[0];
      expect(baseline.versionTag).toBe("v1.0");
      expect(restoredStudy.provenance?.derivedFromVersionTag).toBe("v1.0");
    });
  });
});
