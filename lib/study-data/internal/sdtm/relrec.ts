/**
 * SDTM RELREC (#3414): links each adverse event to the concomitant
 * medication given for it. The EDC records the link on the medication, as
 * the number of the adverse event it treats (CMAENO); RELREC states it as a
 * pair of records, the AE identified by AESEQ and the CM by CMSEQ, sharing
 * one RELID (SDTMIG 3.4, section 8.2). Nothing is inferred: a medication with
 * no related AE number, or whose AE was never tabulated, is not linked.
 */
import type { CellValue, Dataset } from "../../types";

type Row = Record<string, CellValue>;

/** One RELREC row with the collected records it traces to. */
export interface RelrecEntry {
  readonly row: Row;
  readonly sourceIds: readonly string[];
}

/**
 * The collected source id of a medication's related adverse event: the same
 * study and subject as the medication, with the AE number as its suffix, the
 * way the collected data numbers each subject's adverse events.
 */
function relatedAeSource(medicationSource: string, aeNumber: string) {
  const parts = medicationSource.split(":");
  if (parts.length !== 4 || parts[1] !== "CM") return null;
  return `${parts[0]}:AE:${parts[2]}:${aeNumber}`;
}

/**
 * Derive the RELREC rows that link tabulated AE records to the tabulated CM
 * records given for them.
 *
 * @param studyId - The study identifier written to STUDYID.
 * @param collectedCm - The collected CM records, with SRCID and CMAENO.
 * @param ae - The tabulated SDTM AE dataset, numbered, with its lineage.
 * @param cm - The tabulated SDTM CM dataset, numbered, with its lineage.
 * @returns Two rows per linked pair, AE first, in CM order, each tracing to
 *   both collected records.
 */
export function deriveRelrec(
  studyId: string,
  collectedCm: readonly Row[],
  ae: Dataset,
  cm: Dataset
): RelrecEntry[] {
  const aeNumberBySource = new Map<string, string>();
  for (const record of collectedCm) {
    const source = record.SRCID;
    const aeNumber = record.CMAENO;
    if (typeof source === "string" && typeof aeNumber === "string" && aeNumber)
      aeNumberBySource.set(source, aeNumber);
  }
  const aeRowBySource = new Map<string, number>();
  (ae.lineage ?? []).forEach((sources, row) => {
    for (const source of sources) aeRowBySource.set(source, row);
  });

  const entries: RelrecEntry[] = [];
  const relationships = new Map<string, number>();
  for (let row = 0; row < cm.rowCount; row += 1) {
    const cmSources = cm.lineage?.[row] ?? [];
    const linked = cmSources.flatMap((source) => {
      const aeNumber = aeNumberBySource.get(source);
      const aeSource = aeNumber ? relatedAeSource(source, aeNumber) : null;
      const aeRow = aeSource ? aeRowBySource.get(aeSource) : undefined;
      return aeRow === undefined ? [] : [aeRow];
    });
    const aeRow = linked[0];
    if (aeRow === undefined) continue;
    const subject = cm.columns.USUBJID?.[row] ?? null;
    const relid = (relationships.get(String(subject)) ?? 0) + 1;
    relationships.set(String(subject), relid);
    const sourceIds = [
      ...new Set([...(ae.lineage?.[aeRow] ?? []), ...cmSources]),
    ];
    const link = (domain: "AE" | "CM", seq: CellValue) => ({
      row: {
        STUDYID: studyId,
        RDOMAIN: domain,
        USUBJID: subject,
        IDVAR: `${domain}SEQ`,
        IDVARVAL: seq === null ? null : String(seq),
        RELTYPE: null,
        RELID: String(relid),
      },
      sourceIds,
    });
    entries.push(
      link("AE", ae.columns.AESEQ?.[aeRow] ?? null),
      link("CM", cm.columns.CMSEQ?.[row] ?? null)
    );
  }
  return entries;
}
