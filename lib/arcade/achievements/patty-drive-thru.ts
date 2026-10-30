import type { ArcadeTrophy } from "./types";

/** Patty's Drive-Thru trophies. */
export const PATTY_DRIVE_THRU_TROPHIES: ArcadeTrophy[] = [
  {
    id: "patty_drive_thru_first_rush",
    gameId: "patty-drive-thru",
    title: "First Rush",
    subtitle: "Patty's Drive-Thru",
    description: "Keep the line moving with fast, clean orders for one shift.",
    icon: "Headset",
    category: "gameplay",
    targetScore: 400,
    conditionDescription: "Reach 400+ points in Patty's Drive-Thru",
  },
  {
    id: "patty_drive_thru_close",
    gameId: "patty-drive-thru",
    title: "Made It to Close",
    subtitle: "Patty's Drive-Thru",
    description:
      "Work a full shift with most of the board still green when you clock out.",
    icon: "Trophy",
    category: "mastery",
    targetScore: 700,
    conditionDescription: "Reach 700+ points in Patty's Drive-Thru",
  },
  {
    id: "patty_drive_thru_zero_late",
    gameId: "patty-drive-thru",
    title: "Nobody Waited",
    subtitle: "Patty's Drive-Thru",
    description: "Make it to close on a standard shift with zero late orders.",
    icon: "Headset",
    category: "mastery",
    milestone: "zero_late_shift",
    conditionDescription: "Close a standard shift with no late orders",
  },
  {
    id: "patty_drive_thru_full_week",
    gameId: "patty-drive-thru",
    title: "Worked a Full Week",
    subtitle: "Patty's Drive-Thru",
    description:
      "Clock in Monday through Fry Friday and work all five days of a week.",
    icon: "Headset",
    category: "milestone",
    milestone: "full_week",
    conditionDescription: "Finish all five days of a Patty's Drive-Thru week",
  },
];
