import type { FieldManualData } from "./types";

export const FOR_BETTER_OR_BULK_MANUAL: FieldManualData = {
  id: "for-better-or-bulk",
  title: "For Better or Bulk",
  subtitle: "Our Costco Wedding, Set Up in Real Time",
  genre: "Co-op Kitchen Chaos",
  badge: "Couch Co-op",
  route: "/arcade/for-better-or-bulk",
  accentColor: "from-rose-300/20 via-rose-300/5 to-transparent",
  badgeBg: "bg-rose-300/10 text-rose-300 border-rose-300/30",
  objective:
    "Turn a car full of warehouse supplies into a wedding between 9:00 and the 4:00 ceremony. Every planned spot in the venue wants one thing: an arrangement on each table, chairs on the lawn, lanterns on the hooks and a full buffet.",
  quickSummary:
    "Before the clock starts, pick two features Fred built into the wedding website months ago and fill the cart without going over budget. Then Fred and Abbi carry roses to the rose table, raw meat to the grill and everything else to where it goes. Phone calls freeze whoever answers unless the website already answered for you. Partway through the morning Fred's brothers text, and the clock stops until he decides what to do. At 4:00 the receipt explains what got done, who did it and why.",
  controls: [
    {
      action: "Move",
      description:
        "In two-player mode Fred uses WASD and Abbi the arrow keys. Alone, either set moves whoever you are playing.",
      key: "WASD / arrows",
    },
    {
      action: "Pick up or put down",
      description:
        "Takes from the crate, station, spot or patch of ground you are facing, or puts what you carry there.",
      key: "E or Space (Fred) / Enter (Abbi)",
    },
    {
      action: "Work",
      description:
        "Hold to arrange roses or pluck petals at a station, or to leave an empty centerpiece or petal spot bare on purpose.",
      key: "F (Fred) / Shift (Abbi)",
    },
    {
      action: "Swap",
      description:
        "In one-player mode, switches between Fred and Abbi. Shift+Tab leaves the cabinet, so keyboard focus can go back to the page.",
      key: "Tab / Shift+Tab",
    },
    {
      action: "Pause",
      description: "Stops the clock.",
      key: "Esc",
    },
  ],
  rules: [
    {
      title: "Roses become things",
      detail:
        "A bunch of roses on the rose table becomes an arrangement after a moment of held work, and in the petal bucket it becomes a bucket of petals. The cart buys exactly the roses the plan needs, so a dropped bunch in the bin is a bare table later.",
      badge: "Rose table",
    },
    {
      title: "The grill does not wait",
      detail:
        "Raw hot dogs and wings cook in a few seconds and burn a few seconds after that. Burnt food goes in the bin, and binning a batch restocks one batch from its crate. Extra food in the cart is insurance against the grill, not extra credit.",
      badge: "Grill",
    },
    {
      title: "The website answers the phone",
      detail:
        "Guests call with questions at set times. A call freezes whoever picks up for a moment, unless a website feature already answers it: the FAQ, Abbi's admin page or the registry scraper. The 3D intro answers nothing.",
      badge: "Phone",
    },
    {
      title: "The brothers' text",
      detail:
        "Fred can stay, take a short break and promise to come back for one thing, or leave. Staying keeps him working, nervously. A break brings him back calmer; the promise is kept only if that work is done by 4:00. Leaving is never a kept promise, however much Abbi finishes alone.",
      badge: "Presence",
    },
    {
      title: "Bare on purpose",
      detail:
        "Hold F or Shift on an empty centerpiece or petal spot to leave it bare. Simplifying drops that spot from the plan, and the receipt counts it as a choice, not as unfinished.",
      badge: "Simplify",
    },
    {
      title: "Arcade Daily",
      detail:
        "Play daily on the arcade hub opens today's seed: the same shower and guest rush for everyone, rolling over at midnight UTC. A day finished on today's seed at normal speed records its spots set as today's daily best, kept apart from the board score, which counts only the standard day.",
      badge: "Daily",
    },
  ],
  proTips: [
    "Put the meat on the grill first, then go do something else nearby.",
    "In one-player mode, park one person at the rose table and swap.",
    "The FAQ and the admin page stop the most calls.",
    "Chairs are heavy but never burn. Two come off the crate at a time.",
  ],
  lore: {
    title: "The real wedding",
    story:
      "Abbi and Fred married on 10/10/25 at the Plummer House in Rochester, for about 100 guests and under about $4,000, mostly from Costco. Abbi did most of the prep with friends, the roses were Kirkland, dinner was hot dogs, wings, mac and cheese and quinoa salad, and the leftovers went to the Rochester warming shelter. The game's layout, timings, prices and choices are invented for play.",
    realWorldTech: [
      "Fixed-timestep simulation",
      "Deterministic replay from input frames",
      "Canvas 2D rendering",
      "Shared-keyboard input mapping",
      "Condition-based explanations",
    ],
  },
};
