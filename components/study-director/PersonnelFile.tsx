"use client";

import React, { useRef, useState } from "react";
import { PROFILES, importCareer, type CareerFile } from "./career";

const Stat: React.FC<{ label: string; value: React.ReactNode }> = ({
  label,
  value,
}) => (
  <div className="min-w-0">
    <dt className="text-[10px] tracking-[0.14em] text-[var(--sd-muted)] uppercase">
      {label}
    </dt>
    <dd className="mt-0.5 text-lg font-bold text-[var(--sd-text)] tabular-nums">
      {value}
    </dd>
  </div>
);

/**
 * The player's personnel file: studies run, best results and the Study
 * Director titles earned so far. Unearned titles stay redacted. The file
 * lives in this browser; export and import move it to another.
 */
export const PersonnelFile: React.FC<{
  career: CareerFile;
  onImport: (career: CareerFile) => void;
}> = ({ career, onImport }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const earned = PROFILES.filter((id) => career.titles[id]).length;

  const exportFile = () => {
    const blob = new Blob([JSON.stringify(career, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "study-director-career.json";
    a.click();
    URL.revokeObjectURL(url);
    setMessage("Career file downloaded.");
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    const parsed = importCareer(await file.text());
    if (parsed) {
      onImport(parsed);
      setMessage("Career file imported and merged.");
    } else {
      setMessage("That file is not a Study Director career file.");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <section
      aria-label="Personnel file"
      data-testid="study-personnel-file"
      className="border border-[var(--sd-hairline)] bg-[var(--sd-surface)] p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-bold tracking-[0.14em] text-[var(--sd-text)] uppercase">
          Personnel file
        </h3>
        <p className="text-[11px] text-[var(--sd-muted)]">
          Saved in this browser
        </p>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Studies started" value={career.started} />
        <Stat label="Studies closed" value={career.finished} />
        <Stat label="Best grade" value={career.bestGrade ?? "None"} />
        <Stat
          label="Best sponsor"
          value={
            career.bestStars > 0 ? (
              <span
                aria-label={`${career.bestStars} of 5 stars`}
                className="text-[var(--sd-amber)]"
              >
                {"★".repeat(career.bestStars)}
                <span className="text-zinc-700">
                  {"★".repeat(5 - career.bestStars)}
                </span>
              </span>
            ) : (
              "None"
            )
          }
        />
      </dl>

      <h4 className="mt-4 text-[10px] tracking-[0.14em] text-[var(--sd-muted)] uppercase">
        Titles earned, {earned} of {PROFILES.length}
      </h4>
      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
        {PROFILES.map((id) => {
          const title = career.titles[id];
          return (
            <li
              key={id}
              className="flex min-w-0 items-center justify-between gap-2 border border-[var(--sd-hairline)] px-2 py-1.5 text-xs"
            >
              {title ? (
                <>
                  <span className="min-w-0 truncate font-bold text-[var(--sd-amber)]">
                    {title.title}
                  </span>
                  <span className="shrink-0 text-[var(--sd-muted)] tabular-nums">
                    ×{title.count}
                  </span>
                </>
              ) : (
                <>
                  <span
                    aria-hidden="true"
                    className="h-3 w-28 max-w-full bg-zinc-700"
                  />
                  <span className="sr-only">Not yet earned</span>
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-[10px] tracking-wide text-[var(--sd-muted)] uppercase"
                  >
                    Redacted
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {career.history.length > 0 ? (
        <>
          <h4 className="mt-4 text-[10px] tracking-[0.14em] text-[var(--sd-muted)] uppercase">
            Recent studies
          </h4>
          <ol className="mt-2 space-y-1 text-xs">
            {career.history.slice(0, 3).map((run) => (
              <li key={run.seed} className="flex min-w-0 gap-2">
                <span className="w-4 shrink-0 font-bold text-[var(--sd-amber)]">
                  {run.grade}
                </span>
                <span className="min-w-0 break-words text-zinc-300">
                  {run.headline}
                </span>
              </li>
            ))}
          </ol>
        </>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={exportFile}
          className="min-h-[36px] border border-zinc-700 px-3 text-xs text-zinc-200 hover:border-[var(--sd-amber)]"
        >
          Export career
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="min-h-[36px] border border-zinc-700 px-3 text-xs text-zinc-200 hover:border-[var(--sd-amber)]"
        >
          Import career
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          tabIndex={-1}
          aria-label="Career file to import"
          onChange={(e) => void importFile(e.target.files?.[0])}
        />
        <p role="status" className="text-[11px] text-[var(--sd-muted)]">
          {message}
        </p>
      </div>
    </section>
  );
};
