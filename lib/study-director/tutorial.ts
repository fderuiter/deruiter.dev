import type { TutorialScript } from "@/lib/arcade";

/**
 * The signals Study Director's office sends its tutorial (#3457): the
 * player walked, talked to someone, opened the EDC, asked how they are,
 * sat at the desk, decided something, and wrote a decision up.
 */
export const STUDY_DIRECTOR_TUTORIAL_SIGNALS = {
  move: "move",
  talk: "talk",
  edc: "edc",
  self: "self",
  desk: "desk",
  decide: "decide",
  document: "document",
} as const;

const S = STUDY_DIRECTOR_TUTORIAL_SIGNALS;

/**
 * The seed of the tutorial's practice day. Its first morning has calls to
 * return at the desk, so there is a decision to make and write up.
 */
export const STUDY_DIRECTOR_TUTORIAL_SEED = "sdw-tutorial";

/**
 * Study Director's guided tutorial (#3457). It runs a practice morning in
 * the office whose clock stands still and that is never saved, and teaches
 * the office by doing: walk, talk, the EDC, asking how you are, the desk, a
 * decision and its write-up. Its first step is the office's first-run help,
 * which the Controls button still opens. The keys match the cabinet's
 * controls list.
 */
export const STUDY_DIRECTOR_TUTORIAL: TutorialScript = {
  gameId: "study-director",
  version: 1,
  minutes: 4,
  steps: [
    {
      id: "welcome",
      chapter: "The office",
      title: "Run one study",
      body: "You direct Study 24-081 from kickoff to closeout, on the floor of a contract research organization. Every action costs minutes and energy. On this practice morning the clock stands still and nothing is saved.",
    },
    {
      id: "move",
      chapter: "The office",
      title: "Walk the floor",
      body: "Walk around the office. The office directory beside the floor walks you to a person or a station without steering.",
      keys: "W A S D or the arrow keys",
      touch: "Tap the floor or the arrow buttons",
      practice: { signal: S.move },
    },
    {
      id: "talk",
      chapter: "The team",
      title: "Talk to someone",
      body: "Walk up to someone on your team, face them and press E. Talking is how you hear what the dashboard does not say, and how you hand out work.",
      keys: "E",
      touch: "The E button",
      practice: { signal: S.talk },
    },
    {
      id: "edc",
      chapter: "The work",
      title: "Open the EDC",
      body: "Walk to the EDC workstation and press E. It shows the query queue the sites have entered, and working it closes queries.",
      keys: "E at the EDC",
      touch: "The E button at the EDC",
      practice: { signal: S.edc },
    },
    {
      id: "self",
      chapter: "The work",
      title: "Ask how it is going",
      body: "Ask yourself how you are. Energy and focus run down through the day, and a tired director decides worse.",
      keys: "F",
      touch: "The F button",
      target: "self",
      practice: { signal: S.self },
    },
    {
      id: "desk",
      chapter: "Decisions",
      title: "Sit at your desk",
      body: "Walk to the phone in your office and press E. Your desk opens: mail, voicemail and calls to return wait there.",
      keys: "E at the phone",
      touch: "The E button at the phone",
      practice: { signal: S.desk },
    },
    {
      id: "decide",
      chapter: "Decisions",
      title: "Make a decision",
      body: "Return one of the calls at the desk and choose an answer.",
      keys: "The number keys, or click an answer",
      touch: "Tap an answer",
      practice: { signal: S.decide },
    },
    {
      id: "document",
      chapter: "Decisions",
      title: "Write it up",
      body: "A decision that is not on file becomes documentation debt, and inspection finds it. Write it up now, or later from the desk.",
      keys: "Click Write it up now",
      touch: "Tap Write it up now",
      practice: { signal: S.document },
    },
    {
      id: "done",
      chapter: "The real day",
      title: "The clock runs",
      body: "A real day runs from morning to the hard stop, with calls, visitors and site visits, and ends with the overnight report. The Controls button lists the keys again.",
    },
  ],
};
