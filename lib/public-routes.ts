/**
 * The public route catalog shared by offline precaching and page benchmarks.
 *
 * Route membership belongs here so a first-class page cannot be benchmarked
 * without also being available to the service worker's application shell.
 */
export interface PublicRouteDefinition {
  path: string;
  name: string;
  category: "top-level" | "case-study" | "arcade" | "tool";
}

export const PUBLIC_ROUTE_REGISTRY = [
  { path: "/", name: "Homepage (Pretext & Bio)", category: "top-level" },
  {
    path: "/case-studies",
    name: "Case Studies Index",
    category: "top-level",
  },
  {
    path: "/blog",
    name: "Blog / Engineering Dispatches",
    category: "top-level",
  },
  { path: "/arcade", name: "Arcade Hub", category: "top-level" },
  { path: "/proof", name: "Formal Proof Studio", category: "tool" },
  { path: "/m/proof", name: "Mobile Formal Proof Studio", category: "tool" },
  { path: "/neuro", name: "Neuro 3D Simulator", category: "tool" },
  { path: "/m/neuro", name: "Mobile Neuro 3D Simulator", category: "tool" },
  { path: "/crf", name: "CRF Builder & AST", category: "tool" },
  { path: "/m/crf", name: "Mobile CRF Builder & AST", category: "tool" },
  { path: "/patrol", name: "Patrol Shift Studio", category: "tool" },
  { path: "/m/patrol", name: "Mobile Patrol Shift Studio", category: "tool" },
  {
    path: "/simulator",
    name: "Architectural Archetype Simulator",
    category: "tool",
  },
  {
    path: "/schedule",
    name: "Schedule / Calendar",
    category: "top-level",
  },
  { path: "/contact", name: "Contact", category: "top-level" },
  { path: "/stack", name: "Architecture & Stack", category: "top-level" },
  {
    path: "/acknowledgments",
    name: "Open Source Acknowledgments",
    category: "top-level",
  },
  {
    path: "/merch",
    name: "Laser Loon Merch",
    category: "top-level",
  },
  {
    path: "/offline",
    name: "Offline Fallback View",
    category: "top-level",
  },
  {
    path: "/case-studies/clinical-data-mapper",
    name: "CS: Clinical Data Mapper",
    category: "case-study",
  },
  {
    path: "/case-studies/cadence-clinical",
    name: "CS: Cadence Clinical",
    category: "case-study",
  },
  {
    path: "/case-studies/schemaflow",
    name: "CS: SchemaFlow",
    category: "case-study",
  },
  {
    path: "/case-studies/imednet-python-sdk",
    name: "CS: iMedNet SDK",
    category: "case-study",
  },
  {
    path: "/case-studies/wedding-website",
    name: "CS: Wedding Platform",
    category: "case-study",
  },
  {
    path: "/case-studies/hono-kiln",
    name: "CS: Hono-Kiln Runtime",
    category: "case-study",
  },
  {
    path: "/case-studies/inbody-qr-decoder",
    name: "CS: InBody QR Decoder",
    category: "case-study",
  },
  {
    path: "/case-studies/oxidizemath",
    name: "CS: OxidizeMath",
    category: "case-study",
  },
  {
    path: "/case-studies/ualbf",
    name: "CS: UALBF Engine",
    category: "case-study",
  },
  {
    path: "/case-studies/laser-loon",
    name: "CS: Laser Loon",
    category: "case-study",
  },
  {
    path: "/work/laser-loon",
    name: "CS: Laser Loon Work Route",
    category: "case-study",
  },
  {
    path: "/case-studies/sonos-network-controller",
    name: "CS: Sonos Network Controller",
    category: "case-study",
  },
  {
    path: "/case-studies/clintrials",
    name: "CS: clintrials WASM Engine",
    category: "case-study",
  },
  {
    path: "/case-studies/equipose-randomization",
    name: "CS: Equipose Randomization",
    category: "case-study",
  },
  {
    path: "/case-studies/lambda-wave",
    name: "CS: Lambda-Wave Radar",
    category: "case-study",
  },
  {
    path: "/case-studies/duckdeploy",
    name: "CS: DuckDeploy Dynamic UI",
    category: "case-study",
  },
  {
    path: "/case-studies/cardiac-risk-modeling",
    name: "CS: Cardiac Risk Modeling",
    category: "case-study",
  },
  {
    path: "/case-studies/4glory",
    name: "CS: 4Glory Sports Analytics",
    category: "case-study",
  },
  {
    path: "/case-studies/crf-xl",
    name: "CS: CRF.xl CDISC Compiler",
    category: "case-study",
  },
  {
    path: "/case-studies/promptops",
    name: "CS: PromptOps LLM Framework",
    category: "case-study",
  },
  {
    path: "/case-studies/designing-for-my-brother",
    name: "CS: Designing for My Brother",
    category: "case-study",
  },
  {
    path: "/arcade/working-with-duck",
    name: "Game: Duck Canvas Engine",
    category: "arcade",
  },
  {
    path: "/arcade/laser-loon",
    name: "Game: Laser Loon",
    category: "arcade",
  },
  {
    path: "/arcade/quasi-puzzler",
    name: "Game: Quasi Puzzler",
    category: "arcade",
  },
  {
    path: "/arcade/garmin-watch",
    name: "Game: Garmin Watch",
    category: "arcade",
  },
  {
    path: "/arcade/clinical-chaos",
    name: "Game: Clinical Chaos",
    category: "arcade",
  },
  {
    path: "/arcade/trial-and-error",
    name: "Game: Trial & Error",
    category: "arcade",
  },
  {
    path: "/arcade/study-director",
    name: "Game: Study Director",
    category: "arcade",
  },
  {
    path: "/protocol-drift",
    name: "Protocol Drift Simulator",
    category: "tool",
  },
  {
    path: "/arcade/retro-labyrinth",
    name: "Game: Retro Labyrinth",
    category: "arcade",
  },
  {
    path: "/arcade/meme-vault",
    name: "Game: Secret Meme Vault",
    category: "arcade",
  },
] as const satisfies readonly PublicRouteDefinition[];

export const PUBLIC_ROUTE_PATHS = PUBLIC_ROUTE_REGISTRY.map(({ path }) => path);
