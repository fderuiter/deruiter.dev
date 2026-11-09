/**
 * Naming and routing constants for the Trial Data Pipeline Simulator, the
 * planned name of the tool now served at `/protocol-drift` (#3164).
 *
 * The rebrand lands in steps, so every later step reads the name and paths
 * from here rather than repeating the strings. The engine in
 * `lib/protocol-drift` keeps its name.
 *
 * @module
 */

/** The tool's display name, used in menus, titles and cards. */
export const PIPELINE_SIMULATOR_NAME = "Trial Data Pipeline Simulator";

/** The route the tool moves to under the clinical section. */
export const PIPELINE_SIMULATOR_PATH = "/clinical/pipeline-simulator";

/** The route the tool is served at today, kept so old links keep working. */
export const PIPELINE_SIMULATOR_LEGACY_PATH = "/protocol-drift";

/** The one-line description shown under the tool's name. */
export const PIPELINE_SIMULATOR_TAGLINE =
  "Design the pipeline. See where the data breaks.";
