import type { ArcadeTrophy } from "./types";

/** Working With Duck trophies. */
export const WORKING_WITH_DUCK_TROPHIES: ArcadeTrophy[] = [
  {
    id: "duck_first_sprint",
    gameId: "working-with-duck",
    title: "Deadline Met",
    subtitle: "Working With Duck",
    description: "Complete a work sprint while keeping Duck happy.",
    icon: "Bone",
    category: "gameplay",
    milestone: "sprint_shipped",
    conditionDescription: "Ship any sprint in Working With Duck",
  },
  {
    id: "duck_master",
    gameId: "working-with-duck",
    title: "Puppy Whisperer",
    subtitle: "Working With Duck",
    description:
      "Ship a sprint with every prop saved, no accidents and Duck still a Good Boy.",
    icon: "Heart",
    category: "mastery",
    milestone: "three_star_sprint",
    conditionDescription:
      "Earn all three stars on a sprint in Working With Duck",
  },
  {
    id: "duck_graduate",
    gameId: "working-with-duck",
    title: "Good Boy Graduate",
    subtitle: "Working With Duck",
    description: "Ship all five sprints with Duck still on the Good Boy list.",
    icon: "Trophy",
    category: "mastery",
    milestone: "campaign_cleared",
    conditionDescription: "Clear sprint 5 in Working With Duck",
  },
  {
    id: "duck_trick_or_treat",
    gameId: "working-with-duck",
    title: "Trick or Treat",
    subtitle: "Working With Duck",
    description: "Ship a sprint with Duck dressed as a duck.",
    icon: "Pumpkin",
    category: "gameplay",
    milestone: "duck_costume_sprint",
    conditionDescription:
      "Ship a sprint in Working With Duck wearing the Halloween duck costume",
  },
];
