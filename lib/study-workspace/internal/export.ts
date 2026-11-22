import {
  canonicalUsdmJson,
  validateUsdmV4Document,
} from "@/lib/clinical-standards";
import type { StudyWorkspace, ValidatedStudyExport } from "../types";

/**
 * Exports the working study as USDM v4 JSON after checking it against the
 * USDM v4.0.0 Wrapper schema. The text is canonical JSON (sorted keys), so
 * the same workspace always gives the same bytes. A document with schema
 * issues is not exported; its issues are returned instead.
 */
export async function exportValidatedStudyUsdm(
  workspace: StudyWorkspace
): Promise<ValidatedStudyExport> {
  const issues = await validateUsdmV4Document(workspace.usdm);
  if (issues.length > 0) return { status: "invalid", issues };
  return {
    status: "ok",
    json: canonicalUsdmJson(workspace.usdm),
    sha256: workspace.revision.sha256,
  };
}
