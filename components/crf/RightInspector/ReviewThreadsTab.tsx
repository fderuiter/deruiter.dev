"use client";

import { useId, useState } from "react";
import type {
  CRFField,
  StudyReviewActor,
  StudyReviewRole,
  StudyReviewThread,
} from "@/lib/crf";

interface ReviewThreadsTabProps {
  threads: StudyReviewThread[];
  selectedField: CRFField | null;
  author: StudyReviewActor;
  onAuthorChange: (author: StudyReviewActor) => void;
  onAddComment: (
    fieldId: string,
    body: string,
    author: StudyReviewActor
  ) => void;
  onSetStatus: (
    threadId: string,
    status: "resolved" | "open",
    author: StudyReviewActor
  ) => void;
  isTargetDeleted: (thread: StudyReviewThread) => boolean;
  getStatus: (thread: StudyReviewThread) => "open" | "resolved";
}

const REVIEW_ROLES: StudyReviewRole[] = [
  "Data Manager",
  "Medical Monitor",
  "Biostatistician",
  "Clinical Reviewer",
];

export function ReviewThreadsTab({
  threads,
  selectedField,
  author,
  onAuthorChange,
  onAddComment,
  onSetStatus,
  isTargetDeleted,
  getStatus,
}: ReviewThreadsTabProps) {
  const idPrefix = useId();
  const [comment, setComment] = useState("");
  const [replyingToThreadId, setReplyingToThreadId] = useState<string | null>(
    null
  );
  const actor = { ...author, name: author.name.trim() };
  const replyingToThread = threads.find(
    (thread) => thread.id === replyingToThreadId
  );
  const fieldThread = selectedField
    ? threads.find((thread) => thread.target.fieldId === selectedField.id)
    : undefined;
  const commentTarget = replyingToThread
    ? {
        fieldId: replyingToThread.target.fieldId,
        variableName: replyingToThread.target.variableName,
        label: replyingToThread.target.label,
      }
    : selectedField
      ? {
          fieldId: selectedField.id,
          variableName: selectedField.variableName,
          label: selectedField.label,
        }
      : null;
  const authorNameId = `review-author-name-${idPrefix}`;
  const authorRoleId = `review-author-role-${idPrefix}`;
  const commentId = `review-comment-${idPrefix}`;

  const submitComment = () => {
    if (!commentTarget || !actor.name || !comment.trim()) return;
    onAddComment(commentTarget.fieldId, comment.trim(), actor);
    setComment("");
    setReplyingToThreadId(null);
  };

  return (
    <section className="space-y-4 p-4" aria-label="Local field review threads">
      <div className="rounded-lg border studio-border-default studio-surface-subtle p-3">
        <h4 className="text-xs font-bold uppercase tracking-wide studio-fg-primary">
          Local authoring review
        </h4>
        <p className="mt-1 text-[11px] leading-relaxed studio-fg-muted">
          Saved with this study. These notes are separate from simulated EDC
          audit history and do not represent a shared account.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2">
          <label className="text-[10px] studio-fg-muted" htmlFor={authorNameId}>
            Reviewer name
            <input
              id={authorNameId}
              value={author.name}
              onChange={(event) =>
                onAuthorChange({ ...author, name: event.target.value })
              }
              autoComplete="name"
              className="mt-1 w-full rounded border studio-border-strong studio-surface-subtle px-2 py-1.5 text-xs studio-fg-primary"
              placeholder="Enter your name"
            />
          </label>
          <label className="text-[10px] studio-fg-muted" htmlFor={authorRoleId}>
            Reviewer role
            <select
              id={authorRoleId}
              value={author.role}
              onChange={(event) =>
                onAuthorChange({
                  ...author,
                  role: event.target.value as StudyReviewRole,
                })
              }
              className="mt-1 w-full rounded border studio-border-strong studio-surface-subtle px-2 py-1.5 text-xs studio-fg-primary"
            >
              {REVIEW_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {commentTarget && (
        <div className="rounded-lg border studio-border-default p-3">
          <h4 className="text-xs font-semibold studio-fg-primary">
            {replyingToThread
              ? "Reply to field thread"
              : fieldThread
                ? "Continue field thread"
                : "Start a field thread"}
          </h4>
          <p className="mt-1 text-[11px] studio-fg-muted">
            {commentTarget.variableName} · {commentTarget.label}
          </p>
          <label className="sr-only" htmlFor={commentId}>
            Review comment
          </label>
          <textarea
            id={commentId}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            className="mt-2 w-full resize-y rounded border studio-border-strong studio-surface-subtle px-2 py-2 text-xs studio-fg-primary"
            placeholder="Add context or a question about this field"
          />
          <button
            type="button"
            onClick={submitComment}
            disabled={!actor.name || !comment.trim()}
            className="mt-2 rounded border studio-accent-amber px-3 py-1.5 text-xs studio-hover-amber disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add comment
          </button>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-semibold studio-fg-primary">
            Study review threads
          </h4>
          <span className="font-mono text-[10px] studio-fg-amber">
            {threads.filter((thread) => getStatus(thread) === "open").length}{" "}
            open
          </span>
        </div>
        {threads.length === 0 ? (
          <p className="rounded border border-dashed studio-border-default p-3 text-xs studio-fg-muted">
            No review threads in this study yet. Select a field to start one.
          </p>
        ) : (
          threads.map((thread) => {
            const status = getStatus(thread);
            const deleted = isTargetDeleted(thread);

            return (
              <article
                key={thread.id}
                className="rounded-lg border studio-border-default studio-surface-subtle p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words text-xs font-semibold studio-fg-primary">
                      {thread.target.variableName} · {thread.target.label}
                    </p>
                    <p className="mt-1 text-[10px] studio-fg-muted">
                      {deleted
                        ? "Deleted field · history retained"
                        : `${thread.target.formName} · ${thread.target.formId}`}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] uppercase ${
                      status === "open"
                        ? "studio-border-amber studio-fg-amber"
                        : "studio-border-emerald studio-fg-emerald"
                    }`}
                  >
                    {status}
                  </span>
                </div>
                <ol className="mt-3 space-y-2 border-l studio-border-default pl-3">
                  {thread.events.map((event) => (
                    <li key={event.id} className="text-[11px]">
                      <p className="leading-relaxed studio-fg-secondary">
                        {event.type === "comment" && event.body}
                        {event.type === "resolved" && "Resolved this thread."}
                        {event.type === "reopened" && "Reopened this thread."}
                        {event.type === "target-renamed" &&
                          `Field renamed from ${event.previousVariableName} to ${event.nextVariableName}.`}
                        {event.type === "target-deleted" &&
                          `Field ${event.target.variableName} was deleted; this discussion remains attached to its stable identity.`}
                      </p>
                      <p className="mt-0.5 flex flex-wrap gap-x-2 text-[9px] studio-fg-muted">
                        <span>
                          {event.author.name} · {event.author.role}
                        </span>
                        <time dateTime={event.at}>{event.at}</time>
                      </p>
                    </li>
                  ))}
                </ol>
                <button
                  type="button"
                  onClick={() => {
                    setComment("");
                    setReplyingToThreadId(thread.id);
                  }}
                  className="mt-3 rounded border studio-border-strong px-2 py-1 text-[10px] studio-fg-secondary studio-hover-border"
                >
                  Reply to thread
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onSetStatus(
                      thread.id,
                      status === "open" ? "resolved" : "open",
                      actor
                    )
                  }
                  disabled={!actor.name}
                  className="ml-2 mt-3 rounded border studio-border-strong px-2 py-1 text-[10px] studio-fg-secondary studio-hover-border disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {status === "open" ? "Resolve thread" : "Reopen thread"}
                </button>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
