"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  decodeExploration,
  encodeExploration,
  type Exploration,
  type ExplorationResult,
} from "@/lib/clinical-platform";
import { createExploreClient } from "./explore-client";
import { ExplorerView, type HistoryMode } from "./ExplorerView";

/** Where a visitor with no link starts: subjects screened, study by study. */
const START: Exploration = {
  metricId: "subjects_screened",
  dimensions: ["study"],
  filters: [],
  visual: null,
};

// The exploration lives in the URL hash, which repeats keys (`by=study&by=
// month`), so it is read whole rather than through useStudioHashParams,
// which keeps one value per key.
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("hashchange", listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("hashchange", listener);
    window.removeEventListener("popstate", listener);
  };
}

const clientHash = () => window.location.hash;
const serverHash = () => "";

function writeHash(hash: string, mode: HistoryMode): void {
  const url = `${window.location.pathname}${window.location.search}#${hash}`;
  if (mode === "push") window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
  for (const listener of listeners) listener();
}

/**
 * The /platform/explore self-service explorer. The exploration lives in the
 * URL hash (`#metric=subjects_screened&by=study`), so every exploration has
 * an address to share. Each one runs in a Web Worker over the synthetic
 * portfolio; nothing is fetched, nothing is stored on a server and no
 * database is woken (ADR 0066).
 */
export function Explorer() {
  const hash = useSyncExternalStore(subscribe, clientHash, serverHash);
  const decoded = useMemo(
    () => (hash.replace(/^#/, "") === "" ? null : decodeExploration(hash)),
    [hash]
  );
  const exploration = decoded?.ok ? decoded.exploration : START;
  const key = encodeExploration(exploration);
  const [client] = useState(createExploreClient);
  const [answer, setAnswer] = useState<{
    key: string;
    result: ExplorationResult | null;
    error: string | null;
  } | null>(null);

  useEffect(() => () => client.dispose(), [client]);

  useEffect(() => {
    // An answer for an exploration the visitor has already changed is
    // dropped: the cleanup marks it stale before the next request goes.
    let live = true;
    client.explore(exploration).then(
      (result) => {
        if (live) setAnswer({ key, result, error: null });
      },
      (error: unknown) => {
        if (live) {
          setAnswer((previous) => ({
            key,
            result: previous?.result ?? null,
            error: error instanceof Error ? error.message : String(error),
          }));
        }
      }
    );
    return () => {
      live = false;
    };
    // `exploration` is memoized on the hash, so it changes with `key`.
  }, [client, exploration, key]);

  return (
    <ExplorerView
      exploration={exploration}
      result={answer?.result ?? null}
      busy={answer === null || answer.key !== key}
      error={answer?.key === key ? answer.error : null}
      linkError={decoded !== null && !decoded.ok ? decoded.error : null}
      hash={key}
      onChange={(next, mode) => writeHash(encodeExploration(next), mode)}
    />
  );
}
