/**
 * Tracker drift report (#2792).
 *
 * Release decisions are read from epic checklists and `status:in-progress`
 * claims, so a checklist that still shows a closed issue as open, or a lane
 * holding more claims than its limit, misleads the person deciding. This
 * module finds both. The rules are pure and take plain data; the GitHub reads
 * sit behind {@link fetchTrackerData} and its injectable `fetch`.
 *
 * Report only: nothing here edits an issue.
 */

/** The label a claim carries while someone works the issue. */
export const IN_PROGRESS_LABEL = "status:in-progress";

/** The label that marks an issue as an epic whose checklist is tracked. */
export const EPIC_LABEL = "type:epic";

/** One checklist line whose subject is an issue reference. */
export interface ChecklistItem {
  /** The 1-based line number in the epic body. */
  line: number;
  checked: boolean;
  /** The issue the line is about: the first `#N` after the checkbox. */
  issue: number;
  text: string;
}

export interface TrackerIssue {
  number: number;
  title: string;
  state: "open" | "closed";
  labels: string[];
  assignees: string[];
  body?: string;
}

export type DriftKind = "unticked-closed" | "ticked-open";

export interface ChecklistDrift {
  epic: number;
  kind: DriftKind;
  item: ChecklistItem;
}

export interface ClaimCount {
  /** An assignee login, a `lane:` label, or "unassigned". */
  holder: string;
  issues: number[];
}

export interface TrackerReport {
  repo: string;
  epics: number[];
  drift: ChecklistDrift[];
  /** Checklist references that could not be resolved to an issue state. */
  unresolved: number[];
  claims: ClaimCount[];
}

const CHECKLIST_LINE = /^\s*[-*]\s+\[([ xX])\]\s+(?:~~)?\*{0,2}#(\d+)\b(.*)$/;

/**
 * Finds the checklist lines whose subject is an issue.
 *
 * A line's subject is the issue reference that opens it, so a ticked
 * `#2583 to #2590 merged` is about issue 2583, while a line that only
 * mentions an issue later in its text has no subject and is skipped.
 * Fenced code is ignored.
 *
 * @param body - An epic's Markdown body.
 * @returns The checklist items in body order.
 */
export function parseChecklist(body: string): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  let fenced = false;
  body.split(/\r?\n/).forEach((text, index) => {
    if (/^\s*(```|~~~)/.test(text)) {
      fenced = !fenced;
      return;
    }
    if (fenced) return;
    const match = CHECKLIST_LINE.exec(text);
    if (!match) return;
    items.push({
      line: index + 1,
      checked: match[1] !== " ",
      issue: Number(match[2]),
      text: text.trim(),
    });
  });
  return items;
}

/**
 * Compares each epic's checklist with the state of the issues it names.
 *
 * An unticked line whose issue is closed is drift. A ticked line whose issue
 * is still open is reported too, since it is drift unless the line covers
 * only part of that issue, which a person can tell at a glance.
 *
 * @param epics - The open epics, with bodies.
 * @param states - Issue states by number; a missing number is unresolved.
 * @returns The drift found and the references that could not be resolved.
 */
export function findChecklistDrift(
  epics: readonly Pick<TrackerIssue, "number" | "body">[],
  states: ReadonlyMap<number, "open" | "closed">
): { drift: ChecklistDrift[]; unresolved: number[] } {
  const drift: ChecklistDrift[] = [];
  const unresolved = new Set<number>();
  for (const epic of epics) {
    for (const item of parseChecklist(epic.body ?? "")) {
      const state = states.get(item.issue);
      if (!state) {
        unresolved.add(item.issue);
        continue;
      }
      if (!item.checked && state === "closed") {
        drift.push({ epic: epic.number, kind: "unticked-closed", item });
      } else if (item.checked && state === "open") {
        drift.push({ epic: epic.number, kind: "ticked-open", item });
      }
    }
  }
  return { drift, unresolved: [...unresolved].sort((a, b) => a - b) };
}

/**
 * Counts open `status:in-progress` claims per holder.
 *
 * A claim counts once for each assignee and once for each `lane:` label, so
 * a WIP limit reads at a glance either way. A claim with neither is counted
 * under "unassigned".
 *
 * @param issues - Open issues carrying the in-progress label.
 * @returns Holders with the most claims first, then by name.
 */
export function countClaims(
  issues: readonly Pick<TrackerIssue, "number" | "labels" | "assignees">[]
): ClaimCount[] {
  const byHolder = new Map<string, number[]>();
  const add = (holder: string, issue: number) =>
    byHolder.set(holder, [...(byHolder.get(holder) ?? []), issue]);
  for (const issue of issues) {
    const holders = [
      ...issue.assignees.map((login) => `@${login}`),
      ...issue.labels.filter((label) => label.startsWith("lane:")),
    ];
    for (const holder of holders.length ? holders : ["unassigned"]) {
      add(holder, issue.number);
    }
  }
  return [...byHolder]
    .map(([holder, numbers]) => ({
      holder,
      issues: [...numbers].sort((a, b) => a - b),
    }))
    .sort(
      (a, b) =>
        b.issues.length - a.issues.length || a.holder.localeCompare(b.holder)
    );
}

/**
 * Builds the report from data already read.
 *
 * @param repo - `owner/name`, for the report header.
 * @param epics - The open epics, with bodies.
 * @param states - Issue states by number.
 * @param claims - Open issues carrying the in-progress label.
 * @returns The tracker report.
 */
export function buildTrackerReport(
  repo: string,
  epics: readonly Pick<TrackerIssue, "number" | "body">[],
  states: ReadonlyMap<number, "open" | "closed">,
  claims: readonly Pick<TrackerIssue, "number" | "labels" | "assignees">[]
): TrackerReport {
  const { drift, unresolved } = findChecklistDrift(epics, states);
  return {
    repo,
    epics: epics.map(({ number }) => number),
    drift,
    unresolved,
    claims: countClaims(claims),
  };
}

/**
 * Renders the report as plain text.
 *
 * @param report - The result of {@link buildTrackerReport}.
 * @returns One section per finding type.
 */
export function formatTrackerReport(report: TrackerReport): string {
  const lines = [
    `Tracker drift for ${report.repo} (${report.epics.length} open epics)`,
  ];
  const section = (kind: DriftKind, heading: string) => {
    const found = report.drift.filter((d) => d.kind === kind);
    lines.push("", `${heading}: ${found.length}`);
    for (const { epic, item } of found) {
      lines.push(`  #${epic}:${item.line} ${item.text.slice(0, 140)}`);
    }
  };
  section("unticked-closed", "Unticked, but the issue is closed");
  section(
    "ticked-open",
    "Ticked, but the issue is open (fine if the line covers only part)"
  );
  if (report.unresolved.length) {
    lines.push(
      "",
      `Unresolved references: ${report.unresolved.map((n) => `#${n}`).join(" ")}`
    );
  }
  const total = new Set(report.claims.flatMap(({ issues }) => issues)).size;
  lines.push("", `${IN_PROGRESS_LABEL} claims: ${total}`);
  for (const { holder, issues } of report.claims) {
    lines.push(
      `  ${holder}: ${issues.length} (${issues.map((n) => `#${n}`).join(" ")})`
    );
  }
  return lines.join("\n");
}

type FetchLike = (
  url: string,
  init: { headers: Record<string, string>; method?: string; body?: string }
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

interface RestIssue {
  number: number;
  title: string;
  state: string;
  body?: string | null;
  labels: ({ name?: string } | string)[];
  assignees?: { login: string }[] | null;
  pull_request?: unknown;
}

function toIssue(raw: RestIssue): TrackerIssue {
  return {
    number: raw.number,
    title: raw.title,
    state: raw.state === "closed" ? "closed" : "open",
    labels: raw.labels.map((label) =>
      typeof label === "string" ? label : (label.name ?? "")
    ),
    assignees: (raw.assignees ?? []).map(({ login }) => login),
    body: raw.body ?? "",
  };
}

/**
 * Reads the epics, the states of the issues they name, and the open claims.
 *
 * Uses the REST API for the two label lists and one GraphQL query per 100
 * referenced issues for their states, so a run costs a handful of requests.
 * GraphQL needs a token, so without one the states stay unresolved.
 *
 * @param repo - `owner/name`.
 * @param token - A GitHub token, or undefined to read anonymously.
 * @param fetchImpl - The `fetch` to use; injected by tests.
 * @returns The built report.
 */
export async function fetchTrackerData(
  repo: string,
  token: string | undefined,
  fetchImpl: FetchLike = fetch as unknown as FetchLike
): Promise<TrackerReport> {
  const [owner, name] = repo.split("/");
  if (!owner || !name) throw new Error(`Expected owner/name, got "${repo}"`);
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "deruiter-dx-trackers",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const listByLabel = async (label: string): Promise<TrackerIssue[]> => {
    const issues: TrackerIssue[] = [];
    for (let page = 1; page <= 10; page += 1) {
      const url = `https://api.github.com/repos/${owner}/${name}/issues?state=open&per_page=100&page=${page}&labels=${encodeURIComponent(label)}`;
      const response = await fetchImpl(url, { headers });
      if (!response.ok) {
        throw new Error(`GitHub returned ${response.status} for ${label}`);
      }
      const batch = (await response.json()) as RestIssue[];
      issues.push(...batch.filter((i) => !i.pull_request).map(toIssue));
      if (batch.length < 100) break;
    }
    return issues;
  };

  const epics = await listByLabel(EPIC_LABEL);
  const claims = await listByLabel(IN_PROGRESS_LABEL);
  const referenced = [
    ...new Set(
      epics
        .flatMap((epic) => parseChecklist(epic.body ?? ""))
        .map((i) => i.issue)
    ),
  ];
  const states = new Map<number, "open" | "closed">();
  if (token) {
    for (let start = 0; start < referenced.length; start += 100) {
      const chunk = referenced.slice(start, start + 100);
      const fields = chunk
        .map(
          (n) =>
            `i${n}: issueOrPullRequest(number: ${n}) { ... on Issue { state } ... on PullRequest { state } }`
        )
        .join("\n");
      const response = await fetchImpl("https://api.github.com/graphql", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `query { repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) { ${fields} } }`,
        }),
      });
      if (!response.ok) {
        throw new Error(`GitHub GraphQL returned ${response.status}`);
      }
      const payload = (await response.json()) as {
        data?: { repository?: Record<string, { state?: string } | null> };
      };
      for (const n of chunk) {
        const state = payload.data?.repository?.[`i${n}`]?.state;
        if (state) states.set(n, state === "OPEN" ? "open" : "closed");
      }
    }
  }
  return buildTrackerReport(repo, epics, states, claims);
}
