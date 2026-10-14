/**
 * Save files (pd-101-save-v1). A save stores the seed, scenario and the
 * accepted command log; restoring replays the log into a fresh engine and
 * checks the resulting state hash, so a save can never silently diverge.
 */
import { SAVE_FORMAT } from "../presets";
import type { ProtocolDriftSaveFile } from "../types";
import { createProtocolDriftEngine, type ProtocolDriftEngine } from "./engine";

/** Thrown for malformed, unsupported or tampered save files. */
export class ProtocolDriftSaveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProtocolDriftSaveError";
  }
}

/** Serializes a save file to pretty-printed JSON. */
export function serializeSave(save: ProtocolDriftSaveFile): string {
  return JSON.stringify(save, null, 2);
}

/** Parses and version-checks a save file. */
export function deserializeSave(json: string): ProtocolDriftSaveFile {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new ProtocolDriftSaveError("Save file is not valid JSON");
  }
  if (typeof data !== "object" || data === null) {
    throw new ProtocolDriftSaveError("Save file must be a JSON object");
  }
  const save = data as Partial<ProtocolDriftSaveFile>;
  if (save.format !== SAVE_FORMAT) {
    throw new ProtocolDriftSaveError(
      `Unsupported save format: ${String(save.format)}`
    );
  }
  if (save.version !== 1) {
    throw new ProtocolDriftSaveError(
      `Unsupported save version: ${String(save.version)}`
    );
  }
  if (
    typeof save.seed !== "number" ||
    !Array.isArray(save.commands) ||
    typeof save.stateHash !== "string" ||
    (save.scenario !== "full" && save.scenario !== "tracer")
  ) {
    throw new ProtocolDriftSaveError(
      "Save file is missing seed, scenario, commands or stateHash"
    );
  }
  const valid = save as ProtocolDriftSaveFile;
  const rejected = valid.rejectedCommands;
  if (
    rejected !== undefined &&
    !(
      typeof rejected === "number" &&
      Number.isInteger(rejected) &&
      rejected >= 0
    )
  ) {
    // An unreadable count is dropped rather than failing the whole save.
    delete valid.rejectedCommands;
  }
  return valid;
}

/** Rebuilds an engine from a save by replaying its command log. */
export function restoreProtocolDriftEngine(
  save: ProtocolDriftSaveFile
): ProtocolDriftEngine {
  // Rejections never reach the command log, so the count rides on the save
  // and on the replayed INIT that resets the engine (#2054).
  const rejectedCommands = save.rejectedCommands ?? 0;
  const engine = createProtocolDriftEngine({
    seed: save.seed,
    scenario: save.scenario,
    rejectedCommands,
  });
  for (const command of save.commands) {
    engine.dispatch(
      command.type === "INIT" ? { ...command, rejectedCommands } : command
    );
  }
  if (engine.stateHash() !== save.stateHash) {
    throw new ProtocolDriftSaveError(
      "Replayed state does not match the save's state hash"
    );
  }
  return engine;
}
