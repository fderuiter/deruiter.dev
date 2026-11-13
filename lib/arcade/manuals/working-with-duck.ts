import type { FieldManualData } from "./types";
import { manualControlsFromActions } from "../input";
import { DUCK_ACTIONS } from "@/lib/working-with-duck-actions";

export const WORKING_WITH_DUCK_MANUAL: FieldManualData = {
  id: "working-with-duck",
  title: "Working With Duck",
  subtitle: "Pet Simulation & Multitasking Arcade",
  genre: "Pet Simulation",
  badge: "Pet AI Arcade",
  route: "/arcade/working-with-duck",
  storageKey: "working_with_duck_high_score",
  accentColor: "from-amber-500/20 via-amber-500/5 to-transparent",
  badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  objective:
    "Balance writing production code against managing your autonomous Golden Retriever puppy, Duck. Keep Duck happy, healthy, and hazard-free while maximizing commit output.",
  quickSummary:
    "Toss toys to divert Duck from power cables, command training tricks (Q-W-E-R), push active coding commits (Space), scrub belly rubs during the flop, jump agility hurdles in the Dog Park, and wash in the Bathtub when muddy.",
  controls: [
    // The key column comes from the game's action map (#2356), so the
    // manual names the keys the game binds.
    ...manualControlsFromActions(DUCK_ACTIONS, [
      {
        group: "work",
        action: "Active Code Burst",
        description:
          "In the office, press Spacebar (Focus Work Sprint) to rapidly push code commits and squash bugs with Good Boy multiplier bonuses.",
        alsoKey: "Desk Click",
      },
      {
        group: "tricks",
        action: "Training Tricks",
        description:
          "In the office, press Q (Sit), W (High Five), E (Drop It), or R (Spin) for immediate obedience, focus recovery, and Good Boy score multipliers.",
      },
      {
        group: "toys",
        action: "Toss Toys & Treats",
        description:
          "Press 1 (Tennis Ball), 2 (Kong Chew), 3 (Squeaky Toy), or 4 (Treat) to divert Duck away from server cables and trade stolen items.",
      },
      {
        group: "door",
        action: "Answer the Door",
        description:
          "When a delivery knocks at the back door, press D, click the door, or use the Get the package button to bring it in before it is gone.",
        alsoKey: "Door Click",
      },
    ]),
    {
      action: "Bathtub Wash & Rinse",
      description:
        "When Duck gets muddy at the Dog Park, drag him to the Bathtub station, scrub lather with your mouse, and shower rinse for a sparkling clean coat.",
      key: "Bathtub Click / Drag",
    },
    {
      action: "Agility Jump & Whistle",
      description:
        "In the Dog Park, steer Duck around mud puddles with W or the Up and Down arrow keys, tap Spacebar to leap over agility hurdles, and recall Duck with the ultrasonic whistle.",
      key: "W / Arrows, Spacebar, Whistle",
    },
  ],
  rules: [
    {
      title: "Autonomous Puppy State Machine",
      detail:
        "Duck transitions autonomously between behavioral states: Idle, Hazard-Chew, Belly-Flop, Potty-Sniff, Trick-Performance, and Nap Time. Anticipate his transitions to prevent desk chaos.",
      badge: "Deterministic AI",
    },
    {
      title: "Hazard Interception",
      detail:
        "If Duck chews the API cluster wire or Part 11 audit script, multiplier resets and penalty points apply. Call 'Drop It!' (E) or drop a Kong (2) immediately.",
      badge: "Hazard Penalty",
    },
    {
      title: "Score and Par",
      detail:
        "Every unit of work shipped pays the same points, whether it ticks in on its own or comes from a coding burst, scaled by the Good Boy multiplier. Tricks, saves and bath time add to that. Each sprint has a par time, and every second you ship under it earns a speed bonus, so a fast, calm sprint beats a slow one. The result card compares your score with your best on that same sprint.",
      badge: "Scoring",
    },
    {
      title: "5-Sprint Campaign & Accessories",
      detail:
        "Progress across 5 story-driven sprints to unlock wearable cosmetics: Adidas Bucket Hat, Blue Vet Cone (available right away for post-neuter recovery shenanigans), Tech CEO Bowtie, Adventure Bandana, and Yellow Mud Boots.",
      badge: "Wardrobe Unlocks",
    },
    {
      title: "Sprint Twists",
      detail:
        "Sprints 2 to 5 each add one twist, named on the opening banner. Sprint 2, Cable Alert: every few seconds Duck goes for the power cable, so answer with Drop It (E) or a Kong (2). Sprint 3, Window Watch: squirrels visit the window; call Sit (Q) while one is there for 400 points, or Duck barks, winds up and loses Good Boy. Sprint 4, Mud Storm: storms muddy Duck, and muddy paws halve your coding bursts until a bath. Sprint 5, Launch Standup: 20 seconds in, Excitement climbs faster for 15 seconds; get through it with no zoomies, chews or potty runs for a 1,500 bonus.",
      badge: "Campaign",
    },
    {
      title: "Endless Quarters",
      detail:
        "Endless mode runs in quarters. Every 120 work units a new quarter starts (Q1, Q2, Q3...): the meters fill faster, impulses come sooner, and one hazard joins for the rest of the run. Q2 brings more frequent surprises, Q3 tracks mud in after every potty trip (a muddy Duck slows work until bathed), and Q4 sets Duck chewing faster, power cable first. The run ends at a time-out and scores 1,000 per quarter survived plus the work done, with its own endless best.",
      badge: "Endless",
    },
    {
      title: "Puppy Hiccups",
      detail:
        "From sprint 2, and in endless mode, Duck can catch the hiccups for four seconds. A trick called mid-hic slips and breaks the combo; call it in the gap between hics and it lands as normal.",
      badge: "Surprise",
    },
    {
      title: "Polaroid Scrapbook",
      detail:
        "Capturing key milestone moments unlocks 10 high-resolution real photos and vector artwork in your persistent scrapbook.",
      badge: "Collectibles",
    },
  ],
  proTips: [
    "Use 'Drop It!' (E) as soon as Duck targets a hazard to save items without switching toys.",
    "Equip the Blue Vet Cone right away if cables keep getting chewed: the plastic rim blocks chews with a *CLONK!* and widens bone-scooping at the Dog Park.",
    "Wear Yellow Mud Boots to provide complete mud puddle immunity at the Dog Park.",
    "Equip the Tech CEO Bowtie for an extra 0.2x speed boost during active sprint crunch periods.",
  ],
  lore: {
    title: "Autonomous Behavior Trees in Canvas 2D",
    story:
      "Building lifelike virtual pets requires combining finite state machines with weighted steering behaviors (Craig Reynolds' Boids algorithms). Duck's wandering pathing computes avoidance vectors around furniture while evaluating hunger, joy, and fatigue curves rendered in 60 FPS Canvas 2D with procedural particle fur shaders.",
    realWorldTech: [
      "Craig Reynolds Steering",
      "Finite State Machines",
      "Web Audio API Synths",
      "Canvas 2D Physics",
    ],
  },
};
