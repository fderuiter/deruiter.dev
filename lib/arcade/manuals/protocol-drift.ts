import type { FieldManualData } from "./types";

export const PROTOCOL_DRIFT_MANUAL: FieldManualData = {
  id: "protocol-drift",
  title: "Protocol Drift",
  subtitle: "Design the trial. Debug reality.",
  genre: "Systems Simulation",
  badge: "Pipeline Canvas",
  route: "/protocol-drift",
  accentColor: "from-amber-500/20 via-amber-500/5 to-transparent",
  badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  objective:
    "As Lead Clinical Data Architect for Study PD-101, wire a pipeline that carries site entries into CDISC SDTM, keep it honest through tired coordinators and a mid-flight protocol amendment, derive the ADaM orthostatic rows below the Conservation Wall, and clear both Database Lock gates without fabricating a single bit.",
  quickSummary:
    "Accept the briefing, place chips on the Tabulation Lane and wire them, press Run Local Test, then Publish Revision, then Space to run the clock. Investigate discrepancies in the Forensic Inspector, query sites with attached evidence, and request the Database Lock on Day 28.",
  controls: [
    {
      action: "Run or pause the clock",
      description:
        "Runs the published pipeline at 1x, 2x or 5x; at 1x one simulated hour passes per real second.",
      key: "Space",
    },
    {
      action: "Step one hour",
      description:
        "While paused, advances the clock by exactly one simulated hour.",
      key: "N",
    },
    {
      action: "Expand the inspector",
      description:
        "Expands the tri-pane Forensic Inspector (Form View, Pipeline Trace, Review and Query) over the canvas.",
      key: "I",
    },
    {
      action: "Dock the inspector",
      description: "Returns the inspector to its docked height.",
      key: "Esc",
    },
    {
      action: "Add and wire chips",
      description:
        "Drag a chip from the toolbox, or press Enter on it, then connect output pins to input pins. The Pipeline as text list offers the same wiring from the keyboard.",
      key: "Drag / Enter",
    },
  ],
  rules: [
    {
      title: "The Conservation Wall",
      detail:
        "Tabulation chips cannot cross the wall at y416, and data flows only downward through the Snapshot Handoff, which freezes a read-only copy of SDTM. Analysis never rewrites tabulation.",
      badge: "Wall",
    },
    {
      title: "No silent selection or imputation",
      detail:
        "Text with two readings is kept and counted as loss until you disposition it. A partial date such as 2025-10 stays partial; imputing a day adds 4.95 bits of fabricated precision and blocks the lock.",
      badge: "Epistemic debt",
    },
    {
      title: "Evidence beats a generic query",
      detail:
        "A tired coordinator may answer Confirmed Correct without checking. That answers the thread but never resolves the issue. A query with the paper evidence attached gets a real review and a source correction.",
      badge: "Queries",
    },
    {
      title: "Route by assessment date",
      detail:
        "Amendment 01 requires standing blood pressure after a site activates v2. A visit is judged by when it was assessed, not when it was submitted, so a late backlog form stays on v1.",
      badge: "Amendment",
    },
    {
      title: "Dual Database Lock",
      detail:
        "The SDTM checklist needs 110 VS rows, 6 MH rows, no open queries, no fabricated debt and intact traces. The ADaM checklist needs 20 orthostatic rows with NOT EVALUABLE visits handled honestly and no stale derivations.",
      badge: "Lock",
    },
    {
      title: "Efficiency against par",
      detail:
        "The debrief scores five measures against par: 13 chips, 21 wires, lock on Day 28, no rejected commands and no fabricated bits. Each is worth 100 points at par, more for a leaner pipeline and less for a sprawling one, and earns a medal at or under par. Your best for each measure is kept in this browser.",
      badge: "Par",
    },
    {
      title: "Arcade Daily",
      detail:
        "Play daily on the arcade hub starts the study on today's seed instead of seed #48291; the footer shows the daily's date. Locking the database on it records the lock score as today's daily best on the hub.",
      badge: "Daily",
    },
  ],
  proTips: [
    "Add the regex split before Site A's narrative entry arrives on Day 7.",
    "Inspect the Form View before you query: the paper may already tell you the answer.",
    "Replay derivations after any source correction.",
  ],
  lore: {
    title: "Where the plan meets the clinic",
    story:
      "Data standards describe the data a trial should collect; clinics produce the data they actually collect. Protocol Drift is a fictional, simplified account of the work in between. Every study, site and person is invented and nothing in it is clinical or regulatory advice.",
    realWorldTech: [
      "CDISC SDTM and ADaM",
      "CDASH partial date handling",
      "Source data verification",
      "Protocol amendments and IRB activation",
      "Database lock",
    ],
  },
};
