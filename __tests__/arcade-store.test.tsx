// @vitest-environment jsdom
//
// #2371: createArcadeStore, the one store every arcade high score and save
// is read and written through, and the Meme Vault's move onto it.
import React from "react";
import { renderToString } from "react-dom/server";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ARCADE_CORRUPT_SUFFIX,
  createArcadeStore,
  onArcadeProgressNotice,
  type ArcadeProgressNotice,
  type ArcadeStore,
} from "@/lib/arcade";
import {
  MEME_STORAGE_KEYS,
  echoBestStore,
  getUnlockedAchievements,
  memeAchievementsStore,
  unlockAchievement,
} from "@/lib/meme-data";
import { getArcadeProgress, recordRun } from "@/lib/arcade-achievements";
import { onAppEvent } from "@/lib/event-bus";
import { safeStorage } from "@/lib/safe-storage";

class MockStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
}

const KEY = "arcade_store_test_best";
let keyCounter = 0;

/** A bare-integer best, like the games' own high-score keys. */
function bestStore(key: string): ArcadeStore<number> {
  return createArcadeStore<number>(key, {
    parse: (raw) => {
      if (!/^\d+$/.test(raw)) throw new TypeError("not a score");
      return Number.parseInt(raw, 10);
    },
    serialize: (value) => String(value),
    fallback: 0,
  });
}

function freshKey(): string {
  keyCounter += 1;
  return `${KEY}_${keyCounter}`;
}

function Best({ store }: { store: ArcadeStore<number> }) {
  return <p data-testid="best">{store.useValue()}</p>;
}

describe("createArcadeStore (#2371)", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MockStorage());
    safeStorage.clearCache();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    safeStorage.clearCache();
  });

  it("keeps the stored bytes exactly as the game wrote them", () => {
    const key = freshKey();
    localStorage.setItem(key, "1200");
    const store = bestStore(key);
    expect(store.get()).toBe(1200);
    expect(store.set(1500)).toBe(true);
    expect(localStorage.getItem(key)).toBe("1500");
  });

  it("returns the same snapshot while the stored text is unchanged", () => {
    const store = createArcadeStore<{ best: number }>(freshKey(), {
      parse: (raw) => JSON.parse(raw) as { best: number },
      serialize: (value) => JSON.stringify(value),
      fallback: { best: 0 },
    });
    store.set({ best: 3 });
    expect(store.get()).toBe(store.get());
    expect(store.get()).toEqual({ best: 3 });
  });

  it("updates a subscriber in the same tab on a write", () => {
    const store = bestStore(freshKey());
    render(<Best store={store} />);
    expect(screen.getByTestId("best").textContent).toBe("0");
    act(() => {
      store.set(42);
    });
    expect(screen.getByTestId("best").textContent).toBe("42");
  });

  it("fires one arcade_progress_changed event per write, naming the key", () => {
    const key = freshKey();
    const store = bestStore(key);
    const heard: string[] = [];
    const stop = onAppEvent("arcade_progress_changed", (d) =>
      heard.push(d.key)
    );
    store.set(7);
    stop();
    expect(heard).toEqual([key]);
  });

  it("updates a subscriber when another tab writes the key", () => {
    const key = freshKey();
    const store = bestStore(key);
    render(<Best store={store} />);
    act(() => {
      // Another tab's write lands in shared storage and fires `storage`.
      localStorage.setItem(key, "99");
      window.dispatchEvent(
        new StorageEvent("storage", { key, newValue: "99" })
      );
    });
    expect(screen.getByTestId("best").textContent).toBe("99");
  });

  it("ignores another tab's write to a different key", () => {
    const store = bestStore(freshKey());
    const onChange = vi.fn();
    const stop = store.subscribe(onChange);
    window.dispatchEvent(new StorageEvent("storage", { key: "unrelated" }));
    expect(onChange).not.toHaveBeenCalled();
    window.dispatchEvent(new StorageEvent("storage", { key: null }));
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
  });

  it("reads a damaged value as the fallback without throwing", () => {
    const key = freshKey();
    localStorage.setItem(key, "{not a score");
    const store = bestStore(key);
    expect(() => store.get()).not.toThrow();
    expect(store.get()).toBe(0);
    // Reading never writes: the damaged text is still there.
    expect(localStorage.getItem(key)).toBe("{not a score");
  });

  it("sets a damaged value aside under <key>:corrupt and tells the player once", () => {
    const key = freshKey();
    localStorage.setItem(key, "{not a score");
    const store = bestStore(key);
    const notices: ArcadeProgressNotice[] = [];
    const stop = onArcadeProgressNotice((n) => notices.push(n));
    expect(store.settle()).toBe(0);
    expect(localStorage.getItem(`${key}${ARCADE_CORRUPT_SUFFIX}`)).toBe(
      "{not a score"
    );
    expect(localStorage.getItem(key)).toBeNull();
    localStorage.setItem(key, "also broken");
    store.settle();
    stop();
    expect(notices).toEqual([
      { key, corruptKey: `${key}${ARCADE_CORRUPT_SUFFIX}` },
    ]);
  });

  it("never overwrites a damaged value without setting it aside", () => {
    const key = freshKey();
    localStorage.setItem(key, "garbage");
    const store = bestStore(key);
    store.set(10);
    expect(localStorage.getItem(`${key}${ARCADE_CORRUPT_SUFFIX}`)).toBe(
      "garbage"
    );
    expect(store.get()).toBe(10);
  });

  it("renders the fallback on the server", () => {
    const key = freshKey();
    localStorage.setItem(key, "500");
    const store = bestStore(key);
    const html = renderToString(<Best store={store} />);
    expect(html).toContain(">0<");
  });

  it("reads the fallback and writes nothing when localStorage is defective", () => {
    vi.stubGlobal("localStorage", { getItem: undefined, setItem: undefined });
    const store = createArcadeStore<number>(freshKey(), {
      parse: (raw) => Number(raw),
      serialize: String,
      fallback: 0,
      retainInMemory: false,
    });
    expect(store.get()).toBe(0);
    expect(store.set(5)).toBe(false);
    expect(store.get()).toBe(0);
  });

  it("does not throw when storage refuses the write", () => {
    vi.stubGlobal("localStorage", {
      ...new MockStorage(),
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {},
    });
    const store = bestStore(freshKey());
    expect(() => store.set(3)).not.toThrow();
  });
});

describe("Meme Vault on createArcadeStore (#2371)", () => {
  beforeEach(() => {
    localStorage.clear();
    safeStorage.clear();
  });

  afterEach(cleanup);

  it("keeps the trophy list and Echo best keys and bytes", () => {
    expect(memeAchievementsStore.key).toBe(MEME_STORAGE_KEYS.ACHIEVEMENTS);
    expect(echoBestStore.key).toBe(MEME_STORAGE_KEYS.ECHO_BEST);
    localStorage.setItem(
      MEME_STORAGE_KEYS.ACHIEVEMENTS,
      JSON.stringify(["konami"])
    );
    localStorage.setItem(MEME_STORAGE_KEYS.ECHO_BEST, "6");
    expect(getUnlockedAchievements()).toEqual(["konami"]);
    expect(echoBestStore.get()).toBe(6);
    expect(unlockAchievement("vault")).toBe(true);
    expect(localStorage.getItem(MEME_STORAGE_KEYS.ACHIEVEMENTS)).toBe(
      JSON.stringify(["konami", "vault"])
    );
  });

  it("records the vault score as a run with its view", () => {
    const heard: Array<Record<string, unknown> | undefined> = [];
    const stop = onAppEvent("arcade_score_updated", (d) =>
      heard.push(d.metadata)
    );
    unlockAchievement("konami");
    stop();
    expect(getArcadeProgress().highScores["meme-vault"]).toBe(100);
    expect(heard).toHaveLength(1);
    expect(heard[0]?.mode).toBe("trophies");
    expect(["phone", "tablet", "desktop"]).toContain(heard[0]?.view);
  });

  it("sets aside a trophy list that is not a list", () => {
    localStorage.setItem(MEME_STORAGE_KEYS.ACHIEVEMENTS, '{"a":1}');
    expect(getUnlockedAchievements()).toEqual([]);
    memeAchievementsStore.settle();
    expect(
      localStorage.getItem(
        `${MEME_STORAGE_KEYS.ACHIEVEMENTS}${ARCADE_CORRUPT_SUFFIX}`
      )
    ).toBe('{"a":1}');
  });
});

describe("recordRun (#2371)", () => {
  beforeEach(() => {
    localStorage.clear();
    safeStorage.clear();
  });

  it("keeps the best score and passes the view, mode and duration on", () => {
    const heard: Array<Record<string, unknown> | undefined> = [];
    const stop = onAppEvent("arcade_score_updated", (d) =>
      heard.push(d.metadata)
    );
    recordRun("laser-loon", {
      score: 600,
      view: "phone",
      mode: "campaign",
      durationMs: 1234,
    });
    recordRun("laser-loon", { score: 100, view: "desktop" });
    stop();
    expect(getArcadeProgress().highScores["laser-loon"]).toBe(600);
    expect(heard).toEqual([
      { view: "phone", mode: "campaign", durationMs: 1234 },
      { view: "desktop" },
    ]);
  });
});
