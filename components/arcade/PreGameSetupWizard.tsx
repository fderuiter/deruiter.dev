"use client";

import React, { useState, useEffect } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useAudio } from "@/components/providers/AudioProvider";
import { useAnnouncer } from "@/hooks/useAnnouncer";
import {
  IconCheck,
  IconChevronRight,
  IconChevronLeft,
  IconSparkles,
  IconAdjustments,
  IconDeviceGamepad2,
  IconEye,
  IconRocket,
} from "@tabler/icons-react";

type DifficultyMode = "casual" | "normal" | "hard";
type ScreenShakeIntensity = "none" | "subtle" | "high";
type CRTFilterPreset = "off" | "soft" | "arcade" | "scanlines";
type BezelStyle = "classic" | "neon" | "woodgrain" | "minimal";

export interface GameSetupConfig {
  difficulty: DifficultyMode;
  loadout: string;
  screenShake: ScreenShakeIntensity;
  crtFilter: CRTFilterPreset;
  bezelStyle: BezelStyle;
}

interface GameLoadoutOption {
  id: string;
  name: string;
  description: string;
  badge?: string;
}

const GAME_LOADOUTS: Record<string, GameLoadoutOption[]> = {
  "working-with-duck": [
    {
      id: "balanced",
      name: "Treats & Tennis Ball",
      description:
        "Standard puppy management loadout with balanced treats and recall",
      badge: "Balanced",
    },
    {
      id: "agility",
      name: "Agility Whistle & Chew Toy",
      description: "Faster recall speed & high puppy happiness boost",
      badge: "Agility",
    },
    {
      id: "developer",
      name: "Pro Desk & Organic Bones",
      description:
        "Extended coding stamina & treaties for high-pressure sprints",
      badge: "Endurance",
    },
  ],
  "laser-loon": [
    {
      id: "ruby",
      name: "Thermal Ruby Ray",
      description:
        "High-temperature continuous laser beam for precise flag blasting",
      badge: "Thermal",
    },
    {
      id: "cryo",
      name: "Glacial Cryo-Shatter",
      description:
        "Freezes red tape and shatters rival flag obstacles instantly",
      badge: "Cryo",
    },
    {
      id: "tremolo",
      name: "Loon Tremolo Overdrive",
      description: "Sonic shockwave pulses with rapid recharge speed",
      badge: "Sonic",
    },
  ],
  "quasi-puzzler": [
    {
      id: "standard",
      name: "Standard Lean Tactics",
      description:
        "Introductory AST tactic inference and goal decomposition set",
      badge: "Standard",
    },
    {
      id: "solver",
      name: "Advanced Formal Solver",
      description: "Automated goal simplification and tactic recommendations",
      badge: "Automation",
    },
    {
      id: "axiom",
      name: "Lean 4 Axiom Pack",
      description:
        "Full mathematical proof tree suite with expanded hypothesis stack",
      badge: "Axiomatic",
    },
  ],
  "garmin-watch": [
    {
      id: "standard-ram",
      name: "32KB Standard Heap",
      description:
        "Baseline: 500ms GC freeze, normal battery drain, standard 2 to 4 KB GC sweep",
      badge: "32KB RAM",
    },
    {
      id: "low-power",
      name: "Low-Power Runner",
      description:
        "Battery drains 40% slower and the GC freeze shrinks to 350ms",
      badge: "Eco",
    },
    {
      id: "overclocked",
      name: "Overclocked Speedster",
      description:
        "GC frees 2 KB more per sweep, but the battery drains 60% faster",
      badge: "Overclock",
    },
  ],
  "clinical-chaos": [
    {
      id: "sdtm-pack",
      name: "Standard SDTM Domain Pack",
      description: "DM, VS, AE, LB regulatory mapping toolkit",
      badge: "Compliance",
    },
    {
      id: "fast-track",
      name: "Fast-Track Audit Kit",
      description:
        "Accelerated electronic signatures and rapid CDISC validation",
      badge: "Fast-Track",
    },
    {
      id: "fda-priority",
      name: "FDA Priority Pass",
      description: "Reduced auditor stress accumulation rate",
      badge: "Priority",
    },
  ],
  "retro-labyrinth": [
    {
      id: "debugger",
      name: "Standard Debugger",
      description: "Balanced maze traversal & developer weapon kit",
      badge: "Debug",
    },
    {
      id: "npm-armor",
      name: "npm install Armor",
      description:
        "Increased resistance against codebase bugs and corrupt nodes",
      badge: "Defense",
    },
    {
      id: "git-force",
      name: "git push --force Laser",
      description: "High-damage wall-shattering attacks against boss enemies",
      badge: "Force",
    },
  ],
  default: [
    {
      id: "standard",
      name: "Standard Loadout",
      description: "Balanced starting parameters for arcade gameplay",
      badge: "Standard",
    },
    {
      id: "speedrun",
      name: "Speedrunner Kit",
      description: "Aggressive options for rapid playthroughs and high scores",
      badge: "Speed",
    },
    {
      id: "defense",
      name: "Defender Shield Pack",
      description: "Enhanced survival parameters and safety margins",
      badge: "Defense",
    },
  ],
};

const DIFFICULTY_OPTIONS: {
  id: DifficultyMode;
  label: string;
  desc: string;
  badge: string;
  color: string;
}[] = [
  {
    id: "casual",
    label: "Casual",
    desc: "Relaxed difficulty with extra safety margins and higher resources",
    badge: "Relaxed",
    color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  },
  {
    id: "normal",
    label: "Normal",
    desc: "Standard balanced arcade experience as originally intended",
    badge: "Standard",
    color: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  },
  {
    id: "hard",
    label: "Hard",
    desc: "Extreme arcade challenge for veteran players seeking leaderboard dominance",
    badge: "Expert",
    color: "text-red-400 border-red-500/30 bg-red-500/10",
  },
];

/**
 * Games that map difficulty to concrete engine parameters describe them here
 * so the wizard never promises more than the game delivers.
 */
const GAME_DIFFICULTY_DESCRIPTIONS: Record<
  string,
  Partial<Record<DifficultyMode, string>>
> = {
  "garmin-watch": {
    casual: "Obstacles 15% slower and spaced out; RAM fills 30% more slowly",
    normal: "Standard obstacle speed, spacing and RAM pressure",
    hard: "Obstacles 20% faster and closer together; RAM fills 33% faster",
  },
};

/**
 * Games whose cabinet reacts to the wizard's screen shake, CRT and bezel
 * options and restarts the run on confirm describe that here.
 */
const GAME_APPLY_NOTES: Record<string, string> = {
  "garmin-watch":
    "Confirming starts a fresh run with these options. A run in progress is paused while you set up, and Skip Setup resumes it.",
};

const SCREEN_SHAKE_OPTIONS: {
  id: ScreenShakeIntensity;
  label: string;
  desc: string;
}[] = [
  {
    id: "none",
    label: "None (Off)",
    desc: "Completely disable screen shake vibrations",
  },
  {
    id: "subtle",
    label: "Subtle (Low)",
    desc: "Gentle physical feedback on major impacts",
  },
  {
    id: "high",
    label: "High (Full)",
    desc: "Maximum retro arcade screen shake intensity",
  },
];

const CRT_FILTER_OPTIONS: {
  id: CRTFilterPreset;
  label: string;
  desc: string;
}[] = [
  {
    id: "off",
    label: "Disabled",
    desc: "Clean modern rendering without CRT overlays",
  },
  {
    id: "soft",
    label: "Soft CRT",
    desc: "Gentle phosphor glow and subtle scanline raster",
  },
  {
    id: "arcade",
    label: "Arcade CRT",
    desc: "Authentic arcade cabinet tube curvature & phosphor mask",
  },
  {
    id: "scanlines",
    label: "Heavy Scanlines",
    desc: "Prominent scanline grid for 90s retro aesthetic",
  },
];

const BEZEL_STYLE_OPTIONS: {
  id: BezelStyle;
  label: string;
  desc: string;
  previewClass: string;
}[] = [
  {
    id: "classic",
    label: "Classic Woodgrain",
    desc: "Vintage 1980s arcade wood cabinet trim",
    previewClass: "border-amber-800 bg-amber-950/40 text-amber-300",
  },
  {
    id: "neon",
    label: "Cyber Neon",
    desc: "Glowing cyan & magenta neon synthwave bezel",
    previewClass: "border-cyan-500 bg-cyan-950/40 text-cyan-300",
  },
  {
    id: "woodgrain",
    label: "Pixel Gold",
    desc: "Polished pixel gold metallic border",
    previewClass: "border-yellow-500 bg-yellow-950/40 text-yellow-300",
  },
  {
    id: "minimal",
    label: "Dark Minimal",
    desc: "Sleek obsidian matte finish",
    previewClass: "border-zinc-700 bg-zinc-900/60 text-zinc-300",
  },
];

export function getSavedSetupConfig(gameId: string): GameSetupConfig {
  const loadouts = GAME_LOADOUTS[gameId] || GAME_LOADOUTS["default"];
  const defaultConfig: GameSetupConfig = {
    difficulty: "normal",
    loadout: loadouts[0].id,
    screenShake: "subtle",
    crtFilter: "soft",
    bezelStyle: "classic",
  };

  if (typeof window === "undefined") return defaultConfig;

  try {
    const raw = localStorage.getItem(`pregame_setup_${gameId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        difficulty: ["casual", "normal", "hard"].includes(parsed.difficulty)
          ? parsed.difficulty
          : defaultConfig.difficulty,
        loadout:
          parsed.loadout && loadouts.some((l) => l.id === parsed.loadout)
            ? parsed.loadout
            : defaultConfig.loadout,
        screenShake: ["none", "subtle", "high"].includes(parsed.screenShake)
          ? parsed.screenShake
          : defaultConfig.screenShake,
        crtFilter: ["off", "soft", "arcade", "scanlines"].includes(
          parsed.crtFilter
        )
          ? parsed.crtFilter
          : defaultConfig.crtFilter,
        bezelStyle: ["classic", "neon", "woodgrain", "minimal"].includes(
          parsed.bezelStyle
        )
          ? parsed.bezelStyle
          : defaultConfig.bezelStyle,
      };
    }
  } catch {
    // Ignore storage error
  }
  return defaultConfig;
}

export function saveSetupConfig(gameId: string, config: GameSetupConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`pregame_setup_${gameId}`, JSON.stringify(config));
  } catch {
    // Ignore storage quota error
  }
}

interface PreGameSetupWizardProps {
  gameId: string;
  gameTitle?: string;
  isOpen: boolean;
  onComplete: (config: GameSetupConfig) => void;
  onCancel?: () => void;
}

export const PreGameSetupWizard: React.FC<PreGameSetupWizardProps> = ({
  gameId,
  gameTitle = "Arcade Game",
  isOpen,
  onComplete,
  onCancel,
}) => {
  const { playNote, playHover, playSubmit, playKeystroke } = useAudio();
  const { announce } = useAnnouncer();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [config, setConfig] = useState<GameSetupConfig>(() =>
    getSavedSetupConfig(gameId)
  );
  const [wasOpen, setWasOpen] = useState(isOpen);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setConfig(getSavedSetupConfig(gameId));
      setCurrentStep(1);
    }
  }

  // Announce when wizard opens
  useEffect(() => {
    if (isOpen) {
      announce(
        `Pre-Game Setup Wizard launched for ${gameTitle}. Step 1 of 3: Gameplay Configuration.`,
        "polite"
      );
    }
  }, [isOpen, gameTitle, announce]);

  const modalRef = useFocusTrap<HTMLDivElement>(isOpen, {
    onEscape: () => {
      if (onCancel) {
        onCancel();
      }
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && currentStep < 3) {
        goToStep((currentStep + 1) as 1 | 2 | 3);
      } else if (e.key === "ArrowLeft" && currentStep > 1) {
        goToStep((currentStep - 1) as 1 | 2 | 3);
      }
    },
  });

  if (!isOpen) return null;

  const loadoutOptions = GAME_LOADOUTS[gameId] || GAME_LOADOUTS["default"];

  const goToStep = (nextStep: 1 | 2 | 3) => {
    setCurrentStep(nextStep);
    playNote(400 + nextStep * 80, 0.1);
    const stepNames = {
      1: "Step 1 of 3: Gameplay Configuration",
      2: "Step 2 of 3: Visual & Cabinet Effects",
      3: "Step 3 of 3: Setup Summary & Confirmation",
    };
    announce(stepNames[nextStep], "polite");
  };

  const handleDifficultyChange = (d: DifficultyMode) => {
    setConfig((prev) => ({ ...prev, difficulty: d }));
    playKeystroke(65);
    announce(`Difficulty set to ${d}`, "polite");
  };

  const handleLoadoutChange = (l: string) => {
    setConfig((prev) => ({ ...prev, loadout: l }));
    playKeystroke(66);
    const selectedLoadout = loadoutOptions.find((opt) => opt.id === l);
    announce(`Starting loadout set to ${selectedLoadout?.name || l}`, "polite");
  };

  const handleScreenShakeChange = (s: ScreenShakeIntensity) => {
    setConfig((prev) => ({ ...prev, screenShake: s }));
    playKeystroke(67);
    announce(`Screen shake set to ${s}`, "polite");
  };

  const handleCRTFilterChange = (c: CRTFilterPreset) => {
    setConfig((prev) => ({ ...prev, crtFilter: c }));
    playKeystroke(68);
    announce(`CRT filter set to ${c}`, "polite");
  };

  const handleBezelStyleChange = (b: BezelStyle) => {
    setConfig((prev) => ({ ...prev, bezelStyle: b }));
    playKeystroke(69);
    announce(`Cabinet bezel style set to ${b}`, "polite");
  };

  const handleStartGame = () => {
    saveSetupConfig(gameId, config);
    playSubmit();
    announce(
      "Pre-Game Setup confirmed. Starting active gameplay!",
      "assertive"
    );
    onComplete(config);
  };

  const difficultyDescriptions = GAME_DIFFICULTY_DESCRIPTIONS[gameId];
  const applyNote = GAME_APPLY_NOTES[gameId];

  // Find readable labels for summary preview
  const currentLoadoutObj =
    loadoutOptions.find((o) => o.id === config.loadout) || loadoutOptions[0];
  const currentDiffObj =
    DIFFICULTY_OPTIONS.find((d) => d.id === config.difficulty) ||
    DIFFICULTY_OPTIONS[1];
  const currentShakeObj =
    SCREEN_SHAKE_OPTIONS.find((s) => s.id === config.screenShake) ||
    SCREEN_SHAKE_OPTIONS[1];
  const currentCRTObj =
    CRT_FILTER_OPTIONS.find((c) => c.id === config.crtFilter) ||
    CRT_FILTER_OPTIONS[1];
  const currentBezelObj =
    BEZEL_STYLE_OPTIONS.find((b) => b.id === config.bezelStyle) ||
    BEZEL_STYLE_OPTIONS[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-title"
      aria-describedby="wizard-desc"
      data-testid="pregame-setup-wizard-overlay"
      className="absolute inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 select-none overflow-hidden animate-in fade-in duration-200"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        // Always a rectangle, even over the round Garmin face: a circular
        // panel clipped the title, step dots and Next Step button.
        className="w-full max-w-xl max-h-[92%] bg-zinc-950 border-2 border-amber-500/40 rounded-2xl p-4 sm:p-6 shadow-[0_0_50px_rgba(245,158,11,0.2)] flex flex-col justify-between overflow-y-auto text-white font-mono"
      >
        {/* Header with Step Progress Indicator */}
        <div>
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <IconAdjustments className="w-4 h-4" />
              </div>
              <div>
                <h2
                  id="wizard-title"
                  className="text-sm sm:text-base font-extrabold uppercase tracking-wider text-amber-400"
                >
                  Pre-Game Setup Wizard
                </h2>
                <p id="wizard-desc" className="text-[10px] text-zinc-400">
                  {gameTitle} • Step {currentStep} of 3
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {[1, 2, 3].map((step) => (
                <button
                  key={step}
                  onClick={() => goToStep(step as 1 | 2 | 3)}
                  onMouseEnter={() => playHover()}
                  aria-label={`Go to wizard step ${step}`}
                  className={`min-h-[44px] min-w-[44px] w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center transition-all cursor-pointer touch-manipulation select-none active:scale-95 ${
                    currentStep === step
                      ? "bg-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.5)] scale-110"
                      : currentStep > step
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                        : "bg-zinc-900 text-zinc-600 border border-zinc-800"
                  }`}
                >
                  {currentStep > step ? (
                    <IconCheck className="w-3.5 h-3.5" />
                  ) : (
                    step
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* STEP 1: Gameplay Configuration */}
          {currentStep === 1 && (
            <div
              className="space-y-4 animate-in fade-in duration-150"
              data-testid="wizard-step-1"
            >
              <div className="flex items-center gap-1.5 text-xs text-amber-300 font-bold uppercase tracking-wider">
                <IconDeviceGamepad2 className="w-4 h-4 text-amber-400" />
                <span>Step 1: Gameplay Parameters</span>
              </div>

              {/* Difficulty Mode Selection */}
              <div>
                <label className="block text-[11px] text-zinc-400 uppercase tracking-widest mb-1.5 font-bold">
                  Difficulty Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {DIFFICULTY_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleDifficultyChange(opt.id)}
                      onMouseEnter={() => playHover()}
                      className={`min-h-[44px] min-w-[44px] p-2.5 rounded-xl border text-left transition-all cursor-pointer touch-manipulation select-none active:scale-95 flex flex-col justify-center ${
                        config.difficulty === opt.id
                          ? "border-amber-400 bg-amber-500/20 text-white shadow-[0_0_15px_rgba(245,158,11,0.2)] ring-1 ring-amber-400"
                          : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1 w-full">
                        <span className="font-bold text-xs">{opt.label}</span>
                        {config.difficulty === opt.id && (
                          <IconCheck className="w-3.5 h-3.5 text-amber-400" />
                        )}
                      </div>
                      <p className="text-[9px] text-zinc-400 leading-tight hidden sm:block">
                        {difficultyDescriptions?.[opt.id] ?? opt.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Initial Loadout Options */}
              <div>
                <label className="block text-[11px] text-zinc-400 uppercase tracking-widest mb-1.5 font-bold">
                  Initial Starting Loadout
                </label>
                <div className="space-y-2">
                  {loadoutOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleLoadoutChange(opt.id)}
                      onMouseEnter={() => playHover()}
                      className={`min-h-[44px] min-w-[44px] w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer touch-manipulation select-none active:scale-95 flex items-center justify-between gap-3 ${
                        config.loadout === opt.id
                          ? "border-amber-400 bg-amber-500/20 text-white shadow-[0_0_15px_rgba(245,158,11,0.2)] ring-1 ring-amber-400"
                          : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold text-xs text-white">
                            {opt.name}
                          </span>
                          {opt.badge && (
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-400 leading-tight">
                          {opt.description}
                        </p>
                      </div>
                      {config.loadout === opt.id && (
                        <IconCheck className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Visual Configuration */}
          {currentStep === 2 && (
            <div
              className="space-y-4 animate-in fade-in duration-150"
              data-testid="wizard-step-2"
            >
              <div className="flex items-center gap-1.5 text-xs text-amber-300 font-bold uppercase tracking-wider">
                <IconEye className="w-4 h-4 text-amber-400" />
                <span>Step 2: Visual & Cabinet Configuration</span>
              </div>

              {/* Screen Shake Intensity */}
              <div>
                <label className="block text-[11px] text-zinc-400 uppercase tracking-widest mb-1.5 font-bold">
                  Screen Shake Intensity
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {SCREEN_SHAKE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleScreenShakeChange(opt.id)}
                      onMouseEnter={() => playHover()}
                      className={`min-h-[44px] min-w-[44px] p-2 rounded-xl border text-center transition-all cursor-pointer touch-manipulation select-none active:scale-95 flex items-center justify-center ${
                        config.screenShake === opt.id
                          ? "border-amber-400 bg-amber-500/20 text-white shadow-[0_0_15px_rgba(245,158,11,0.2)] ring-1 ring-amber-400"
                          : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                    >
                      <span className="font-bold text-xs block">
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* CRT Filter Preset */}
              <div>
                <label className="block text-[11px] text-zinc-400 uppercase tracking-widest mb-1.5 font-bold">
                  CRT Filter Effect
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CRT_FILTER_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleCRTFilterChange(opt.id)}
                      onMouseEnter={() => playHover()}
                      className={`min-h-[44px] min-w-[44px] p-2.5 rounded-xl border text-left transition-all cursor-pointer touch-manipulation select-none active:scale-95 flex flex-col justify-center ${
                        config.crtFilter === opt.id
                          ? "border-amber-400 bg-amber-500/20 text-white shadow-[0_0_15px_rgba(245,158,11,0.2)] ring-1 ring-amber-400"
                          : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5 w-full">
                        <span className="font-bold text-xs text-white">
                          {opt.label}
                        </span>
                        {config.crtFilter === opt.id && (
                          <IconCheck className="w-3.5 h-3.5 text-amber-400" />
                        )}
                      </div>
                      <p className="text-[9px] text-zinc-400 leading-tight hidden sm:block">
                        {opt.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cabinet Bezel Style */}
              <div>
                <label className="block text-[11px] text-zinc-400 uppercase tracking-widest mb-1.5 font-bold">
                  Cabinet Bezel Theme
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {BEZEL_STYLE_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleBezelStyleChange(opt.id)}
                      onMouseEnter={() => playHover()}
                      className={`min-h-[44px] min-w-[44px] p-2.5 rounded-xl border text-left transition-all cursor-pointer touch-manipulation select-none active:scale-95 flex flex-col justify-center ${
                        config.bezelStyle === opt.id
                          ? "border-amber-400 bg-amber-500/20 text-white shadow-[0_0_15px_rgba(245,158,11,0.2)] ring-1 ring-amber-400"
                          : "border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5 w-full">
                        <span className="font-bold text-xs text-white">
                          {opt.label}
                        </span>
                        {config.bezelStyle === opt.id && (
                          <IconCheck className="w-3.5 h-3.5 text-amber-400" />
                        )}
                      </div>
                      <p className="text-[9px] text-zinc-400 leading-tight hidden sm:block">
                        {opt.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Confirmation Summary & Launch */}
          {currentStep === 3 && (
            <div
              className="space-y-4 animate-in fade-in duration-150"
              data-testid="wizard-step-3"
            >
              <div className="flex items-center gap-1.5 text-xs text-amber-300 font-bold uppercase tracking-wider">
                <IconSparkles className="w-4 h-4 text-amber-400" />
                <span>Step 3: Setup Summary & Confirmation</span>
              </div>

              <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3.5 sm:p-4 space-y-2.5 text-xs">
                <div className="flex justify-between border-b border-zinc-800/80 pb-2">
                  <span className="text-zinc-400 uppercase text-[10px]">
                    Title:
                  </span>
                  <span className="font-bold text-amber-400">{gameTitle}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-800/80 pb-2">
                  <span className="text-zinc-400 uppercase text-[10px]">
                    Difficulty:
                  </span>
                  <span className="font-bold text-white capitalize">
                    {currentDiffObj.label}
                  </span>
                </div>
                {difficultyDescriptions?.[config.difficulty] && (
                  <p
                    data-testid="wizard-summary-difficulty-effect"
                    className="text-[10px] text-zinc-400 leading-tight break-words"
                  >
                    {difficultyDescriptions[config.difficulty]}
                  </p>
                )}
                <div className="flex justify-between border-b border-zinc-800/80 pb-2">
                  <span className="text-zinc-400 uppercase text-[10px]">
                    Loadout:
                  </span>
                  <span className="font-bold text-white text-right">
                    {currentLoadoutObj.name}
                  </span>
                </div>
                {applyNote && (
                  <p
                    data-testid="wizard-summary-loadout-effect"
                    className="text-[10px] text-zinc-400 leading-tight break-words"
                  >
                    {currentLoadoutObj.description}
                  </p>
                )}
                <div className="flex justify-between border-b border-zinc-800/80 pb-2">
                  <span className="text-zinc-400 uppercase text-[10px]">
                    Screen Shake:
                  </span>
                  <span className="font-bold text-white">
                    {currentShakeObj.label}
                  </span>
                </div>
                <div className="flex justify-between border-b border-zinc-800/80 pb-2">
                  <span className="text-zinc-400 uppercase text-[10px]">
                    CRT Filter:
                  </span>
                  <span className="font-bold text-white">
                    {currentCRTObj.label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400 uppercase text-[10px]">
                    Cabinet Bezel:
                  </span>
                  <span className="font-bold text-white">
                    {currentBezelObj.label}
                  </span>
                </div>
              </div>
              {applyNote && (
                <p
                  data-testid="wizard-apply-note"
                  className="text-[10px] text-amber-300/90 leading-snug break-words"
                >
                  {applyNote}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation Buttons */}
        <div className="mt-5 pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-3">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => goToStep((currentStep - 1) as 1 | 2 | 3)}
              onMouseEnter={() => playHover()}
              className="min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer touch-manipulation select-none active:scale-95"
            >
              <IconChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
          ) : onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              onMouseEnter={() => playHover()}
              className="min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 font-bold text-xs transition-all cursor-pointer touch-manipulation select-none active:scale-95 flex items-center justify-center"
            >
              Skip Setup
            </button>
          ) : (
            <div />
          )}

          {currentStep < 3 ? (
            <button
              type="button"
              onClick={() => goToStep((currentStep + 1) as 1 | 2 | 3)}
              onMouseEnter={() => playHover()}
              className="min-h-[44px] min-w-[44px] px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs flex items-center justify-center gap-1 transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)] cursor-pointer touch-manipulation select-none active:scale-95 uppercase"
            >
              <span>Next Step</span>
              <IconChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartGame}
              onMouseEnter={() => playHover()}
              className="min-h-[44px] min-w-[44px] px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] cursor-pointer touch-manipulation select-none active:scale-95 uppercase tracking-wider animate-pulse"
            >
              <IconRocket className="w-4 h-4 fill-black" />
              <span>Start Game</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
