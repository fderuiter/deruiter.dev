import type { EventOption, StudyEvent, StudyState } from "../types";

/** Shorthand for an option; `debt` is what skipping documentation adds. */
function opt(
  id: string,
  label: string,
  attentionCost: number,
  debt: number,
  effects: EventOption["effects"],
  extra: Pick<EventOption, "flags" | "schedule" | "finding"> = {}
): EventOption {
  return {
    id,
    label,
    attentionCost,
    debtIfUndocumented: debt,
    effects,
    ...extra,
  };
}

const allSites = (patch: { burden?: number; trainingCurrent?: boolean }) =>
  ["site-01", "site-02", "site-03"].map((siteId) => ({ siteId, ...patch }));

const meanLoad = (s: StudyState): number =>
  s.team.reduce((n, m) => n + m.workload, 0) / Math.max(1, s.team.length);
const sumSites = (
  s: StudyState,
  pick: (x: StudyState["sites"][number]) => number
): number => s.sites.reduce((n, x) => n + pick(x), 0);

/**
 * The slice's events, in roughly the order a study would meet them. Scripted
 * events appear on their day; triggered ones appear when the study's own
 * state calls for them; follow-ups only appear when an earlier choice
 * schedules them. Every message is fictional.
 */
export const STUDY_EVENTS: StudyEvent[] = [
  // Protocol and planning
  {
    id: "sponsor-biomarkers",
    from: "Arcadia Therapeutics (Sponsor)",
    subject: "Exploratory biomarkers",
    body: "Could we add exploratory biomarkers to the schedule? It shouldn't affect anything, right?",
    urgency: "important",
    day: 1,
    ttl: 3,
    ifIgnored: { meters: { client: -5 } },
    options: [
      opt(
        "accept",
        "Sure, we'll add them",
        1,
        6,
        { meters: { client: 6 }, sites: allSites({ burden: 10 }) },
        { flags: ["biomarkers-added"] }
      ),
      opt(
        "assess",
        "Add them after an impact assessment",
        3,
        2,
        { meters: { client: 2 }, spend: 4000, sites: allSites({ burden: 4 }) },
        { flags: ["biomarkers-added"] }
      ),
      opt("decline", "Decline: not in this protocol", 1, 2, {
        meters: { client: -8, integrity: 3 },
      }),
      opt("addendum", "Propose it for a later addendum", 2, 3, {
        slipDays: 2,
        meters: { integrity: 3 },
      }),
    ],
  },
  {
    id: "stat-endpoint-two",
    from: "Priya (Biostatistician)",
    subject: "Endpoint 2 derivation",
    body: "Need a final derivation decision for endpoint 2 before I can finish the SAP.",
    urgency: "important",
    day: 2,
    ttl: 4,
    ifIgnored: {
      meters: { integrity: -4 },
      workload: [{ memberId: "priya", delta: 10 }],
    },
    options: [
      opt("decide", "Decide it together now", 2, 3, {
        meters: { integrity: 6 },
      }),
      opt("delegate", "You decide, Priya", 0, 8, { meters: { integrity: 2 } }),
      opt(
        "defer",
        "Defer until closer to lock",
        1,
        6,
        { meters: { integrity: -2 } },
        {
          flags: ["endpoint2-deferred"],
          schedule: [{ eventId: "endpoint-rework", inDays: 56 }],
        }
      ),
    ],
  },
  {
    id: "site-three-irb",
    from: "Dana (Regulatory)",
    subject: "Site 03 IRB paperwork",
    body: "Site 03 hasn't submitted its IRB package. Their coordinator isn't answering me.",
    urgency: "important",
    day: 3,
    ttl: 4,
    ifIgnored: { slipDays: 2, workload: [{ memberId: "dana", delta: 10 }] },
    options: [
      opt("chase", "Call the coordinator yourself", 2, 2, {
        sites: [{ siteId: "site-03", burden: 2 }],
      }),
      opt("escalate", "Escalate to the site's PI", 2, 3, {
        meters: { client: 0 },
        sites: [{ siteId: "site-03", burden: 4 }],
      }),
      opt("dana", "Let Dana keep chasing", 0, 2, {
        workload: [{ memberId: "dana", delta: 12 }],
      }),
    ],
  },
  {
    id: "boss-proposal-call",
    from: "Your boss",
    subject: "Acme proposal call at 2?",
    body: "Can you join the Acme proposal call at 2? You'd be great for the operations part.",
    urgency: "routine",
    day: 4,
    ttl: 1,
    ifIgnored: { meters: { team: -2 } },
    options: [
      opt("join", "Join the call", 3, 0, { meters: { team: 2 } }),
      opt("send-walt", "Send Walt in your place", 1, 0, {
        workload: [{ memberId: "walt", delta: 10 }],
      }),
      opt("decline", "Decline politely", 0, 0, { meters: { team: -1 } }),
    ],
  },
  {
    id: "dm-build-slip",
    from: "Maya (Data Manager)",
    subject: "Database build validation",
    body: "Build validation will slip about four days. I can hit Friday if we deprioritize edit-check testing.",
    urgency: "important",
    day: 6,
    ttl: 3,
    ifIgnored: { slipDays: 4, workload: [{ memberId: "maya", delta: 10 }] },
    options: [
      opt("push", "Push her to hit Friday", 1, 6, {
        meters: { integrity: -5 },
        workload: [{ memberId: "maya", delta: 15 }],
      }),
      opt("slip", "Accept the four-day slip", 1, 2, {
        slipDays: 4,
        meters: { client: -3 },
      }),
      opt("borrow", "Borrow another data manager", 2, 2, {
        spend: 6000,
        workload: [{ memberId: "maya", delta: -15 }],
      }),
      opt(
        "scope",
        "Reduce validation scope",
        1,
        8,
        {
          meters: { integrity: -8, compliance: -6 },
        },
        {
          finding: {
            question:
              "Edit-check testing was reduced during database build. What was the rationale and impact assessment?",
            answer:
              "The reduced scope, its rationale and an impact assessment are on file.",
            severity: "minor",
          },
        }
      ),
      opt("escalate", "Escalate to management", 2, 2, {
        slipDays: 2,
        meters: { client: -2 },
      }),
    ],
  },
  // Startup
  {
    id: "site-three-training",
    from: "Dana (Regulatory)",
    subject: "Amendment 1 training",
    body: "The Site 03 coordinator hasn't completed training on Amendment 1. Enrollment opens tomorrow.",
    urgency: "important",
    day: 9,
    ttl: 3,
    trigger: (s) => !s.sites[2]?.trainingCurrent,
    ifIgnored: { meters: { compliance: -6 } },
    options: [
      opt("require", "Hold enrollment until they train", 2, 1, {
        slipDays: 2,
        sites: [{ siteId: "site-03", trainingCurrent: true }],
      }),
      opt(
        "waive",
        "Let them enroll and train later",
        0,
        8,
        {
          meters: { compliance: -3 },
        },
        {
          finding: {
            question:
              "Site 03 staff performed study procedures before completing training on Amendment 1. Explain.",
            answer:
              "A waiver with a risk assessment and completed training records is on file.",
            severity: "minor",
          },
        }
      ),
      opt("remote", "Have Walt train them remotely", 2, 2, {
        workload: [{ memberId: "walt", delta: 12 }],
        sites: [{ siteId: "site-03", trainingCurrent: true }],
      }),
    ],
  },
  {
    id: "coordinator-dose-time",
    from: "Site 02 coordinator",
    subject: "Subject 014 dosing time",
    body: "Subject 014 took their dose at 08:02 instead of 08:00. Is this a protocol deviation?",
    urgency: "routine",
    day: 10,
    ttl: 2,
    ifIgnored: { sites: [{ siteId: "site-02", burden: 4, openQueries: 1 }] },
    options: [
      opt("guide", "Reply with the protocol window", 1, 0, {
        sites: [{ siteId: "site-02", burden: -3 }],
      }),
      opt("stats", "Ask Priya for a ruling", 1, 0, {
        workload: [{ memberId: "priya", delta: 5 }],
      }),
    ],
  },
  {
    id: "lab-manual",
    from: "Site 01",
    subject: "Where is the lab manual?",
    body: "Where can I find the lab manual?",
    urgency: "routine",
    day: 11,
    ttl: 2,
    ifIgnored: { sites: [{ siteId: "site-01", deviations: 1 }] },
    options: [
      opt("reply", "Reply with the link", 1, 0, {}),
      opt("walt", "Ask Walt to handle it", 0, 0, {
        workload: [{ memberId: "walt", delta: 4 }],
      }),
    ],
  },
  {
    id: "sponsor-ceo-call",
    from: "Arcadia Therapeutics (Sponsor)",
    subject: "CEO joining Friday's call",
    body: "Our CEO will join Friday. Could you send a status deck beforehand? Great work so far, we love the momentum!",
    urgency: "important",
    day: 14,
    ttl: 3,
    ifIgnored: { meters: { client: -6 } },
    options: [
      opt("deck", "Build a proper status deck", 3, 0, {
        meters: { client: 8 },
      }),
      opt("template", "Send last week's template", 1, 0, {
        meters: { client: 2 },
      }),
      opt("dashboard", "Point them to the dashboard", 0, 0, {
        meters: { client: -3 },
      }),
    ],
  },
  // Conduct
  {
    id: "sponsor-enrollment-numbers",
    from: "Arcadia Therapeutics (Sponsor)",
    subject: "Enrollment numbers before 10 AM",
    body: "Can you send updated enrollment numbers before our 10 AM call?",
    urgency: "routine",
    day: 22,
    ttl: 1,
    ifIgnored: { meters: { client: -4 } },
    options: [
      opt("send", "Send the numbers", 1, 0, { meters: { client: 3 } }),
      opt("walt", "Ask Walt to pull them", 0, 0, {
        workload: [{ memberId: "walt", delta: 6 }],
        meters: { client: 1 },
      }),
    ],
  },
  {
    id: "edc-missing-subject",
    from: "Site 03",
    subject: "Subject 031 not in EDC",
    body: "Subject 031 was randomized yesterday but we're not seeing them in EDC. Please advise.",
    urgency: "critical",
    day: 24,
    ttl: 2,
    ifIgnored: {
      sites: [{ siteId: "site-03", unsignedSource: 2, openQueries: 3 }],
      meters: { integrity: -4 },
    },
    options: [
      opt("call", "Call the coordinator", 2, 2, {
        sites: [{ siteId: "site-03", openQueries: -1 }],
      }),
      opt("audit", "Audit Site 03", 2, 0, { auditSites: ["site-03"] }),
      opt("email", "Email and wait", 0, 4, {
        sites: [{ siteId: "site-03", openQueries: 1 }],
      }),
    ],
  },
  {
    id: "cowboy-pi-consent",
    from: "Site 01 PI",
    subject: "Second consent signature",
    body: "We've always done it this way. I don't see why the second consent signature matters.",
    urgency: "important",
    day: 26,
    ttl: 3,
    ifIgnored: {
      sites: [{ siteId: "site-01", unsignedSource: 2 }],
      meters: { compliance: -4 },
    },
    options: [
      opt("firm", "Explain why it is required", 2, 0, {
        meters: { compliance: 4 },
        sites: [{ siteId: "site-01", burden: 3 }],
      }),
      opt(
        "slide",
        "Let it slide this once",
        0,
        12,
        {
          meters: { compliance: -4 },
          sites: [{ siteId: "site-01", unsignedSource: 2 }],
        },
        {
          flags: ["consent-waived"],
          finding: {
            question:
              "Consent forms for Site 01 subjects lack the required second signature. Explain.",
            answer:
              "The deviation was logged, the PI was retrained and consent was re-obtained.",
            severity: "major",
          },
        }
      ),
      opt("deviation", "Log it as a deviation and retrain", 3, 0, {
        meters: { compliance: 2 },
        sites: [{ siteId: "site-01", deviations: 1, burden: -2 }],
      }),
    ],
  },
  {
    id: "veteran-warning",
    from: "Walt (Monitor)",
    subject: "I think we have a problem",
    body: "Fred, I think we have a problem. Queries are piling up and Maya is underwater.",
    urgency: "critical",
    day: 28,
    ttl: 3,
    trigger: (s) =>
      (s.team[0]?.workload ?? 0) > 75 || sumSites(s, (x) => x.openQueries) >= 6,
    ifIgnored: {
      meters: { integrity: -6, team: -6 },
      workload: [{ memberId: "maya", delta: 15 }],
    },
    options: [
      opt("support", "Bring in data management support", 2, 2, {
        spend: 5000,
        workload: [{ memberId: "maya", delta: -25 }],
      }),
      opt("prioritize", "Reprioritize queries with Maya", 2, 1, {
        sites: [
          { siteId: "site-01", openQueries: -3 },
          { siteId: "site-03", openQueries: -3 },
        ],
      }),
      opt("reassure", "Thank him, keep going", 0, 4, { meters: { team: -2 } }),
    ],
  },
  {
    id: "optimistic-analysis",
    from: "Priya (Biostatistician)",
    subject: "Analysis timeline",
    body: "Yeah, analysis should take about three days.",
    urgency: "important",
    day: 30,
    ttl: 4,
    ifIgnored: { meters: { timeline: -2 } },
    options: [
      opt(
        "accept",
        "Plan on three days",
        0,
        2,
        {},
        { schedule: [{ eventId: "analysis-slip", inDays: 36 }] }
      ),
      opt("buffer", "Book a realistic buffer now", 1, 1, {
        slipDays: 2,
        meters: { client: -2, integrity: 2 },
      }),
      opt("programmer", "Ask Omar to sanity-check the plan", 2, 1, {
        workload: [{ memberId: "omar", delta: 10 }],
        meters: { integrity: 3 },
      }),
    ],
  },
  {
    id: "eligibility-subject-017",
    from: "Site 01",
    subject: "Subject 017 creatinine",
    body: "Subject 017's screening creatinine was outside the eligibility range but the PI wants to dose today. Advise?",
    urgency: "critical",
    day: 33,
    ttl: 1,
    ifIgnored: {
      sites: [{ siteId: "site-01", eligibilityConcerns: 1 }],
      meters: { integrity: -5 },
    },
    options: [
      opt(
        "proceed",
        "Proceed, we'll document later",
        0,
        14,
        {
          sites: [{ siteId: "site-01", eligibilityConcerns: 1 }],
          meters: { integrity: -3 },
        },
        {
          flags: ["subject-017-proceeded"],
          finding: {
            question:
              "Subject 017 received study medication despite a creatinine result outside the eligibility criteria. Explain why the subject remained enrolled.",
            answer:
              "Medical monitor reviewed the laboratory result. A repeat sample showed the first was hemolyzed. The repeat met the criterion and sponsor medical approval is on file.",
            severity: "major",
          },
        }
      ),
      opt(
        "review",
        "Medical monitor review and repeat sample",
        3,
        2,
        { spend: 1500, slipDays: 1, meters: { integrity: 5 } },
        { flags: ["subject-017-reviewed"] }
      ),
      opt("withdraw", "Do not enroll the subject", 1, 1, {
        sites: [{ siteId: "site-01", enrolled: -1 }],
        meters: { integrity: 6, client: -4 },
      }),
    ],
  },
  {
    id: "sponsor-endpoint-timepoint",
    from: "Arcadia Therapeutics (Sponsor)",
    subject: "Change the primary timepoint",
    body: "We talked to our advisors: could we move the primary PK timepoint? Should be a small change.",
    urgency: "important",
    day: 35,
    ttl: 3,
    ifIgnored: { meters: { client: -4 } },
    options: [
      opt("amend", "Process a formal amendment", 3, 0, {
        spend: 5000,
        slipDays: 3,
        meters: { compliance: 4 },
        sites: allSites({ trainingCurrent: false }),
      }),
      opt(
        "agree",
        "Agree by email",
        1,
        12,
        {
          meters: { client: 5, compliance: -6 },
        },
        {
          finding: {
            question:
              "The primary PK timepoint changed without a formal protocol amendment or IRB approval. Explain.",
            answer:
              "The change went through a documented amendment with IRB approval before it took effect.",
            severity: "major",
          },
        }
      ),
      opt("hold", "Hold the line on the protocol", 2, 2, {
        meters: { client: -7, integrity: 3 },
      }),
    ],
  },
  {
    id: "sponsor-fourth-site",
    from: "Arcadia Therapeutics (Sponsor)",
    subject: "Enrollment is behind",
    body: "Enrollment looks slower than promised. Can we open a fourth site?",
    urgency: "important",
    day: 38,
    ttl: 3,
    trigger: (s) => sumSites(s, (x) => x.enrolled) < s.setup.subjects * 0.5,
    ifIgnored: { meters: { client: -5 } },
    options: [
      opt("open", "Open a fourth site", 3, 3, {
        spend: 12000,
        sites: allSites({ burden: -6 }),
      }),
      opt("fix", "Fix the sites we have", 2, 1, {
        sites: [
          { siteId: "site-03", burden: -8 },
          { siteId: "site-02", burden: -5 },
        ],
      }),
      opt("wait", "Ask for more time", 1, 2, {
        meters: { client: -3 },
        slipDays: 3,
      }),
    ],
  },
  {
    id: "irb-expiry",
    from: "Dana (Regulatory)",
    subject: "IRB approval expires Friday",
    body: "The IRB approval for Site 02 expires Friday and the renewal isn't filed.",
    urgency: "critical",
    day: 40,
    ttl: 2,
    ifIgnored: { meters: { compliance: -18 }, slipDays: 3 },
    options: [
      opt("expedite", "Pay for an expedited renewal", 2, 1, { spend: 800 }),
      opt("dana", "Dana files it today", 1, 1, {
        workload: [{ memberId: "dana", delta: 20 }],
      }),
      opt("site", "Ask the site to file", 2, 2, {
        sites: [{ siteId: "site-02", burden: 3 }],
      }),
    ],
  },
  {
    id: "overtime-request",
    from: "The team",
    subject: "We're running on fumes",
    body: "Several of us have worked weekends. Can we get some relief before lock?",
    urgency: "important",
    day: 42,
    ttl: 3,
    trigger: (s) => meanLoad(s) > 65,
    ifIgnored: { meters: { team: -8 } },
    options: [
      opt("approve", "Approve paid overtime", 1, 0, {
        spend: 6000,
        workload: s6(-10),
      }),
      opt("temp", "Bring in a temp for two weeks", 2, 0, {
        spend: 9000,
        workload: s6(-18),
      }),
      opt("deny", "Not possible right now", 0, 0, { meters: { team: -8 } }),
    ],
  },
  {
    id: "site-three-queries",
    from: "Maya (Data Manager)",
    subject: "Site 03 open queries",
    body: "Site 03 hasn't answered anything in weeks. The query count there is climbing and I can't get a response.",
    urgency: "critical",
    day: 44,
    ttl: 2,
    trigger: (s) =>
      (s.sites[2]?.openQueries ?? 0) >= 4 || (s.sites[2]?.deviations ?? 0) >= 4,
    ifIgnored: {
      meters: { integrity: -6 },
      sites: [{ siteId: "site-03", openQueries: 4 }],
    },
    options: [
      opt("walt", "Send Walt on site", 2, 1, {
        workload: [{ memberId: "walt", delta: 15 }],
        sites: [{ siteId: "site-03", openQueries: -6, unsignedSource: -2 }],
      }),
      opt("audit", "Audit Site 03 yourself", 2, 0, { auditSites: ["site-03"] }),
      opt("email", "Email the coordinator again", 0, 3, {}),
    ],
  },
  {
    id: "site-two-again",
    from: "Site 02 coordinator",
    subject: "Missed visit window",
    body: "Subject 022 came in a day outside the visit window. I'm so sorry. What should I do? Should I stop the study?",
    urgency: "routine",
    day: 46,
    ttl: 2,
    ifIgnored: { sites: [{ siteId: "site-02", burden: 4 }] },
    options: [
      opt("calm", "Reassure and log the deviation", 1, 3, {
        sites: [{ siteId: "site-02", deviations: 1, burden: -4 }],
      }),
      opt("call", "Take a call to walk through it", 2, 1, {
        sites: [{ siteId: "site-02", burden: -8 }],
      }),
    ],
  },
  {
    id: "safety-narrative",
    from: "Arcadia Therapeutics (Sponsor)",
    subject: "SAE at Site 02: narrative in 24h",
    body: "A serious adverse event was reported at Site 02. We need the narrative within 24 hours.",
    urgency: "critical",
    day: 48,
    ttl: 1,
    ifIgnored: { meters: { compliance: -12, client: -8 } },
    options: [
      opt("own", "Drive the narrative yourself", 3, 1, {
        meters: { compliance: 5, integrity: 4 },
      }),
      opt("lee", "Delegate to Lee with review", 1, 2, {
        workload: [{ memberId: "lee", delta: 25 }],
        meters: { compliance: 2 },
      }),
      opt("delay", "Ask for another day", 0, 8, {
        meters: { compliance: -4, client: -5 },
      }),
    ],
  },
  // Cleaning
  {
    id: "query-blitz",
    from: "Maya (Data Manager)",
    subject: "Query cleaning approach",
    body: "We can run a cleaning blitz now or stay steady. The blitz is faster but it hits the sites hard.",
    urgency: "important",
    day: 50,
    ttl: 3,
    ifIgnored: { workload: [{ memberId: "maya", delta: 10 }] },
    options: [
      opt("blitz", "Run the blitz", 2, 2, {
        workload: [{ memberId: "maya", delta: 12 }],
        sites: allSites({ burden: 8 }),
      }),
      opt("steady", "Stay steady", 1, 1, { slipDays: 2 }),
      opt("support", "Blitz with extra help", 2, 2, {
        spend: 5000,
        workload: [{ memberId: "maya", delta: -8 }],
      }),
    ],
  },
  {
    id: "sponsor-earlier-lock",
    from: "Arcadia Therapeutics (Sponsor)",
    subject: "Can we lock a week earlier?",
    body: "Our board meets soon. Can we lock the database a week earlier? Everything looks great from where we sit!",
    urgency: "important",
    day: 56,
    ttl: 3,
    ifIgnored: { meters: { client: -3 } },
    options: [
      opt(
        "yes",
        "Commit to the earlier date",
        1,
        10,
        {
          slipDays: -5,
          meters: { client: 6, integrity: -6, compliance: -4 },
        },
        {
          finding: {
            question:
              "The lock date was moved up a week. What was assessed about data readiness?",
            answer:
              "The impact assessment and sponsor approval are documented.",
            severity: "minor",
          },
        }
      ),
      opt("plan", "Show what it would cost", 2, 2, { meters: { client: 1 } }),
      opt("no", "Keep the plan", 1, 0, { meters: { client: -4 } }),
    ],
  },
  {
    id: "sponsor-good-vibes",
    from: "Arcadia Therapeutics (Sponsor)",
    subject: "Great call today everyone",
    body: "Great call today everyone! Sounds like we're in a really good place.",
    urgency: "routine",
    day: 58,
    ttl: 2,
    ifIgnored: {},
    options: [
      opt("thanks", "Thank them and move on", 0, 0, { meters: { client: 1 } }),
      opt("risk", "Send an honest risk summary", 2, 0, {
        meters: { client: -2, compliance: 3 },
      }),
    ],
  },
  // Analysis
  {
    id: "endpoint-rework",
    from: "Priya (Biostatistician)",
    subject: "Endpoint 2 needs a decision now",
    body: "We deferred the endpoint 2 derivation. I can't run the primary analysis without it.",
    urgency: "critical",
    day: 60,
    ttl: 2,
    followUp: true,
    ifIgnored: { meters: { integrity: -12 }, slipDays: 4 },
    options: [
      opt("decide", "Decide it today", 2, 2, {
        slipDays: 3,
        meters: { integrity: -4 },
      }),
      opt("rework", "Re-derive with the sponsor", 3, 2, {
        slipDays: 5,
        meters: { integrity: 2, client: -2 },
      }),
    ],
  },
  {
    id: "programmer-mismatch",
    from: "Omar (Programmer)",
    subject: "Double programming mismatch",
    body: "Independent programming doesn't match on AUC for two subjects.",
    urgency: "critical",
    day: 62,
    ttl: 2,
    ifIgnored: { meters: { integrity: -8 } },
    options: [
      opt("rerun", "Rerun validation properly", 2, 1, {
        slipDays: 2,
        meters: { integrity: 6 },
      }),
      opt(
        "accept",
        "Accept the production result",
        0,
        10,
        { meters: { integrity: -10 } },
        {
          flags: ["auc-mismatch-accepted"],
          finding: {
            question:
              "Independent programming did not match production for two subjects. How was it resolved?",
            answer:
              "The mismatch, its investigation and the resolution are documented.",
            severity: "major",
          },
        }
      ),
      opt("priya", "Ask Priya to arbitrate", 1, 2, {
        workload: [{ memberId: "priya", delta: 10 }],
        meters: { integrity: 3 },
      }),
    ],
  },
  {
    id: "analysis-slip",
    from: "Priya (Biostatistician)",
    subject: "Analysis is taking longer",
    body: "Narrator: it did not take three days. I need about five more.",
    urgency: "important",
    day: 66,
    ttl: 2,
    followUp: true,
    ifIgnored: { slipDays: 5 },
    options: [
      opt("wait", "Absorb the five days", 1, 1, {
        slipDays: 5,
        meters: { client: -4 },
      }),
      opt("help", "Add Omar to speed it up", 2, 1, {
        slipDays: 2,
        workload: [{ memberId: "omar", delta: 15 }],
      }),
    ],
  },
  // Reporting and closeout
  {
    id: "csr-draft",
    from: "Lee (Medical Writer)",
    subject: "CSR draft timeline",
    body: "The CSR draft is ready for review, but tables still have open comments. Ship it or wait?",
    urgency: "important",
    day: 70,
    ttl: 3,
    ifIgnored: { meters: { client: -4 } },
    options: [
      opt("wait", "Resolve comments first", 2, 1, {
        slipDays: 2,
        meters: { integrity: 3 },
      }),
      opt(
        "ship",
        "Ship the draft",
        1,
        6,
        {
          meters: { client: 3, compliance: -3 },
        },
        {
          finding: {
            question:
              "The CSR draft was released with open table comments. What controls were in place?",
            answer: "Release rationale and comment disposition are documented.",
            severity: "minor",
          },
        }
      ),
    ],
  },
  {
    id: "closeout-files",
    from: "Dana (Regulatory)",
    subject: "Trial master file check",
    body: "The trial master file has gaps. Do we close it out now or fix it?",
    urgency: "important",
    day: 74,
    ttl: 3,
    ifIgnored: { meters: { compliance: -8 } },
    options: [
      opt("fix", "Fix the gaps first", 3, 0, {
        meters: { compliance: 6 },
        slipDays: 1,
      }),
      opt(
        "close",
        "Close it out as is",
        0,
        10,
        { meters: { compliance: -4 } },
        {
          finding: {
            question:
              "The trial master file was closed with known gaps. Explain.",
            answer: "Gaps were remediated and reconciled before closeout.",
            severity: "major",
          },
        }
      ),
    ],
  },
];

function s6(delta: number): Array<{ memberId: string; delta: number }> {
  return ["maya", "priya", "dana", "walt", "lee", "omar"].map((memberId) => ({
    memberId,
    delta,
  }));
}
