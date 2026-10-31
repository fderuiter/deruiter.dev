/**
 * SDTM CO (#2711): the comments a site recorded against a subject's records.
 * The comments form names the record it comments on by its collected source
 * ID; CO names the same record the SDTM way, by its domain and --SEQ, or by
 * VISITNUM for a visit in SV (SDTMIG 3.4, section 5.1). Nothing is inferred:
 * a comment whose record was not tabulated is not written. A comment that
 * names a record takes that record's date, so CODTC is left out.
 */
import type { CellValue, Dataset } from "../../types";

type Row = Record<string, CellValue>;

/** One CO row with the collected records it traces to. */
export interface CommentEntry {
  readonly row: Row;
  readonly sourceIds: readonly string[];
}

/** The domain of a collected source ID, `STUDY:DOMAIN:SUBJECT:SUFFIX`. */
function sourceDomain(source: string): string | null {
  const parts = source.split(":");
  return parts.length === 4 ? parts[1] : null;
}

/**
 * Derive the CO rows for the collected comments.
 *
 * @param studyId - The study identifier written to STUDYID.
 * @param collectedComments - The collected comment records, with SRCID,
 *   USUBJID, RSRCID and COVAL.
 * @param targets - The tabulated SDTM datasets a comment may name, with
 *   their lineage.
 * @returns One row per comment whose record was tabulated, unnumbered, in
 *   collection order, each tracing to the comment and the commented record.
 */
export function deriveComments(
  studyId: string,
  collectedComments: readonly Row[],
  targets: readonly Dataset[]
): CommentEntry[] {
  // The tabulated row of each collected record, by the first source in its
  // lineage, which is the record itself.
  const rowBySource = new Map<string, { dataset: Dataset; row: number }>();
  for (const dataset of targets)
    (dataset.lineage ?? []).forEach((sources, row) => {
      const own = sources[0];
      if (own && sourceDomain(own) === dataset.name)
        rowBySource.set(own, { dataset, row });
    });

  const entries: CommentEntry[] = [];
  for (const record of collectedComments) {
    const target =
      typeof record.RSRCID === "string"
        ? rowBySource.get(record.RSRCID)
        : undefined;
    if (!target) continue;
    const { dataset, row } = target;
    const idvar = dataset.name === "SV" ? "VISITNUM" : `${dataset.name}SEQ`;
    const value = dataset.columns[idvar]?.[row] ?? null;
    entries.push({
      row: {
        STUDYID: studyId,
        DOMAIN: "CO",
        RDOMAIN: dataset.name,
        USUBJID: record.USUBJID,
        IDVAR: idvar,
        IDVARVAL: value === null ? null : String(value),
        COVAL: record.COVAL,
      },
      sourceIds: [
        ...(typeof record.SRCID === "string" ? [record.SRCID] : []),
        String(record.RSRCID),
      ],
    });
  }
  return entries;
}
