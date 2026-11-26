import {
  MAX_STUDY_IMPORT_BYTES,
  type ImportStudyRepositoryFileResult,
  type StudyRepositoryFileInput,
} from "../types";
import { importUsdmStudy } from "./import";
import { openStudyWorkspace } from "./revision";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function looksLikeWorkspaceFilename(fileName: string | null | undefined): boolean {
  return typeof fileName === "string" && /\.study\.json$/i.test(fileName.trim());
}

/**
 * Imports a `.usdm.json` or `.study.json` payload with a 25 MiB guard prior to
 * reading or parsing. When an imported USDM v4 document contains multiple study
 * versions or designs and no `selection` was provided, returns
 * `{ status: "needs-selection", choices, document, fileName }` so the studio
 * can prompt the user before opening the workspace.
 */
export async function importStudyRepositoryFile(
  input: StudyRepositoryFileInput
): Promise<ImportStudyRepositoryFileResult> {
  if (input.byteLength > MAX_STUDY_IMPORT_BYTES) {
    return {
      status: "too-large",
      maxBytes: MAX_STUDY_IMPORT_BYTES,
      actualBytes: input.byteLength,
    };
  }

  const fileName = input.fileName ?? null;
  const text = await input.readText();
  const actualUtf8Bytes = new TextEncoder().encode(text).byteLength;
  if (actualUtf8Bytes > MAX_STUDY_IMPORT_BYTES) {
    return {
      status: "too-large",
      maxBytes: MAX_STUDY_IMPORT_BYTES,
      actualBytes: actualUtf8Bytes,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (caught) {
    return {
      status: "rejected",
      problems: [
        {
          code: "not-json",
          message:
            caught instanceof Error
              ? caught.message
              : "The file is not valid JSON.",
        },
      ],
    };
  }

  const isWorkspaceEnvelope =
    (isRecord(parsed) && "workspaceVersion" in parsed) ||
    looksLikeWorkspaceFilename(fileName);

  if (isWorkspaceEnvelope && !(isRecord(parsed) && "usdmVersion" in parsed)) {
    const opened = openStudyWorkspace(text);
    if (opened.status === "ok") {
      return {
        status: "ok",
        format: "workspace",
        workspace: opened.workspace,
      };
    }
    return {
      status: "invalid-workspace",
      problem: opened.problem,
    };
  }

  const imported = await importUsdmStudy(
    { document: parsed },
    {
      fileName: fileName ?? undefined,
      selection: input.selection,
    }
  );
  if (imported.status === "needs-selection") {
    return {
      status: "needs-selection",
      choices: imported.choices,
      document: parsed,
      fileName,
    };
  }
  if (imported.status === "rejected") {
    return {
      status: "rejected",
      problems: imported.problems,
    };
  }
  return {
    status: "ok",
    format: "usdm",
    workspace: imported.workspace,
    report: imported.report,
  };
}
