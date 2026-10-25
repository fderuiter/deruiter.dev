/**
 * Tracker drift report (#2792).
 *
 * Release decisions are read from epic checklists and `status:in-progress`
 * claims, so a checklist that still shows a closed issue as open, or a lane
 * holding more claims than its limit, misleads the person deciding. This
 * module finds both, and the claims nobody appears to be working (#2830).
 * The rules are pure and take plain data; the GitHub reads
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

/** How long a claim may go without an open PR, a push or a comment. */
export const STALE_CLAIM_WINDOW_MS = 24 * 60 * 60 * 1000;

/** What GitHub shows of the work behind one claim. */
export interface ClaimActivity {
  /** Open pull requests that close or cross-reference the issue. */
  openPullRequests: number[];
  /** The newest commit time on a branch whose name contains the number. */
  lastPushAt: string | null;
  /** When the newest comment on the issue was made. */
  lastCommentAt: string | null;
}

/** A claim with no open PR and no push or comment inside the window. */
export interface StaleClaim {
  issue: number;
  title: string;
  /** Assignee logins as `@login`, `lane:` labels, or "unassigned". */
  holders: string[];
  /** The newer of the last push and the last comment, if either exists. */
  lastActivityAt: string | null;
}

export interface TrackerReport {
  repo: string;
  epics: number[];
  drift: ChecklistDrift[];
  /** Checklist references that could not be resolved to an issue state. */
  unresolved: number[];
  claims: ClaimCount[];
  /** Stale claims, or null when claim activity could not be read. */
  staleClaims: StaleClaim[] | null;
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

function claimHolders(
  issue: Pick<TrackerIssue, "labels" | "assignees">
): string[] {
  const holders = [
    ...issue.assignees.map((login) => `@${login}`),
    ...issue.labels.filter((label) => label.startsWith("lane:")),
  ];
  return holders.length ? holders : ["unassigned"];
}

/**
 * Finds the claims that nobody appears to be working.
 *
 * A claim is stale when no open pull request is linked to it and neither a
 * push to a branch named after it nor a comment on it falls inside the
 * window. A claim with no activity entry was not read and is skipped.
 *
 * @param claims - Open issues carrying the in-progress label.
 * @param activity - What GitHub shows for each claim, by issue number.
 * @param now - The time to measure the window back from.
 * @param windowMs - How long a claim may go quiet; defaults to 24 hours.
 * @returns The stale claims, longest quiet first.
 */
export function findStaleClaims(
  claims: readonly Pick<
    TrackerIssue,
    "number" | "title" | "labels" | "assignees"
  >[],
  activity: ReadonlyMap<number, ClaimActivity>,
  now: Date,
  windowMs = STALE_CLAIM_WINDOW_MS
): StaleClaim[] {
  const cutoff = now.getTime() - windowMs;
  const stale: StaleClaim[] = [];
  for (const claim of claims) {
    const seen = activity.get(claim.number);
    if (!seen || seen.openPullRequests.length > 0) continue;
    const times = [seen.lastPushAt, seen.lastCommentAt]
      .filter((t): t is string => t !== null)
      .map((t) => Date.parse(t))
      .filter((t) => !Number.isNaN(t));
    const last = times.length ? Math.max(...times) : null;
    if (last !== null && last > cutoff) continue;
    stale.push({
      issue: claim.number,
      title: claim.title,
      holders: claimHolders(claim),
      lastActivityAt: last === null ? null : new Date(last).toISOString(),
    });
  }
  return stale.sort(
    (a, b) =>
      (a.lastActivityAt ?? "").localeCompare(b.lastActivityAt ?? "") ||
      a.issue - b.issue
  );
}

interface PullRequestNode {
  number?: number;
  state?: string;
}

/** The GraphQL fields {@link fetchTrackerData} reads for one claim. */
export interface ClaimActivityNodes {
  issue?: {
    comments?: { nodes?: ({ createdAt?: string } | null)[] };
    closedByPullRequestsReferences?: {
      nodes?: (PullRequestNode | null)[];
    };
    timelineItems?: {
      nodes?: ({
        source?: PullRequestNode | null;
        subject?: PullRequestNode | null;
      } | null)[];
    };
  } | null;
  refs?: {
    nodes?: ({
      name?: string;
      target?: { committedDate?: string } | null;
    } | null)[];
  } | null;
}

/**
 * Reads one claim's activity from its GraphQL fields.
 *
 * GitHub's ref search matches substrings, so only branches where the number
 * stands alone (`fix/foo-2830`, not `fix/foo-28301`) count as pushes. The
 * push time is the branch head's commit time, which is the closest the API
 * offers to when the branch was last pushed.
 *
 * @param issueNumber - The claimed issue.
 * @param nodes - The issue's comments, linked PRs and timeline, and the
 *   branches whose names matched the number.
 * @returns The claim's activity.
 */
export function toClaimActivity(
  issueNumber: number,
  nodes: ClaimActivityNodes
): ClaimActivity {
  const open = new Set<number>();
  const addIfOpen = (pr: PullRequestNode | null | undefined) => {
    if (pr?.number !== undefined && pr.state === "OPEN") open.add(pr.number);
  };
  for (const pr of nodes.issue?.closedByPullRequestsReferences?.nodes ?? []) {
    addIfOpen(pr);
  }
  for (const item of nodes.issue?.timelineItems?.nodes ?? []) {
    addIfOpen(item?.source);
    addIfOpen(item?.subject);
  }
  const standalone = new RegExp(`(^|\\D)${issueNumber}(\\D|$)`);
  const pushes = (nodes.refs?.nodes ?? [])
    .filter((ref) => ref?.name && standalone.test(ref.name))
    .map((ref) => ref?.target?.committedDate)
    .filter((t): t is string => typeof t === "string")
    .sort();
  return {
    openPullRequests: [...open].sort((a, b) => a - b),
    lastPushAt: pushes.at(-1) ?? null,
    lastCommentAt: nodes.issue?.comments?.nodes?.at(-1)?.createdAt ?? null,
  };
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
    for (const holder of claimHolders(issue)) add(holder, issue.number);
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
 * @param activity - Claim activity and the time to judge it at; leave it
 *   out when the activity could not be read.
 * @returns The tracker report.
 */
export function buildTrackerReport(
  repo: string,
  epics: readonly Pick<TrackerIssue, "number" | "body">[],
  states: ReadonlyMap<number, "open" | "closed">,
  claims: readonly Pick<
    TrackerIssue,
    "number" | "title" | "labels" | "assignees"
  >[],
  activity?: { byIssue: ReadonlyMap<number, ClaimActivity>; now: Date }
): TrackerReport {
  const { drift, unresolved } = findChecklistDrift(epics, states);
  return {
    repo,
    epics: epics.map(({ number }) => number),
    drift,
    unresolved,
    claims: countClaims(claims),
    staleClaims: activity
      ? findStaleClaims(claims, activity.byIssue, activity.now)
      : null,
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
  if (report.staleClaims === null) {
    lines.push("", "Stale claims: not checked (claim activity was not read)");
  } else {
    lines.push(
      "",
      `Stale claims (no open PR, push or comment in 24 h): ${report.staleClaims.length}`
    );
    for (const {
      issue,
      title,
      holders,
      lastActivityAt,
    } of report.staleClaims) {
      lines.push(
        `  #${issue} ${holders.join(" ")} last activity ${lastActivityAt ?? "none"}: ${title.slice(0, 100)}`
      );
    }
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
 * Reads the epics, the states of the issues they name, the open claims and
 * the activity behind each claim.
 *
 * Uses the REST API for the two label lists, one GraphQL query per 100
 * referenced issues for their states, and one per 25 claims for their
 * activity, so a run costs a handful of requests. GraphQL needs a token, so
 * without one the states stay unresolved and stale claims are not checked.
 *
 * @param repo - `owner/name`.
 * @param token - A GitHub token, or undefined to read anonymously.
 * @param fetchImpl - The `fetch` to use; injected by tests.
 * @param now - The time stale claims are judged at; injected by tests.
 * @returns The built report.
 */
export async function fetchTrackerData(
  repo: string,
  token: string | undefined,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
  now: Date = new Date()
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
  if (!token) return buildTrackerReport(repo, epics, states, claims);

  const queryRepository = async (fields: string) => {
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
      data?: { repository?: Record<string, unknown> | null };
    };
    return payload.data?.repository ?? {};
  };

  for (let start = 0; start < referenced.length; start += 100) {
    const chunk = referenced.slice(start, start + 100);
    const repository = await queryRepository(
      chunk
        .map(
          (n) =>
            `i${n}: issueOrPullRequest(number: ${n}) { ... on Issue { state } ... on PullRequest { state } }`
        )
        .join("\n")
    );
    for (const n of chunk) {
      const state = (repository[`i${n}`] as { state?: string } | null)?.state;
      if (state) states.set(n, state === "OPEN" ? "open" : "closed");
    }
  }

  // Claim activity is heavier per issue, so it goes 25 claims at a time.
  const byIssue = new Map<number, ClaimActivity>();
  for (let start = 0; start < claims.length; start += 25) {
    const chunk = claims.slice(start, start + 25).map((c) => c.number);
    const repository = await queryRepository(
      chunk
        .map(
          (n) => `c${n}: issue(number: ${n}) {
  comments(last: 1) { nodes { createdAt } }
  closedByPullRequestsReferences(first: 10, includeClosedPrs: false) { nodes { number state } }
  timelineItems(itemTypes: [CROSS_REFERENCED_EVENT, CONNECTED_EVENT], last: 50) { nodes { ... on CrossReferencedEvent { source { ... on PullRequest { number state } } } ... on ConnectedEvent { subject { ... on PullRequest { number state } } } } }
}
b${n}: refs(refPrefix: "refs/heads/", query: "${n}", first: 20) { nodes { name target { ... on Commit { committedDate } } } }`
        )
        .join("\n")
    );
    for (const n of chunk) {
      byIssue.set(
        n,
        toClaimActivity(n, {
          issue: repository[`c${n}`] as ClaimActivityNodes["issue"],
          refs: repository[`b${n}`] as ClaimActivityNodes["refs"],
        })
      );
    }
  }
  return buildTrackerReport(repo, epics, states, claims, { byIssue, now });
}
