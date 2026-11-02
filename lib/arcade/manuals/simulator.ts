import type { FieldManualData } from "./types";

export const SIMULATOR_MANUAL: FieldManualData = {
  id: "simulator",
  title: "Architectural Archetype Simulator",
  subtitle: "Architecture Bias, Incident Triage & Code Review",
  genre: "Decision Sim",
  badge: "Decision Tree",
  route: "/simulator",
  accentColor: "from-blue-500/20 via-blue-500/5 to-transparent",
  badgeBg: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  objective:
    "Make three engineering trade-offs (an architecture bias, a production incident mitigation and a code review safeguard) and see how they balance Systems Rigor, UI/UX Craft, Resilience and Velocity.",
  quickSummary:
    "Choose an architecture bias, triage a live latency spike and review an async pipeline. Your path maps deterministically to one of four Architectural Archetypes.",
  controls: [
    {
      action: "Select an Option",
      description:
        "Click or press Enter on an option card to commit to that trade-off. Each option adds points to the four decision axes.",
      key: "Click Option Card",
    },
    {
      action: "Step Back",
      description:
        "Use Back (or the browser's Back button) to revisit the previous question. Progress lives in the URL, so any step can be shared or bookmarked.",
      key: "Back Button",
    },
    {
      action: "Copy Report",
      description:
        "On the result screen, copy a plain-text report with your archetype, the four decision stats, your three decisions and a link that reopens the result.",
      key: "Copy Report",
    },
    {
      action: "Run Again",
      description:
        "Return to the first question to explore a different path and archetype.",
      key: "Run Again",
    },
  ],
  rules: [
    {
      title: "Four Decision Axes",
      detail:
        "Every option adds points to Systems Rigor, UI/UX Craft, Resilience and Velocity. Stats show each axis as a share of the most that axis can score on any path.",
      badge: "Score Matrix",
    },
    {
      title: "Live Incident Commander Triage",
      detail:
        "Stage 2 places you in the middle of a production latency spike. A circuit breaker with a fallback queue favours resilience; scaling read-replicas favours velocity.",
      badge: "Outage Triage",
    },
    {
      title: "Architectural Archetypes",
      detail:
        "Your bias (systems or interface) and stance (resilience or velocity) select one of four archetypes, from 'Fault-Isolation Architect' to 'Product Velocity Engineer'. Ties resolve to systems and resilience.",
      badge: "Archetype Profile",
    },
  ],
  proTips: [
    "There are no purely 'correct' choices: every decision trades speed, durability and operational overhead against each other.",
    "Question 1 sets your bias; question 2 mostly sets your stance. Change one of them to reach a different archetype.",
    "The stage badge above each question names the operational context of the challenge.",
  ],
  lore: {
    title: "Architecture Trade-offs Under Pressure",
    story:
      "Architecture is mostly a series of trade-offs made with incomplete information: which layer to harden first, how to stop a latency spike from cascading, and which safeguard a pipeline cannot ship without. The simulation compresses three of those decisions into a few minutes and shows which pattern your choices form.",
    realWorldTech: [
      "Expand-and-Contract Migrations",
      "SRE SLO/SLA Frameworks",
      "Blameless Post-Mortems",
      "Circuit Breakers",
    ],
  },
};
