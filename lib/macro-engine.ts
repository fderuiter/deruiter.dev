import { z } from "zod";
import { logger } from "@/lib/logger";
import { safeStorage } from "@/lib/safe-storage";
import {
  onAppEvent,
  emitAppEvent,
  type MacroRecordStepPayload,
} from "@/lib/event-bus";
import { workspaceCommandRegistry } from "@/lib/workspace-command-registry";

export const MACRO_STORAGE_KEY = "portfolio_macros_v1";
export const MAX_MACRO_STEPS = 20;

export const MacroStepSchema = z.object({
  actionId: z.string().min(1),
  timestamp: z.number().default(() => Date.now()),
  args: z.record(z.string(), z.unknown()).optional(),
});

export const MacroSequenceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  createdAt: z.number().default(() => Date.now()),
  updatedAt: z.number().default(() => Date.now()),
  steps: z.array(MacroStepSchema).max(MAX_MACRO_STEPS),
});

export const MacroStorageSchema = z.array(MacroSequenceSchema);

export type MacroStep = z.infer<typeof MacroStepSchema>;
export type MacroSequence = z.infer<typeof MacroSequenceSchema>;

export interface RecordingStateSnapshot {
  isRecording: boolean;
  recordingName: string;
  recordedStepsCount: number;
  recordedSteps: MacroStep[];
}

export type MacroEngineListener = () => void;

const EMPTY_RECORDED_STEPS: MacroStep[] = [];
const EMPTY_SAVED_MACROS: MacroSequence[] = [];

const INITIAL_RECORDING_STATE: RecordingStateSnapshot = {
  isRecording: false,
  recordingName: "",
  recordedStepsCount: 0,
  recordedSteps: EMPTY_RECORDED_STEPS,
};

export class MacroEngine {
  private recording = false;
  private recordingName = "";
  private recordedSteps: MacroStep[] = [];
  private isExecuting = false;
  private isReplaying = false;
  private listeners = new Set<MacroEngineListener>();
  private isInitialized = false;

  private cachedRecordingState: RecordingStateSnapshot =
    INITIAL_RECORDING_STATE;
  private cachedRawStorage: unknown = null;
  private cachedSavedMacros: MacroSequence[] = EMPTY_SAVED_MACROS;

  constructor() {
    this.initEventListeners();
  }

  private initEventListeners() {
    if (typeof window === "undefined" || this.isInitialized) return;
    this.isInitialized = true;

    onAppEvent("macro:start_recording", (payload) => {
      this.startRecording(payload?.name);
    });

    onAppEvent("macro:stop_recording", () => {
      this.stopRecording();
    });

    onAppEvent("macro:toggle_recording", (payload) => {
      this.toggleRecording(payload?.name);
    });

    onAppEvent("macro:record_step", (payload) => {
      if (payload && payload.actionId) {
        this.recordStep(payload);
      }
    });

    onAppEvent("macro:save", (payload) => {
      if (payload && payload.name) {
        const steps = payload.steps?.map((s) => ({
          actionId: s.actionId,
          timestamp: s.timestamp ?? Date.now(),
          args: s.args,
        }));
        this.saveMacro(payload.name, payload.description, steps);
      }
    });

    onAppEvent("macro:execute", (payload) => {
      if (payload && payload.macroId) {
        this.executeMacro(payload.macroId);
      }
    });
  }

  private updateRecordingCache() {
    if (!this.recording && this.recordedSteps.length === 0) {
      this.cachedRecordingState = INITIAL_RECORDING_STATE;
      return;
    }
    this.cachedRecordingState = {
      isRecording: this.recording,
      recordingName: this.recordingName,
      recordedStepsCount: this.recordedSteps.length,
      recordedSteps: [...this.recordedSteps],
    };
  }

  /**
   * Starts a macro recording session.
   */
  public startRecording(name?: string): void {
    this.recording = true;
    this.recordingName = name || "Untitled Macro";
    this.recordedSteps = [];
    this.updateRecordingCache();
    this.emitState();
  }

  /**
   * Stops the active macro recording session.
   */
  public stopRecording(): MacroStep[] {
    this.recording = false;
    const steps = [...this.recordedSteps];
    this.updateRecordingCache();
    this.emitState();
    return steps;
  }

  /**
   * Toggles recording mode on or off.
   */
  public toggleRecording(name?: string): void {
    if (this.recording) {
      this.stopRecording();
    } else {
      this.startRecording(name);
    }
  }

  /**
   * Returns whether recording is currently active.
   */
  public isRecording(): boolean {
    return this.recording;
  }

  /**
   * Returns details of current recording state (stable reference).
   */
  public getRecordingState(): RecordingStateSnapshot {
    return this.cachedRecordingState;
  }

  /**
   * Records a step into the active recording sequence.
   */
  public recordStep(stepPayload: MacroRecordStepPayload): void {
    if (!this.recording || this.isReplaying) return;

    if (this.recordedSteps.length >= MAX_MACRO_STEPS) {
      logger.warn(
        `MacroEngine: Maximum limit of ${MAX_MACRO_STEPS} steps reached for macro. Step ignored.`
      );
      return;
    }

    const step: MacroStep = {
      actionId: stepPayload.actionId,
      timestamp: stepPayload.timestamp || Date.now(),
      args: stepPayload.args,
    };

    this.recordedSteps.push(step);
    this.updateRecordingCache();
    this.emitState();
  }

  /**
   * Retrieves and validates all persisted macros from local browser storage.
   * Ensures schema integrity, sanitizing or logging corrupted entries gracefully.
   * Returns a stable cached array reference when raw storage has not changed.
   */
  public getSavedMacros(): MacroSequence[] {
    if (typeof window === "undefined") return EMPTY_SAVED_MACROS;

    try {
      const raw = safeStorage.getItem(MACRO_STORAGE_KEY, EMPTY_SAVED_MACROS);
      if (raw === this.cachedRawStorage) {
        return this.cachedSavedMacros;
      }

      this.cachedRawStorage = raw;

      if (!raw || (Array.isArray(raw) && raw.length === 0)) {
        this.cachedSavedMacros = EMPTY_SAVED_MACROS;
        return EMPTY_SAVED_MACROS;
      }

      const result = MacroStorageSchema.safeParse(raw);
      if (result.success) {
        this.cachedSavedMacros =
          result.data.length === 0 ? EMPTY_SAVED_MACROS : result.data;
        return this.cachedSavedMacros;
      }

      logger.warn(
        "MacroEngine: Persisted macro storage failed schema validation. Filtering corrupted entries:",
        result.error
      );

      // Attempt row-by-row recovery for partial corruption
      if (Array.isArray(raw)) {
        const validMacros: MacroSequence[] = [];
        for (const item of raw) {
          const singleResult = MacroSequenceSchema.safeParse(item);
          if (singleResult.success) {
            validMacros.push(singleResult.data);
          }
        }
        safeStorage.setItem(MACRO_STORAGE_KEY, validMacros);
        this.cachedSavedMacros =
          validMacros.length === 0 ? EMPTY_SAVED_MACROS : validMacros;
        return this.cachedSavedMacros;
      }

      // Reset invalid non-array storage
      safeStorage.setItem(MACRO_STORAGE_KEY, EMPTY_SAVED_MACROS);
      this.cachedSavedMacros = EMPTY_SAVED_MACROS;
      return EMPTY_SAVED_MACROS;
    } catch (err) {
      logger.warn(
        "MacroEngine: Failed reading saved macros from storage:",
        err
      );
      this.cachedSavedMacros = EMPTY_SAVED_MACROS;
      return EMPTY_SAVED_MACROS;
    }
  }

  /**
   * Saves a named macro sequence to local storage (`portfolio_macros_v1`).
   */
  public saveMacro(
    name: string,
    description?: string,
    customSteps?: MacroStep[]
  ): MacroSequence | null {
    const stepsToSave = (customSteps || this.recordedSteps).slice(
      0,
      MAX_MACRO_STEPS
    );

    if (stepsToSave.length === 0) {
      logger.warn("MacroEngine: Cannot save a macro with 0 steps.");
      return null;
    }

    const newMacro: MacroSequence = {
      id: `macro_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim() || "Untitled Macro",
      description,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      steps: stepsToSave,
    };

    const parseResult = MacroSequenceSchema.safeParse(newMacro);
    if (!parseResult.success) {
      logger.warn(
        "MacroEngine: Macro sequence validation failed:",
        parseResult.error
      );
      return null;
    }

    const existing = this.getSavedMacros();
    const updated = [parseResult.data, ...existing];

    try {
      safeStorage.setItem(MACRO_STORAGE_KEY, updated);
      this.cachedRawStorage = updated;
      this.cachedSavedMacros = updated;

      if (this.recording) {
        this.stopRecording();
      } else {
        this.emitState();
      }
      this.notify();
      return parseResult.data;
    } catch (err) {
      logger.warn("MacroEngine: Failed saving macro sequence to storage:", err);
      return null;
    }
  }

  /**
   * Deletes a saved macro by ID.
   */
  public deleteMacro(id: string): void {
    const existing = this.getSavedMacros();
    const filtered = existing.filter((m) => m.id !== id);
    safeStorage.setItem(MACRO_STORAGE_KEY, filtered);
    this.cachedRawStorage = filtered;
    this.cachedSavedMacros =
      filtered.length === 0 ? EMPTY_SAVED_MACROS : filtered;
    this.notify();
  }

  /**
   * Executes a saved macro sequence step by step asynchronously on the main thread.
   * Incorporates a safety interlock threshold (max 20 steps) and re-entrancy protection.
   */
  public async executeMacro(
    idOrMacro: string | MacroSequence
  ): Promise<boolean> {
    if (this.isExecuting) {
      logger.warn("MacroEngine: A macro execution is already in progress.");
      return false;
    }

    let macro: MacroSequence | undefined;

    if (typeof idOrMacro === "string") {
      const saved = this.getSavedMacros();
      macro = saved.find((m) => m.id === idOrMacro);
    } else {
      macro = idOrMacro;
    }

    if (!macro) {
      logger.warn("MacroEngine: Target macro sequence not found.");
      return false;
    }

    const validation = MacroSequenceSchema.safeParse(macro);
    if (!validation.success) {
      logger.warn(
        "MacroEngine: Target macro fails schema validation:",
        validation.error
      );
      return false;
    }

    const validMacro = validation.data;
    const stepsToRun = validMacro.steps.slice(0, MAX_MACRO_STEPS);

    this.isExecuting = true;
    this.isReplaying = true;

    try {
      logger.info(
        `MacroEngine: Replaying macro "${validMacro.name}" (${stepsToRun.length} steps)...`
      );

      for (let i = 0; i < stepsToRun.length; i++) {
        const step = stepsToRun[i];
        await workspaceCommandRegistry.executeAction(step.actionId, step.args);

        // Yield to main thread to allow UI rendering and smooth transitions
        await new Promise((resolve) => setTimeout(resolve, 30));
      }

      logger.info(
        `MacroEngine: Macro "${validMacro.name}" executed successfully.`
      );
      return true;
    } catch (err) {
      logger.warn(
        `MacroEngine: Error executing macro "${validMacro.name}":`,
        err
      );
      return false;
    } finally {
      this.isExecuting = false;
      this.isReplaying = false;
    }
  }

  /**
   * Subscribes to changes in macro engine state.
   */
  public subscribe(listener: MacroEngineListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        logger.warn("MacroEngine listener error:", err);
      }
    }
  }

  private emitState() {
    emitAppEvent("macro:state_changed", {
      isRecording: this.recording,
      recordingName: this.recordingName,
      recordedStepsCount: this.recordedSteps.length,
    });
    this.notify();
  }
}

export const macroEngine = new MacroEngine();
