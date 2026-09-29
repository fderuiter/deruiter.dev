import { clamp } from "../game-utils";
import { BIMOFinding, BIMOInspectionReport } from "./types";

/**
 * A shortcut the player took to keep the sponsor happy. Skeletons stay hidden
 * during the shift and surface as findings in the end-of-phase BIMO report.
 */
export interface SponsorSkeleton {
  id: string;
  category: BIMOFinding["category"];
  severity: BIMOFinding["severity"];
  description: string;
  regulation: string;
}

export interface SponsorChoiceEffects {
  /** Change to sponsor satisfaction (0–100). */
  sponsorMood: number;
  /** Change to FDA auditor suspicion (0–100). */
  suspicion: number;
  /** Points added to (or removed from) the score. */
  score: number;
  /** Seconds added to (or taken from) every subject on the conveyor. */
  timeBonusSeconds: number;
  /** Charge added to every power-up. */
  powerUpCharge: number;
  /** Shortcut recorded for the final inspection, if any. */
  skeleton?: SponsorSkeleton;
}

export interface SponsorChoice {
  label: string;
  /** What happened, written to the audit trail after choosing. */
  outcome: string;
  effects: SponsorChoiceEffects;
}

export interface SponsorRequest {
  id: string;
  from: string;
  role: string;
  subject: string;
  body: string;
  /** Seconds before the sender follows up. */
  deadlineSeconds: number;
  choices: readonly SponsorChoice[];
}

export interface ActiveSponsorRequest {
  request: SponsorRequest;
  timeRemaining: number;
  /** Number of follow-up emails already sent for this request. */
  followUps: number;
}

export interface SponsorState {
  mood: number;
  skeletons: SponsorSkeleton[];
  handled: number;
  ignored: number;
  activeRequest: ActiveSponsorRequest | null;
  timeUntilNextRequest: number;
  lastRequestId: string | null;
}

export type SponsorEvent =
  | { type: "request_arrived"; request: SponsorRequest }
  | { type: "follow_up"; request: SponsorRequest; subjectLine: string }
  | { type: "request_dropped"; request: SponsorRequest; moodDelta: number }
  | { type: "contract_terminated" };

export const SPONSOR_STARTING_MOOD = 70;
/** Mood lost per second: the sponsor always wants more. */
export const SPONSOR_MOOD_DECAY_PER_SECOND = 0.35;
/**
 * Mood lost per second in each campaign phase. Later phases lock CRFs faster,
 * so the sponsor's expectations climb with them and satisfaction keeps
 * mattering instead of pinning at 100% (#1327).
 */
export const SPONSOR_MOOD_DECAY_BY_PHASE: Readonly<Record<1 | 2 | 3, number>> =
  {
    1: SPONSOR_MOOD_DECAY_PER_SECOND,
    2: 0.5,
    3: 0.8,
  };
/** Satisfaction above which each submission earns less goodwill. */
export const SPONSOR_BOOST_TAPER_START = 60;
export const SPONSOR_MAX_FOLLOW_UPS = 2;
export const SPONSOR_FOLLOW_UP_MOOD_PENALTY = 6;
export const SPONSOR_DROPPED_MOOD_PENALTY = 12;
const FOLLOW_UP_DEADLINE_SECONDS = 12;

const noEffects: SponsorChoiceEffects = {
  sponsorMood: 0,
  suspicion: 0,
  score: 0,
  timeBonusSeconds: 0,
  powerUpCharge: 0,
};

function effects(partial: Partial<SponsorChoiceEffects>): SponsorChoiceEffects {
  return { ...noEffects, ...partial };
}

export const SPONSOR_REQUESTS: readonly SponsorRequest[] = [
  {
    id: "enrollment-eod",
    from: "Brenda",
    role: "Sponsor Study Manager",
    subject: "Enrollment numbers by EOD?",
    body: "Hi! Leadership needs updated enrollment for the steering committee. Target was 400. Where are we? 🙂",
    deadlineSeconds: 18,
    choices: [
      {
        label: "Send the real number (3 of 400)",
        outcome: "Brenda replied 'Thanks' with no emoji. This is bad.",
        effects: effects({ sponsorMood: -12, suspicion: -3 }),
      },
      {
        label: "Send the 'projected' number",
        outcome:
          "Brenda loved the hockey-stick chart. The steering committee did too.",
        effects: effects({
          sponsorMood: 15,
          score: 100,
          skeleton: {
            id: "skel-projected-enrollment",
            category: "Data Integrity",
            severity: "Major",
            description:
              "Enrollment reported to the sponsor was labelled 'projected' but presented as actual. The projection assumed every patient in the state enrolls.",
            regulation: "ICH GCP E6(R3) § 3.16 - Record keeping and reporting",
          },
        }),
      },
      {
        label: "Propose a quick sync to align",
        outcome:
          "The quick sync ran 58 minutes and ended with 'let's take this offline'.",
        effects: effects({ sponsorMood: 4, timeBonusSeconds: -6 }),
      },
    ],
  },
  {
    id: "close-all-queries",
    from: "Chad",
    role: "VP, Clinical Operations",
    subject: "Close all 312 open queries by Friday?",
    body: "Need a clean slide for the board deck. Zero open queries = great optics. You're a rockstar!!",
    deadlineSeconds: 16,
    choices: [
      {
        label: "Close them all as 'Confirmed per site'",
        outcome:
          "312 queries closed in 4 minutes. Chad sent a GIF of a rocket.",
        effects: effects({
          sponsorMood: 18,
          score: 150,
          powerUpCharge: 1,
          skeleton: {
            id: "skel-query-dump",
            category: "Data Integrity",
            severity: "Critical",
            description:
              "312 data queries closed 'confirmed per site' within 4 minutes, while the CRA was badged into an airport lounge.",
            regulation: "21 CFR § 11.10(e) - Audit trail of operator actions",
          },
        }),
      },
      {
        label: "Explain query aging honestly",
        outcome: "Chad said 'Let's circle back.' Nobody will circle back.",
        effects: effects({ sponsorMood: -8, suspicion: -5 }),
      },
      {
        label: "Reply 'On it! 🚀' and do nothing",
        outcome: "Chad has already put 'zero open queries' in the deck.",
        effects: effects({ sponsorMood: 8, suspicion: 5 }),
      },
    ],
  },
  {
    id: "causality-call",
    from: "Dr. Okafor",
    role: "Sponsor Medical Monitor",
    subject: "URGENT: AE causality in 10 min",
    body: "Subject 1042 reports a headache after dosing. Related or not related? Board call starts shortly.",
    deadlineSeconds: 14,
    choices: [
      {
        label: "Possibly related",
        outcome: "Conservative call logged. The auditor nodded approvingly.",
        effects: effects({ sponsorMood: 2, suspicion: -4 }),
      },
      {
        label: "Not related (the subject was hit by a bus)",
        outcome: "Dr. Okafor asked why the bus isn't in the AE log.",
        effects: effects({ sponsorMood: 6, score: 50, suspicion: 3 }),
      },
      {
        label: "Escalate to the PI, who is golfing",
        outcome: "The PI replied from hole 14: 'ok'.",
        effects: effects({ sponsorMood: -4, timeBonusSeconds: -4 }),
      },
    ],
  },
  {
    id: "etmf-training",
    from: "Sponsor's Consultant's Consultant",
    role: "Change Management Lead",
    subject: "Mandatory: new eTMF training (6 hrs, today)",
    body: "We are excited to sunset the old eTMF in favor of the new eTMF, which is the old eTMF with a new logo.",
    deadlineSeconds: 20,
    choices: [
      {
        label: "Actually do the training",
        outcome:
          "You learned where the 'Upload' button moved to. Lifelines charged.",
        effects: effects({
          sponsorMood: 6,
          timeBonusSeconds: -8,
          powerUpCharge: 2,
        }),
      },
      {
        label: "Click through at 4x speed",
        outcome: "Certificate earned. Quiz score: 100% (all answers were 'C').",
        effects: effects({
          sponsorMood: 4,
          skeleton: {
            id: "skel-speedrun-training",
            category: "Protocol Compliance",
            severity: "Minor",
            description:
              "Training records show a 6-hour eTMF course completed in 11 minutes, with every quiz answer 'C'.",
            regulation:
              "ICH GCP E6(R3) § 2.3 - Qualified and trained personnel",
          },
        }),
      },
      {
        label: "Ask if there's a training on the training",
        outcome: "There is. It is also 6 hours.",
        effects: effects({ sponsorMood: -6, score: 25 }),
      },
    ],
  },
  {
    id: "ccg-v14",
    from: "Brenda",
    role: "Sponsor Study Manager",
    subject: "CRF Completion Guidelines v14 (retroactive)",
    body: "Small update: v14 changes how we record 'date of visit'. Effective for all visits, including past ones. Thanks!",
    deadlineSeconds: 18,
    choices: [
      {
        label: "Re-review every submitted CRF",
        outcome: "Painful, but the audit trail is immaculate.",
        effects: effects({
          sponsorMood: 5,
          suspicion: -8,
          timeBonusSeconds: -10,
        }),
      },
      {
        label: "Pretend you didn't see the email",
        outcome: "The email is marked read. The auditor can see that.",
        effects: effects({
          sponsorMood: -5,
          skeleton: {
            id: "skel-ignored-ccg",
            category: "Protocol Compliance",
            severity: "Major",
            description:
              "Submitted CRFs were not re-reviewed after CRF Completion Guidelines v14 were issued. The email was opened 9 times.",
            regulation: "21 CFR § 312.62 - Investigator record keeping",
          },
        }),
      },
      {
        label: "Reply-all asking what changed",
        outcome: "47 people replied-all asking to be removed from the thread.",
        effects: effects({ sponsorMood: -10, score: -50 }),
      },
    ],
  },
  {
    id: "move-up-lock",
    from: "Chad",
    role: "VP, Clinical Operations",
    subject: "Loving the progress! Quick one",
    body: "Can we move database lock up by 3 weeks? Investors are excited. So am I. 🚀",
    deadlineSeconds: 16,
    choices: [
      {
        label: "Say yes (you cannot)",
        outcome:
          "Chad announced the new date on LinkedIn. The auditor saw the post.",
        effects: effects({ sponsorMood: 20, suspicion: 10 }),
      },
      {
        label: "Push back with a realistic timeline",
        outcome: "Chad has scheduled a 'quick chat about mindset'.",
        effects: effects({ sponsorMood: -12, suspicion: -3 }),
      },
      {
        label: "Send a Gantt chart so complex he stops asking",
        outcome: "Chad replied 'Great, aligned!' He did not open it.",
        effects: effects({ sponsorMood: 3, score: 75 }),
      },
    ],
  },
  {
    id: "overdue-mvr",
    from: "Oversight Dashboard (automated)",
    role: "Monitoring Metrics Bot",
    subject: "Monitoring Visit Report 14 days overdue",
    body: "Your SDV rate is 97.3%. The target is 100%. Your KPI tile is now red. Please turn it green.",
    deadlineSeconds: 20,
    choices: [
      {
        label: "Write the report on the plane",
        outcome:
          "Filed from seat 34E, between a crying baby and a man eating tuna.",
        effects: effects({
          sponsorMood: 8,
          timeBonusSeconds: -5,
          powerUpCharge: 1,
        }),
      },
      {
        label: "Copy-paste last visit's report",
        outcome: "The KPI tile is green. The typos are identical.",
        effects: effects({
          sponsorMood: 10,
          score: 50,
          skeleton: {
            id: "skel-copy-paste-mvr",
            category: "Protocol Compliance",
            severity: "Major",
            description:
              "Monitoring Visit Reports for visits 4 and 5 are identical, including the typo 'pateint' and the weather.",
            regulation: "ICH GCP E6(R3) § 3.11 - Monitoring reports",
          },
        }),
      },
      {
        label: "Argue that risk-based monitoring means 97% is fine",
        outcome:
          "Technically correct. The bot does not understand technically correct.",
        effects: effects({ sponsorMood: -6, suspicion: -2, score: 25 }),
      },
    ],
  },
  {
    id: "out-of-ip",
    from: "Brenda",
    role: "Sponsor Study Manager",
    subject: "Site is out of study drug?!",
    body: "Site 014 says they have zero kits left. The depot is closed. Could you maybe... drive some over? It's 3 hours.",
    deadlineSeconds: 16,
    choices: [
      {
        label: "Drive it over yourself",
        outcome: "Delivered. Your car's AC broke on the highway.",
        effects: effects({
          sponsorMood: 12,
          score: 100,
          timeBonusSeconds: -8,
          skeleton: {
            id: "skel-honda-civic-cold-chain",
            category: "Protocol Compliance",
            severity: "Minor",
            description:
              "Investigational product was transported in the CRA's Honda Civic. The temperature log is a Post-it reading 'felt cool'.",
            regulation: "21 CFR § 312.57 - Record of drug disposition",
          },
        }),
      },
      {
        label: "Ship it via qualified courier",
        outcome: "Arrives Tuesday. Brenda sighs audibly over email.",
        effects: effects({ sponsorMood: -4, suspicion: -2 }),
      },
      {
        label: "Tell the site to 'use their best judgment'",
        outcome: "The site's best judgment was expired kits from 2019.",
        effects: effects({
          sponsorMood: 4,
          skeleton: {
            id: "skel-best-judgment-dosing",
            category: "Adverse Event Reporting",
            severity: "Critical",
            description:
              "Subjects were dosed from expired kits on the CRA's instruction to 'use best judgment'.",
            regulation: "21 CFR § 312.60 - Investigator responsibilities",
          },
        }),
      },
    ],
  },
  {
    id: "legal-wording",
    from: "Sponsor Legal",
    role: "Associate General Counsel",
    subject: "Wording guidance for visit reports",
    body: "Going forward, please avoid the word 'problem'. Preferred alternatives: 'learning opportunity', 'dynamic finding'.",
    deadlineSeconds: 18,
    choices: [
      {
        label: "Comply",
        outcome: "Your reports now contain 14 'dynamic findings'.",
        effects: effects({ sponsorMood: 8, score: 25 }),
      },
      {
        label: "Comply, and rename SAEs 'Surprise Adventure Events'",
        outcome: "Legal hasn't noticed yet. The auditor has.",
        effects: effects({ sponsorMood: -2, score: 150, suspicion: 6 }),
      },
      {
        label: "Ignore it",
        outcome: "Legal has sent a follow-up with more adjectives.",
        effects: effects({ sponsorMood: -6 }),
      },
    ],
  },
  {
    id: "friday-455",
    from: "Chad",
    role: "VP, Clinical Operations",
    subject: "Fri 4:55 PM: quick call?",
    body: "Won't take long. Just want to 'pick your brain' about 'a few things'.",
    deadlineSeconds: 14,
    choices: [
      {
        label: "Take the call",
        outcome: "It was not quick. You now own three new workstreams.",
        effects: effects({ sponsorMood: 10, timeBonusSeconds: -6 }),
      },
      {
        label: "Pretend your Wi-Fi died",
        outcome: "Chad sent a calendar invite titled 'Wi-Fi Sync'.",
        effects: effects({ sponsorMood: -8, score: 50 }),
      },
      {
        label: "Join camera-off and keep working",
        outcome: "You said 'great point' at the right times. Mostly.",
        effects: effects({ sponsorMood: 4, suspicion: 3 }),
      },
    ],
  },
  {
    id: "site-selection-vibes",
    from: "Brenda",
    role: "Sponsor Study Manager",
    subject: "New site: feasibility looks great!",
    body: "Their questionnaire says they can enroll 400 patients. They also said that last trial. And the one before.",
    deadlineSeconds: 18,
    choices: [
      {
        label: "Approve them (optimism!)",
        outcome:
          "Site activated. First patient expected 'imminently' (since March).",
        effects: effects({ sponsorMood: 12, suspicion: 4 }),
      },
      {
        label: "Request their actual enrollment history",
        outcome: "History received: 3, 1, and 'data unavailable'.",
        effects: effects({ sponsorMood: -5, score: 75, suspicion: -3 }),
      },
      {
        label: "Forward to your manager with 'thoughts?'",
        outcome: "Your manager forwarded it back with 'thoughts?'.",
        effects: effects({ sponsorMood: 0, timeBonusSeconds: -3 }),
      },
    ],
  },
];

/**
 * Fresh sponsor state for a new shift. The first email arrives after `firstRequestDelay` seconds.
 */
export function createInitialSponsorState(
  firstRequestDelay = 20
): SponsorState {
  return {
    mood: SPONSOR_STARTING_MOOD,
    skeletons: [],
    handled: 0,
    ignored: 0,
    activeRequest: null,
    timeUntilNextRequest: firstRequestDelay,
    lastRequestId: null,
  };
}

/**
 * Picks the next sponsor email, avoiding an immediate repeat. `rand` must return a value in [0, 1).
 */
export function pickSponsorRequest(
  rand: () => number = Math.random,
  lastRequestId: string | null = null
): SponsorRequest {
  const pool =
    SPONSOR_REQUESTS.length > 1
      ? SPONSOR_REQUESTS.filter((r) => r.id !== lastRequestId)
      : SPONSOR_REQUESTS;
  const idx = Math.min(
    pool.length - 1,
    Math.max(0, Math.floor(rand() * pool.length))
  );
  return pool[idx];
}

/**
 * Subject line for the nth follow-up to an unanswered request.
 */
export function getFollowUpSubject(
  request: SponsorRequest,
  followUps: number
): string {
  if (followUps <= 1) return `RE: ${request.subject} (just circling back 🙂)`;
  return `FW: RE: RE: ${request.subject} (+ looping in your manager)`;
}

/**
 * Human-readable sponsor temperature for the satisfaction meter.
 */
export function getSponsorMoodLabel(mood: number): string {
  if (mood >= 85) return "Sponsor is sending you swag";
  if (mood >= 65) return "Sponsor is 'really happy with the partnership'";
  if (mood >= 45) return "Sponsor 'just has a few questions'";
  if (mood >= 25) return "Sponsor scheduled a 'quick alignment sync'";
  if (mood > 0) return "Sponsor is quietly drafting an RFP";
  return "Sponsor moved the study to another CRO";
}

function nextRequestDelay(rand: () => number): number {
  return 26 + Math.floor(rand() * 14);
}

function clampMood(mood: number): number {
  return Math.min(100, Math.max(0, mood));
}

/**
 * Advances the sponsor by `deltaSeconds`: mood decays, emails arrive, unanswered
 * emails escalate into follow-ups and are eventually dropped with a penalty.
 */
export function tickSponsor(
  state: SponsorState,
  deltaSeconds: number,
  rand: () => number = Math.random,
  decayPerSecond: number = SPONSOR_MOOD_DECAY_PER_SECOND
): { state: SponsorState; events: SponsorEvent[] } {
  const events: SponsorEvent[] = [];
  if (state.mood <= 0) return { state, events };

  let next: SponsorState = {
    ...state,
    mood: clampMood(state.mood - decayPerSecond * deltaSeconds),
  };

  if (next.activeRequest) {
    const remaining = next.activeRequest.timeRemaining - deltaSeconds;
    if (remaining > 0) {
      next = {
        ...next,
        activeRequest: { ...next.activeRequest, timeRemaining: remaining },
      };
    } else if (next.activeRequest.followUps < SPONSOR_MAX_FOLLOW_UPS) {
      const followUps = next.activeRequest.followUps + 1;
      const request = next.activeRequest.request;
      next = {
        ...next,
        mood: clampMood(next.mood - SPONSOR_FOLLOW_UP_MOOD_PENALTY),
        activeRequest: {
          request,
          followUps,
          timeRemaining: FOLLOW_UP_DEADLINE_SECONDS,
        },
      };
      events.push({
        type: "follow_up",
        request,
        subjectLine: getFollowUpSubject(request, followUps),
      });
    } else {
      const request = next.activeRequest.request;
      next = {
        ...next,
        mood: clampMood(next.mood - SPONSOR_DROPPED_MOOD_PENALTY),
        ignored: next.ignored + 1,
        activeRequest: null,
        timeUntilNextRequest: nextRequestDelay(rand),
      };
      events.push({
        type: "request_dropped",
        request,
        moodDelta: -SPONSOR_DROPPED_MOOD_PENALTY,
      });
    }
  } else {
    const wait = next.timeUntilNextRequest - deltaSeconds;
    if (wait <= 0) {
      const request = pickSponsorRequest(rand, next.lastRequestId);
      next = {
        ...next,
        activeRequest: {
          request,
          followUps: 0,
          timeRemaining: request.deadlineSeconds,
        },
        lastRequestId: request.id,
        timeUntilNextRequest: 0,
      };
      events.push({ type: "request_arrived", request });
    } else {
      next = { ...next, timeUntilNextRequest: wait };
    }
  }

  if (next.mood <= 0) {
    events.push({ type: "contract_terminated" });
  }

  return { state: next, events };
}

/**
 * Answers the active sponsor email with the chosen option. Returns the unchanged
 * state and `null` effects when there is no active email or the index is invalid.
 */
export function resolveSponsorChoice(
  state: SponsorState,
  choiceIndex: number,
  rand: () => number = Math.random
): {
  state: SponsorState;
  effects: SponsorChoiceEffects | null;
  outcome: string | null;
} {
  const active = state.activeRequest;
  const choice = active?.request.choices[choiceIndex];
  if (!active || !choice) return { state, effects: null, outcome: null };

  const skeleton = choice.effects.skeleton;
  return {
    state: {
      ...state,
      mood: clampMood(state.mood + choice.effects.sponsorMood),
      skeletons: skeleton ? [...state.skeletons, skeleton] : state.skeletons,
      handled: state.handled + 1,
      activeRequest: null,
      timeUntilNextRequest: nextRequestDelay(rand),
    },
    effects: choice.effects,
    outcome: choice.outcome,
  };
}

/**
 * Mood decay per second for a phase; endless mode and unknown phases use the
 * phase 1 rate.
 */
export function getSponsorMoodDecayPerSecond(phase: number): number {
  return phase === 2 || phase === 3
    ? SPONSOR_MOOD_DECAY_BY_PHASE[phase]
    : SPONSOR_MOOD_DECAY_PER_SECOND;
}

/**
 * Sponsors love throughput: a signed submission nudges satisfaction up. Above
 * `SPONSOR_BOOST_TAPER_START` the nudge shrinks, down to a quarter at 100%, so
 * a fast player settles in the 70s rather than parking the meter at 100%.
 */
export function applySponsorSubmissionBoost(
  state: SponsorState,
  allClean: boolean
): SponsorState {
  if (state.mood <= 0) return state;
  const base = allClean ? 5 : 3;
  const taper = clamp(
    (100 - state.mood) / (100 - SPONSOR_BOOST_TAPER_START),
    0.25,
    1
  );
  return { ...state, mood: clampMood(state.mood + base * taper) };
}

const SKELETON_SCORE_PENALTY: Record<BIMOFinding["severity"], number> = {
  Critical: 20,
  Major: 10,
  Minor: 4,
};

/**
 * Surfaces the player's sponsor-pleasing shortcuts as inspection findings,
 * lowering the score and escalating the verdict where warranted.
 */
export function applySponsorSkeletonsToReport(
  report: BIMOInspectionReport,
  skeletons: readonly SponsorSkeleton[]
): BIMOInspectionReport {
  if (skeletons.length === 0) return report;

  const findings: BIMOFinding[] = skeletons.map((s, idx) => ({
    id: `FND-SPONSOR-${idx + 1}`,
    category: s.category,
    severity: s.severity,
    description: s.description,
    regulation: s.regulation,
  }));
  const penalty = skeletons.reduce(
    (sum, s) => sum + SKELETON_SCORE_PENALTY[s.severity],
    0
  );

  let verdict = report.verdict;
  let summary = report.summary;
  if (skeletons.some((s) => s.severity === "Critical")) {
    verdict = "OAI (Official Action Indicated - Form 483 Issued)";
  } else if (verdict === "NAI (No Action Indicated - Approved)") {
    verdict = "VAI (Voluntary Action Indicated)";
  }
  summary = `${summary} Inspectors also found ${skeletons.length} sponsor-pleasing shortcut${
    skeletons.length === 1 ? "" : "s"
  } in the correspondence archive.`;

  return {
    ...report,
    overallScore: Math.max(0, report.overallScore - penalty),
    verdict,
    summary,
    findings: [...report.findings, ...findings],
  };
}
