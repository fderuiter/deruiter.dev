"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useClipboard } from "@/hooks/useClipboard";
import { useToast } from "@/hooks/useToast";
import {
  ControlPoint,
  DatasetSource,
  QAMetrics,
  ScenarioId,
  ScenarioConfig,
  DatasetConfig,
  ScoreState,
  SurfaceMode,
  TerminalLog,
  ToolMode,
  VoxelCoord,
  VoxelEdit,
} from "@/lib/neuro/types";
import {
  getNeuroScenarios,
  getNeuroDatasetConfigs,
  getNeuroScenarioList,
  computeSyntheticVolume,
  computeQAMetrics,
  getNeuroScenariosSync,
  getNeuroDatasetConfigsSync,
  getNeuroScenarioListSync,
  computeSyntheticVolumeSync,
  computeQAMetricsSync,
} from "@/lib/neuro/loader";
import {
  NEURO_RUN_RECON_KEY,
  applyVoxelEditsToVolume,
  countNeuroDraftEdits,
  getNeuroProvenance,
  isNeuroSelectionValid,
  withNeuroDraft,
  type NeuroDraft,
  type NeuroDraftMap,
  NEURO_TERMINAL_SIMULATION_NOTICE,
  formatScenarioDiagnostics,
  parseReconAllCommand,
  resolveNeuroHotkey,
} from "@/lib/neuro";
import { SyntheticVolume, VOLUME_SIZE } from "@/lib/neuro/volume-generator";
import { MultiPlanarSliceViewer } from "./MultiPlanarSliceViewer";
import dynamic from "next/dynamic";
import { NeuroReconSkeleton } from "./NeuroReconSkeleton";

const Brain3DViewerSkeleton: React.FC = () => {
  return (
    <div
      className="relative w-full h-[460px] bg-zinc-950 rounded-2xl border border-zinc-800/80 overflow-hidden flex flex-col justify-between p-4 select-none animate-pulse"
      data-testid="brain-3d-skeleton"
    >
      {/* Skeleton Header */}
      <div className="flex items-center gap-2 bg-zinc-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-800 text-xs font-mono w-max">
        <div className="w-1.5 h-1.5 rounded-full bg-brand-cyan/60 animate-ping" />
        <span className="font-semibold text-zinc-400 uppercase tracking-wider">
          Initializing 3D Engine...
        </span>
      </div>

      {/* Skeleton Center pulsing graphic */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
        <div className="relative">
          <div className="absolute -inset-4 rounded-full bg-brand-cyan/5 blur-xl animate-pulse" />
          <Icon3dCubeSphere className="w-16 h-16 text-brand-cyan/40 animate-pulse relative z-10" />
        </div>
        <div className="text-center space-y-1 relative z-10">
          <p className="text-sm font-bold font-mono text-zinc-300">
            NeuroRecon 3D Viewer
          </p>
          <p className="text-[11px] font-mono text-brand-cyan/60">
            Loading heavy WebGL visualizer and 3D brain mesh...
          </p>
        </div>
      </div>

      {/* Skeleton Footer */}
      <div className="flex items-center justify-between text-xs font-mono text-zinc-500 bg-zinc-900/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-zinc-800/60 w-full mt-auto">
        <span>PREPARING T1 MESH BUFFER</span>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-brand-cyan/30 animate-pulse" />
          <span className="text-[10px]">STANDBY</span>
        </div>
      </div>
    </div>
  );
};

const Brain3DViewer = dynamic(
  () => import("./Brain3DViewer").then((mod) => mod.Brain3DViewer),
  {
    ssr: false,
    loading: () => <Brain3DViewerSkeleton />,
  }
);
import { NeuroToolbar } from "./NeuroToolbar";
import { NeuroMetricsPanel } from "./NeuroMetricsPanel";
import { FreeSurferTerminal } from "./FreeSurferTerminal";
import { NeuroFieldManual } from "./NeuroFieldManual";
import { NeuroSuccessDialog } from "./NeuroSuccessDialog";
import { useAudio } from "@/components/providers/AudioProvider";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useStudioHashParams } from "@/hooks/useStudioHashParams";
import {
  IconBrain,
  IconCheck,
  IconInfoCircle,
  Icon3dCubeSphere,
  IconLayersSubtract,
  IconLink,
  IconX,
  IconCompass,
  IconAlertCircle,
} from "@tabler/icons-react";

export const NeuroReconClient: React.FC = () => {
  const { playNote, playSuccess } = useAudio();
  const { recordEvent } = useTelemetry();
  const { params, setParam, setParams } = useStudioHashParams();
  const toast = useToast();

  const [activeScenarioId, setActiveScenarioId] = useState<ScenarioId>(() => {
    if (typeof window !== "undefined") {
      const rawSc = new URLSearchParams(window.location.hash.slice(1)).get(
        "scenario"
      ) as ScenarioId;
      if (
        rawSc &&
        [
          "dura_inclusion",
          "wm_hypointensity",
          "skull_strip_erosion",
          "sandbox",
        ].includes(rawSc)
      ) {
        return rawSc;
      }
    }
    return "dura_inclusion";
  });

  const [scenarios, setScenarios] = useState<
    Record<ScenarioId, ScenarioConfig>
  >(() => getNeuroScenariosSync());
  const [datasetConfigs, setDatasetConfigs] = useState<
    Record<DatasetSource, DatasetConfig>
  >(() => getNeuroDatasetConfigsSync());
  const [scenarioList, setScenarioList] = useState<ScenarioId[]>(() =>
    getNeuroScenarioListSync()
  );
  const [volume, setVolume] = useState<SyntheticVolume>(() =>
    computeSyntheticVolumeSync(activeScenarioId)
  );
  const [qaMetrics, setQaMetrics] = useState<QAMetrics>(() => {
    const scs = getNeuroScenariosSync();
    const vol = computeSyntheticVolumeSync(activeScenarioId);
    return computeQAMetricsSync(scs[activeScenarioId], vol, [], []);
  });

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      getNeuroScenarios(),
      getNeuroDatasetConfigs(),
      getNeuroScenarioList(),
      computeSyntheticVolume(activeScenarioId),
    ]).then(([scs, dCfgs, scList, vol]) => {
      if (!isMounted) return;
      setScenarios(scs);
      setDatasetConfigs(dCfgs);
      setScenarioList(scList);
      setVolume(vol);
      const sc = scs[activeScenarioId];
      if (sc) {
        computeQAMetrics(sc, vol, [], []).then((metrics) => {
          if (isMounted) setQaMetrics(metrics);
        });
      }
    });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentScenario = scenarios ? scenarios[activeScenarioId] : null;

  const [crosshair, setCrosshair] = useState<VoxelCoord>({
    x: 42,
    y: 58,
    z: 28,
  });
  const [toolMode, setToolModeState] = useState<ToolMode>(() => {
    if (typeof window !== "undefined") {
      const rawTool = new URLSearchParams(window.location.hash.slice(1)).get(
        "tool"
      ) as ToolMode;
      if (
        rawTool &&
        ["inspect", "control_point", "paint", "erase"].includes(rawTool)
      ) {
        return rawTool;
      }
    }
    return "inspect";
  });

  useEffect(() => {
    if (currentScenario) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCrosshair((prev) =>
        prev.x === 42 && prev.y === 58 && prev.z === 28
          ? currentScenario.targetCoords
          : prev
      );
    }
  }, [currentScenario]);

  const [brushRadius, setBrushRadius] = useState<number>(2);
  const [surfaceMode, setSurfaceMode] = useState<SurfaceMode>("pial");
  const [showPialContour, setShowPialContour] = useState(true);
  const [showWmContour, setShowWmContour] = useState(true);
  const [viewMode, setViewModeState] = useState<"split" | "3d" | "2d">(() => {
    if (typeof window !== "undefined") {
      const rawView = new URLSearchParams(window.location.hash.slice(1)).get(
        "view"
      ) as "split" | "3d" | "2d";
      if (rawView && ["split", "3d", "2d"].includes(rawView)) {
        return rawView;
      }
    }
    return "split";
  });
  const [activeDataset, setActiveDatasetState] = useState<DatasetSource>(() => {
    if (typeof window !== "undefined") {
      const rawDs = new URLSearchParams(window.location.hash.slice(1)).get(
        "dataset"
      ) as DatasetSource;
      if (rawDs && ["case_study", "mni152", "oasis"].includes(rawDs)) {
        return rawDs;
      }
    }
    return "case_study";
  });

  const [controlPoints, setControlPoints] = useState<ControlPoint[]>([]);
  const [voxelEdits, setVoxelEdits] = useState<VoxelEdit[]>([]);
  // Session-only per-case drafts so switching cases never discards edits.
  const [drafts, setDrafts] = useState<NeuroDraftMap>({});
  const draftsRef = React.useRef<NeuroDraftMap>({});
  const editsRef = React.useRef<NeuroDraft>({
    controlPoints: [],
    voxelEdits: [],
  });
  const activeScenarioRef = React.useRef<ScenarioId>(activeScenarioId);
  const [resetUndo, setResetUndo] = useState<NeuroDraft | null>(null);
  useEffect(() => {
    editsRef.current = { controlPoints, voxelEdits };
    activeScenarioRef.current = activeScenarioId;
  }, [controlPoints, voxelEdits, activeScenarioId]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFieldManualOpen, setIsFieldManualOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const reconTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const [scoreState, setScoreState] = useState<ScoreState>({
    score: 1200,
    multiplier: 1,
    streak: 0,
    resolvedScenarios: [],
  });
  const scoreStateRef = React.useRef<ScoreState>(scoreState);
  const [lastReward, setLastReward] = useState(500);

  const [logs, setLogs] = useState<TerminalLog[]>(() => {
    const initialScenario = getNeuroScenariosSync()[activeScenarioId];
    return [
      {
        id: "log-init-1",
        type: "info",
        text: "FreeSurfer v7.4.1 (Linux x86_64) environment loaded.",
        timestamp: "00:00:01",
      },
      {
        id: "log-init-sim",
        type: "info",
        text: NEURO_TERMINAL_SIMULATION_NOTICE,
        timestamp: "00:00:01",
      },
      {
        id: "log-init-2",
        type: "output",
        text: initialScenario
          ? `Loaded subject sub-01 [${initialScenario.title}]\n${formatScenarioDiagnostics(initialScenario, qaMetrics)}`
          : "Loaded subject sub-01.",
        timestamp: "00:00:02",
      },
    ];
  });

  // Apply Scenario State locally without pushing history
  const applyScenarioState = useCallback(
    async (scenarioId: ScenarioId) => {
      if (reconTimerRef.current !== null) {
        clearTimeout(reconTimerRef.current);
        reconTimerRef.current = null;
        setIsProcessing(false);
      }

      // Park the current case's edits as a draft before leaving it.
      const leavingId = activeScenarioRef.current;
      const savedDrafts = withNeuroDraft(
        draftsRef.current,
        leavingId,
        editsRef.current
      );
      draftsRef.current = savedDrafts;
      setDrafts(savedDrafts);
      setResetUndo(null);

      setActiveScenarioId(scenarioId);
      activeScenarioRef.current = scenarioId;
      const scs = scenarios || (await getNeuroScenarios());
      const newConfig = scs[scenarioId];
      const newVol = await computeSyntheticVolume(scenarioId);
      const restored = savedDrafts[scenarioId];
      if (restored) applyVoxelEditsToVolume(newVol, restored.voxelEdits);
      setVolume(newVol);
      const newMetrics = newConfig
        ? await computeQAMetrics(newConfig, newVol, [], [])
        : null;
      if (newConfig) {
        setCrosshair(newConfig.targetCoords);
        setToolModeState(newConfig.recommendedTool);
      }
      setControlPoints(restored ? restored.controlPoints : []);
      setVoxelEdits(restored ? restored.voxelEdits : []);
      setShowSuccessModal(false);

      setLogs((prev) => [
        ...prev,
        {
          id: `log-sw-${Date.now()}`,
          type: "command",
          text: `switch-scenario --case=${scenarioId}`,
          timestamp: new Date().toLocaleTimeString(),
        },
        {
          id: `log-sw-out-${Date.now()}`,
          type: "info",
          text:
            newConfig && newMetrics
              ? `Loaded ${newConfig.title}. ${newConfig.defectDescription}\n${formatScenarioDiagnostics(newConfig, newMetrics)} (earlier lines above describe the previous case)${restored ? `\nRestored your ${countNeuroDraftEdits(restored)} unsaved edit(s) for this case from this session.` : ""}`
              : `Loaded ${scenarioId}`,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    },
    [scenarios]
  );

  // Switch Scenario Handler (User Click)
  const handleSelectScenario = useCallback(
    (scenarioId: ScenarioId) => {
      applyScenarioState(scenarioId);

      // Defect cases are synthetic: leave a real-scan dataset when one is picked.
      const leaveDataset = !isNeuroSelectionValid(activeDataset, scenarioId);
      if (leaveDataset) setActiveDatasetState("case_study");

      setParams(
        {
          scenario: scenarioId === "dura_inclusion" ? null : scenarioId,
          tool: null,
          ...(leaveDataset ? { dataset: null } : {}),
        },
        { replace: false }
      );

      recordEvent("neuro", "project_click");
    },
    [applyScenarioState, setParams, recordEvent, activeDataset]
  );

  // Synchronize incoming hash state on mount or browser Back/Forward navigation
  useEffect(() => {
    const rawSc =
      (params.scenario as ScenarioId | undefined) || "dura_inclusion";
    if (scenarios && scenarios[rawSc] && rawSc !== activeScenarioId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      applyScenarioState(rawSc);
    }
    const rawView =
      (params.view as "split" | "3d" | "2d" | undefined) || "split";
    if (["split", "3d", "2d"].includes(rawView) && rawView !== viewMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setViewModeState(rawView);
    }
    const rawDs = (params.dataset as DatasetSource | undefined) || "case_study";
    // A share link pairing a real-scan dataset with a synthetic case is invalid.
    const effectiveDs =
      ["case_study", "mni152", "oasis"].includes(rawDs) &&
      isNeuroSelectionValid(rawDs, rawSc)
        ? rawDs
        : "case_study";
    if (effectiveDs !== activeDataset) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveDatasetState(effectiveDs);
    }
    const rawTool = params.tool as ToolMode | undefined;
    const recommendedTool = currentScenario?.recommendedTool || "inspect";
    const targetTool =
      rawTool &&
      ["inspect", "control_point", "paint", "erase"].includes(rawTool)
        ? rawTool
        : recommendedTool;
    if (targetTool !== toolMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToolModeState(targetTool);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    params,
    activeScenarioId,
    viewMode,
    activeDataset,
    toolMode,
    currentScenario,
    applyScenarioState,
  ]);

  const setViewMode = (mode: "split" | "3d" | "2d") => {
    setViewModeState(mode);
    setParam("view", mode === "split" ? null : mode, { replace: true });
  };

  const setActiveDataset = (dataset: DatasetSource) => {
    setActiveDatasetState(dataset);
    setParam("dataset", dataset === "case_study" ? null : dataset, {
      replace: true,
    });
  };

  const setToolMode = useCallback(
    (tool: ToolMode) => {
      setToolModeState(tool);
      setParam(
        "tool",
        tool === (currentScenario?.recommendedTool || "inspect") ? null : tool,
        { replace: true }
      );
    },
    [currentScenario, setParam]
  );

  const { copy: copyShareLink } = useClipboard({
    successMessage:
      "Link copied: case, view and tool only. Your edits are not included.",
    onSuccess: () => {
      try {
        playSuccess();
      } catch {}
      // useClipboard already announced successMessage; show it without speaking it twice.
      toast.success(
        "Link copied: case, view and tool only. Your edits are not included.",
        { duration: 3500, announce: false }
      );
    },
  });

  const handleCopyShareLink = () => {
    if (typeof window !== "undefined") {
      copyShareLink(window.location.href);
    }
  };

  useEffect(() => {
    return () => {
      if (reconTimerRef.current !== null) {
        clearTimeout(reconTimerRef.current);
        reconTimerRef.current = null;
      }
    };
  }, []);

  // Re-evaluate QA metrics on state changes
  useEffect(() => {
    if (!currentScenario || !volume) return;
    let isMounted = true;
    computeQAMetrics(currentScenario, volume, controlPoints, voxelEdits).then(
      (metrics) => {
        if (isMounted) setQaMetrics(metrics);
      }
    );
    return () => {
      isMounted = false;
    };
  }, [currentScenario, volume, controlPoints, voxelEdits]);

  // Add Control Point Handler
  const handleAddControlPoint = (
    point: Omit<ControlPoint, "id" | "timestamp">
  ) => {
    const newCP: ControlPoint = {
      ...point,
      id: `cp-${Date.now()}`,
      timestamp: Date.now(),
    };
    setControlPoints((prev) => [...prev, newCP]);
    playNote(620, 0.08); // Pleasant high tick

    setLogs((prev) => [
      ...prev,
      {
        id: `log-cp-${Date.now()}`,
        type: "info",
        text: `Added Control Point at (${point.x}, ${point.y}, ${point.z}) with target intensity 110.`,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  };

  // Apply Voxel Edits Handler
  const handleApplyVoxelEdits = (edits: VoxelEdit[]) => {
    // Mutate live volume buffers for instant rendering
    const size = VOLUME_SIZE;
    const appliedEdits: VoxelEdit[] = [];
    edits.forEach((e) => {
      const idx = e.z * size * size + e.y * size + e.x;
      const mask = e.layer === "brainmask" ? volume.brainmask : volume.wmMask;
      const originalValue = mask[idx];
      if (originalValue === e.newValue) return;
      appliedEdits.push({ ...e, originalValue });
      if (e.layer === "brainmask") {
        volume.brainmask[idx] = e.newValue;
      } else if (e.layer === "wm") {
        volume.wmMask[idx] = e.newValue;
        volume.rawT1[idx] = e.newValue === 1 ? 110 : 70;
      }
    });

    if (appliedEdits.length === 0) return;
    setVoxelEdits((prev) => [...prev, ...appliedEdits]);

    playNote(toolMode === "paint" ? 480 : 340, 0.05);
  };

  // Reset Scenario Edits
  const handleReset = async () => {
    if (reconTimerRef.current !== null) {
      clearTimeout(reconTimerRef.current);
      reconTimerRef.current = null;
      setIsProcessing(false);
    }

    const previous: NeuroDraft = { controlPoints, voxelEdits };
    setResetUndo(countNeuroDraftEdits(previous) > 0 ? previous : null);
    const freshVol = await computeSyntheticVolume(activeScenarioId);
    setVolume(freshVol);
    setControlPoints([]);
    setVoxelEdits([]);
    if (currentScenario) {
      setCrosshair(currentScenario.targetCoords);
    }
    playNote(300, 0.1);

    setLogs((prev) => [
      ...prev,
      {
        id: `log-rst-${Date.now()}`,
        type: "command",
        text: "mri_restore_checkpoint --reset",
        timestamp: new Date().toLocaleTimeString(),
      },
      {
        id: `log-rst-out-${Date.now()}`,
        type: "info",
        text: "Reset all manual voxel edits and control points to baseline.",
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  };

  // Undo the last Reset by replaying its edits onto a fresh volume
  const handleUndoReset = async () => {
    if (!resetUndo) return;
    const restoredEdits = resetUndo;
    const freshVol = await computeSyntheticVolume(activeScenarioId);
    applyVoxelEditsToVolume(freshVol, restoredEdits.voxelEdits);
    setVolume(freshVol);
    setControlPoints(restoredEdits.controlPoints);
    setVoxelEdits(restoredEdits.voxelEdits);
    setResetUndo(null);
    setLogs((prev) => [
      ...prev,
      {
        id: `log-rst-undo-${Date.now()}`,
        type: "info",
        text: `Restored ${countNeuroDraftEdits(restoredEdits)} edit(s) cleared by Reset.`,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  };

  // Run recon-all Pipeline Execution
  const handleRunRecon = useCallback(async () => {
    if (!currentScenario || !volume) return;
    if (reconTimerRef.current !== null) {
      clearTimeout(reconTimerRef.current);
    }

    setIsProcessing(true);
    playNote(520, 0.15);

    const cmdStr =
      toolMode === "control_point"
        ? "recon-all -s sub-01 -autorecon2-cp"
        : activeScenarioId === "topological_handle"
          ? "recon-all -s sub-01 -autorecon2-wm -fix-topology"
          : "recon-all -s sub-01 -autorecon2 -autorecon3";

    setLogs((prev) => [
      ...prev,
      {
        id: `log-run-${Date.now()}`,
        type: "command",
        text: cmdStr,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);

    const metrics = await computeQAMetrics(
      currentScenario,
      volume,
      controlPoints,
      voxelEdits
    );

    reconTimerRef.current = setTimeout(() => {
      reconTimerRef.current = null;
      setIsProcessing(false);

      if (metrics.isResolved) {
        const prev = scoreStateRef.current;
        const alreadyEarned = prev.resolvedScenarios.includes(activeScenarioId);
        const isSandbox = activeScenarioId === "sandbox";
        // Reward policy (#1218): each repair scenario pays out once per
        // session; Sandbox is inspection-only and never pays out.
        if (isSandbox || alreadyEarned) {
          playNote(440, 0.1);
          setLogs((logs) => [
            ...logs,
            {
              id: `log-res-insp-${Date.now()}`,
              type: "info",
              text: isSandbox
                ? `[INSPECTION PASS] Sandbox volume verified with no defects to correct. Estimated Euler χ = ${metrics.eulerCharacteristic}, estimated Dice = ${(metrics.diceScore * 100).toFixed(1)}%. No points awarded.`
                : `[SIMULATION PASSED] Case already completed; re-verified. Estimated Euler χ = ${metrics.eulerCharacteristic}, estimated Dice = ${(metrics.diceScore * 100).toFixed(1)}%. No additional points.`,
              timestamp: new Date().toLocaleTimeString(),
            },
          ]);
          return;
        }
        const reward = 500 * prev.multiplier;
        const next: ScoreState = {
          score: prev.score + reward,
          multiplier: Math.min(4, prev.multiplier + 1),
          streak: prev.streak + 1,
          resolvedScenarios: [...prev.resolvedScenarios, activeScenarioId],
        };
        scoreStateRef.current = next;
        setScoreState(next);
        setLastReward(reward);
        playSuccess();
        setShowSuccessModal(true);

        setLogs((logs) => [
          ...logs,
          {
            id: `log-res-succ-${Date.now()}`,
            type: "success",
            text: `[SIMULATION PASSED] ${currentScenario.successMessage} Estimated Euler χ = ${metrics.eulerCharacteristic}, estimated Dice = ${(metrics.diceScore * 100).toFixed(1)}%. +${reward} PTS`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);

        recordEvent("neuro", "project_click");
      } else {
        playNote(380, 0.1);
        setLogs((prev) => [
          ...prev,
          {
            id: `log-res-prog-${Date.now()}`,
            type: "info",
            text: `[INCOMPLETE] Simulated recon executed. Estimated remaining defect units: ${metrics.defectCount}. Estimated Euler χ = ${metrics.eulerCharacteristic}. Continue manual correction.`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
    }, 850);
  }, [
    toolMode,
    activeScenarioId,
    currentScenario,
    volume,
    controlPoints,
    voxelEdits,
    playNote,
    playSuccess,
    recordEvent,
    setLogs,
  ]);

  // CLI Command Execution Router
  const handleExecuteCliCommand = async (cmd: string) => {
    const trimmed = cmd.trim().toLowerCase();
    const timestamp = new Date().toLocaleTimeString();

    setLogs((prev) => [
      ...prev,
      { id: `cmd-${Date.now()}`, type: "command", text: cmd, timestamp },
    ]);

    if (trimmed.startsWith("recon-all")) {
      const parsed = parseReconAllCommand(trimmed);
      if (parsed.ok) {
        handleRunRecon();
      } else {
        setLogs((prev) => [
          ...prev,
          {
            id: `out-recon-err-${Date.now()}`,
            type: "error",
            text: parsed.error,
            timestamp,
          },
        ]);
      }
    } else if (trimmed === "help") {
      setLogs((prev) => [
        ...prev,
        {
          id: `out-help-${Date.now()}`,
          type: "output",
          text: `Constrained simulation; only these commands are modeled:\n  recon-all [-s <subject>] [-autorecon2 | -autorecon2-cp | -autorecon2-wm | -autorecon3 | -all]\n                            : Run the simulated repair check (all stages behave the same)\n  freeview -f <mesh>        : Inspect surface meshes\n  stats                     : Print cortical & subcortical volume metrics\n  euler                     : Display Euler characteristic diagnostics\n  cp list                   : List active control point anchors\n  dataset [cases|mni152|oasis] : Switch 3D reference dataset\n  clear                     : Clear terminal log buffer`,
          timestamp,
        },
      ]);
    } else if (trimmed === "stats") {
      if (qaMetrics) {
        setLogs((prev) => [
          ...prev,
          {
            id: `out-stats-${Date.now()}`,
            type: "output",
            text: `Morphometric Stats (simulated; not aseg.stats / aparc.stats):\n  Example Intracranial Volume (eTIV): 1,482,910 mm³\n  Example Gray Matter Volume: 712,450 mm³\n  Example White Matter Volume: 489,120 mm³\n  Estimated Mean Cortical Thickness: ${qaMetrics.meanCorticalThicknessMm} mm\n  Estimated Dice Trend (no reference mask): ${(qaMetrics.diceScore * 100).toFixed(1)}%\n  Estimated Defect Units: ${qaMetrics.defectCount}`,
            timestamp,
          },
        ]);
      }
    } else if (trimmed === "euler") {
      if (qaMetrics && currentScenario) {
        setLogs((prev) => [
          ...prev,
          {
            id: `out-euler-${Date.now()}`,
            type: "output",
            text: `Estimated Euler Characteristic: χ = ${qaMetrics.eulerCharacteristic} (Scenario target = ${currentScenario.targetEuler})\nThis value is interpolated from simulated repair progress, not measured from a surface mesh.\nStatus: ${
              qaMetrics.eulerCharacteristic === currentScenario.targetEuler
                ? "Scenario target reached"
                : "Scenario repair in progress"
            }`,
            timestamp,
          },
        ]);
      }
    } else if (trimmed === "cp list") {
      if (controlPoints.length === 0) {
        setLogs((prev) => [
          ...prev,
          {
            id: `out-cp-empty-${Date.now()}`,
            type: "info",
            text: "No control points placed yet. Use tool [2] or 'C' key.",
            timestamp,
          },
        ]);
      } else {
        const cpListStr = controlPoints
          .map(
            (cp, idx) =>
              `  ${idx + 1}. [${cp.label || "CP"}] (${cp.x}, ${cp.y}, ${cp.z}) -> Target Int: ${cp.intensity}`
          )
          .join("\n");
        setLogs((prev) => [
          ...prev,
          {
            id: `out-cp-list-${Date.now()}`,
            type: "output",
            text: `Active Control Points (${controlPoints.length}):\n${cpListStr}`,
            timestamp,
          },
        ]);
      }
    } else if (trimmed.startsWith("dataset")) {
      const parts = trimmed.split(" ");
      const target = parts[1];
      if (
        target === "mni152" ||
        target === "oasis" ||
        target === "cases" ||
        target === "case_study"
      ) {
        const dId =
          target === "cases" ? "case_study" : (target as DatasetSource);
        setActiveDataset(dId);
        if (dId !== "case_study") {
          handleSelectScenario("sandbox");
        }
        const dCfgs = datasetConfigs || (await getNeuroDatasetConfigs());
        const dCfg = dCfgs[dId];
        setLogs((prev) => [
          ...prev,
          {
            id: `out-ds-${Date.now()}`,
            type: "success",
            text: `Active dataset set to: ${dCfg ? dCfg.name : dId} (${dCfg ? dCfg.sourceRepo : ""})`,
            timestamp,
          },
        ]);
      } else {
        setLogs((prev) => [
          ...prev,
          {
            id: `out-ds-list-${Date.now()}`,
            type: "info",
            text: `Available datasets:\n  dataset cases   : FreeSurfer Clinical QA Cases 01-04 (synthetic)\n  dataset mni152  : MNI152 ICBM 2009c 3D reference mesh (slices and QA stay synthetic)\n  dataset oasis   : OASIS-1 3D reference mesh (slices and QA stay synthetic)`,
            timestamp,
          },
        ]);
      }
    } else if (trimmed === "clear") {
      setLogs([]);
    } else {
      setLogs((prev) => [
        ...prev,
        {
          id: `out-err-${Date.now()}`,
          type: "error",
          text: `Command not recognized: '${cmd}'. Type 'help' for FreeSurfer syntax guide.`,
          timestamp,
        },
      ]);
    }
  };

  const isDialogOpen = isFieldManualOpen || showSuccessModal;

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Studio hotkeys are suspended while a modal dialog owns the keyboard.
      if (isDialogOpen) return;
      // Ignore text entry, modifier chords, and natively activating controls.
      const action = resolveNeuroHotkey(e);
      if (!action) return;
      if (action.type === "tool") {
        setToolMode(action.tool);
      } else if (action.type === "run") {
        e.preventDefault();
        if (!isProcessing) handleRunRecon();
      } else {
        setIsFieldManualOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isProcessing, isDialogOpen, handleRunRecon, setToolMode]);

  // Next Scenario Advancer
  const handleAdvanceNextScenario = async () => {
    setShowSuccessModal(false);
    const scList =
      scenarioList.length > 0 ? scenarioList : await getNeuroScenarioList();
    const currIdx = scList.indexOf(activeScenarioId);
    if (currIdx < scList.length - 1) {
      handleSelectScenario(scList[currIdx + 1]);
    } else {
      handleSelectScenario("sandbox");
    }
  };

  if (
    !scenarios ||
    !datasetConfigs ||
    !volume ||
    !qaMetrics ||
    !currentScenario
  ) {
    return <NeuroReconSkeleton />;
  }

  const activeDatasetConfig = datasetConfigs[activeDataset];
  const provenance = getNeuroProvenance(
    activeDataset,
    activeDatasetConfig?.name
  );

  return (
    <div
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6"
      data-keyboard-boundary="true"
      inert={isDialogOpen}
    >
      {/* Interactive First Action Guide & Onboarding Banner */}
      {showOnboarding && (
        <div
          data-testid="neuro-onboarding-banner"
          className="bg-zinc-900/90 border border-brand-cyan/30 rounded-3xl p-4 sm:p-5 backdrop-blur-xl relative overflow-hidden space-y-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-brand-cyan">
              <IconCompass className="w-5 h-5 shrink-0" />
              <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-white">
                First Action Guide · How to Repair Cortical Surfaces
              </h2>
            </div>
            <button
              onClick={() => setShowOnboarding(false)}
              title="Dismiss Guide"
              aria-label="Dismiss First Action Guide"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <IconX className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-zinc-300 leading-relaxed font-sans">
            Welcome to <strong>NeuroRecon Studio</strong>, an interactive CAD
            simulator for FreeSurfer cortical surface reconstruction and
            topological defect repair.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
            <div className="bg-zinc-950/80 p-3 rounded-2xl border border-zinc-800 space-y-1">
              <div className="text-brand-cyan font-bold">1. SELECT CASE</div>
              <p className="text-[11px] text-zinc-400 leading-snug">
                Choose a defect scenario (e.g. Dura Over-Inclusion or
                Hypointensity), or pair the Sandbox with an MNI152 / OASIS 3D
                reference mesh. 2D slices and QA metrics are always synthetic.
              </p>
            </div>
            <div className="bg-zinc-950/80 p-3 rounded-2xl border border-zinc-800 space-y-1">
              <div className="text-emerald-400 font-bold">2. EDIT VOXELS</div>
              <p className="text-[11px] text-zinc-400 leading-snug">
                Use Control Points <kbd className="text-brand-cyan">[2]</kbd> or
                Paint/Erase Brushes{" "}
                <kbd className="text-emerald-400">[3/4]</kbd> on 2D slices.
              </p>
            </div>
            <div className="bg-zinc-950/80 p-3 rounded-2xl border border-zinc-800 space-y-1">
              <div className="text-amber-400 font-bold">3. RUN RECON-ALL</div>
              <p className="text-[11px] text-zinc-400 leading-snug">
                Click{" "}
                <strong className="text-brand-cyan">[RUN RECON-ALL]</strong> or
                press <kbd>[{NEURO_RUN_RECON_KEY}]</kbd> to check the simulated
                Euler target χ = 2.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-zinc-800/60 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-amber-400/90 text-[11px]">
              <IconAlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>
                <strong>Educational Simulation Notice:</strong> Illustrative
                visualization for software & neuroimaging engineering. Not for
                clinical diagnosis or medical decision-making.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsFieldManualOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-brand-cyan font-bold transition-all min-h-[44px] flex items-center justify-center"
              >
                Field Manual [M]
              </button>
              <button
                onClick={() => setShowOnboarding(false)}
                className="px-3 py-1.5 rounded-xl bg-brand-cyan text-zinc-950 font-bold hover:bg-brand-cyan/90 transition-all min-h-[44px] flex items-center justify-center"
              >
                Start Editing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Banner / Scenario Selector Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-zinc-900/90 border border-zinc-800 p-4 rounded-3xl backdrop-blur-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-brand-cyan/10 border border-brand-cyan/20 flex items-center justify-center text-brand-cyan shadow-inner">
            <IconBrain className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-brand-cyan">
                {currentScenario.badge}
              </span>
              <span className="text-xs font-mono text-zinc-400">·</span>
              <span className="text-xs font-mono text-zinc-400">
                Difficulty: {currentScenario.difficulty}
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-white font-mono">
              {currentScenario.title}
            </h1>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 self-stretch md:self-auto">
          {/* Share Link Button */}
          <button
            onClick={handleCopyShareLink}
            className="flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-300 hover:text-white transition-all shadow-sm"
            title="Copy a link to this case, view and tool. Edits are not included in the link."
          >
            <IconLink className="w-3.5 h-3.5 text-brand-cyan" />
            <span>Share</span>
          </button>

          {/* Dataset Source Selector */}
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs font-mono">
            {(["case_study", "mni152", "oasis"] as DatasetSource[]).map(
              (dId) => {
                const dCfg = datasetConfigs[dId];
                const isSelected = activeDataset === dId;
                return (
                  <button
                    key={dId}
                    onClick={() => {
                      setActiveDataset(dId);
                      if (dId !== "case_study") {
                        handleSelectScenario("sandbox");
                      }
                      playNote(440, 0.08);
                    }}
                    title={dCfg ? dCfg.subtitle : dId}
                    className={`px-2.5 py-2 min-h-[44px] flex items-center justify-center rounded-lg transition-all ${
                      isSelected
                        ? "bg-zinc-800 text-white font-bold border border-zinc-700 shadow-sm"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <span>
                      {dId === "case_study"
                        ? "QA Scenarios"
                        : dId === "mni152"
                          ? "MNI152 (GLB)"
                          : "OASIS (OBJ)"}
                    </span>
                  </button>
                );
              }
            )}
          </div>

          {/* Scenario Carousel Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800 self-stretch md:self-auto overflow-x-auto">
            {scenarioList.map((scId, idx) => {
              const isResolved = scoreState.resolvedScenarios.includes(scId);
              const isActive = activeScenarioId === scId;
              return (
                <button
                  key={scId}
                  onClick={() => handleSelectScenario(scId)}
                  disabled={!isNeuroSelectionValid(activeDataset, scId)}
                  title={
                    isNeuroSelectionValid(activeDataset, scId)
                      ? undefined
                      : "Defect cases use synthetic slices and QA; switch to QA Scenarios to open them."
                  }
                  className={`disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 px-3 py-2 min-h-[44px] rounded-xl text-xs font-mono transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-brand-cyan text-zinc-950 font-bold shadow-md"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                  }`}
                >
                  <span>
                    {scId === "sandbox" ? "Sandbox" : `Case 0${idx + 1}`}
                  </span>
                  {isResolved && (
                    <IconCheck className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  {(isActive
                    ? controlPoints.length + voxelEdits.length
                    : countNeuroDraftEdits(drafts[scId])) > 0 && (
                    <>
                      <span
                        aria-hidden="true"
                        className="w-1.5 h-1.5 rounded-full bg-amber-400"
                      />
                      <span className="sr-only">has unsaved edits</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p
        className="text-[11px] font-mono text-zinc-400"
        data-testid="neuro-draft-note"
      >
        Edits are kept per case while this page stays open (amber dot marks
        unsaved edits). Reload clears them, and Share links never include them.
        Reset clears only the current case.
      </p>
      {resetUndo && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-zinc-900/80 px-3 py-2 text-xs font-mono text-amber-300"
        >
          <span className="min-w-0 break-words">
            Reset cleared {countNeuroDraftEdits(resetUndo)} edit(s) on this
            case.
          </span>
          <button
            type="button"
            onClick={handleUndoReset}
            className="min-h-[44px] px-3 rounded-lg border border-amber-500/40 text-amber-300 hover:bg-zinc-800"
          >
            Undo reset
          </button>
        </div>
      )}

      {/* Live FreeSurfer QA HUD Metrics */}
      <NeuroMetricsPanel
        scenario={currentScenario}
        metrics={qaMetrics}
        scoreState={scoreState}
      />

      {/* Explanatory Lore Banner */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 p-4 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <IconInfoCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="text-zinc-200 leading-relaxed font-sans">
              <strong className="text-amber-400 font-mono uppercase tracking-wider">
                Defect Diagnosis:{" "}
              </strong>
              {currentScenario.defectDescription}
            </p>
            <p className="text-zinc-400 leading-relaxed">
              <strong className="text-brand-cyan font-mono uppercase tracking-wider">
                Remediation Protocol:{" "}
              </strong>
              {currentScenario.lore.remediationProtocol}
            </p>
          </div>
        </div>

        {/* View Mode Splitter */}
        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 text-xs font-mono self-end md:self-auto">
          <button
            onClick={() => setViewMode("split")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all ${
              viewMode === "split"
                ? "bg-zinc-800 text-white font-bold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>Split 3D/2D</span>
          </button>
          <button
            onClick={() => setViewMode("3d")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all ${
              viewMode === "3d"
                ? "bg-zinc-800 text-white font-bold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Icon3dCubeSphere className="w-3.5 h-3.5" />
            <span>3D Only</span>
          </button>
          <button
            onClick={() => setViewMode("2d")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all ${
              viewMode === "2d"
                ? "bg-zinc-800 text-white font-bold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <IconLayersSubtract className="w-3.5 h-3.5" />
            <span>2D Only</span>
          </button>
        </div>
      </div>

      {/* Freeview Tool Palette Toolbar */}
      <NeuroToolbar
        toolMode={toolMode}
        brushRadius={brushRadius}
        showPialContour={showPialContour}
        showWmContour={showWmContour}
        isProcessing={isProcessing}
        onToolModeChange={setToolMode}
        onBrushRadiusChange={setBrushRadius}
        onTogglePialContour={() => setShowPialContour((prev) => !prev)}
        onToggleWmContour={() => setShowWmContour((prev) => !prev)}
        onRunRecon={handleRunRecon}
        onReset={handleReset}
        onOpenFieldManual={() => setIsFieldManualOpen(true)}
      />

      {/* Data provenance for each view and metric */}
      <dl
        aria-label="Data provenance"
        className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono text-zinc-400"
        data-testid="neuro-provenance"
      >
        {(
          [
            ["3D mesh", provenance.mesh],
            ["2D slices", provenance.volume],
            ["QA metrics", provenance.qa],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="min-w-0 break-words rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2"
          >
            <dt className="text-zinc-400 uppercase tracking-wider">{label}</dt>
            <dd className="text-zinc-300">{value}</dd>
          </div>
        ))}
      </dl>

      {/* Main Viewport Canvas Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 3D Brain Surface Canvas (Span 5 or 12 or 0) */}
        {(viewMode === "split" || viewMode === "3d") && (
          <div
            className={`h-[460px] ${
              viewMode === "3d" ? "lg:col-span-12" : "lg:col-span-5"
            }`}
          >
            <Brain3DViewer
              surfaceMode={surfaceMode}
              crosshair={crosshair}
              modelUrl={
                activeDatasetConfig?.modelUrl || "/models/brain-surface.glb"
              }
              onSurfaceChange={setSurfaceMode}
              onCrosshairChange={setCrosshair}
            />
          </div>
        )}

        {/* 2D Multi-Planar Orthoview Slices (Span 7 or 12 or 0) */}
        {(viewMode === "split" || viewMode === "2d") && (
          <div
            className={`h-[460px] ${
              viewMode === "2d" ? "lg:col-span-12" : "lg:col-span-7"
            }`}
          >
            <MultiPlanarSliceViewer
              volume={volume}
              crosshair={crosshair}
              toolMode={toolMode}
              brushRadius={brushRadius}
              showPialContour={showPialContour}
              showWmContour={showWmContour}
              controlPoints={controlPoints}
              onCrosshairChange={setCrosshair}
              onAddControlPoint={handleAddControlPoint}
              onApplyVoxelEdits={handleApplyVoxelEdits}
            />
          </div>
        )}
      </div>

      {/* FreeSurfer Interactive CLI Terminal */}
      <FreeSurferTerminal
        logs={logs}
        onExecuteCommand={handleExecuteCliCommand}
        onClearLogs={() => setLogs([])}
      />

      {/* Field Manual Modal */}
      <NeuroFieldManual
        isOpen={isFieldManualOpen}
        onClose={() => setIsFieldManualOpen(false)}
      />

      {/* Case Resolution Celebration Modal */}
      <NeuroSuccessDialog
        isOpen={showSuccessModal}
        message={currentScenario.successMessage}
        eulerCharacteristic={qaMetrics.eulerCharacteristic}
        diceScore={qaMetrics.diceScore}
        reward={lastReward}
        onStay={() => setShowSuccessModal(false)}
        onAdvance={handleAdvanceNextScenario}
        onSchedule={() => recordEvent("neuro", "project_click")}
      />
    </div>
  );
};
