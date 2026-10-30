import type { ArcadeTrophy } from "./types";

/** For Better or Bulk trophies. */
export const FOR_BETTER_OR_BULK_TROPHIES: ArcadeTrophy[] = [
  {
    id: "for_better_or_bulk_setup_crew",
    gameId: "for-better-or-bulk",
    title: "Setup Crew",
    subtitle: "For Better or Bulk",
    description: "Place a dozen things around the venue before 4:00.",
    icon: "Rings",
    category: "gameplay",
    targetScore: 12,
    conditionDescription: "Place 12+ things in For Better or Bulk",
  },
  {
    id: "for_better_or_bulk_everything",
    gameId: "for-better-or-bulk",
    title: "Bought Out the Roses",
    subtitle: "For Better or Bulk",
    description:
      "Buy every rose and place all 27 things the biggest plan asks for: bouquets, centerpieces, petals, chairs, lanterns and the buffet.",
    icon: "Trophy",
    category: "mastery",
    targetScore: 27,
    conditionDescription: "Place 27 things in For Better or Bulk",
  },
  {
    id: "for_better_or_bulk_three_stars",
    gameId: "for-better-or-bulk",
    title: "Three for Three",
    subtitle: "For Better or Bulk",
    description:
      "Meet all three game challenges on a finished run of the standard day.",
    icon: "Sparkles",
    category: "mastery",
    conditionDescription:
      "Meet all three game challenges on a standard-day run in For Better or Bulk",
  },
  {
    id: "for_better_or_bulk_perfect_day",
    gameId: "for-better-or-bulk",
    title: "A Perfect Day",
    subtitle: "For Better or Bulk",
    description:
      "Meet all three game challenges on a seeded day, the one the whole day shares.",
    icon: "Trophy",
    category: "mastery",
    conditionDescription:
      "Meet all three game challenges on a seeded day in For Better or Bulk",
  },
  {
    id: "for_better_or_bulk_nothing_burnt",
    gameId: "for-better-or-bulk",
    title: "Nothing Burnt",
    subtitle: "For Better or Bulk",
    description: "Finish every setup task with no batch burnt on the grill.",
    icon: "Heart",
    category: "gameplay",
    conditionDescription:
      "Finish every setup task with no burnt batches in For Better or Bulk",
  },
];
