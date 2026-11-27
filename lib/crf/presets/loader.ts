import { STUDY_PRESETS } from "./index";
import { ONCOLOGY_RECIST_PRESET } from "./oncology-recist";
import type { StudyProtocol } from "../types";

export async function getStudyPresets() {
  return STUDY_PRESETS;
}

export async function getOncologyPreset(): Promise<StudyProtocol> {
  return ONCOLOGY_RECIST_PRESET;
}

export async function getPresetById(
  id: string
): Promise<StudyProtocol | undefined> {
  return STUDY_PRESETS.find((p) => p.id === id)?.study;
}

export function getOncologyPresetSync(): StudyProtocol {
  return ONCOLOGY_RECIST_PRESET;
}

export function getStudyPresetsSync() {
  return STUDY_PRESETS;
}

export function getPresetByIdSync(id: string): StudyProtocol | undefined {
  return STUDY_PRESETS.find((p) => p.id === id)?.study;
}
