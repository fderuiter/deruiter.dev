import type { FieldManualData } from "./types";

export const STUDY_DIRECTOR_MANUAL: FieldManualData = {
  id: "study-director",
  title: "Study Director: Everything Is Fine",
  subtitle: "Clinical Study Management Simulator",
  genre: "Management Simulation",
  badge: "Walkable Office",
  route: "/arcade/study-director",
  accentColor: "from-amber-500/20 via-amber-500/5 to-transparent",
  badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  objective:
    "Take Study 24-081, a randomized PK study for a first-time biotech, from kickoff to closeout: a scientifically valid, compliant study, on time, without wrecking the budget, the sponsor relationship or your team. Six meters compete and you cannot keep them all high. At the end the sponsor, the company, the science and the regulator each give a verdict, and the FDA may come to ask about your decisions.",
  quickSummary:
    "The game opens in the CRO office. Walk the floor with W A S D, press E to use what you face or talk to a teammate, and drive out to the sites to see what the dashboard is hiding. Every action costs minutes and energy; go home when the day runs out. Prefer a dashboard? The classic desk gives you 5 attention points a day instead. Skipped documentation adds documentation debt, which the inspection replays. Your run saves as you play.",
  controls: [
    {
      action: "Walk the office",
      description:
        "Moves one tile; hold the key to keep walking. Walking costs clock time, about four tiles a minute. Pressing into the wall beside a doorway slides you into line with the door (one step, paid for). In the office directory, each place shows what the walk would cost before you go.",
      key: "W A S D / Arrows",
    },
    {
      action: "Use or talk",
      description:
        "Uses the station you face (EDC, phone, eTMF, coffee, your car) or talks to the teammate in front of you.",
      key: "E",
    },
    {
      action: "Work the query queue (office)",
      description:
        "At the EDC workstation, spends forty-five minutes answering the open queries the sites have entered, the biggest backlog first. Only queries the EDC shows can be worked: a site that hides its problems keeps them. The Today list counts the queries the EDC shows, and the evening wrap-up counts the ones you closed.",
      key: "E at the EDC",
    },
    {
      action: "Ask yourself how it is going",
      description: "It is fine.",
      key: "F",
    },
    {
      action: "Choose an option (classic desk)",
      description:
        "Answers the open message with the numbered option. Each option shows its attention cost.",
      key: "1 - 5",
    },
    {
      action: "Document the decision",
      description:
        "Toggles documentation for the next choice. It costs 1 extra attention and keeps the decision from becoming an observation at inspection.",
      key: "D",
    },
    {
      action: "Move through the inbox",
      description: "Selects the next or previous message in the inbox.",
      key: "J / K",
    },
    {
      action: "End the day (classic desk)",
      description:
        "Unanswered messages whose time has run out apply their fallout, the study advances one day and attention refills to 5, less when a query backlog or documentation debt is taking routine work.",
      key: "E",
    },
    {
      action: "Skip to the next message",
      description:
        "When nothing is waiting, ends days until the next message arrives, so quiet stretches take one keypress.",
      key: "N",
    },
    {
      action: "Audit a site",
      description:
        "Costs 2 attention. Shows the site's true queries, deviations, unsigned source, eligibility concerns and training for 10 days.",
      key: "Audit button",
    },
    {
      action: "Delegate the day (office)",
      description:
        "Asks first, then hands the rest of the day to the team and sends you home. They give each waiting message its quickest answer without writing it up, some messages slip through and land their fallout, and every teammate trusts you a little less. The overnight report says what they did.",
      key: "Delegate button",
    },
  ],
  rules: [
    {
      title: "Short or full study",
      detail:
        "A new office run offers two lengths beside the difficulty. The full study runs 77 days with 48 subjects at five sites. The short study is the same protocol as a 35-day pilot with 24 subjects at Sites 01 to 03: the same deck of messages, follow-ups and visitors comes, closer together, and a rescue starts three days behind instead of six. With a few delegated days a short study fits in one sitting. The share card says which one you ran, and saves from before the choice load as the full study.",
      badge: "Length",
    },
    {
      title: "A different inbox every run",
      detail:
        "Each run deals its own deck of messages from the seed. The key moments always come: the protocol questions, first dosing, the analysis plan, database lock and the report. About three quarters of the other messages written for each stretch of the study arrive, each a few days either side of its usual day, so two runs differ in what lands as well as when. Follow-ups and callbacks only come after the decision that caused them, and never without it. A study that slips past its planned end gets mail of its own: the lock date, licences, finance, close-out visits and the boxes in the copier room. The same seed and the same decisions give the same inbox, and a save from before the deck keeps its messages on their old days.",
      badge: "Deck",
    },
    {
      title: "Attention is the resource",
      detail:
        "In the office, minutes and energy are the resource: the day starts at 8:00 and a late finish costs energy and morale. On the classic desk you get 5 attention points a day and unspent points do not carry over. Answering, delegating and auditing all spend them, so some messages will go unanswered.",
      badge: "Attention",
    },
    {
      title: "Sounds and small signals",
      detail:
        "Sound is off until you turn it on with the site's sound toggle, and it follows the site's reduced-motion and high-contrast settings. Six short cues exist, each played once per event and never in a loop: footsteps (every second tile, not on touch screens), a door when you enter a room, the phone ringing, an email chime, the coffee machine, and a stamp when an item leaves your task list. Small toasts show energy or focus moving, a heart gained or lost, and a stamped task. They are decoration: everything that matters is also written in the HUD and read out by screen readers.",
      badge: "Feedback",
    },
    {
      title: "The shape of a day",
      detail:
        "Each morning you can choose one priority for the day: your people, the sites or your desk. It colours the evening, when a short wrap-up says what you decided, what is still unwritten, what was left waiting and whether you kept your priority. Choosing people makes every kind gesture land a little harder; sites and desk are judged by what the sites sent overnight and whether your decisions are written up. Around ten, a quarter to one and half past three, something small interrupts the day (lunch, a sponsor ping, a jammed printer, a pile of queries, a fire drill, a new starter stuck at the door). Each has options with a time cost, and an interruption you let go is never free. You are never interrupted at a site or in a meeting.",
      badge: "Rhythm",
    },
    {
      title: "Getting to know your team",
      detail:
        "Open a teammate's conversation for four small actions. Bring a coffee (10 minutes, better if you know their order), ask a favour of them (20 minutes, only if they have room in their workload), ask about them (15 minutes, learns what they care about) or cover for them (5 minutes, needs four hearts, trades some trust for relief). Each can be used only so often. Teammates you trust a lot give you an early warning about the site that worries them most, and take one more unit of work a night.",
      badge: "People",
    },
    {
      title: "Five sites, five kinds of coordinator",
      detail:
        "Drive out to any of five sites. Each has its own coordinator and investigator, its own drive time, and a type you work out from visits: the anxious one whose records hold up, the friendly one who says all is well, the organised one who holds the whole study in their head, the confident one who writes the source from memory, and the new one who reports everything and has nobody to ask. What they show on the first visit is not the whole of them. The right checks reveal the rest, some only from the second visit.",
      badge: "Sites",
    },
    {
      title: "Visitors in the conference room",
      detail:
        "Twice in a study someone waits for you in the conference room for an hour and a half: the sponsor's VP of Clinical Operations, some time in the third week, and the EDC vendor, some time in the sixth. Walk in to meet them. With the sponsor you can tell what you have actually seen (best if you audited the site she is worried about), give the clean summary (pleasant, and a cost to integrity if something is being hidden), hand her to your data manager, or ask for another day. With the vendor you can ask for the audit-trail walkthrough, negotiate the renewal, send the data manager with questions, or take the brochure. A sponsor nobody meets takes it as a snub. Interruptions wait while a visitor does.",
      badge: "Visits",
    },
    {
      title: "Everything is fine, until you look",
      detail:
        "Enrollment, budget and timeline on the dashboard are honest. Safety, data and regulatory only show what each site has reported: a coordinator who emails about everything surfaces most problems, one who says nothing surfaces almost none. An audit shows the real numbers.",
      badge: "Dashboard",
    },
    {
      title: "Decisions echo",
      detail:
        "A high-burden protocol overloads sites, which produces deviations and queries, which overload data management, which delays lock and pushes the schedule. A choice on day 4 can be a crisis on day 63, and some choices schedule a follow-up message.",
      badge: "Causal chain",
    },
    {
      title: "Documentation debt",
      detail:
        "Skipping documentation saves attention today and adds debt. Debt lowers Compliance and raises the chance the FDA visits. If it does, it asks about your own decisions: documented ones close, undocumented ones become observations.",
      badge: "Inspection",
    },
    {
      title: "Four verdicts and a profile",
      detail:
        "Locking the database turns open queries into delay. The sponsor rates you in stars, the company reports margin and timeline variance, the science reports evaluable and missing data, and the regulator grades inspection readiness. The game then names which kind of Study Director you were, from what you actually did. A run played in the office closes out at the same report, and its share card says so; the link replays the same seed at the classic desk. Office runs also keep a meeting archive, reachable from your desk and from the closeout, and add meetings, site visits and what you were told to the exports.",
      badge: "Closeout",
    },
    {
      title: "Arcade Daily",
      detail:
        "Play daily on the arcade hub opens the classic desk on today's study seed, the same for everyone until midnight UTC. A finished daily study records its grade and stars as today's daily best on the hub, beside your career.",
      badge: "Daily",
    },
  ],
  proTips: [
    "Audit the site you hear least from.",
    "A message ignored on a critical day costs more than a cheap answer.",
    "Documenting everything is not free. Document the decisions an inspector would ask about.",
    "When the veteran says there is a problem, there is a problem.",
  ],
  lore: {
    title: "The person in the middle",
    story:
      "A study director sits between the sponsor, the sites, the statisticians, the data managers and the regulators, and is judged on whether the study holds up years later. The game is fictional and simplified: every sponsor, site and person is invented, and nothing in it is regulatory or clinical advice.",
    realWorldTech: [
      "Protocol deviation tracking",
      "Edit checks and data queries",
      "Database lock",
      "Trial master file",
      "FDA inspection readiness",
    ],
  },
};
