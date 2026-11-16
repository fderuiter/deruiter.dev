/**
 * Naming and routing constants for the Trial Data Pipeline Simulator, served
 * at `/clinical/pipeline-simulator` (#3164, #3167).
 *
 * Every surface reads the name and paths from here rather than repeating the
 * strings. The engine in
 * `lib/protocol-drift` keeps its name.
 *
 * @module
 */

/** The tool's display name, used in menus, titles and cards. */
export const PIPELINE_SIMULATOR_NAME = "Trial Data Pipeline Simulator";

/** The route the tool is served at, under the clinical section. */
export const PIPELINE_SIMULATOR_PATH = "/clinical/pipeline-simulator";

/** The tool's old route, which now redirects (308) to the new one. */
export const PIPELINE_SIMULATOR_LEGACY_PATH = "/protocol-drift";

/** The one-line description shown under the tool's name. */
export const PIPELINE_SIMULATOR_TAGLINE =
  "Design the pipeline. See where the data breaks.";
