import type { FieldManualData } from "./types";

export const PATROL_MANUAL: FieldManualData = {
  id: "patrol",
  title: "Patrol Shift",
  subtitle: "Midwest Ski Patrol Judgment Simulation",
  genre: "Judgment Simulation",
  badge: "Simulation",
  route: "/patrol",
  accentColor: "from-cyan-500/20 via-cyan-500/5 to-transparent",
  badgeBg: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  objective:
    "Work a full patrol shift at a Welch Village-inspired hill: hold the mountain between calls, take dispatches, run the scene, sled the patient down, hand off, and read your debrief. Educational simulation only: it does not teach or certify clinical care.",
  quickSummary:
    "Start your shift, patrol the map between dispatches, assess and treat on scene, run the toboggan down the fall line, hand off to EMS, then review a debrief scored across five dimensions.",
  controls: [
    {
      action: "Start a Shift",
      description:
        "Begin at the intro, move through the morning briefing, and arrive on the mountain map. Reset at any time from the header to start a fresh shift.",
      key: "Begin Shift Briefing",
    },
    {
      action: "Patrol the Mountain Map",
      description:
        "Between calls you hold the hill. Trigger ambient operations (a closed rope, debris on a trail, a guest asking directions) and resolve them, or await the next dispatch.",
      key: "Click Map Actions",
    },
    {
      action: "Respond to Dispatch",
      description:
        "Radio traffic arrives as text on CH 1. Acknowledge the call to travel to the scene; the scenario's location, patient, and bystanders are revealed as you gather information.",
      key: "Acknowledge",
    },
    {
      action: "Run the Scene (OEC)",
      description:
        "Assess scene safety first, then gather observations, check vitals, and execute care actions. Order matters: the debrief engine reads what you did and when.",
      key: "Click Actions",
    },
    {
      action: "Talk to People on Scene",
      description:
        "Choose dialogue responses to delegate to your partner, calm a patient, manage bystanders, or request resources over the radio. There is rarely one correct line.",
      key: "Click Choices",
    },
    {
      action: "Steer the Toboggan (OET)",
      description:
        "Hold left or right to steer across the fall line. Steering is continuous: the sled keeps turning while the key is held.",
      key: "A / D or ← / →",
    },
    {
      action: "Brake and Control Speed",
      description:
        "Hold to scrub speed on the pitch. Chain brake toggles on and off for sustained control on ice; tail rope belay toggles your partner's braking behind the sled.",
      key: "S / ↓ • Space or B • T",
    },
    {
      action: "Pause the Descent",
      description:
        "Freeze the toboggan simulation without losing your run state.",
      key: "P",
    },
    {
      action: "Touch & Step-Through Controls",
      description:
        "On touch devices a control dock provides the same steering, brake, chain-brake, and tail-rope inputs. Step-Through Mode replaces the real-time descent with a discrete, keyboard-and-screen-reader-navigable alternative path.",
      key: "Touch Dock / Step-Through Mode",
    },
    {
      action: "Hand Off & Debrief",
      description:
        "Give a structured handoff to incoming EMS, then read a debrief with specific observations derived from your actual event log, plus a shift summary when you close out.",
      key: "Complete Handoff",
    },
  ],
  rules: [
    {
      title: "Not Medical Training",
      detail:
        "Patrol Shift is an educational simulation about operational judgment. It does not provide clinical protocols, medical guidance, or any form of OEC/OET certification. Never use it as a care reference.",
      badge: "Disclaimer",
    },
    {
      title: "Scene Safety Comes First",
      detail:
        "Assessing scene safety before you touch the patient is scored. The debrief engine checks whether a scene-safety action was logged before your first patient-care action.",
      badge: "Scene",
    },
    {
      title: "Five Debrief Dimensions",
      detail:
        "Every incident is read across Scene Management, Patient Care, Communication, Transportation, and Operational Judgment: each with a meter and specific written observations, not a bare score.",
      badge: "Debrief",
    },
    {
      title: "Smooth Beats Fast",
      detail:
        "Transport is judged on patient comfort, not elapsed time. Abrupt corrections and hard braking on the descent cost you more than a slower, controlled run.",
      badge: "OET",
    },
    {
      title: "Unofficial Tribute",
      detail:
        "An independent, non-commercial tribute to Midwest ski patrolling. Not affiliated with, endorsed by, or sponsored by Welch Village Ski and Snowboard Area.",
      badge: "Notice",
    },
  ],
  proTips: [
    "Assess scene safety before anything else: the debrief engine explicitly checks the ordering.",
    "Delegate. Sending your partner for equipment while you stay with the patient reads as strong scene management.",
    "Reassess vitals after an intervention; a single check early gives the debrief nothing to compare against.",
    "On the descent, small sustained corrections beat large late ones: the comfort metric punishes abrupt input.",
    "Engage the chain brake before the pitch steepens, not after you are already accelerating.",
    "Ambient events between calls are scored too: patrolling is responsibility for a place, not just waiting for injuries.",
    "Audio is muted by default and every radio call is text-first, so nothing is lost with sound off.",
  ],
  lore: {
    title: "Midwest Patrol & Systems Architecture",
    story:
      "Midwest patrolling is its own discipline: 360 feet of vertical, hard-packed man-made snow, short fast laps, and a volunteer culture where the same person sweeps the hill, runs the sled, and talks to the guest's family. This simulation models that judgment (deciding, communicating, and sequencing under mild pressure) through a headless finite state machine, data-authored scenarios, and a declarative rule engine that derives feedback from your event history rather than a scoreboard.",
    realWorldTech: [
      "Finite State Machines",
      "Deep Modules",
      "Declarative Rule Engines",
      "Outdoor Emergency Care (OEC)",
      "Outdoor Emergency Transportation (OET)",
    ],
  },
};
