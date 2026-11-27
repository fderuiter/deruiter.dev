import type {
  StudyRepositoryRecord,
  StudyRepositorySaveOptions,
  StudyRepositorySeed,
  StudyRepositoryStore,
} from "../types";
import { buildSeedRepositoryRecord } from "./repository-meta";
import { StudyWorkspaceConflictError } from "./revision";

const ACTIVE_STUDY_KEY = "activeStudyId";

function sortRecords(
  records: Iterable<StudyRepositoryRecord>
): readonly StudyRepositoryRecord[] {
  const kindRank: Record<StudyRepositoryRecord["kind"], number> = {
    reference: 0,
    migrated: 1,
    imported: 2,
    authored: 3,
  };
  return [...records]
    .map((entry) => structuredClone(entry))
    .sort((a, b) => {
      const rankDiff = kindRank[a.kind] - kindRank[b.kind];
      if (rankDiff !== 0) return rankDiff;
      if (a.createdAt !== b.createdAt) {
        return a.createdAt.localeCompare(b.createdAt);
      }
      return a.studyId.localeCompare(b.studyId);
    });
}

/**
 * Creates a volatile in-memory study repository store with the same optimistic
 * concurrency guarantees as the IndexedDB store, used when IndexedDB is
 * unavailable or blocked in private browsing windows.
 */
export function createMemoryStudyRepositoryStore(): StudyRepositoryStore {
  const studies = new Map<string, StudyRepositoryRecord>();
  const meta = new Map<string, unknown>();

  return {
    persistence: "memory",

    list(): Promise<readonly StudyRepositoryRecord[]> {
      return Promise.resolve(sortRecords(studies.values()));
    },

    get(studyId: string): Promise<StudyRepositoryRecord | null> {
      const found = studies.get(studyId);
      return Promise.resolve(found ? structuredClone(found) : null);
    },

    put(
      record: StudyRepositoryRecord,
      options: StudyRepositorySaveOptions = {}
    ): Promise<StudyRepositoryRecord> {
      const currentRevisionId =
        studies.get(record.studyId)?.workspace.revision.id ?? null;
      if (
        !options.force &&
        options.expectedRevisionId !== undefined &&
        currentRevisionId !== options.expectedRevisionId
      ) {
        return Promise.reject(
          new StudyWorkspaceConflictError(
            options.expectedRevisionId,
            currentRevisionId
          )
        );
      }
      const copy = structuredClone(record);
      studies.set(copy.studyId, copy);
      return Promise.resolve(structuredClone(copy));
    },

    async seedIfMissing(seeds: readonly StudyRepositorySeed[]): Promise<void> {
      for (let index = 0; index < seeds.length; index += 1) {
        const seed = seeds[index];
        if (studies.has(seed.studyId)) continue;
        const stamp = new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString();
        const built = await buildSeedRepositoryRecord(seed, stamp);
        if (!studies.has(seed.studyId)) {
          studies.set(seed.studyId, built);
        }
      }
    },

    remove(studyId: string): Promise<void> {
      studies.delete(studyId);
      if (meta.get(ACTIVE_STUDY_KEY) === studyId) {
        meta.delete(ACTIVE_STUDY_KEY);
      }
      return Promise.resolve();
    },

    getActiveStudyId(): Promise<string | null> {
      const value = meta.get(ACTIVE_STUDY_KEY);
      return Promise.resolve(
        typeof value === "string" && value.length > 0 ? value : null
      );
    },

    setActiveStudyId(studyId: string | null): Promise<void> {
      if (studyId === null) {
        meta.delete(ACTIVE_STUDY_KEY);
      } else {
        meta.set(ACTIVE_STUDY_KEY, studyId);
      }
      return Promise.resolve();
    },

    getMeta(key: string): Promise<unknown> {
      const value = meta.get(key);
      return Promise.resolve(
        value === undefined ? undefined : structuredClone(value)
      );
    },

    setMeta(key: string, value: unknown): Promise<void> {
      if (value === null || value === undefined) {
        meta.delete(key);
      } else {
        meta.set(key, structuredClone(value));
      }
      return Promise.resolve();
    },

    close(): void {
      // No-op for volatile memory store.
    },
  };
}
