/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ClinicalTrialChaos } from "@/components/ClinicalTrialChaos";
import { ClinicalChaosClient } from "@/components/arcade/ClinicalChaosClient";
import { EMPTY_STUDY_PRESET } from "@/lib/crf";

class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  get length(): number {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null;
  }
}

const mockPlaySuccess = vi.fn();
const mockPlayNote = vi.fn();

vi.mock("@/components/providers/AudioProvider", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/components/providers/AudioProvider")
    >();
  return {
    ...actual,
    useAudio: () => ({
      playSuccess: mockPlaySuccess,
      playNote: mockPlayNote,
      playHover: vi.fn(),
      muted: false,
    }),
    AudioProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

// Records polite announcements while keeping the real announcer behavior.
const announcements = vi.hoisted(() => [] as string[]);
vi.mock("@/hooks/useAnnouncer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useAnnouncer")>();
  return {
    ...actual,
    useAnnouncer: () => {
      const ctx = actual.useAnnouncer();
      return {
        ...ctx,
        announce: (...args: Parameters<typeof ctx.announce>) => {
          announcements.push(String(args[0]));
          return ctx.announce(...args);
        },
      };
    },
  };
});

// A new Phase 1 campaign opens with the first-shift calibration (#834),
// which freezes every clock; tests about live timers skip it.
const skipCalibration = async (container: HTMLElement) => {
  const skip = Array.from(container.querySelectorAll("button")).find(
    (b) => b.textContent === "Skip calibration"
  );
  expect(skip).toBeDefined();
  await act(async () => {
    skip?.click();
  });
};

// Lets a test fire the Fast-Track lifeline repeatedly: a zero maxCharge means
// its charge never falls below the maximum, so it is always ready.
const fastTrackLifeline = vi.hoisted(() => ({
  alwaysCharged: false,
  allCharged: false,
}));
vi.mock("@/lib/clinical-trial-chaos/engine", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/clinical-trial-chaos/engine")>();
  return {
    ...actual,
    createInitialPowerUpInventory: () => {
      const inventory = actual.createInitialPowerUpInventory();
      if (fastTrackLifeline.allCharged) {
        return {
          ...inventory,
          "fda-coffee-break": {
            ...inventory["fda-coffee-break"],
            charge: inventory["fda-coffee-break"].maxCharge,
          },
          "auto-clean": {
            ...inventory["auto-clean"],
            charge: inventory["auto-clean"].maxCharge,
          },
          "query-extension": {
            ...inventory["query-extension"],
            charge: inventory["query-extension"].maxCharge,
          },
          "fast-sign": {
            ...inventory["fast-sign"],
            charge: inventory["fast-sign"].maxCharge,
          },
        };
      }
      if (!fastTrackLifeline.alwaysCharged) return inventory;
      return {
        ...inventory,
        "fast-sign": { ...inventory["fast-sign"], charge: 0, maxCharge: 0 },
      };
    },
  };
});

const mockRecordEvent = vi.fn().mockResolvedValue(true);
vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    recordEvent: mockRecordEvent,
  }),
}));

describe("ClinicalTrialChaos React Component UI Suite", () => {
  let container: HTMLDivElement;
  let root: Root;
  let mockStorage: LocalStorageMock;

  beforeEach(() => {
    mockStorage = new LocalStorageMock();
    Object.defineProperty(window, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      arcTo: vi.fn(),
      ellipse: vi.fn(),
      roundRect: vi.fn(),
      rect: vi.fn(),
      quadraticCurveTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      measureText: vi.fn((text: string) => ({
        width: (text || "").length * 8,
        height: 16,
      })),
      createLinearGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
      createRadialGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
      })),
      createPattern: vi.fn(),
      getImageData: vi.fn(
        (_sx?: number, _sy?: number, sw?: number, sh?: number) => {
          const width = typeof sw === "number" && sw > 0 ? sw : 256;
          const height = typeof sh === "number" && sh > 0 ? sh : 256;
          return {
            width,
            height,
            data: new Uint8ClampedArray(width * height * 4),
          };
        }
      ),
      putImageData: vi.fn(),
      createImageData: vi.fn((w?: number | ImageData, h?: number) => {
        const width = typeof w === "number" && w > 0 ? w : 256;
        const height = typeof h === "number" && h > 0 ? h : 256;
        return {
          width,
          height,
          data: new Uint8ClampedArray(width * height * 4),
        };
      }),
      drawImage: vi.fn(),
      setLineDash: vi.fn(),
      getLineDash: vi.fn(() => []),
      clip: vi.fn(),
    };

    HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx as any);
    // Starting a shift scrolls the board into view; JSDOM has no layout to scroll.
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
    HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      width: 768,
      height: 140,
      right: 768,
      bottom: 140,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    fastTrackLifeline.allCharged = false;
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("should mount with initial HUD, stations, and regulatory lifelines", async () => {
    await act(async () => {
      root.render(<ClinicalTrialChaos />);
    });

    expect(container.textContent).toContain("Clinical Trial Chaos");
    expect(container.textContent).toContain("Score:");
    expect(container.textContent).toContain("Combo:");
    // Idle shows the shift briefing and office picker, not the play area
    expect(container.textContent).toContain("Shift briefing");
    expect(container.textContent).toContain("Pick your office");

    const startBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Start 3-Phase Campaign")
    );
    await act(async () => {
      startBtn?.click();
    });

    expect(container.textContent).toContain("FDA AUDITOR SCRUTINY");
    expect(container.textContent).toContain("SPONSOR SATISFACTION");
    expect(container.textContent).toContain("DM Station");
    expect(container.textContent).toContain("VS Station");
    expect(container.textContent).toContain("FDA Coffee Break");
    expect(container.textContent).toContain("CDISC Auto-Clean");
  });

  it("should enforce keyboard boundary with data-keyboard-boundary='true'", async () => {
    await act(async () => {
      root.render(<ClinicalTrialChaos />);
    });

    const boundary = container.querySelector('[data-keyboard-boundary="true"]');
    expect(boundary).not.toBeNull();
    expect(boundary?.getAttribute("tabIndex")).toBe("0");
  });

  it("should start the campaign when clicking Start 3-Phase Campaign", async () => {
    await act(async () => {
      root.render(<ClinicalTrialChaos />);
    });

    const startBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Start 3-Phase Campaign")
    );
    expect(startBtn).toBeDefined();

    await act(async () => {
      startBtn?.click();
    });

    expect(mockRecordEvent).toHaveBeenCalledWith(
      "clinical_trial_chaos",
      "project_click"
    );
    expect(container.textContent).toContain("SUBJ-1001");
  });

  it("starts a seeded shift through the accessible fallback", async () => {
    await act(async () => {
      root.render(<ClinicalTrialChaos />);
    });

    const fallback = container.querySelector(
      '[aria-label="Clinical Trial Chaos Accessible Subtree"]'
    );
    const start = Array.from(fallback?.querySelectorAll("button") ?? []).find(
      (button) => button.textContent?.trim() === "Start Phase 1"
    );
    expect(start).toBeDefined();

    await act(async () => {
      start?.click();
    });

    expect(fallback?.textContent).toContain("Active Subjects on Conveyor: 3");
    expect(container.textContent).toContain("SUBJ-1001");
    expect(mockRecordEvent).toHaveBeenCalledWith(
      "clinical_trial_chaos",
      "project_click"
    );
  });

  it("runs accessible lifelines through the real action handlers", async () => {
    fastTrackLifeline.allCharged = true;
    await act(async () => {
      root.render(<ClinicalTrialChaos />);
    });
    const fallback = container.querySelector(
      '[aria-label="Clinical Trial Chaos Accessible Subtree"]'
    );
    const start = Array.from(fallback?.querySelectorAll("button") ?? []).find(
      (button) => button.textContent?.trim() === "Start Phase 1"
    );
    await act(async () => {
      start?.click();
    });

    for (const name of [
      "Coffee Break",
      "Auto Clean",
      "Query Extension",
      "Fast-Track",
    ]) {
      const button = Array.from(
        fallback?.querySelectorAll("button") ?? []
      ).find((candidate) =>
        candidate.textContent?.includes(`Activate ${name}`)
      );
      expect(button, name).toBeDefined();
      expect(button?.disabled, name).toBe(false);
    }

    const coffee = Array.from(fallback?.querySelectorAll("button") ?? []).find(
      (button) => button.textContent?.includes("Activate Coffee Break")
    );
    await act(async () => {
      coffee?.click();
    });
    expect(fallback?.textContent).toContain(
      "BIMO Auditor Behavior: coffee_break"
    );
    expect(coffee?.textContent).toContain("0 of");
    for (const name of ["Auto Clean", "Query Extension", "Fast-Track"]) {
      const button = Array.from(
        fallback?.querySelectorAll("button") ?? []
      ).find((candidate) =>
        candidate.textContent?.includes(`Activate ${name}`)
      );
      await act(async () => {
        button?.click();
      });
      expect(button?.textContent, name).toContain("0 of");
    }
    expect(fallback?.textContent).toContain("Active Subjects on Conveyor: 2");
  });

  it("uses compact canvas geometry and matching subject hit targets", async () => {
    vi.mocked(
      HTMLCanvasElement.prototype.getBoundingClientRect
    ).mockReturnValue({
      left: 0,
      top: 0,
      width: 330,
      height: 127,
      right: 330,
      bottom: 127,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    await act(async () => {
      root.render(<ClinicalTrialChaos />);
    });
    const canvas = container.querySelector("canvas[role='application']");
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(canvas?.getAttribute("width")).toBe("330");
    expect(canvas?.getAttribute("height")).toBe("127");

    const start = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Start 3-Phase Campaign")
    );
    await act(async () => {
      start?.click();
    });
    await act(async () => {
      canvas?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, clientX: 135, clientY: 55 })
      );
    });
    expect(container.querySelector("#cc-dossier-title")?.textContent).toContain(
      "SUBJ-1002"
    );
  });

  it("should open Multi-Choice Validation Drawer and resolve an observation", async () => {
    vi.useFakeTimers();

    await act(async () => {
      root.render(<ClinicalTrialChaos />);
    });

    // Start campaign
    const startBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Start 3-Phase Campaign")
    );
    await act(async () => {
      startBtn?.click();
    });

    // Find and click the observation card with unvalidated prompt
    const validateChoiceEl = Array.from(
      container.querySelectorAll("span")
    ).find((s) => s.textContent?.includes("Validate Choice"));
    expect(validateChoiceEl).toBeDefined();
    const obsCard = validateChoiceEl?.closest(".cursor-pointer") as HTMLElement;
    expect(obsCard).not.toBeNull();

    await act(async () => {
      obsCard.click();
    });

    expect(container.textContent).toContain(
      "CDISC Controlled Terminology Validation"
    );
    expect(container.textContent).toContain(
      "Select Compliant CDISC Standard Value / CT Code"
    );

    // Click the correct choice "180 cm"
    const choiceBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim().replace(/^\d/, "") === "180 cm"
    );
    expect(choiceBtn).toBeDefined();

    await act(async () => {
      choiceBtn?.click();
    });

    // Advance timer for modal auto-close
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(container.textContent).toContain("180 cm");

    vi.useRealTimers();
  });

  it("accepts a compliant choice and lets the player retry after a rejection with a CRF Studio protocol loaded (#1150)", async () => {
    vi.useFakeTimers();
    // Every generated field starts flagged.
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    mockStorage.setItem(
      "crf_active_protocol",
      JSON.stringify(EMPTY_STUDY_PRESET)
    );

    await act(async () => {
      root.render(<ClinicalTrialChaos />);
    });
    const startBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Start 3-Phase Campaign")
    );
    await act(async () => {
      startBtn?.click();
    });

    const obsCard = Array.from(container.querySelectorAll("span"))
      .find((s) => s.textContent?.includes("Validate Choice"))
      ?.closest(".cursor-pointer") as HTMLElement;
    expect(obsCard).toBeTruthy();
    await act(async () => {
      obsCard.click();
    });

    const dialog = () =>
      container.querySelector('[aria-labelledby="cc-fix-dialog-title"]');
    const choice = (label: string) =>
      Array.from(dialog()?.querySelectorAll("button") ?? []).find(
        (b) => b.textContent?.trim().replace(/^\d/, "") === label
      );
    expect(dialog()?.textContent).toContain("Date Informed Consent Signed");

    await act(async () => {
      choice("Unknown")?.click();
    });
    expect(dialog()?.textContent).toContain("Regulatory Query");
    expect(dialog()?.textContent).toContain("Date Informed Consent Signed");

    await act(async () => {
      choice("2024-03-15")?.click();
    });
    expect(dialog()?.textContent).toContain("Standard Verified");
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(dialog()).toBeNull();

    randomSpy.mockRestore();
    vi.useRealTimers();
  });

  describe("first-shift calibration (#834)", () => {
    const timeLeft = (label: string) =>
      container.textContent?.match(
        new RegExp(`Subject ${label} \\([^)]*\\)\\): Time Remaining (\\d+)s`)
      )?.[1];
    const start = async () => {
      await act(async () => {
        root.render(<ClinicalTrialChaos />);
      });
      const startBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Start 3-Phase Campaign")
      );
      await act(async () => {
        startBtn?.click();
      });
    };
    const tick = async (ms: number) => {
      for (let t = 0; t < ms; t += 250) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(250);
        });
      }
    };
    const panel = () =>
      container.querySelector('[data-testid="cc-calibration"]');

    it("guides subject #1 through Fix, Route and Sign with every clock frozen", async () => {
      vi.useFakeTimers();
      announcements.length = 0;
      try {
        await start();
        expect(panel()?.textContent).toContain("clocks paused");
        expect(
          panel()?.querySelector('[aria-current="step"]')?.textContent
        ).toContain("Fix");
        expect(
          container.querySelector("#cc-dossier-title")?.textContent
        ).toContain("SUBJ-1001");

        await tick(6000);
        expect(timeLeft("SUBJ-1001")).toBe("40");
        expect(timeLeft("SUBJ-1003")).toBe("28");
        expect(container.textContent).toContain("0%");
        expect(container.textContent).toContain("Queue · 3/5");

        const obsCard = Array.from(container.querySelectorAll("span"))
          .find((s) => s.textContent?.includes("Validate Choice"))
          ?.closest(".cursor-pointer") as HTMLElement;
        await act(async () => {
          obsCard.click();
        });
        const choice = Array.from(container.querySelectorAll("button")).find(
          (b) => b.textContent?.trim().replace(/^\d/, "") === "180 cm"
        );
        await act(async () => {
          choice?.click();
        });
        await tick(750);
        expect(
          panel()?.querySelector('[aria-current="step"]')?.textContent
        ).toContain("Route");
        expect(
          announcements.some((a) => a.includes("Calibration step 2"))
        ).toBe(true);

        const dmStation = Array.from(container.querySelectorAll("h4"))
          .find((h) => h.textContent?.includes("DM Station"))
          ?.closest(".group") as HTMLElement;
        await act(async () => {
          dmStation.click();
        });
        expect(panel()).toBeNull();
        expect(container.textContent).toContain("Submits:1");
        expect(announcements).toContain(
          "Calibration complete. The shift is live."
        );

        await tick(3000);
        expect(Number(timeLeft("SUBJ-1003"))).toBeLessThan(28);
      } finally {
        vi.useRealTimers();
      }
    });

    it("Skip resumes the same live state once and returns focus to the board", async () => {
      vi.useFakeTimers();
      announcements.length = 0;
      try {
        await start();
        await tick(2000);
        expect(timeLeft("SUBJ-1001")).toBe("40");
        await skipCalibration(container);
        expect(panel()).toBeNull();
        expect(
          document.activeElement?.getAttribute("data-keyboard-boundary")
        ).toBe("true");
        expect(
          announcements.filter(
            (a) => a === "Calibration skipped. The shift is live."
          )
        ).toHaveLength(1);
        // Same seeded subject, still flagged, no resource consumed.
        expect(
          container.querySelector("#cc-dossier-title")?.textContent
        ).toContain("SUBJ-1001");
        expect(container.textContent).toContain("180 m");
        expect(container.textContent).toContain("Queue · 3/5");
        await tick(3000);
        expect(Number(timeLeft("SUBJ-1001"))).toBeLessThan(40);
      } finally {
        vi.useRealTimers();
      }
    });

    it("keeps endless mode live without calibration", async () => {
      vi.useFakeTimers();
      try {
        await act(async () => {
          root.render(<ClinicalTrialChaos />);
        });
        const endless = Array.from(container.querySelectorAll("button")).find(
          (b) => b.textContent === "Endless"
        );
        await act(async () => {
          endless?.click();
        });
        const startBtn = Array.from(container.querySelectorAll("button")).find(
          (b) => b.textContent?.includes("Start Endless Sprint")
        );
        await act(async () => {
          startBtn?.click();
        });
        expect(panel()).toBeNull();
        expect(container.textContent).not.toContain("Skip calibration");
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it("should switch between Conveyor Floor, Live SDTM Studio, and Audit Trail tabs", async () => {
    await act(async () => {
      root.render(<ClinicalTrialChaos />);
    });

    // Switch to Live SDTM Studio tab
    const sdtmTabBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Live SDTM Studio")
    );
    expect(sdtmTabBtn).toBeDefined();

    await act(async () => {
      sdtmTabBtn?.click();
    });

    expect(container.textContent).toContain("Live CDISC SDTM Dataset Studio");
    expect(container.textContent).toContain("Export CDISC ODM XML");
    expect(container.textContent).toContain("Export SDTM CSV");

    // Switch to Audit Trail tab
    const auditTabBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Audit Trail Log")
    );
    expect(auditTabBtn).toBeDefined();

    await act(async () => {
      auditTabBtn?.click();
    });

    expect(container.textContent).toContain(
      "21 CFR PART 11 IMMUTABLE AUDIT TRAIL"
    );
  });

  it("downloads ODM XML and SDTM CSV exports through attached anchors with deferred revocation", async () => {
    vi.useFakeTimers();
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const createObjectURL = vi.fn<(blob: Blob) => string>(
      () => "blob:cc-export"
    );
    const revokeObjectURL = vi.fn<(url: string) => void>();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const downloads: { name: string; attached: boolean }[] = [];
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push({
          name: this.download,
          attached: document.body.contains(this),
        });
      });

    try {
      await act(async () => {
        root.render(<ClinicalTrialChaos />);
      });
      const findButton = (text: string) =>
        Array.from(container.querySelectorAll("button")).find((b) =>
          b.textContent?.includes(text)
        );

      await act(async () => {
        findButton("Start 3-Phase Campaign")?.click();
      });
      const validateChoiceEl = Array.from(
        container.querySelectorAll("span")
      ).find((el) => el.textContent?.includes("Validate Choice"));
      await act(async () => {
        (validateChoiceEl?.closest(".cursor-pointer") as HTMLElement).click();
      });
      await act(async () => {
        Array.from(container.querySelectorAll("button"))
          .find((b) => b.textContent?.trim().replace(/^\d/, "") === "180 cm")
          ?.click();
      });
      await act(async () => {
        vi.advanceTimersByTime(600);
      });
      const dmHeading = Array.from(container.querySelectorAll("h4")).find((h) =>
        h.textContent?.includes("DM Station")
      );
      await act(async () => {
        (dmHeading?.closest(".group") as HTMLElement).click();
      });
      expect(container.textContent).toContain("Submits:1");

      await act(async () => {
        findButton("Live SDTM Studio")?.click();
      });
      const odmBtn = findButton("Export CDISC ODM XML") as HTMLButtonElement;
      const csvBtn = findButton("Export SDTM CSV") as HTMLButtonElement;
      expect(odmBtn.disabled).toBe(false);
      expect(csvBtn.disabled).toBe(false);

      await act(async () => {
        odmBtn.click();
      });
      await act(async () => {
        csvBtn.click();
      });

      expect(downloads).toHaveLength(2);
      expect(downloads[0].name).toMatch(/^CDISC_ODM_Snapshot_\d+\.xml$/);
      expect(downloads[1].name).toMatch(/^SDTM_Dataset_\d+\.csv$/);
      // Firefox ignores clicks on anchors that are not attached to the document.
      expect(downloads.every((d) => d.attached)).toBe(true);
      expect(createObjectURL.mock.calls.map(([blob]) => blob.type)).toEqual([
        "application/xml",
        "text/csv",
      ]);
      expect(container.querySelectorAll("a[download]")).toHaveLength(0);

      expect(revokeObjectURL).not.toHaveBeenCalled();
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(revokeObjectURL).toHaveBeenCalledTimes(2);
    } finally {
      clickSpy.mockRestore();
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
      vi.useRealTimers();
    }
  });

  it("quick-dispatches a clean routine dossier exactly once without the signature modal", async () => {
    vi.useFakeTimers();

    await act(async () => {
      root.render(<ClinicalTrialChaos />);
    });

    // Start campaign
    const startBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Start 3-Phase Campaign")
    );
    await act(async () => {
      startBtn?.click();
    });

    // Resolve observation (Height: 180 m -> 180 cm)
    const validateChoiceEl = Array.from(
      container.querySelectorAll("span")
    ).find((s) => s.textContent?.includes("Validate Choice"));
    const obsCard = validateChoiceEl?.closest(".cursor-pointer") as HTMLElement;
    await act(async () => {
      obsCard.click();
    });

    const choiceBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim().replace(/^\d/, "") === "180 cm"
    );
    await act(async () => {
      choiceBtn?.click();
    });

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    // The first seeded packet is routine, clean, and below the phase target.
    const dmHeading = Array.from(container.querySelectorAll("h4")).find((h) =>
      h.textContent?.includes("DM Station")
    );
    expect(dmHeading).toBeDefined();
    const dmStationCard = dmHeading?.closest(".group") as HTMLElement;

    await act(async () => {
      dmStationCard.click();
    });
    await act(async () => {
      dmStationCard.click();
    });

    expect(container.textContent).not.toContain(
      "21 CFR Part 11 Electronic Signature"
    );
    // The second press lands on the next queue head; it must be ignored, not
    // routed or rejected, because the player has not looked at it yet.
    expect(container.textContent).not.toContain("before routing");
    expect(container.textContent).toContain("Submits:1");
    // #834: the SAE (SUBJ-1003) outranks SUBJ-1002 and loads next.
    expect(container.querySelector("#cc-dossier-title")?.textContent).toContain(
      "SUBJ-1003"
    );
    expect(container.textContent).toContain(
      "Next dossier loaded: SUBJ-1003 (SAE)"
    );
    expect(announcements).toContain("Next dossier loaded: SUBJ-1003 (SAE)");
    expect(container.textContent).toContain("Combo:1");
    const auditTab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Audit Trail Log")
    );
    await act(async () => {
      auditTab?.click();
    });
    expect(container.textContent).toContain("SIMULATED ROUTINE DISPATCH");
    const floorTab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Conveyor Floor")
    );
    await act(async () => {
      floorTab?.click();
    });

    // Regression: a terminated trial's SDTM rows must not leak into the next trial.
    const sdtmTabLabel = () =>
      Array.from(container.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Live SDTM Studio")
      )?.textContent ?? "";
    expect(sdtmTabLabel()).not.toMatch(/Live SDTM Studio0$/);

    // Let the remaining subjects expire until the auditor issues a 483
    for (
      let i = 0;
      i < 60 && !container.textContent?.includes("TRIAL TERMINATED");
      i++
    ) {
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
    }
    expect(container.textContent).toContain("TRIAL TERMINATED");

    const restartBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Restart Phase I")
    );
    await act(async () => {
      restartBtn?.click();
    });
    expect(sdtmTabLabel()).toMatch(/Live SDTM Studio0$/);
    // A restarted Phase 1 campaign calibrates again (#834).
    expect(container.textContent).toContain("Skip calibration");

    vi.useRealTimers();
  });

  it("counts a protocol amendment down to its end during play", async () => {
    vi.useFakeTimers();
    try {
      await act(async () => {
        root.render(<ClinicalTrialChaos />);
      });
      const startBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Start 3-Phase Campaign")
      );
      await act(async () => {
        startBtn?.click();
      });
      await skipCalibration(container);

      const banner = () =>
        Array.from(container.querySelectorAll("p")).find((p) =>
          p.textContent?.startsWith("Protocol amendment:")
        );
      for (let i = 0; i < 60 && !banner(); i++) {
        await act(async () => {
          vi.advanceTimersByTime(1000);
        });
      }
      expect(banner()).toBeDefined();

      // Every render used to copy the stale state back into the loop's ref,
      // so the countdown never reached zero and the amendment never ended.
      for (let i = 0; i < 30 && banner(); i++) {
        await act(async () => {
          vi.advanceTimersByTime(1000);
        });
      }
      expect(banner()).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it("quick-dispatches a clean routine dossier from a numeric hotkey", async () => {
    vi.useFakeTimers();
    try {
      await act(async () => {
        root.render(<ClinicalTrialChaos />);
      });
      const start = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent?.includes("Start 3-Phase Campaign")
      );
      await act(async () => {
        start?.click();
      });
      const observation = Array.from(container.querySelectorAll("span"))
        .find((span) => span.textContent?.includes("Validate Choice"))
        ?.closest(".cursor-pointer") as HTMLElement;
      await act(async () => {
        observation.click();
      });
      const correct = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent?.trim().replace(/^\d/, "") === "180 cm"
      );
      await act(async () => {
        correct?.click();
        vi.advanceTimersByTime(600);
      });

      const board = container.querySelector(
        '[data-keyboard-boundary="true"]'
      ) as HTMLElement;
      await act(async () => {
        board.dispatchEvent(
          new KeyboardEvent("keydown", { key: "1", bubbles: true })
        );
      });
      expect(container.textContent).toContain("Submits:1");
      expect(container.textContent).not.toContain(
        "21 CFR Part 11 Electronic Signature"
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps full review for a clean SAE dossier", async () => {
    vi.useFakeTimers();
    try {
      await act(async () => {
        root.render(<ClinicalTrialChaos />);
      });
      const start = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent?.includes("Start 3-Phase Campaign")
      );
      await act(async () => {
        start?.click();
      });
      const saeQueueCard = Array.from(
        container.querySelectorAll("button")
      ).find((button) => button.textContent?.includes("SUBJ-1003"));
      await act(async () => {
        saeQueueCard?.click();
      });
      expect(
        container.querySelector("#cc-dossier-title")?.textContent
      ).toContain("SUBJ-1003");
      const observation = Array.from(container.querySelectorAll("span"))
        .find((span) => span.textContent?.includes("Validate Choice"))
        ?.closest(".cursor-pointer") as HTMLElement;
      await act(async () => {
        observation.click();
      });
      const correct = Array.from(container.querySelectorAll("button")).find(
        (button) =>
          button.textContent?.trim().replace(/^\d/, "") === "Headache (Grade 2)"
      );
      await act(async () => {
        correct?.click();
        vi.advanceTimersByTime(600);
      });
      const aeStation = Array.from(container.querySelectorAll("h4"))
        .find((heading) => heading.textContent?.includes("AE Station"))
        ?.closest("button") as HTMLElement;
      await act(async () => {
        aeStation.click();
      });
      expect(container.textContent).toContain(
        "21 CFR Part 11 Electronic Signature"
      );
      expect(container.textContent).not.toContain("Submits:1");
      const confirm = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent?.includes("Sign & Lock CRF (Enter)")
      );
      await act(async () => {
        confirm?.click();
      });
      expect(container.textContent).toContain("Submits:1");
    } finally {
      vi.useRealTimers();
    }
  });

  it("guides early pointer and numeric routing without opening a modal or changing penalties", async () => {
    vi.useFakeTimers();
    try {
      await act(async () => {
        root.render(<ClinicalTrialChaos />);
      });
      const start = Array.from(container.querySelectorAll("button")).find(
        (button) => button.textContent?.includes("Start 3-Phase Campaign")
      );
      await act(async () => {
        start?.click();
      });

      const board = container.querySelector(
        '[data-keyboard-boundary="true"]'
      ) as HTMLElement;
      const dmStation = Array.from(container.querySelectorAll("h4"))
        .find((heading) => heading.textContent?.includes("DM Station"))
        ?.closest("button") as HTMLButtonElement;
      expect(dmStation).toBeDefined();
      expect(dmStation.textContent).toContain("Fix first");
      const initialScore = container.querySelector(
        'output[for="clinical-score"]'
      )?.textContent;
      const initialCombo = container.querySelector(
        '[title^="Lock CRFs back-to-back"]'
      )?.textContent;
      const initialAuditor = container
        .querySelector('[aria-label="FDA auditor suspicion"]')
        ?.getAttribute("aria-valuenow");

      await act(async () => {
        dmStation.click();
      });
      expect(container.textContent).toContain(
        "Resolve 1 flagged observation before routing"
      );
      expect(container.textContent).not.toContain(
        "21 CFR Part 11 Electronic Signature"
      );

      await act(async () => {
        board.dispatchEvent(
          new KeyboardEvent("keydown", { key: "1", bubbles: true })
        );
      });
      expect(container.textContent).toContain(
        "Resolve 1 flagged observation before routing"
      );
      expect(container.textContent).not.toContain(
        "21 CFR Part 11 Electronic Signature"
      );
      expect(
        container.querySelector('output[for="clinical-score"]')?.textContent
      ).toBe(initialScore);
      expect(
        container.querySelector('[title^="Lock CRFs back-to-back"]')
          ?.textContent
      ).toBe(initialCombo);
      expect(
        container
          .querySelector('[aria-label="FDA auditor suspicion"]')
          ?.getAttribute("aria-valuenow")
      ).toBe(initialAuditor);
      expect(container.textContent).not.toContain("AUDIT REJECT");

      const validateChoice = Array.from(container.querySelectorAll("span"))
        .find((span) => span.textContent?.includes("Validate Choice"))
        ?.closest(".cursor-pointer") as HTMLElement;
      await act(async () => {
        validateChoice.click();
      });
      const correctChoice = Array.from(
        container.querySelectorAll("button")
      ).find(
        (button) => button.textContent?.trim().replace(/^\d/, "") === "180 cm"
      );
      await act(async () => {
        correctChoice?.click();
        vi.advanceTimersByTime(600);
      });

      expect(dmStation.textContent).toContain("Accepts ✓");
      const aeStation = Array.from(container.querySelectorAll("h4"))
        .find((heading) => heading.textContent?.includes("AE Station"))
        ?.closest("button") as HTMLButtonElement;
      expect(aeStation.textContent).toContain("Other domain");
      // A clean dossier sent to the wrong station is a real submission: it
      // keeps the signature modal and the engine's mismatch validation.
      await act(async () => {
        aeStation.click();
      });
      expect(container.textContent).toContain(
        "21 CFR Part 11 Electronic Signature"
      );
      expect(container.textContent).not.toContain("before routing");
    } finally {
      vi.useRealTimers();
    }
  });

  it("completes a Fast-Track 21 CFR Pass like a signed CRF (#897)", async () => {
    vi.useFakeTimers();
    fastTrackLifeline.alwaysCharged = true;
    try {
      await act(async () => {
        root.render(<ClinicalTrialChaos />);
      });
      const startBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Start 3-Phase Campaign")
      );
      await act(async () => {
        startBtn?.click();
      });

      const board = container.querySelector(
        '[data-keyboard-boundary="true"]'
      ) as HTMLElement;
      const fastTrack = async () => {
        // Wait for a packet if the conveyor has run dry.
        for (
          let i = 0;
          i < 30 &&
          container.textContent?.includes("Waiting for the next packet");
          i++
        ) {
          await act(async () => {
            vi.advanceTimersByTime(1000);
          });
        }
        await act(async () => {
          board.dispatchEvent(
            new KeyboardEvent("keydown", { key: "r", bubbles: true })
          );
        });
      };
      const multiplierBadge = () =>
        Array.from(container.querySelectorAll("span")).find((s) =>
          /^×\d$/.test(s.textContent ?? "")
        )?.textContent;

      await fastTrack();
      // The destination station counts the submission.
      expect(container.textContent).toContain("Submits:1");

      await fastTrack();
      await fastTrack();
      // Three in a row is a 3-combo, which raises the multiplier to ×2.
      expect(multiplierBadge()).toBe("×2");

      await fastTrack();
      await fastTrack();
      // The fifth CRF meets the Phase 1 target and clears the phase.
      expect(container.textContent).toContain(
        "PHASE 1 COMPLIANCE AUDIT PASSED!"
      );
    } finally {
      fastTrackLifeline.alwaysCharged = false;
      vi.useRealTimers();
    }
  });

  it("does not start a shift when Enter is pressed on a focused briefing button", async () => {
    await act(async () => {
      root.render(<ClinicalTrialChaos />);
    });

    const officeCard = Array.from(
      container.querySelectorAll('[role="radio"]')
    ).find((b) =>
      b.textContent?.includes("Big Pharma Glass Tower")
    ) as HTMLElement;
    expect(officeCard).toBeDefined();

    await act(async () => {
      officeCard.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );
    });

    expect(container.textContent).toContain("Shift briefing");
    expect(mockRecordEvent).not.toHaveBeenCalled();

    // Enter on the board itself still starts the shift
    const board = container.querySelector(
      '[data-keyboard-boundary="true"]'
    ) as HTMLElement;
    await act(async () => {
      board.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );
    });
    expect(mockRecordEvent).toHaveBeenCalledWith(
      "clinical_trial_chaos",
      "project_click"
    );
  });

  // #1306: the board's key handler cancelled Tab, Enter and Space for every
  // target, so focus could never leave the board and focused buttons
  // couldn't be pressed from the keyboard.
  it("never traps Tab and leaves Enter and Space to focused buttons", async () => {
    await act(async () => {
      root.render(<ClinicalTrialChaos />);
    });
    const board = container.querySelector(
      '[data-keyboard-boundary="true"]'
    ) as HTMLElement;
    const endless = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Endless")
    ) as HTMLElement;
    expect(endless).toBeDefined();

    const press = (el: HTMLElement, key: string) => {
      const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        el.dispatchEvent(event);
      });
      return event.defaultPrevented;
    };

    expect(press(board, "Tab")).toBe(false);
    expect(press(endless, "Tab")).toBe(false);
    expect(press(endless, "Enter")).toBe(false);
    expect(press(endless, " ")).toBe(false);
    // Game keys on the board itself are still claimed.
    expect(press(board, "1")).toBe(true);
  });

  it("remembers the selected outfit and announces it at clock-in", async () => {
    await act(async () => {
      root.render(<ClinicalTrialChaos />);
    });

    const outfitCard = Array.from(
      container.querySelectorAll('[role="radio"]')
    ).find((b) => b.textContent?.includes("The WFH Mullet")) as HTMLElement;
    expect(outfitCard).toBeDefined();

    await act(async () => {
      outfitCard.click();
    });

    expect(outfitCard.getAttribute("aria-checked")).toBe("true");
    expect(mockStorage.getItem("clinical_chaos_outfit")).toBe("wfh-mullet");

    // A fresh mount restores the saved outfit
    act(() => {
      root.unmount();
    });
    root = createRoot(container);
    await act(async () => {
      root.render(<ClinicalTrialChaos />);
    });
    const restored = Array.from(
      container.querySelectorAll('[role="radio"][aria-checked="true"]')
    ).map((el) => el.textContent);
    expect(restored.some((t) => t?.includes("The WFH Mullet"))).toBe(true);

    const startBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Start 3-Phase Campaign")
    );
    await act(async () => {
      startBtn?.click();
    });
    const auditTab = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Audit Trail Log")
    );
    await act(async () => {
      auditTab?.click();
    });
    expect(container.textContent).toContain("[WARDROBE]");
    expect(container.textContent).toContain("pyjama bottoms");
  });

  it("closes the fix dialog at game over and counts wrong fixes as violations (#1325)", async () => {
    vi.useFakeTimers();
    // Endless subjects are random; seed the draw so runs repeat closely. The
    // loop below does not rely on which value is compliant.
    let seed = 1325;
    vi.spyOn(Math, "random").mockImplementation(() => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    });

    await act(async () => {
      root.render(<ClinicalTrialChaos />);
    });
    // Endless mode, as in the playtest: no calibration shift to forgive the
    // wrong picks.
    const endlessBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Endless BIMO Audit Mode")
    );
    await act(async () => {
      endlessBtn?.click();
    });
    const startBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => /^Start/.test(b.textContent?.trim() ?? "")
    );
    await act(async () => {
      startBtn?.click();
    });

    const dialogTitle = "CDISC Controlled Terminology Validation";
    const openDialog = () =>
      Array.from(container.querySelectorAll("[role='dialog']")).find((d) =>
        d.textContent?.includes(dialogTitle)
      );
    const openNextFlaggedField = async () => {
      const validateChoiceEl = Array.from(
        container.querySelectorAll("span")
      ).find((s) => s.textContent?.includes("Validate Choice"));
      const card = validateChoiceEl?.closest(".cursor-pointer");
      if (!card) return;
      await act(async () => {
        (card as HTMLElement).click();
      });
    };

    await openNextFlaggedField();
    expect(openDialog()).toBeTruthy();

    // Keep answering flagged fields until the FDA's suspicion ends the trial.
    // Which offered value is compliant depends on the random subject, so pick
    // by position: a pick that leaves the dialog open was a wrong fix, and a
    // pick that closes it resolved the field, so open the next one.
    let wrongPicks = 0;
    for (
      let i = 0;
      i < 120 && !container.textContent?.includes("TRIAL TERMINATED");
      i++
    ) {
      const dialog = openDialog();
      if (!dialog) {
        await openNextFlaggedField();
      } else {
        const choices = Array.from(dialog.querySelectorAll("button")).filter(
          (b) => /^\d/.test(b.textContent?.trim() ?? "")
        );
        if (choices.length === 0) break;
        await act(async () => {
          choices[i % choices.length].click();
        });
        if (openDialog()) wrongPicks++;
      }
      await act(async () => {
        vi.advanceTimersByTime(700);
      });
    }

    expect(wrongPicks).toBeGreaterThan(0);
    expect(container.textContent).toContain("TRIAL TERMINATED");
    // The fix dialog no longer sits over the Form 483 panel.
    expect(container.textContent).not.toContain(
      "CDISC Controlled Terminology Validation"
    );
    const violations = Array.from(container.querySelectorAll("dt")).find(
      (dt) => dt.textContent === "Violations"
    )?.nextElementSibling?.textContent;
    expect(Number(violations)).toBeGreaterThan(0);

    vi.mocked(Math.random).mockRestore();
    vi.useRealTimers();
  });

  it("says on the board when a clean CRF went to the wrong station (#1326)", async () => {
    vi.useFakeTimers();

    await act(async () => {
      root.render(<ClinicalTrialChaos />);
    });
    const startBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Start 3-Phase Campaign")
    );
    await act(async () => {
      startBtn?.click();
    });

    // Fix SUBJ-1001's height (180 m -> 180 cm) so the CRF is clean.
    const validateChoiceEl = Array.from(
      container.querySelectorAll("span")
    ).find((s) => s.textContent?.includes("Validate Choice"));
    const obsCard = validateChoiceEl?.closest(".cursor-pointer") as HTMLElement;
    await act(async () => {
      obsCard.click();
    });
    const choiceBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.trim().replace(/^\d/, "") === "180 cm"
    );
    await act(async () => {
      choiceBtn?.click();
    });
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    // Send it to AE, which does not take DM or VS data.
    const aeHeading = Array.from(container.querySelectorAll("h4")).find((h) =>
      h.textContent?.includes("AE Station")
    );
    const aeCard = aeHeading?.closest(".group") as HTMLElement;
    await act(async () => {
      aeCard.click();
    });
    const signBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Sign & Lock CRF")
    );
    if (signBtn) {
      await act(async () => {
        signBtn.click();
      });
    }

    expect(container.textContent).toContain(
      "Rejected: SUBJ-1001 does not belong at AE."
    );
    expect(announcements.some((a) => a.startsWith("Rejected: SUBJ-1001"))).toBe(
      true
    );

    vi.useRealTimers();
  });

  it("should load existing high score from localStorage", async () => {
    mockStorage.setItem("clinical_chaos_highscore", "9800");

    await act(async () => {
      root.render(<ClinicalTrialChaos />);
    });

    expect(container.textContent).toContain("9800");
  });

  it("should freeze conveyor subject timers when Controlled Terminology Drawer or Signature Modal is open, and resume immediately on close", async () => {
    vi.useFakeTimers();

    await act(async () => {
      root.render(<ClinicalTrialChaos />);
    });

    // Start campaign
    const startBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Start 3-Phase Campaign")
    );
    await act(async () => {
      startBtn?.click();
    });
    await skipCalibration(container);

    // Helper to tick fake timers in small steps asynchronously to allow recursive animation frames to execute
    const tickGame = async (totalMs: number, stepMs = 250) => {
      for (let elapsed = 0; elapsed < totalMs; elapsed += stepMs) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(stepMs);
        });
      }
    };

    // An SAE still requires the full review modal after its observation is clean.
    const saeQueueCard = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("SUBJ-1003")
    );
    await act(async () => {
      saeQueueCard?.click();
    });
    const activeTimer = () =>
      container
        .querySelector("#cc-dossier-title")
        ?.parentElement?.parentElement?.children.item(1)
        ?.textContent?.trim();
    const initialSeconds = parseInt(activeTimer() ?? "", 10);
    expect(initialSeconds).toBeGreaterThan(0);

    // Let 2.5 seconds pass
    await tickGame(2500, 100);

    const afterTick = activeTimer();
    expect(parseInt(afterTick ?? "", 10)).toBeLessThan(initialSeconds);

    // Find and click the observation card to open multi-choice validation drawer
    const validateChoiceEl = Array.from(
      container.querySelectorAll("span")
    ).find((s) => s.textContent?.includes("Validate Choice"));
    const obsCard = validateChoiceEl?.closest(".cursor-pointer") as HTMLElement;
    await act(async () => {
      obsCard.click();
    });

    expect(container.textContent).toContain(
      "CDISC Controlled Terminology Validation"
    );

    // Let another 3 seconds pass while drawer is open
    await tickGame(3000, 100);

    expect(activeTimer()).toBe(afterTick);

    // Close the drawer using the close button
    const closeBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Close")
    );
    await act(async () => {
      closeBtn?.click();
    });

    // Let another 2.0 seconds pass after closing drawer
    await tickGame(2000, 100);

    expect(parseInt(activeTimer() ?? "", 10)).toBeLessThan(
      parseInt(afterTick ?? "", 10)
    );

    // Routing now requires a clean dossier; fix the seeded observation first.
    await act(async () => {
      obsCard.click();
    });
    const correctChoice = Array.from(container.querySelectorAll("button")).find(
      (button) =>
        button.textContent?.trim().replace(/^\d/, "") === "Headache (Grade 2)"
    );
    await act(async () => {
      correctChoice?.click();
    });
    await tickGame(600, 100);
    const beforeSignature = activeTimer();

    // Open signature modal via AE Station
    const aeHeading = Array.from(container.querySelectorAll("h4")).find((h) =>
      h.textContent?.includes("AE Station")
    );
    const aeStationCard = aeHeading?.closest(".group") as HTMLElement;
    await act(async () => {
      aeStationCard.click();
    });

    expect(container.textContent).toContain(
      "21 CFR Part 11 Electronic Signature"
    );

    // Let another 4 seconds pass while signature modal is open
    await tickGame(4000, 100);

    // The active dossier's timer stays frozen while the modal is open.
    expect(activeTimer()).toBe(beforeSignature);

    // Cancel signature modal (Close/Cancel)
    const cancelBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Cancel")
    );
    await act(async () => {
      cancelBtn?.click();
    });

    // Let another 1 second pass after closing signature modal
    await tickGame(1000, 100);

    // The active dossier's timer resumes immediately after closing.
    expect(parseInt(activeTimer() ?? "", 10)).toBeLessThan(
      parseInt(beforeSignature ?? "", 10)
    );

    vi.useRealTimers();
  }, 15000);

  it("should enforce minimum 44px touch target dimensions across HUD buttons, tabs, mode selectors, and options", async () => {
    await act(async () => {
      root.render(<ClinicalTrialChaos />);
    });

    const bgmBtn = container.querySelector('[aria-label="Background music"]');
    expect(bgmBtn?.className).toContain("min-h-[44px]");
    expect(bgmBtn?.className).toContain("min-w-[44px]");

    const sfxBtn = container.querySelector('[aria-label="Sound effects"]');
    expect(sfxBtn?.className).toContain("min-h-[44px]");
    expect(sfxBtn?.className).toContain("min-w-[44px]");

    const tabs = container.querySelectorAll('[aria-label="Game views"] button');
    tabs.forEach((tab) => {
      expect(tab.className).toContain("min-h-[44px]");
    });

    const modeBtns = container.querySelectorAll(
      '[aria-label="Game mode"] button'
    );
    modeBtns.forEach((btn) => {
      expect(btn.className).toContain("min-h-[44px]");
    });

    const officeRadioBtns = container.querySelectorAll(
      '[role="radiogroup"] button'
    );
    officeRadioBtns.forEach((btn) => {
      expect(btn.className).toContain("min-h-[44px]");
    });
  });

  it("should handle canvas touch start, move, preventDefault, and cancel resets", async () => {
    await act(async () => {
      root.render(<ClinicalTrialChaos />);
    });

    // Start campaign so conveyor subjects are active
    const startBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Start 3-Phase Campaign")
    );
    await act(async () => {
      startBtn?.click();
    });

    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();
    expect(canvas?.style.touchAction).toBe("none");

    const touchEventStart = new CustomEvent("touchstart", {
      bubbles: true,
      cancelable: true,
    }) as any;
    touchEventStart.touches = [{ clientX: 100, clientY: 50 }];
    const startPreventDefaultSpy = vi.fn();
    touchEventStart.preventDefault = startPreventDefaultSpy;

    await act(async () => {
      canvas?.dispatchEvent(touchEventStart);
    });

    expect(startPreventDefaultSpy).toHaveBeenCalled();

    const touchEventMove = new CustomEvent("touchmove", {
      bubbles: true,
      cancelable: true,
    }) as any;
    touchEventMove.touches = [{ clientX: 120, clientY: 50 }];
    const movePreventDefaultSpy = vi.fn();
    touchEventMove.preventDefault = movePreventDefaultSpy;

    await act(async () => {
      canvas?.dispatchEvent(touchEventMove);
    });

    expect(movePreventDefaultSpy).toHaveBeenCalled();

    const touchEventCancel = new CustomEvent("touchcancel", {
      bubbles: true,
      cancelable: true,
    }) as any;
    const cancelPreventDefaultSpy = vi.fn();
    touchEventCancel.preventDefault = cancelPreventDefaultSpy;

    await act(async () => {
      canvas?.dispatchEvent(touchEventCancel);
    });

    expect(cancelPreventDefaultSpy).toHaveBeenCalled();

    // After cancel, drag state is reset so subsequent touchmove does not trigger selection
    const postCancelMove = new CustomEvent("touchmove", {
      bubbles: true,
      cancelable: true,
    }) as any;
    postCancelMove.touches = [{ clientX: 150, clientY: 50 }];
    const postMovePreventDefaultSpy = vi.fn();
    postCancelMove.preventDefault = postMovePreventDefaultSpy;

    await act(async () => {
      canvas?.dispatchEvent(postCancelMove);
    });

    expect(postMovePreventDefaultSpy).toHaveBeenCalled();
  });

  it("should deduplicate rapid pointer down and touch move events on canvas", async () => {
    await act(async () => {
      root.render(<ClinicalTrialChaos />);
    });

    // Start campaign
    const startBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Start 3-Phase Campaign")
    );
    await act(async () => {
      startBtn?.click();
    });

    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();

    // Trigger pointerdown then immediate touchstart within 100ms
    const pointerEvent = new CustomEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
    }) as any;
    pointerEvent.clientX = 100;
    pointerEvent.clientY = 60;
    pointerEvent.pointerId = 1;

    await act(async () => {
      canvas?.dispatchEvent(pointerEvent);
    });

    const touchEvent = new CustomEvent("touchstart", {
      bubbles: true,
      cancelable: true,
    }) as any;
    touchEvent.touches = [{ clientX: 100, clientY: 60 }];
    touchEvent.preventDefault = vi.fn();

    await act(async () => {
      canvas?.dispatchEvent(touchEvent);
    });

    // Trigger pointermove then immediate touchmove during touch drag
    const pointerMove = new CustomEvent("pointermove", {
      bubbles: true,
      cancelable: true,
    }) as any;
    pointerMove.clientX = 110;
    pointerMove.clientY = 60;

    await act(async () => {
      canvas?.dispatchEvent(pointerMove);
    });

    const touchMove = new CustomEvent("touchmove", {
      bubbles: true,
      cancelable: true,
    }) as any;
    touchMove.touches = [{ clientX: 110, clientY: 60 }];
    touchMove.preventDefault = vi.fn();

    await act(async () => {
      canvas?.dispatchEvent(touchMove);
    });

    // Subject selection state should remain stable without duplicate sound / selection errors
    expect(container.textContent).toContain("SUBJ-1001");
  });

  it("should preserve rapid intentional sequential taps after touchend", async () => {
    await act(async () => {
      root.render(<ClinicalTrialChaos />);
    });

    const startBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Start 3-Phase Campaign")
    );
    await act(async () => {
      startBtn?.click();
    });

    const canvas = container.querySelector("canvas");
    expect(canvas).not.toBeNull();

    // First tap: pointerdown -> touchend
    const firstPointer = new CustomEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
    }) as any;
    firstPointer.clientX = 100;
    firstPointer.clientY = 60;
    firstPointer.pointerId = 1;

    await act(async () => {
      canvas?.dispatchEvent(firstPointer);
    });

    const firstTouchEnd = new CustomEvent("touchend", {
      bubbles: true,
      cancelable: true,
    }) as any;
    firstTouchEnd.preventDefault = vi.fn();

    await act(async () => {
      canvas?.dispatchEvent(firstTouchEnd);
    });

    // Advance time slightly (e.g. 120ms after touchend)
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 120);

    // Second tap should NOT be suppressed by the first touchend
    const secondPointer = new CustomEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
    }) as any;
    secondPointer.clientX = 220;
    secondPointer.clientY = 60;
    secondPointer.pointerId = 2;

    await act(async () => {
      canvas?.dispatchEvent(secondPointer);
    });

    expect(container.textContent).toContain("SUBJ-1002");

    vi.restoreAllMocks();
  });

  describe("ClinicalChaosClient Wrapper Suite", () => {
    it("renders ClinicalChaosClient standby page layout with controls and navigation", async () => {
      await act(async () => {
        root.render(<ClinicalChaosClient />);
      });

      expect(container.textContent).toContain(
        "Clinical Trial Chaos: CDISC Compliance"
      );
      expect(container.textContent).toContain("Back to Arcade Hub");
      expect(container.textContent).toContain(
        "CDISC SDTM / 21 CFR Part 11 Arcade"
      );
      expect(container.textContent).toContain("Two pressures");
      expect(container.textContent).toContain("Offices and amendments");
      expect(container.textContent).toContain("Shortcuts leave a trail");
      expect(container.textContent).toContain("Launch Cabinet");
    });

    it("launches cabinet from ClinicalChaosClient and handles conveyor pause and drawer interlocks", async () => {
      vi.useFakeTimers();

      await act(async () => {
        root.render(<ClinicalChaosClient />);
      });

      // Click Launch Cabinet
      const launchBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Launch Cabinet")
      );
      expect(launchBtn).toBeDefined();

      await act(async () => {
        launchBtn?.click();
      });

      // Advance timers for boot sequence warm-up
      for (let i = 0; i < 20; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(200);
        });
      }

      // Verify cabinet launched and shows shift briefing
      expect(container.textContent).toContain("Shift briefing");

      // Start campaign inside cabinet
      const startBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Start 3-Phase Campaign")
      );
      expect(startBtn).toBeDefined();

      await act(async () => {
        startBtn?.click();
      });

      expect(container.textContent).toContain("SUBJ-1001");
      await skipCalibration(container);

      // Helper to tick fake timers in small steps
      const tickGame = async (totalMs: number, stepMs = 250) => {
        for (let elapsed = 0; elapsed < totalMs; elapsed += stepMs) {
          await act(async () => {
            await vi.advanceTimersByTimeAsync(stepMs);
          });
        }
      };

      // Let 2.5s pass
      await tickGame(2500, 100);
      expect(container.textContent).toContain("38s");

      // Open drawer (interlock)
      const validateChoiceEl = Array.from(
        container.querySelectorAll("span")
      ).find((s) => s.textContent?.includes("Validate Choice"));
      const obsCard = validateChoiceEl?.closest(
        ".cursor-pointer"
      ) as HTMLElement;

      await act(async () => {
        obsCard.click();
      });

      expect(container.textContent).toContain(
        "CDISC Controlled Terminology Validation"
      );

      // Verify timer is frozen during drawer interlock pause
      await tickGame(3000, 100);
      expect(container.textContent).toContain("38s");

      // Close drawer
      const closeBtn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("Close")
      );
      await act(async () => {
        closeBtn?.click();
      });

      // Timer resumes after closing drawer
      await tickGame(2000, 100);
      expect(container.textContent).toContain("36s");

      vi.useRealTimers();
    }, 15000);
  });
});
