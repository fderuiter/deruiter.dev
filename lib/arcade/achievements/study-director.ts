import type { ArcadeTrophy } from "./types";

/** Study Director trophies. */
export const STUDY_DIRECTOR_TROPHIES: ArcadeTrophy[] = [
  {
    id: "study_director_kickoff",
    gameId: "study-director",
    title: "Study Kickoff",
    subtitle: "Study Director",
    description:
      "Get through your first three weeks: answer the inbox, walk the floor and keep the sites running.",
    icon: "ClipboardCheck",
    category: "gameplay",
    // Fired on day 15 of a study, as the text says, not at closeout (#2191).
    milestone: "first_weeks",
    conditionDescription: "Reach day 15 of a study in Study Director",
  },
  {
    id: "study_director_closeout",
    gameId: "study-director",
    title: "FDA Replay Approved",
    subtitle: "Study Director",
    description:
      "Close out a study with every decision written up and nothing left to lapse.",
    icon: "ShieldCheck",
    category: "mastery",
    // Fired by the run it describes, not by career points (#2191).
    milestone: "clean_file",
    conditionDescription:
      "Close out a Study Director study with every decision documented and none ignored",
  },
  {
    id: "study_director_grade_a",
    gameId: "study-director",
    title: "Inspection Ready",
    subtitle: "Study Director",
    description: "Close out a study with an A regulatory grade.",
    icon: "Trophy",
    category: "mastery",
    milestone: "grade_a",
    conditionDescription: "Finish a Study Director study with grade A",
  },
];
