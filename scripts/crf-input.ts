import fs from "fs";
import path from "path";
import { getOncologyPresetSync } from "../lib/crf/presets";
import { StudyProtocol } from "../lib/crf/types";
import { parseUniversalCrf, exportUniversalCrfJson } from "../lib/crf";

/**
 * How the CRF CLI reads and writes its study file (#3091). A file named on
 * the command line must exist and parse; a broken file is reported, never
 * replaced. Only when no file is named and `study.crf.json` is absent does a
 * read-only command fall back to the oncology demo preset, and it says so.
 */

export const DEFAULT_FILE = "study.crf.json";

/** A problem with the study file the user should fix; printed without a stack. */
export class CrfInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CrfInputError";
  }
}

/** A study the CLI loaded, and where it came from. */
export interface LoadedProtocol {
  readonly study: StudyProtocol;
  /** The file a mutation writes back to. */
  readonly path: string;
  /** True when no file existed and the study is the oncology demo preset. */
  readonly fromDemo: boolean;
}

/**
 * Loads the study file for a command.
 *
 * @param filePath - The file named on the command line, if any.
 * @param options - `allowMissing` lets a command that replaces the whole
 *   study (`preset load`) name a file that does not exist yet.
 *   `warn` receives the notice printed when the demo preset stands in.
 * @returns The study, its path, and whether it is the demo preset.
 * @throws CrfInputError when a named file is missing, or any file fails to parse.
 */
export function loadProtocol(
  filePath: string | undefined,
  options: {
    allowMissing?: boolean;
    warn?: (message: string) => void;
  } = {}
): LoadedProtocol {
  const targetPath = filePath || path.resolve(process.cwd(), DEFAULT_FILE);
  if (fs.existsSync(targetPath)) {
    const raw = fs.readFileSync(targetPath, "utf-8");
    try {
      return {
        study: parseUniversalCrf(raw),
        path: targetPath,
        fromDemo: false,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new CrfInputError(
        `${targetPath} is not a valid Universal CRF protocol: ${reason}. Nothing was read or changed.`
      );
    }
  }
  if (filePath && !options.allowMissing) {
    throw new CrfInputError(`${filePath} does not exist.`);
  }
  if (!filePath && !options.allowMissing) {
    (options.warn ?? console.error)(
      `No ${DEFAULT_FILE} here, so this shows the oncology demo preset. Run \`crf init\` to create a study file.`
    );
  }
  return { study: getOncologyPresetSync(), path: targetPath, fromDemo: true };
}

/**
 * Writes a study back to the file it was loaded from.
 *
 * @param loaded - What {@link loadProtocol} returned.
 * @param study - The changed study.
 * @param options - `replaces`: the study no longer depends on what was
 *   loaded (`preset load`), so writing it over the demo preset is fine.
 * @throws CrfInputError when the change was made to the demo preset, which
 *   would write demo content as if it were the user's study.
 */
export function saveProtocol(
  loaded: LoadedProtocol,
  study: StudyProtocol,
  options: { replaces?: boolean } = {}
): void {
  if (loaded.fromDemo && !options.replaces) {
    throw new CrfInputError(
      `Nothing was saved: there is no study file to change. Run \`crf init\` first, or name an existing file.`
    );
  }
  fs.writeFileSync(loaded.path, exportUniversalCrfJson(study), "utf-8");
}
