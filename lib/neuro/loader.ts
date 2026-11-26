import type {
  ScenarioConfig,
  ScenarioId,
  DatasetConfig,
  DatasetSource,
  QAMetrics,
  ControlPoint,
  VoxelEdit,
} from "./types";
import { SCENARIOS, DATASET_CONFIGS, SCENARIO_LIST } from "./scenarios";
import { generateSyntheticVolume, SyntheticVolume } from "./volume-generator";
import { evaluateQAMetrics } from "./qa-engine";

export async function getNeuroScenarios(): Promise<
  Record<ScenarioId, ScenarioConfig>
> {
  return SCENARIOS;
}

export async function getNeuroDatasetConfigs(): Promise<
  Record<DatasetSource, DatasetConfig>
> {
  return DATASET_CONFIGS;
}

export async function getNeuroScenarioList(): Promise<ScenarioId[]> {
  return SCENARIO_LIST;
}

export async function computeSyntheticVolume(
  scenarioId: ScenarioId
): Promise<SyntheticVolume> {
  return generateSyntheticVolume(scenarioId);
}

export async function computeQAMetrics(
  scenario: ScenarioConfig,
  vol: SyntheticVolume,
  pts: ControlPoint[],
  edits: VoxelEdit[]
): Promise<QAMetrics> {
  return evaluateQAMetrics(scenario, vol, pts, edits);
}

export function getNeuroScenariosSync(): Record<ScenarioId, ScenarioConfig> {
  return SCENARIOS;
}

export function getNeuroDatasetConfigsSync(): Record<
  DatasetSource,
  DatasetConfig
> {
  return DATASET_CONFIGS;
}

export function getNeuroScenarioListSync(): ScenarioId[] {
  return SCENARIO_LIST;
}

export function computeSyntheticVolumeSync(
  scenarioId: ScenarioId
): SyntheticVolume {
  return generateSyntheticVolume(scenarioId);
}

export function computeQAMetricsSync(
  scenario: ScenarioConfig,
  vol: SyntheticVolume,
  pts: ControlPoint[],
  edits: VoxelEdit[]
): QAMetrics {
  return evaluateQAMetrics(scenario, vol, pts, edits);
}
