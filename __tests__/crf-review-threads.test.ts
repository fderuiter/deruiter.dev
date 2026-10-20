// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  StudyProtocolEngine,
  exportUniversalCrfJson,
  loadStudyDraft,
  parseUniversalCrf,
  saveStudyDraft,
  type StudyReviewActor,
} from "@/lib/crf";
import { MockStorage } from "../vitest.setup";

describe("StudyProtocol review threads", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: new MockStorage(),
      writable: true,
      configurable: true,
    });
  });

  it("attributes ordinary field deletion to the declared reviewer", () => {
    const { study, form } = StudyProtocolEngine.addForm(
      StudyProtocolEngine.createInitialStudy(),
      "VS"
    );
    const field = form?.sections[0]?.fields[0];
    expect(field).toBeDefined();
    if (!form || !field) throw new Error("The starter study needs a field");

    const author: StudyReviewActor = {
      name: "Morgan Patel",
      role: "Clinical Reviewer",
    };
    const commented = StudyProtocolEngine.addReviewComment(
      study,
      field.id,
      "Retain this item for review.",
      author,
      "2026-09-20T14:00:00.000Z"
    );
    const deleted = StudyProtocolEngine.removeField(
      commented.study,
      form.id,
      field.id,
      undefined,
      author,
      "2026-09-20T14:05:00.000Z"
    );
    const deletion = deleted.study.reviewThreads?.[0]?.events[1];

    expect(deletion).toMatchObject({
      type: "target-deleted",
      at: "2026-09-20T14:05:00.000Z",
      author,
    });
  });

  it("records a committed label edit from the thread's last known target", () => {
    const { study: initial, form } = StudyProtocolEngine.addForm(
      StudyProtocolEngine.createInitialStudy(),
      "VS"
    );
    const field = form.sections[0]?.fields[0];
    expect(field).toBeDefined();
    if (!form || !field) throw new Error("The starter study needs a field");

    const opened = StudyProtocolEngine.addReviewComment(
      initial,
      field.id,
      "Please check the label.",
      { name: "Alex Reviewer", role: "Clinical Reviewer" },
      "2026-09-20T14:00:00.000Z"
    );
    const edit = StudyProtocolEngine.updateField(
      opened.study,
      form.id,
      field.id,
      { label: "Updated assessment label" }
    );
    const committed = StudyProtocolEngine.recordReviewTargetChange(
      edit.study,
      field.id,
      { name: "Casey Reviewer", role: "Medical Monitor" },
      "2026-09-20T14:05:00.000Z"
    );
    const thread = committed.reviewThreads?.[0];

    expect(thread?.events[1]).toMatchObject({
      type: "target-renamed",
      previousLabel: field.label,
      nextLabel: "Updated assessment label",
      author: { name: "Casey Reviewer", role: "Medical Monitor" },
      at: "2026-09-20T14:05:00.000Z",
    });
    expect(thread?.target).toMatchObject({
      fieldId: field.id,
      variableName: field.variableName,
      label: "Updated assessment label",
    });
  });

  it("allows a reply to continue after the target field is deleted", () => {
    const { study: initial, form } = StudyProtocolEngine.addForm(
      StudyProtocolEngine.createInitialStudy(),
      "VS"
    );
    const field = form.sections[0]?.fields[0];
    expect(field).toBeDefined();
    if (!field) throw new Error("The starter study needs a field");

    const opened = StudyProtocolEngine.addReviewComment(
      initial,
      field.id,
      "Keep the original rationale.",
      { name: "Alex Reviewer", role: "Clinical Reviewer" },
      "2026-09-20T14:00:00.000Z"
    );
    const deleted = StudyProtocolEngine.removeField(
      opened.study,
      form.id,
      field.id,
      undefined,
      { name: "Casey Reviewer", role: "Data Manager" },
      "2026-09-20T14:05:00.000Z"
    );
    const replied = StudyProtocolEngine.addReviewComment(
      deleted.study,
      field.id,
      "The rationale still applies to the deleted item.",
      { name: "Morgan Reviewer", role: "Medical Monitor" },
      "2026-09-20T14:10:00.000Z"
    );

    expect(replied.thread.target).toMatchObject({
      fieldId: field.id,
      variableName: field.variableName,
    });
    expect(replied.thread.events.map((event) => event.type)).toEqual([
      "comment",
      "target-deleted",
      "comment",
    ]);
  });

  it("records deletion events for each threaded field removed with a section", () => {
    const { study: initial, form } = StudyProtocolEngine.addForm(
      StudyProtocolEngine.createInitialStudy(),
      "VS"
    );
    const section = form.sections[0];
    const field = section?.fields[0];
    expect(field).toBeDefined();
    if (!section || !field) throw new Error("The starter form needs a field");
    const expanded = StudyProtocolEngine.addSection(initial, form.id, "Keep");
    const opened = StudyProtocolEngine.addReviewComment(
      expanded.study,
      field.id,
      "Review before removing this section.",
      { name: "Alex Reviewer", role: "Clinical Reviewer" },
      "2026-09-20T14:00:00.000Z"
    );

    const deleted = StudyProtocolEngine.removeSectionWithCascade(
      opened.study,
      form.id,
      section.id,
      undefined,
      { name: "Casey Reviewer", role: "Data Manager" },
      "2026-09-20T14:05:00.000Z"
    );

    expect(deleted.study.reviewThreads?.[0]?.events[1]).toMatchObject({
      type: "target-deleted",
      target: { fieldId: field.id, variableName: field.variableName },
      author: { name: "Casey Reviewer", role: "Data Manager" },
      at: "2026-09-20T14:05:00.000Z",
    });
  });

  it("retains comment, rename, resolve, reopen, deletion, and save history", () => {
    const { study: initial, form } = StudyProtocolEngine.addForm(
      StudyProtocolEngine.createInitialStudy(),
      "VS"
    );
    const field = form?.sections[0]?.fields[0];
    expect(form).toBeDefined();
    expect(field).toBeDefined();
    if (!form || !field) throw new Error("The starter study needs a field");

    const reviewer: StudyReviewActor = {
      name: "Riley Chen",
      role: "Data Manager",
    };
    const author: StudyReviewActor = {
      name: "Jordan Lee",
      role: "Medical Monitor",
    };
    const created = StudyProtocolEngine.addReviewComment(
      initial,
      field.id,
      "Please confirm this question is still needed.",
      reviewer,
      "2026-09-20T14:00:00.000Z"
    );
    const renamed = StudyProtocolEngine.renameFieldEverywhere(
      created.study,
      form.id,
      field.id,
      "REVVAR",
      undefined,
      author,
      "2026-09-20T14:05:00.000Z"
    );
    expect(renamed.error).toBeUndefined();
    expect(renamed.study.reviewThreads?.[0]?.target).toMatchObject({
      fieldId: field.id,
      variableName: "REVVAR",
    });

    const resolved = StudyProtocolEngine.setReviewThreadStatus(
      renamed.study,
      created.thread.id,
      "resolved",
      reviewer,
      "2026-09-20T14:10:00.000Z"
    );
    const reopened = StudyProtocolEngine.setReviewThreadStatus(
      resolved,
      created.thread.id,
      "open",
      author,
      "2026-09-20T14:15:00.000Z"
    );
    const deleted = StudyProtocolEngine.removeFieldWithCascade(
      reopened,
      form.id,
      field.id,
      { purgeReferencingRules: true },
      author,
      "2026-09-20T14:20:00.000Z"
    );
    const storage = globalThis.localStorage;

    expect(deleted.removedField?.id).toBe(field.id);
    expect(saveStudyDraft(deleted.study, storage).status).toBe("saved");

    const restored = loadStudyDraft(storage);
    expect(restored.status).toBe("recovered");
    if (restored.status !== "recovered") return;

    const thread = restored.study.reviewThreads?.find(
      (candidate) => candidate.id === created.thread.id
    );
    expect(thread?.target.fieldId).toBe(field.id);
    expect(thread?.events.map((event) => event.type)).toEqual([
      "comment",
      "target-renamed",
      "resolved",
      "reopened",
      "target-deleted",
    ]);
    expect(thread?.events[1]).toMatchObject({
      type: "target-renamed",
      previousVariableName: field.variableName,
      nextVariableName: "REVVAR",
    });
    expect(thread?.events[4]).toMatchObject({
      type: "target-deleted",
      target: { fieldId: field.id, variableName: "REVVAR" },
    });
    expect(thread?.events.map((event) => event.author.name)).toEqual([
      "Riley Chen",
      "Jordan Lee",
      "Riley Chen",
      "Jordan Lee",
      "Jordan Lee",
    ]);
    expect(thread?.events.map((event) => event.at)).toEqual([
      "2026-09-20T14:00:00.000Z",
      "2026-09-20T14:05:00.000Z",
      "2026-09-20T14:10:00.000Z",
      "2026-09-20T14:15:00.000Z",
      "2026-09-20T14:20:00.000Z",
    ]);
    expect(StudyProtocolEngine.getReviewThreadStatus(thread!)).toBe("open");
    expect(StudyProtocolEngine.isReviewTargetDeleted(thread!)).toBe(true);
    expect(StudyProtocolEngine.countOpenReviewThreads(restored.study)).toBe(1);

    const nativeReopen = parseUniversalCrf(
      exportUniversalCrfJson(restored.study)
    );
    expect(nativeReopen.reviewThreads).toEqual(restored.study.reviewThreads);
  });
});
