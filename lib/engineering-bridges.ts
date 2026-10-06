/**
 * Registry of engineering bridges (ADR 0053 section 3): the technical
 * narrative shown beneath an interactive tool or game, and the case studies
 * and architecture decision records it links to for internal PageRank.
 *
 * Every case-study slug and ADR file listed here is verified against the
 * repository by `__tests__/engineering-bridge.test.tsx`.
 */

/** A link from a tool page to a case study on this site. */
export interface EngineeringBridgeCaseStudy {
  slug: string;
  title: string;
}

/** A link from a tool page to an architecture decision record. */
export interface EngineeringBridgeAdr {
  /** Four-digit ADR number, for example "0042". */
  id: string;
  title: string;
  /** File name inside the `adr/` directory. */
  file: string;
}

/** One state machine, algorithm, or design limit worth calling out. */
export interface EngineeringBridgeConstraint {
  label: string;
  detail: string;
}

/** Everything the bridge section renders for one route. */
export interface EngineeringBridgeEntry {
  route: string;
  /** Short name of the tool, used in the section heading. */
  name: string;
  narrative: readonly string[];
  constraints: readonly EngineeringBridgeConstraint[];
  caseStudies: readonly EngineeringBridgeCaseStudy[];
  adrs: readonly EngineeringBridgeAdr[];
}

export const ADR_REPOSITORY_URL =
  "https://github.com/fderuiter/deruiter.dev/blob/main/adr";

export const ENGINEERING_BRIDGES: Readonly<
  Record<string, EngineeringBridgeEntry>
> = {
  "/crf": {
    route: "/crf",
    name: "CRF Studio",
    narrative: [
      "CRF Studio keeps one study definition and derives every view from it: the visual canvas, the spreadsheet grid, the rule editor and the live simulator all read the same state, so an edit in one appears in the others immediately.",
      "Edit checks are stored as small syntax trees rather than free text. The evaluator walks the tree against sample data, which lets the simulator show which entries would raise a query without running any user-supplied code.",
    ],
    constraints: [
      {
        label: "Single study model",
        detail:
          "Canvas, grid and inspector are projections of one universal study schema validated at runtime.",
      },
      {
        label: "Rules as syntax trees",
        detail:
          "Edit checks compile to an AST that the evaluator guards against cycles and out-of-range input.",
      },
      {
        label: "Standards output",
        detail:
          "Study definitions convert to CDISC ODM-XML 1.3.2 and other formats from the same schema.",
      },
    ],
    caseStudies: [
      {
        slug: "crf-xl",
        title: "CRF.xl: From Spreadsheet to Clinical Forms",
      },
    ],
    adrs: [
      {
        id: "0021",
        title: "Universal CRF specification and studio interface",
        file: "0021-universal-crf-format-and-cli-architecture.md",
      },
      {
        id: "0022",
        title: "Next-generation CRF designer architecture",
        file: "0022-next-generation-crf-designer-architecture.md",
      },
    ],
  },
  "/patrol": {
    route: "/patrol",
    name: "Patrol Shift",
    narrative: [
      "Patrol Shift is driven by a pure finite state machine. A shift moves through named phases, every player action is recorded as an event, and a separate scoring engine and debrief evaluator read that history, so the same shift always produces the same debrief.",
      "The Welch Village map is data, not artwork: trails, lifts and points of interest are typed datasets drawn as vector paths with two tuned camera regions, which keeps the map readable on a phone.",
    ],
    constraints: [
      {
        label: "Deterministic shift engine",
        detail:
          "State transitions are pure functions, so scenarios can be replayed and tested without a browser.",
      },
      {
        label: "Scoring separate from play",
        detail:
          "Protocol scoring and the debrief read the recorded event log rather than live UI state.",
      },
      {
        label: "Map as typed data",
        detail:
          "Trails, lifts and points of interest live in one dataset that drives rendering, selection and the elevation profile.",
      },
    ],
    caseStudies: [],
    adrs: [
      {
        id: "0042",
        title: "Patrol Shift scenario engine and studio architecture",
        file: "0042-patrol-shift-scenario-engine-and-studio-architecture.md",
      },
      {
        id: "0044",
        title: "Welch Village terrain engine and mountain viewport",
        file: "0044-welch-village-geospatial-terrain-engine-and-mountain-viewport-architecture.md",
      },
    ],
  },
  "/arcade/laser-loon": {
    route: "/arcade/laser-loon",
    name: "Laser Loon",
    narrative: [
      "Laser Loon runs on a headless engine: a fixed-timestep loop advances the simulation at a steady rate and the renderer interpolates between steps, so gameplay does not change with the monitor's refresh rate.",
      "The React component is a thin shell. Scores and controls are ordinary HTML over the canvas, which keeps them crisp, readable by assistive technology and separate from the game logic.",
    ],
    constraints: [
      {
        label: "Fixed timestep",
        detail:
          "Physics advances in constant steps with an accumulator, giving the same result at 60Hz and 144Hz.",
      },
      {
        label: "Object pooling",
        detail:
          "Projectiles and particles are recycled from pools to avoid garbage-collection pauses mid-game.",
      },
      {
        label: "HTML heads-up display",
        detail:
          "Score and touch controls sit in an overlay outside the canvas, not drawn into it.",
      },
    ],
    caseStudies: [
      {
        slug: "laser-loon",
        title: "Laser Loon: Minnesota, With Eye Lasers",
      },
    ],
    adrs: [
      {
        id: "0019",
        title: "Standardized arcade viewport and touch control architecture",
        file: "0019-standardized-arcade-viewport-and-touch-control-architecture.md",
      },
      {
        id: "0026",
        title: "Headless arcade engine lifecycle and HTML HUD standard",
        file: "0026-headless-arcade-engine-lifecycle-and-html-hud-standard.md",
      },
    ],
  },
};
