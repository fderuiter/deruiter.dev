"use client";

import { useSyncExternalStore, useCallback } from "react";
import { macroEngine, type MacroSequence } from "@/lib/macro-engine";

const subscribe = (callback: () => void) => macroEngine.subscribe(callback);

const getRecordingSnapshot = () => macroEngine.getRecordingState();
const getServerRecordingSnapshot = () => ({
  isRecording: false,
  recordingName: "",
  recordedStepsCount: 0,
  recordedSteps: [],
});

const getSavedMacrosSnapshot = () => macroEngine.getSavedMacros();
const getServerSavedMacrosSnapshot = (): MacroSequence[] => [];

export function useMacroEngine() {
  const recordingState = useSyncExternalStore(
    subscribe,
    getRecordingSnapshot,
    getServerRecordingSnapshot
  );

  const savedMacros = useSyncExternalStore(
    subscribe,
    getSavedMacrosSnapshot,
    getServerSavedMacrosSnapshot
  );

  const startRecording = useCallback((name?: string) => {
    macroEngine.startRecording(name);
  }, []);

  const stopRecording = useCallback(() => {
    return macroEngine.stopRecording();
  }, []);

  const toggleRecording = useCallback((name?: string) => {
    macroEngine.toggleRecording(name);
  }, []);

  const saveMacro = useCallback((name: string, description?: string) => {
    return macroEngine.saveMacro(name, description);
  }, []);

  const executeMacro = useCallback((idOrMacro: string | MacroSequence) => {
    return macroEngine.executeMacro(idOrMacro);
  }, []);

  const deleteMacro = useCallback((id: string) => {
    macroEngine.deleteMacro(id);
  }, []);

  return {
    ...recordingState,
    savedMacros,
    startRecording,
    stopRecording,
    toggleRecording,
    saveMacro,
    executeMacro,
    deleteMacro,
  };
}
