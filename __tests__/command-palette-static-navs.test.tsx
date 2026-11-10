/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CommandPalette } from "@/components/CommandPalette";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const mockPlayHover = vi.fn();
const mockPlaySubmit = vi.fn();
vi.mock("@/components/providers/AudioProvider", () => ({
  registerAudioCleanup: vi.fn(() => vi.fn()),
  useAudio: () => ({
    playHover: mockPlayHover,
    playSubmit: mockPlaySubmit,
    playSuccess: vi.fn(),
    playNote: vi.fn(),
    volume: 0.3,
    muted: false,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

let mockIsDyslexic = false;
vi.mock("@/hooks/useFontPreference", () => ({
  useFontPreference: () => ({
    isDyslexic: mockIsDyslexic,
    toggleDyslexiaMode: vi.fn(),
  }),
}));

let mockIsOpen = true;
const mockCloseSearch = vi.fn();
const mockSetIsOpen = vi.fn((val: boolean) => {
  mockIsOpen = val;
});

vi.mock("@/components/providers/SearchProvider", () => ({
  useSearch: () => ({
    isOpen: mockIsOpen,
    setIsOpen: mockSetIsOpen,
    closeSearch: mockCloseSearch,
  }),
}));

const EXPECTED_ROWS = [
  "nav-work | Work",
  "nav-blog | Blog",
  "nav-about | About Frederick (Bio & Timeline)",
  "nav-contact | Contact",
  "nav-arcade | Arcade",
  "nav-newsletter | Project Notes Newsletter",
  "nav-oxidizemath | OxidizeMath: Verified Numerical Framework in Rust",
  "nav-sonos-network-controller | Sonos Network Controller: Technical Breakdown & Architecture",
  "nav-clintrials | clintrials: Adaptive Clinical Trial Design & WebAssembly Engine",
  "nav-equipose-randomization | Equipose Randomization: Technical Breakdown & Portfolio Integration",
  "nav-lambda-wave | Lambda-Wave: Real-Time SGRT FMCW Radar System",
  "nav-duckdeploy | DuckDeploy: Schema-Driven Dynamic UI Engine",
  "nav-cardiac-risk-modeling | Predictive Cardiac Risk Modeling Pipeline",
  "nav-4glory | 4Glory | Does Fred Know Ball?: Sports Analytics Engine",
  "nav-crf-xl | CRF.xl: Spreadsheet-to-CDISC CRF Compiler",
  "nav-promptops | PromptOps: LLM Prompt Orchestration & Eval Engine",
  "nav-study-data-pipeline-case-study | Study Data Pipeline: USDM to SDTM, ADaM and TLFs",
  "nav-laser-loon | Laser Loon: Quest for the State Flag",
  "nav-laser-loon-cs | The Laser Loon: Graphic Design Case Study & Open Asset Hub",
  "nav-quasi-puzzler | Quasi-Perfect Puzzler",
  "nav-clinical-chaos | Clinical Trial Chaos: CDISC Compliance Arcade",
  "nav-trial-and-error | Trial & Error: Biostat Ops",
  "nav-study-director | Study Director: Everything Is Fine",
  "nav-patty-drive-thru | Patty's Drive-Thru",
  "nav-for-better-or-bulk | For Better or Bulk",
  "nav-protocol-drift | Protocol Drift: Regulatory Simulation Workbench",
  "nav-garmin-watch | Monkey C Mayhem: A Garmin 5K Platformer",
  "nav-working-with-duck | Working With Duck: Pet Simulation Arcade",
  "nav-retro-labyrinth | Retro Labyrinth: Graveyard Roguelike",
  "nav-proof | Logical Proof Workspace",
  "nav-neuro | NeuroRecon: FreeSurfer Pipeline Simulator",
  "nav-crf | Case report form designer (CRF Studio)",
  "nav-patrol-shift | Patrol Shift Studio: Midwest Ski Patrol Simulator",
  "nav-stack | Under the Hood: Architecture & Stack Overview",
  "nav-merch | Laser Loon Merch",
  "nav-acknowledgments | Open Source Credits and Licenses",
  "nav-wedding | Abbi & Fred: Our Wedding Archive",
  "nav-simulator | Architectural Archetype Simulator",
  "nav-schedule | Say Hi / Book a Chat",
  "nav-meme-vault | Meme Vault & Soundboard",
  "nav-offline | Offline Fallback View",
  "nav-admin | Admin",
  "nav-photos | Behind the Code · Visual Archive",
  "action-toggle-dyslexia | Toggle Dyslexia Mode (OpenDyslexic)",
  "case-study-designing-for-my-brother | Designing for My Brother: Accessible Typography",
  "nav-platform-strategy | Vendor scoring (Platform Strategy)",
  "nav-platform-operations | Clinical Operations Dashboards",
  "nav-platform-portfolio | Clinical Portfolio Dashboard",
  "nav-platform-explore | Study metrics explorer (Metrics Explorer)",
  "nav-platform-sql | Query workbench (SQL Workbench)",
  "nav-clinical-standards | Standards Conformance",
  "nav-platform-governance | Data rules and catalog (Data Governance)",
  "nav-clinical | Clinical Journey",
  "nav-labs | Labs",
  "nav-platform | Clinical Data Platform",
  "nav-study-data | Study Data Pipeline",
  "action-macro-start | ⏺ Start Macro Recording",
];

// The palette's static entries moved out of the component (#3490). This pins
// the id and title of every item the palette lists with an empty query, in
// order, so the move cannot reorder, drop or
// rename an entry.
describe("Command palette static entries", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsOpen = true;
    mockIsDyslexic = false;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = "";
  });

  it("lists the same items in the same order", async () => {
    await act(async () => {
      root.render(<CommandPalette />);
    });
    const options = Array.from(document.querySelectorAll('[role="option"]'));
    const rows = options.map(
      (option) =>
        `${option.id.replace(/^palette-option-/, "")} | ${
          option.querySelector(".text-sm.font-semibold")?.textContent ?? ""
        }`
    );
    expect(rows).toEqual(EXPECTED_ROWS);
  });

  it("shows the dyslexia toggle's on-state title while dyslexia mode is on", async () => {
    mockIsDyslexic = true;
    await act(async () => {
      root.render(<CommandPalette />);
    });
    const toggle = document.getElementById(
      "palette-option-action-toggle-dyslexia"
    );
    expect(toggle?.textContent).toContain(
      "Disable Dyslexia Mode (Return to Atkinson/Lexend)"
    );
    expect(toggle?.textContent).toContain("Active");
  });
});
