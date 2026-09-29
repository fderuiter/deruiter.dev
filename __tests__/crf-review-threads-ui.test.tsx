import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudyProtocolEngine, type StudyReviewActor } from "@/lib/crf";
import { ReviewThreadsTab } from "@/components/crf/RightInspector/ReviewThreadsTab";
import { FieldPropertiesTab } from "@/components/crf/RightInspector/FieldPropertiesTab";

describe("field review thread controls", () => {
  afterEach(() => cleanup());

  it("requires a declared author and emits field comments and status changes", () => {
    const { form } = StudyProtocolEngine.addForm(
      StudyProtocolEngine.createInitialStudy(),
      "VS"
    );
    const field = form.sections[0]?.fields[0];
    expect(field).toBeDefined();
    if (!field) throw new Error("The starter study needs a field");

    const author: StudyReviewActor = {
      name: "Study author",
      role: "Data Manager",
    };
    const { thread } = StudyProtocolEngine.addReviewComment(
      { ...StudyProtocolEngine.createInitialStudy(), forms: [form] },
      field.id,
      "Existing review note.",
      author,
      "2026-09-20T14:00:00.000Z"
    );
    const onAddComment = vi.fn();
    const onSetStatus = vi.fn();
    let status: "open" | "resolved" = "open";
    const getStatus = () => status;
    const { rerender } = render(
      <ReviewThreadsTab
        threads={[thread]}
        selectedField={field}
        author={author}
        onAuthorChange={vi.fn()}
        onAddComment={onAddComment}
        onSetStatus={onSetStatus}
        isTargetDeleted={StudyProtocolEngine.isReviewTargetDeleted}
        getStatus={getStatus}
      />
    );

    fireEvent.change(screen.getByLabelText("Review comment"), {
      target: { value: "Please review the wording." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));

    expect(onAddComment).toHaveBeenCalledWith(
      field.id,
      "Please review the wording.",
      author
    );
    expect(screen.getByText("Existing review note.")).toBeTruthy();
    expect(screen.getByText("1 open")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Resolve thread" }));
    expect(onSetStatus).toHaveBeenLastCalledWith(thread.id, "resolved", author);

    status = "resolved";
    rerender(
      <ReviewThreadsTab
        threads={[thread]}
        selectedField={field}
        author={author}
        onAuthorChange={vi.fn()}
        onAddComment={onAddComment}
        onSetStatus={onSetStatus}
        isTargetDeleted={StudyProtocolEngine.isReviewTargetDeleted}
        getStatus={getStatus}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Reopen thread" }));
    expect(onSetStatus).toHaveBeenLastCalledWith(thread.id, "open", author);
  });

  it("uses unique accessible control IDs when inspector instances coexist", () => {
    const { form } = StudyProtocolEngine.addForm(
      StudyProtocolEngine.createInitialStudy(),
      "VS"
    );
    const field = form.sections[0]?.fields[0];
    expect(field).toBeDefined();
    if (!field) throw new Error("The starter study needs a field");
    const props = {
      threads: [],
      selectedField: field,
      author: { name: "Reviewer", role: "Data Manager" as const },
      onAuthorChange: vi.fn(),
      onAddComment: vi.fn(),
      onSetStatus: vi.fn(),
      isTargetDeleted: StudyProtocolEngine.isReviewTargetDeleted,
      getStatus: StudyProtocolEngine.getReviewThreadStatus,
    };

    render(
      <>
        <ReviewThreadsTab {...props} />
        <ReviewThreadsTab {...props} />
      </>
    );

    const nameInputs = screen.getAllByLabelText("Reviewer name");
    const roleInputs = screen.getAllByLabelText("Reviewer role");
    const comments = screen.getAllByLabelText("Review comment");
    expect(nameInputs).toHaveLength(2);
    expect(roleInputs).toHaveLength(2);
    expect(comments).toHaveLength(2);
    expect(new Set(nameInputs.map((input) => input.id)).size).toBe(2);
    expect(new Set(roleInputs.map((input) => input.id)).size).toBe(2);
    expect(new Set(comments.map((input) => input.id)).size).toBe(2);
  });

  it("lets a reviewer reply to a deleted field thread without selecting a field", () => {
    const { study, form } = StudyProtocolEngine.addForm(
      StudyProtocolEngine.createInitialStudy(),
      "VS"
    );
    const field = form.sections[0]?.fields[0];
    expect(field).toBeDefined();
    if (!field) throw new Error("The starter study needs a field");
    const opened = StudyProtocolEngine.addReviewComment(
      study,
      field.id,
      "Preserve this discussion.",
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
    const thread = deleted.study.reviewThreads?.[0];
    expect(thread).toBeDefined();
    if (!thread) throw new Error("The deleted field thread should remain");
    const author: StudyReviewActor = {
      name: "Morgan Reviewer",
      role: "Medical Monitor",
    };
    const onAddComment = vi.fn();

    render(
      <ReviewThreadsTab
        threads={[thread]}
        selectedField={null}
        author={author}
        onAuthorChange={vi.fn()}
        onAddComment={onAddComment}
        onSetStatus={vi.fn()}
        isTargetDeleted={StudyProtocolEngine.isReviewTargetDeleted}
        getStatus={StudyProtocolEngine.getReviewThreadStatus}
      />
    );

    expect(screen.getByText("Deleted field · history retained")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reply to thread" }));
    fireEvent.change(screen.getByLabelText("Review comment"), {
      target: { value: "Keep the historical context." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));

    expect(onAddComment).toHaveBeenCalledWith(
      field.id,
      "Keep the historical context.",
      author
    );
  });

  it("keeps variable name edits staged until the atomic rename action", () => {
    const { form } = StudyProtocolEngine.addForm(
      StudyProtocolEngine.createInitialStudy(),
      "VS"
    );
    const field = form.sections[0]?.fields[0];
    expect(field).toBeDefined();
    if (!field) throw new Error("The starter study needs a field");
    const onUpdateField = vi.fn();
    const onRenameEverywhere = vi.fn();
    const onCommitReviewTargetChange = vi.fn();

    render(
      <FieldPropertiesTab
        field={field}
        allFieldsInForm={form.sections.flatMap((section) => section.fields)}
        codelists={[]}
        onUpdateField={onUpdateField}
        onRenameEverywhere={onRenameEverywhere}
        onCommitReviewTargetChange={onCommitReviewTargetChange}
      />
    );

    fireEvent.change(screen.getByDisplayValue(field.variableName), {
      target: { value: "NEWVAR" },
    });
    expect(onUpdateField).not.toHaveBeenCalledWith({ variableName: "NEWVAR" });
    fireEvent.click(
      screen.getByRole("button", { name: "Rename Everywhere (Atomic)" })
    );

    expect(onRenameEverywhere).toHaveBeenCalledWith("NEWVAR");

    const labelInput = screen.getByPlaceholderText(
      "e.g. Primary Device Deficiency Classification"
    );
    fireEvent.change(labelInput, {
      target: { value: "Updated question wording" },
    });
    fireEvent.blur(labelInput);

    expect(onUpdateField).toHaveBeenCalledWith({
      label: "Updated question wording",
    });
    expect(onCommitReviewTargetChange).toHaveBeenCalledTimes(1);
  });
});
