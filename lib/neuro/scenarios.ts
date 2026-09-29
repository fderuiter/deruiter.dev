/**
 * Clinical FreeSurfer Defect Scenarios & Curriculum Configuration
 */

import { formatNeuroToolKey } from "./hotkeys";
import { DatasetConfig, DatasetSource, ScenarioConfig, ScenarioId } from "./types";

export const SCENARIOS: Record<ScenarioId, ScenarioConfig> = {
  dura_inclusion: {
    id: "dura_inclusion",
    title: "Case 01: Dura Over-Inclusion in Temporal Lobe",
    subtitle: "Meningeal dura mater included in brainmask causing artificial pial surface extension.",
    badge: "Meninges Artifact",
    difficulty: "Beginner",
    targetPlane: "coronal",
    targetCoords: { x: 74, y: 46, z: 48 },
    defectDescription:
      "High-intensity rim of dura mater was erroneously included inside brainmask.mgz. The deformable pial surface expands into the non-brain tissue, inflating local cortical thickness estimates by >1.8mm.",
    lore: {
      biologicalCause:
        "Dura mater and arachnoid membranes exhibit T1 signal intensities (~80-90) closely matching adjacent temporal cerebral cortex in 3T MPRAGE acquisitions.",
      algorithmicImpact:
        "The pial surface expansion algorithm (recon-all -autorecon3) seeks the CSF gradient. If dura is preserved in brainmask.mgz, the surface traps non-brain voxels, corrupting biomarker volumes and thickness stats.",
      remediationProtocol:
        `Switch to Coronal orthoview. Select ${formatNeuroToolKey("erase")} with a 2-3 voxel radius. Erase the extra-cerebral dura voxels outside the gray matter border, then click 'Run recon-all' to recalculate.`,
      freeSurferCommand: "freeview -v brainmask.mgz:colormap=grayscale -f lh.pial:edgecolor=red",
    },
    initialEuler: 2,
    targetEuler: 2,
    initialDefects: 38,
    targetDice: 0.95,
    recommendedTool: "erase",
    successMessage: "Dura mater successfully resected! Pial surface has retracted to the true CSF/cortex boundary.",
  },

  wm_hypointensity: {
    id: "wm_hypointensity",
    title: "Case 02: White Matter Dropout & B1 Inhomogeneity",
    subtitle: "Hypointense WM voxels dropped below 110 threshold, causing white surface holes.",
    badge: "Intensity Defect",
    difficulty: "Intermediate",
    targetPlane: "coronal",
    targetCoords: { x: 28, y: 38, z: 36 },
    defectDescription:
      "B1 transmit field inhomogeneity caused temporal white matter voxel intensities to drop to ~58 (well below the 110 target). The white surface algorithm fails to segment the temporal horn gyral crest.",
    lore: {
      biologicalCause:
        "Dielectric effect and RF coil sensitivity roll-off at 3T/7T cause spatial intensity gradients, particularly in the inferior temporal lobes and cerebellum.",
      algorithmicImpact:
        "FreeSurfer's mri_normalize assumes WM intensity peak is 110. Voxels with intensity < 85 are classified as Gray Matter or CSF, causing white surface retraction and missing gyral white matter.",
      remediationProtocol:
        `Select ${formatNeuroToolKey("control_point")}. Click inside the hypointense white matter region (intensity ~58) to place a 110 anchor point, or paint wm.mgz voxels directly. Then run 'recon-all -autorecon2-cp'.`,
      freeSurferCommand: "recon-all -s sub-01 -autorecon2-cp",
    },
    initialEuler: -2,
    targetEuler: 2,
    initialDefects: 52,
    targetDice: 0.94,
    recommendedTool: "control_point",
    successMessage: "Control points successfully normalized intensity field! White surface has expanded to envelope the gyral crest.",
  },

  skull_strip_erosion: {
    id: "skull_strip_erosion",
    title: "Case 03: Frontal Pole Skull-Strip Over-Erosion",
    subtitle: "Aggressive watershed threshold clipped superior frontal cortical mantle.",
    badge: "Mask Over-Erosion",
    difficulty: "Advanced",
    targetPlane: "sagittal",
    targetCoords: { x: 48, y: 82, z: 52 },
    defectDescription:
      "Aggressive skull-stripping (mri_watershed) clipped 12mm of the superior frontal pole cortical mantle. Surface tessellation cannot form without brainmask restoration.",
    lore: {
      biologicalCause:
        "High skull density and thin CSF buffering in the anterior cranial fossa caused the watershed algorithm to underestimate the true intracranial boundary.",
      algorithmicImpact:
        "Voxels masked out of brainmask.mgz are strictly forbidden from surface tessellation. Any erased cortex results in truncated brain volume and false cortical thinning.",
      remediationProtocol:
        `Switch to Sagittal view. Select ${formatNeuroToolKey("paint")}, set intensity to Gray Matter (75-80), and paint the missing frontal gyri back into brainmask.mgz. Run 'recon-all -autorecon2'.`,
      freeSurferCommand: "recon-all -s sub-01 -autorecon2-wm",
    },
    initialEuler: 2,
    targetEuler: 2,
    initialDefects: 48,
    targetDice: 0.95,
    recommendedTool: "paint",
    successMessage: "Frontal cortical mantle restored to brainmask! Surface tessellation now tracks true anatomical boundaries.",
  },

  topological_handle: {
    id: "topological_handle",
    title: "Case 04: Cortical Bridge Topological Handle",
    subtitle: "Non-spherical topology defect: Euler characteristic χ = 0 (1 handle / genus-1 torus).",
    badge: "Topology Defect",
    difficulty: "Expert",
    targetPlane: "axial",
    targetCoords: { x: 65, y: 56, z: 68 },
    defectDescription:
      "A narrow white matter voxel bridge crosses the central sulcus, creating a topological handle. Euler characteristic is χ = 0 (1 handle). FreeSurfer requires spherical topology (χ = 2) for cortical sphere inflation.",
    lore: {
      biologicalCause:
        "Partial volume averaging in tight sulcal banks causes opposing gyral white matter boundaries to falsely touch across CSF sulcal fundi.",
      algorithmicImpact:
        "Topological defect invalidates homeomorphy to a 2-sphere ($S^2$). FreeSurfer's mris_fix_topology is forced to apply artificial cutting planes, creating distortion in spherical morphometry.",
      remediationProtocol:
        `Switch to Axial view. Select ${formatNeuroToolKey("erase")}. Locate the spurious white matter bridge bridging the sulcus and cut the connection to restore Euler characteristic χ = 2.`,
      freeSurferCommand: "recon-all -s sub-01 -autorecon2-wm -fix-topology",
    },
    initialEuler: 0,
    targetEuler: 2,
    initialDefects: 28,
    targetDice: 0.96,
    recommendedTool: "erase",
    successMessage: "Topological bridge severed! Surface is now homeomorphic to a 2-sphere (Euler characteristic χ = 2).",
  },

  sandbox: {
    id: "sandbox",
    title: "Freeview QA Sandbox",
    subtitle: "Unconstrained volumetric exploration, slice navigation, and 3D surface inspection.",
    badge: "Open Lab",
    difficulty: "Sandbox",
    targetPlane: "axial",
    targetCoords: { x: 48, y: 48, z: 48 },
    defectDescription:
      "Full interactive neuroimaging sandbox. Freely navigate 3D cortical surfaces, switch between pial, white matter, inflated, and subcortical models, and slice across Axial, Coronal, and Sagittal orthoviews.",
    lore: {
      biologicalCause: "Clean baseline structural 3T MRI scan without injected artifacts.",
      algorithmicImpact: "Standard FreeSurfer recon-all pipeline output in pristine topological equilibrium.",
      remediationProtocol: "Use all Freeview CAD tools, terminal commands, and 3D surface modes freely.",
      freeSurferCommand: "freeview -v orig.mgz brainmask.mgz wm.mgz -f lh.pial:edgecolor=red lh.white:edgecolor=yellow",
    },
    initialEuler: 2,
    targetEuler: 2,
    initialDefects: 0,
    targetDice: 0.98,
    recommendedTool: "inspect",
    successMessage: "Sandbox workspace updated.",
  },
};

export const SCENARIO_LIST: ScenarioId[] = [
  "dura_inclusion",
  "wm_hypointensity",
  "skull_strip_erosion",
  "topological_handle",
  "sandbox",
];

export const DATASET_CONFIGS: Record<DatasetSource, DatasetConfig> = {
  case_study: {
    id: "case_study",
    name: "FreeSurfer Defect Scenarios",
    subtitle: "Clinical QA Cases 01–04 with injected anatomical & topological artifacts",
    sourceRepo: "Synthetic FreeSurfer 7.4.1 QA Suite",
    isRealHumanScan: false,
  },
  mni152: {
    id: "mni152",
    name: "Real Human: MNI152 Template",
    subtitle: "ICBM 2009c Nonlinear Symmetric 1mm Average Structural T1 & 3D Cortical Mesh",
    sourceRepo: "McConnell Brain Imaging Centre / OpenNeuro",
    modelUrl: "/models/brain-surface.glb",
    isRealHumanScan: true,
  },
  oasis: {
    id: "oasis",
    name: "Real Human: OASIS-1 3T Scan",
    subtitle: "Cross-Sectional 3T MPRAGE Volumetric Scan with fsaverage Pial Tessellation",
    sourceRepo: "Open Access Series of Imaging Studies (OASIS)",
    modelUrl: "/models/brain.obj",
    isRealHumanScan: true,
  },
};
