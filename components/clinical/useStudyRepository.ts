"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  INITIAL_STUDY_REPOSITORY_SNAPSHOT,
  getSharedStudyRepository,
  type StudyRepositoryClient,
  type StudyRepositorySnapshot,
} from "./study-repository-client";

const getServerSnapshot = (): StudyRepositorySnapshot =>
  INITIAL_STUDY_REPOSITORY_SNAPSHOT;

/**
 * Subscribes a clinical studio or overview component to the shared browser
 * study repository (`IndexedDB` + `BroadcastChannel` with volatile memory
 * fallback), returning a deterministic initial snapshot for SSR safety.
 */
export function useStudyRepository(
  customClient?: StudyRepositoryClient
): {
  readonly snapshot: StudyRepositorySnapshot;
  readonly repository: StudyRepositoryClient;
} {
  const repository = customClient ?? getSharedStudyRepository();
  const snapshot = useSyncExternalStore(
    repository.subscribe,
    repository.getSnapshot,
    getServerSnapshot
  );

  useEffect(() => {
    void repository.initialize();
  }, [repository]);

  return { snapshot, repository };
}
