/**
 * NeuroRecon: FreeSurfer Pipeline Simulator & QA Studio
 * Core Type Definitions & Neuroimaging Data Structures
 */

export interface VoxelCoord {
  x: number;
  y: number;
  z: number;
}

export interface ControlPoint {
  id: string;
  x: number;
  y: number;
  z: number;
  intensity: number;
  label?: string;
  timestamp: number;
}

export interface VoxelEdit {
  x: number;
  y: number;
  z: number;
  originalValue: number;
  newValue: number;
  layer: "brainmask" | "wm";
}

export type SlicePlane = "axial" | "coronal" | "sagittal";

export type SurfaceMode = "pial" | "white" | "inflated" | "aseg" | "aparc";

export type HemisphereFilter = "both" | "lh" | "rh";

export interface AnatomicalParcel {
  id: number;
  name: string;
  shortName: string;
  lobe: "Frontal" | "Parietal" | "Temporal" | "Occipital" | "Cingulate" | "Insular" | "Subcortical";
  color: number; // Hex color matching FreeSurfer ColorLUT
  rgb: [number, number, number]; // 0-255 RGB
  normRgb: [number, number, number]; // 0-1 normalized RGB
  description: string;
}

export const DESIKAN_KILLIANY_PARCELS: Record<string, AnatomicalParcel> = {
  superiorfrontal: {
    id: 1028,
    name: "Superior Frontal Gyrus",
    shortName: "superiorfrontal",
    lobe: "Frontal",
    color: 0x14dca0,
    rgb: [20, 220, 160],
    normRgb: [20 / 255, 220 / 255, 160 / 255],
    description: "Involved in self-awareness, working memory execution, and cognitive control.",
  },
  rostralmiddlefrontal: {
    id: 1027,
    name: "Rostral Middle Frontal Gyrus",
    shortName: "rostralmiddlefrontal",
    lobe: "Frontal",
    color: 0x4b327d,
    rgb: [75, 50, 125],
    normRgb: [75 / 255, 50 / 255, 125 / 255],
    description: "Anterior dorsolateral prefrontal cortex critical for goal-driven executive attention.",
  },
  caudalmiddlefrontal: {
    id: 1003,
    name: "Caudal Middle Frontal Gyrus",
    shortName: "caudalmiddlefrontal",
    lobe: "Frontal",
    color: 0x641900,
    rgb: [100, 25, 0],
    normRgb: [100 / 255, 25 / 255, 0 / 255],
    description: "Posterior premotor region coordinating voluntary eye movements and motor planning.",
  },
  parsopercularis: {
    id: 1018,
    name: "Pars Opercularis (Broca's Area)",
    shortName: "parsopercularis",
    lobe: "Frontal",
    color: 0xdcb48c,
    rgb: [220, 180, 140],
    normRgb: [220 / 255, 180 / 255, 140 / 255],
    description: "Dominant hemisphere language production and phonological syntactic sequencing.",
  },
  parstriangularis: {
    id: 1020,
    name: "Pars Triangularis",
    shortName: "parstriangularis",
    lobe: "Frontal",
    color: 0xdc3c14,
    rgb: [220, 60, 20],
    normRgb: [220 / 255, 60 / 255, 20 / 255],
    description: "Semantic processing and lexical retrieval inside the inferior frontal gyrus.",
  },
  parsorbitalis: {
    id: 1019,
    name: "Pars Orbitalis",
    shortName: "parsorbitalis",
    lobe: "Frontal",
    color: 0x146432,
    rgb: [20, 100, 50],
    normRgb: [20 / 255, 100 / 255, 50 / 255],
    description: "Ventral inferior frontal cortex participating in social cognition and language semantics.",
  },
  lateralorbitofrontal: {
    id: 1012,
    name: "Lateral Orbitofrontal Cortex",
    shortName: "lateralorbitofrontal",
    lobe: "Frontal",
    color: 0x234b32,
    rgb: [35, 75, 50],
    normRgb: [35 / 255, 75 / 255, 50 / 255],
    description: "Evaluates reward expectations, punishment avoidance, and behavioral inhibition.",
  },
  medialorbitofrontal: {
    id: 1014,
    name: "Medial Orbitofrontal Cortex",
    shortName: "medialorbitofrontal",
    lobe: "Frontal",
    color: 0xc8234b,
    rgb: [200, 35, 75],
    normRgb: [200 / 255, 35 / 255, 75 / 255],
    description: "Ventromedial prefrontal hub mediating subjective value and emotion regulation.",
  },
  precentral: {
    id: 1024,
    name: "Precentral Gyrus (Primary Motor Cortex)",
    shortName: "precentral",
    lobe: "Frontal",
    color: 0x3c14dc,
    rgb: [60, 20, 220],
    normRgb: [60 / 255, 20 / 255, 220 / 255],
    description: "Brodmann Area 4 motor homunculus executing somatotopic voluntary movement.",
  },
  paracentral: {
    id: 1017,
    name: "Paracentral Lobule",
    shortName: "paracentral",
    lobe: "Frontal",
    color: 0x3cdc3c,
    rgb: [60, 220, 60],
    normRgb: [60 / 255, 220 / 255, 60 / 255],
    description: "Medial motor and somatosensory control for lower extremities and sphincter tone.",
  },
  frontalpole: {
    id: 1032,
    name: "Frontal Pole (Brodmann Area 10)",
    shortName: "frontalpole",
    lobe: "Frontal",
    color: 0x64197d,
    rgb: [100, 25, 125],
    normRgb: [100 / 255, 25 / 255, 125 / 255],
    description: "Most rostral prefrontal mantle overseeing multi-task coordination and meta-cognition.",
  },
  postcentral: {
    id: 1022,
    name: "Postcentral Gyrus (Primary Somatosensory Cortex)",
    shortName: "postcentral",
    lobe: "Parietal",
    color: 0xdc1414,
    rgb: [220, 20, 20],
    normRgb: [220 / 255, 20 / 255, 20 / 255],
    description: "Brodmann Areas 3, 1, 2 processing tactile, proprioceptive, and thermal afferents.",
  },
  superiorparietal: {
    id: 1029,
    name: "Superior Parietal Lobule",
    shortName: "superiorparietal",
    lobe: "Parietal",
    color: 0x14b48c,
    rgb: [20, 180, 140],
    normRgb: [20 / 255, 180 / 255, 140 / 255],
    description: "Spatial orientation, visuospatial attention, and sensorimotor integration.",
  },
  inferiorparietal: {
    id: 1008,
    name: "Inferior Parietal Lobule",
    shortName: "inferiorparietal",
    lobe: "Parietal",
    color: 0xdc3cdc,
    rgb: [220, 60, 220],
    normRgb: [220 / 255, 60 / 255, 220 / 255],
    description: "Heteromodal association area integrating multimodal sensory information and mathematics.",
  },
  supramarginal: {
    id: 1031,
    name: "Supramarginal Gyrus",
    shortName: "supramarginal",
    lobe: "Parietal",
    color: 0x50a014,
    rgb: [80, 160, 20],
    normRgb: [80 / 255, 160 / 255, 20 / 255],
    description: "Somatosensory language association and empathy/theory of mind processing.",
  },
  precuneus: {
    id: 1025,
    name: "Precuneus",
    shortName: "precuneus",
    lobe: "Parietal",
    color: 0xa08cb4,
    rgb: [160, 140, 180],
    normRgb: [160 / 255, 140 / 255, 180 / 255],
    description: "Core node of Default Mode Network (DMN) supporting autobiographical memory and self-reflection.",
  },
  superiortemporal: {
    id: 1030,
    name: "Superior Temporal Gyrus",
    shortName: "superiortemporal",
    lobe: "Temporal",
    color: 0x8cdcdc,
    rgb: [140, 220, 220],
    normRgb: [140 / 255, 220 / 255, 220 / 255],
    description: "Primary auditory cortex (Heschl's gyrus) and Wernicke's auditory receptive area.",
  },
  middletemporal: {
    id: 1015,
    name: "Middle Temporal Gyrus",
    shortName: "middletemporal",
    lobe: "Temporal",
    color: 0xa06432,
    rgb: [160, 100, 50],
    normRgb: [160 / 255, 100 / 255, 50 / 255],
    description: "Multimodal semantic comprehension, facial recognition, and distance perception.",
  },
  inferiortemporal: {
    id: 1009,
    name: "Inferior Temporal Gyrus",
    shortName: "inferiortemporal",
    lobe: "Temporal",
    color: 0xb42878,
    rgb: [180, 40, 120],
    normRgb: [180 / 255, 40 / 255, 120 / 255],
    description: "Ventral visual stream hub executing complex visual shape and object recognition.",
  },
  fusiform: {
    id: 1007,
    name: "Fusiform Gyrus",
    shortName: "fusiform",
    lobe: "Temporal",
    color: 0xb4dc8c,
    rgb: [180, 220, 140],
    normRgb: [180 / 255, 220 / 255, 140 / 255],
    description: "Fusiform Face Area (FFA) and Visual Word Form Area (VWFA).",
  },
  entorhinal: {
    id: 1006,
    name: "Entorhinal Cortex",
    shortName: "entorhinal",
    lobe: "Temporal",
    color: 0xdc140a,
    rgb: [220, 20, 10],
    normRgb: [220 / 255, 20 / 255, 10 / 255],
    description: "Primary interface between neocortex and hippocampal formation; earliest site of Alzheimer's tau neurodegeneration.",
  },
  temporalpole: {
    id: 1033,
    name: "Temporal Pole",
    shortName: "temporalpole",
    lobe: "Temporal",
    color: 0x464646,
    rgb: [70, 70, 70],
    normRgb: [70 / 255, 70 / 255, 70 / 255],
    description: "Anterior temporal tip binding visceral emotion to complex autobiographical memory.",
  },
  lateraloccipital: {
    id: 1011,
    name: "Lateral Occipital Cortex",
    shortName: "lateraloccipital",
    lobe: "Occipital",
    color: 0x141e8c,
    rgb: [20, 30, 140],
    normRgb: [20 / 255, 30 / 255, 140 / 255],
    description: "Secondary visual cortex processing retinotopic object contours and motion trajectories.",
  },
  cuneus: {
    id: 1005,
    name: "Cuneus",
    shortName: "cuneus",
    lobe: "Occipital",
    color: 0xdc1464,
    rgb: [220, 20, 100],
    normRgb: [220 / 255, 20 / 255, 100 / 255],
    description: "Medial occipital cortex superior to calcarine fissure processing lower visual field quadrant.",
  },
  lingual: {
    id: 1013,
    name: "Lingual Gyrus",
    shortName: "lingual",
    lobe: "Occipital",
    color: 0xe18c8c,
    rgb: [225, 140, 140],
    normRgb: [225 / 255, 140 / 255, 140 / 255],
    description: "Medial occipital/temporal transitional cortex critical for color processing (V4) and encoding word forms.",
  },
  pericalcarine: {
    id: 1021,
    name: "Pericalcarine Cortex (Primary Visual Cortex V1)",
    shortName: "pericalcarine",
    lobe: "Occipital",
    color: 0x78643c,
    rgb: [120, 100, 60],
    normRgb: [120 / 255, 100 / 255, 60 / 255],
    description: "Striate cortex along the calcarine fissure receiving direct lateral geniculate nucleus optic radiations.",
  },
  rostralanteriorcingulate: {
    id: 1026,
    name: "Rostral Anterior Cingulate",
    shortName: "rostralanteriorcingulate",
    lobe: "Cingulate",
    color: 0x50148c,
    rgb: [80, 20, 140],
    normRgb: [80 / 255, 20 / 255, 140 / 255],
    description: "Affective division of the cingulate involved in conflict monitoring and emotional appraisal.",
  },
  caudalanteriorcingulate: {
    id: 1002,
    name: "Caudal Anterior Cingulate",
    shortName: "caudalanteriorcingulate",
    lobe: "Cingulate",
    color: 0x7d8219,
    rgb: [125, 130, 25],
    normRgb: [125 / 255, 130 / 255, 25 / 255],
    description: "Cognitive division of the cingulate driving error detection and cognitive response override.",
  },
  posteriorcingulate: {
    id: 1023,
    name: "Posterior Cingulate Cortex",
    shortName: "posteriorcingulate",
    lobe: "Cingulate",
    color: 0xdcb4dc,
    rgb: [220, 180, 220],
    normRgb: [220 / 255, 180 / 255, 220 / 255],
    description: "Highly connected metabolic hub and default mode network anchor for focused consciousness.",
  },
  isthmuscingulate: {
    id: 1010,
    name: "Isthmus of Cingulate",
    shortName: "isthmuscingulate",
    lobe: "Cingulate",
    color: 0x8c148c,
    rgb: [140, 20, 140],
    normRgb: [140 / 255, 20 / 255, 140 / 255],
    description: "Transitional zone connecting the cingulate gyrus to the parahippocampal gyrus.",
  },
  insula: {
    id: 1035,
    name: "Insular Cortex",
    shortName: "insula",
    lobe: "Insular",
    color: 0xffc020,
    rgb: [255, 192, 32],
    normRgb: [1, 192 / 255, 32 / 255],
    description: "Deep within the lateral sulcus, mediating interoceptive awareness, gustation, and pain processing.",
  },
};

export type ToolMode = "inspect" | "control_point" | "paint" | "erase";

export type ScenarioId =
  | "dura_inclusion"
  | "wm_hypointensity"
  | "skull_strip_erosion"
  | "topological_handle"
  | "sandbox";

export type DatasetSource = "case_study" | "mni152" | "oasis";

export interface DatasetConfig {
  id: DatasetSource;
  name: string;
  subtitle: string;
  sourceRepo: string;
  modelUrl?: string;
  isRealHumanScan: boolean;
}

export interface ScenarioLore {
  biologicalCause: string;
  algorithmicImpact: string;
  remediationProtocol: string;
  freeSurferCommand: string;
}

export interface ScenarioConfig {
  id: ScenarioId;
  title: string;
  subtitle: string;
  badge: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced" | "Expert" | "Sandbox";
  targetPlane: SlicePlane;
  targetCoords: VoxelCoord;
  defectDescription: string;
  lore: ScenarioLore;
  initialEuler: number;
  targetEuler: number;
  initialDefects: number;
  targetDice: number;
  recommendedTool: ToolMode;
  successMessage: string;
}

export interface QAMetrics {
  eulerCharacteristic: number;
  defectCount: number;
  diceScore: number;
  meanCorticalThicknessMm: number;
  controlPointCount: number;
  voxelEditsCount: number;
  isResolved: boolean;
  accuracyScore: number;
}

export interface ScoreState {
  score: number;
  multiplier: number;
  streak: number;
  resolvedScenarios: ScenarioId[];
}

export interface TerminalLog {
  id: string;
  type: "command" | "output" | "error" | "info" | "success";
  text: string;
  timestamp: string;
}

export interface VolumeDimensions {
  width: number;
  height: number;
  depth: number;
}

export interface TissueSegmentLabels {
  BACKGROUND: 0;
  CSF: 1;
  GRAY_MATTER: 2;
  WHITE_MATTER: 3;
  SUBCORTICAL: 4;
  DURA: 5;
  SKULL: 6;
}

export const TISSUE_LABELS: TissueSegmentLabels = {
  BACKGROUND: 0,
  CSF: 1,
  GRAY_MATTER: 2,
  WHITE_MATTER: 3,
  SUBCORTICAL: 4,
  DURA: 5,
  SKULL: 6,
};

export { progressBus, formatBytes, type AssetProgressEvent, type ProgressSubscriber } from "./progress-bus";

export interface MeshWorkerRequest {
  id: string;
  mode: SurfaceMode;
  hemiFilter: HemisphereFilter;
  wireframe?: boolean;
}

export interface HemisphereBufferTransfer {
  hemi: "left" | "right";
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
}

export interface RawGeometryBuffer {
  name?: string;
  hemi?: "left" | "right";
  positions: Float32Array;
  normals?: Float32Array;
  colors?: Float32Array;
  indices: Uint32Array;
  color?: number;
}

export interface GeometryBundle {
  mode: SurfaceMode;
  hemiFilter: HemisphereFilter;
  wireframe?: boolean;
  buffers: RawGeometryBuffer[];
  isSubcortical?: boolean;
}

export interface MeshWorkerResponse {
  id: string;
  mode: SurfaceMode;
  hemiFilter: HemisphereFilter;
  wireframe: boolean;
  buffers: RawGeometryBuffer[];
  isSubcortical?: boolean;
}
