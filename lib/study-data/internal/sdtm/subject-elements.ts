/**
 * SDTM SE (#2711): the elements each subject actually passed through, from
 * the planned elements of their arm in TA and the dates that move a subject
 * from one epoch to the next. The epochs are the ones the other domains'
 * EPOCH uses: before first exposure, from first through last exposure, and
 * after it. An element starts on the date the subject entered it and ends
 * when the next one starts (SDTMIG 3.4, section 5.3), so a record dated on
 * the boundary is in both. Nothing is inferred: a subject enters the third
 * epoch only when a record of theirs is dated after last exposure.
 */
import type { CellValue, Dataset } from "../../types";

type Row = Record<string, CellValue>;

/** One SE row with the collected records it traces to. */
export interface SubjectElementEntry {
  readonly row: Row;
  readonly sourceIds: readonly string[];
}

/** What one subject's elements are derived from. */
export interface SubjectElementInput {
  readonly subject: string;
  /** The collected demographics record, with the consent date. */
  readonly demographics: Row;
  /** The randomization record; absent for a subject never randomized. */
  readonly randomization?: Row;
  /** The exposure record; absent for a subject never dosed. */
  readonly exposure?: Row;
  /** The subject's latest complete date and the record it is on. */
  readonly lastContact?: { readonly date: string; readonly record: Row };
}

function text(value: CellValue | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function fullDate(value: CellValue | undefined): string | null {
  const date = text(value);
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

/**
 * The TA row of each arm's element in each epoch, keyed `ARMCD|EPOCH`, and
 * the element every arm shares in an epoch, keyed `|EPOCH`, when they agree.
 */
function elementsByArmAndEpoch(ta: Dataset): Map<string, Row> {
  const byKey = new Map<string, Row>();
  const shared = new Map<string, Row | null>();
  for (let index = 0; index < ta.rowCount; index += 1) {
    const row = Object.fromEntries(
      ["ARMCD", "TAETORD", "ETCD", "ELEMENT", "EPOCH"].map((name) => [
        name,
        ta.columns[name]?.[index] ?? null,
      ])
    );
    const epoch = text(row.EPOCH);
    if (!epoch) continue;
    byKey.set(`${text(row.ARMCD)}|${epoch}`, row);
    const prior = shared.get(epoch);
    shared.set(
      epoch,
      prior === undefined || (prior && prior.ETCD === row.ETCD) ? row : null
    );
  }
  for (const [epoch, row] of shared) if (row) byKey.set(`|${epoch}`, row);
  return byKey;
}

/**
 * Derive each subject's SE rows, in the order of `subjects`.
 *
 * @param studyId - The study identifier written to STUDYID.
 * @param subjects - Each subject's consent, randomization, exposure and last
 *   contact, from the collected records.
 * @param ta - The tabulated TA dataset.
 * @param epochs - The study's epoch names in USDM order.
 * @param studyDay - The study day of a date for a subject, or null.
 * @returns One row per element entered, unnumbered, each tracing to the
 *   collected records its dates come from.
 */
export function deriveSubjectElements(
  studyId: string,
  subjects: readonly SubjectElementInput[],
  ta: Dataset | undefined,
  epochs: readonly string[],
  studyDay: (date: CellValue, subject: SubjectElementInput) => number | null
): SubjectElementEntry[] {
  const planned = ta ? elementsByArmAndEpoch(ta) : new Map<string, Row>();
  const entries: SubjectElementEntry[] = [];
  for (const input of subjects) {
    const { demographics, randomization, exposure, lastContact } = input;
    const arm = text(randomization?.ARMCD) ?? "";
    const lastDose = fullDate(exposure?.EXENDTC);
    // Each epoch the subject entered: when, and the record that says so.
    const entered: { start: CellValue; record: Row | undefined }[] = [
      { start: demographics.CONSENTDTC ?? null, record: demographics },
    ];
    if (exposure) {
      entered.push({ start: exposure.EXSTDTC ?? null, record: exposure });
      if (lastDose && lastContact && lastContact.date > lastDose)
        entered.push({ start: exposure.EXENDTC ?? null, record: exposure });
    }
    entered.forEach(({ start, record }, index) => {
      const element = planned.get(`${arm}|${epochs[index]}`);
      if (!element) return;
      const next = entered[index + 1];
      const end = next ? next.start : (lastContact?.date ?? null);
      const sources = [
        record,
        index === 1 ? randomization : undefined,
        next ? next.record : lastContact?.record,
      ].flatMap((source) =>
        text(source?.SRCID) ? [text(source?.SRCID)!] : []
      );
      entries.push({
        row: {
          STUDYID: studyId,
          DOMAIN: "SE",
          USUBJID: input.subject,
          ETCD: element.ETCD,
          ELEMENT: element.ELEMENT,
          TAETORD: element.TAETORD,
          EPOCH: element.EPOCH,
          SESTDTC: start,
          SEENDTC: end,
          SESTDY: studyDay(start, input),
          SEENDY: studyDay(end, input),
        },
        sourceIds: [...new Set(sources)],
      });
    });
  }
  return entries;
}
