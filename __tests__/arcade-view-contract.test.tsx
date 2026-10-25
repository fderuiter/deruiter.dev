// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { PlayCabinet } from "@/components/arcade/PlayCabinet";
import {
  ArcadeSessionProvider,
  createArcadeStore,
  defineGameViews,
  useArcadeSession,
  usePrefetchViews,
  useSessionFrame,
  useSessionSelector,
  type ArcadeSession,
  type FramePainter,
  type GameViewLoader,
  type GameViews,
} from "@/components/arcade/views";
import { CounterSessionHolder } from "./fixtures/three-view-game/session";

const announce = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce }),
}));

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    volume: 0.3,
    muted: false,
  }),
}));

const loadDesktop = vi.fn<GameViewLoader>(
  () => import("./fixtures/three-view-game/DesktopView")
);
const loadTablet = vi.fn<GameViewLoader>(
  () => import("./fixtures/three-view-game/TabletView")
);
const loadPhone = vi.fn<GameViewLoader>(
  () => import("./fixtures/three-view-game/PhoneView")
);

const fixtureViews = defineGameViews({
  session: CounterSessionHolder,
  desktop: loadDesktop,
  tablet: loadTablet,
  phone: loadPhone,
});

function setWindow(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: height,
  });
}

async function flush() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function launch() {
  const button = screen.getByRole("button", { name: /Launch Cabinet/i });
  await act(async () => {
    fireEvent.mouseEnter(button);
    await Promise.resolve();
  });
  await act(async () => {
    fireEvent.click(button);
    await Promise.resolve();
  });
  act(() => {
    vi.advanceTimersByTime(2000);
  });
  vi.useRealTimers();
  await flush();
}

function cabinetRoot(): HTMLElement {
  const root = document.querySelector<HTMLElement>("[data-arcade-cabinet]");
  if (!root) throw new Error("no cabinet");
  return root;
}

describe("view contract (#2355)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    loadDesktop.mockClear();
    loadTablet.mockClear();
    loadPhone.mockClear();
    window.history.replaceState(null, "", "/");
    setWindow(1280, 800);
    // jsdom lays nothing out, so the cabinet reads the window size.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/");
  });

  function renderCabinet(
    onAutoPause = vi.fn(),
    views: GameViews = fixtureViews
  ) {
    render(
      <PlayCabinet
        gameId="fixture"
        title="Fixture Game"
        icon={<span>F</span>}
        instructions="Count."
        controls={[{ key: "Space", action: "Add one" }]}
        importComponent={() => Promise.resolve({})}
        views={views}
        onAutoPause={onAutoPause}
      />
    );
    return onAutoPause;
  }

  async function resizeTo(width: number, height: number) {
    await act(async () => {
      setWindow(width, height);
      window.dispatchEvent(new Event("resize"));
    });
    await flush();
  }

  it("mounts the desktop view only, and loads only its chunk", async () => {
    renderCabinet();
    await launch();
    expect(await screen.findByText("Desktop view: 0")).toBeTruthy();
    expect(cabinetRoot().getAttribute("data-view")).toBe("desktop");
    expect(loadDesktop).toHaveBeenCalled();
    expect(loadTablet).not.toHaveBeenCalled();
    expect(loadPhone).not.toHaveBeenCalled();
  });

  it("swaps views live, keeps the session and pauses first", async () => {
    const onAutoPause = renderCabinet();
    await launch();
    fireEvent.click(screen.getByRole("button", { name: "Add one" }));
    fireEvent.click(screen.getByRole("button", { name: "Add one" }));
    expect(await screen.findByText("Desktop view: 2")).toBeTruthy();

    await act(async () => {
      setWindow(390, 844);
      window.dispatchEvent(new Event("resize"));
    });
    await flush();

    expect(await screen.findByText("Phone view: 2")).toBeTruthy();
    expect(screen.queryByText(/Desktop view/)).toBeNull();
    expect(cabinetRoot().getAttribute("data-view")).toBe("phone");
    expect(loadPhone).toHaveBeenCalled();
    expect(onAutoPause).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith("phone layout");
  });

  it("keeps the old view when a swap's chunk fails, and tries again", async () => {
    const phone = vi
      .fn<GameViewLoader>()
      .mockRejectedValueOnce(new Error("chunk failed"))
      .mockImplementation(() => import("./fixtures/three-view-game/PhoneView"));
    const views = defineGameViews({
      session: CounterSessionHolder,
      desktop: loadDesktop,
      tablet: loadTablet,
      phone,
    });
    renderCabinet(vi.fn(), views);
    await launch();
    fireEvent.click(await screen.findByRole("button", { name: "Add one" }));

    await resizeTo(390, 844);
    expect(screen.getByText("Desktop view: 1")).toBeTruthy();
    expect(cabinetRoot().getAttribute("data-view")).toBe("desktop");
    expect(screen.getByTestId("view-swap-toast").textContent).toMatch(
      /The phone layout did not load/
    );
    expect(announce).toHaveBeenCalledWith(
      expect.stringMatching(/The phone layout did not load/)
    );

    // The next crossing tries again, and this time the chunk loads.
    await resizeTo(1280, 800);
    await resizeTo(390, 844);
    expect(await screen.findByText("Phone view: 1")).toBeTruthy();
    expect(screen.queryByText(/did not load/)).toBeNull();
  });

  it("offers Retry and the next larger view when the first view fails", async () => {
    window.history.replaceState(null, "", "/?view=phone");
    const phone = vi
      .fn<GameViewLoader>()
      .mockRejectedValueOnce(new Error("chunk failed"))
      .mockRejectedValueOnce(new Error("chunk failed"))
      .mockImplementation(() => import("./fixtures/three-view-game/PhoneView"));
    const views = defineGameViews({
      session: CounterSessionHolder,
      desktop: loadDesktop,
      tablet: loadTablet,
      phone,
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    renderCabinet(vi.fn(), views);
    await launch();

    expect(await screen.findByText(/This layout did not load/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await flush();
    expect(await screen.findByText(/This layout did not load/)).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Use the tablet layout" })
    );
    expect(await screen.findByText("Tablet view: 0")).toBeTruthy();
    expect(error).toHaveBeenCalled();
  });

  it("honours ?view=", async () => {
    window.history.replaceState(null, "", "/?view=tablet");
    renderCabinet();
    await launch();
    expect(await screen.findByText("Tablet view: 0")).toBeTruthy();
    expect(cabinetRoot().getAttribute("data-view")).toBe("tablet");
  });

  // The picker read `env.NODE_ENV` from lib/env, which in the browser parses
  // an empty process.env and falls back to "development", so a production
  // build showed it (#2376). The inlined process.env.NODE_ENV is reliable.
  it("hides the dev view picker in a production build", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      renderCabinet();
      await launch();
      expect(screen.queryByRole("combobox")).toBeNull();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("loads no view before Launch", () => {
    renderCabinet();
    expect(document.querySelector("[data-view]")).toBeNull();
    expect(loadDesktop).not.toHaveBeenCalled();
  });

  it("leaves a cabinet without views on its children", async () => {
    render(
      <PlayCabinet
        gameId="plain"
        title="Plain Game"
        icon={<span>P</span>}
        instructions="Play."
        controls={[]}
        importComponent={() => Promise.resolve({})}
      >
        <div data-testid="plain-content">Plain</div>
      </PlayCabinet>
    );
    await launch();
    expect(screen.getByTestId("plain-content")).toBeTruthy();
    expect(cabinetRoot().hasAttribute("data-view")).toBe(false);
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});

describe("defineGameViews", () => {
  it("lets an unbuilt view borrow another, with no extra chunk", () => {
    const desktop = vi.fn<GameViewLoader>();
    const views = defineGameViews({
      desktop,
      tablet: "desktop",
      phone: "tablet",
    });
    expect(views.components.tablet).toBe(views.components.desktop);
    expect(views.components.phone).toBe(views.components.desktop);
    expect(views.resolved).toEqual({
      desktop: "desktop",
      tablet: "desktop",
      phone: "desktop",
    });
  });

  it("makes the tablet view the fallback for a phone view that borrows it", () => {
    const views = defineGameViews({
      desktop: vi.fn<GameViewLoader>(),
      tablet: "desktop",
      phone: vi.fn<GameViewLoader>(),
    });
    expect(views.loaders.tablet).toBe(views.loaders.desktop);
    expect(views.resolved.tablet).toBe("desktop");
  });

  it("throws when a view reads a session outside a provider", () => {
    function Bare() {
      useArcadeSession();
      return null;
    }
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Bare />)).toThrow(/ArcadeSessionProvider/);
  });
});

describe("session store", () => {
  afterEach(() => cleanup());

  type State = { readonly count: number; readonly label: string };
  type Intent = { readonly type: "add" } | { readonly type: "noop" };

  function makeStore() {
    return createArcadeStore<State, Intent>(
      { count: 0, label: "start" },
      (state, intent) =>
        intent.type === "add" ? { ...state, count: state.count + 1 } : state
    );
  }

  it("notifies only on a real change", () => {
    const store = makeStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.dispatch({ type: "noop" });
    expect(listener).not.toHaveBeenCalled();
    store.dispatch({ type: "add" });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getState().count).toBe(1);
    unsubscribe();
    store.dispatch({ type: "add" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("re-renders a selector only when its slice changes", () => {
    const store = makeStore();
    let labelRenders = 0;
    function Label() {
      labelRenders += 1;
      return <span>{useSessionSelector((s: State) => s.label)}</span>;
    }
    function Count() {
      return (
        <span data-testid="count">
          {useSessionSelector((s: State) => s.count)}
        </span>
      );
    }
    render(
      <ArcadeSessionProvider value={store}>
        <Label />
        <Count />
      </ArcadeSessionProvider>
    );
    const before = labelRenders;
    act(() => store.dispatch({ type: "add" }));
    expect(screen.getByTestId("count").textContent).toBe("1");
    expect(labelRenders).toBe(before);
  });

  it("keeps an equal slice with isEqual, so a new array does not re-render", () => {
    const store = makeStore();
    let renders = 0;
    function Pair() {
      renders += 1;
      const pair = useSessionSelector(
        (s: State) => [s.label, s.label.length] as const,
        (a, b) => a[0] === b[0] && a[1] === b[1]
      );
      return <span>{pair.join(":")}</span>;
    }
    render(
      <ArcadeSessionProvider value={store}>
        <Pair />
      </ArcadeSessionProvider>
    );
    const before = renders;
    act(() => store.dispatch({ type: "add" }));
    expect(renders).toBe(before);
    expect(screen.getByText("start:5")).toBeTruthy();
  });

  it("paints through onFrame while the view is mounted", () => {
    const painters = new Set<FramePainter>();
    const session: ArcadeSession<null, never> = {
      getState: () => null,
      subscribe: () => () => {},
      dispatch: () => {},
      onFrame(paint) {
        painters.add(paint);
        return () => {
          painters.delete(paint);
        };
      },
    };
    const paint = vi.fn();
    function Canvas() {
      useSessionFrame(paint);
      return null;
    }
    const { unmount } = render(
      <ArcadeSessionProvider value={session}>
        <Canvas />
      </ArcadeSessionProvider>
    );
    painters.forEach((p) => p(0.5));
    expect(paint).toHaveBeenCalledWith(0.5);
    unmount();
    expect(painters.size).toBe(0);
  });
});

describe("usePrefetchViews", () => {
  const originalMatchMedia = window.matchMedia;
  afterEach(() => {
    cleanup();
    window.matchMedia = originalMatchMedia;
  });

  function setCoarse(coarse: boolean) {
    window.matchMedia = vi.fn((query: string) => ({
      matches: query === "(pointer: coarse)" ? coarse : false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
  }

  function Prefetch({
    views,
    view,
  }: {
    views: GameViews;
    view: "phone" | "tablet" | "desktop";
  }) {
    usePrefetchViews(views, view);
    return null;
  }

  function makeViews() {
    const loaders = {
      desktop: vi.fn<GameViewLoader>(() => new Promise(() => {})),
      tablet: vi.fn<GameViewLoader>(() => new Promise(() => {})),
      phone: vi.fn<GameViewLoader>(() => new Promise(() => {})),
    };
    return { loaders, views: defineGameViews(loaders) };
  }

  async function idle() {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }

  it("lets an iPad load the phone view it can reach in Split View", async () => {
    setCoarse(true);
    const { loaders, views } = makeViews();
    render(<Prefetch views={views} view="tablet" />);
    await idle();
    expect(loaders.phone).toHaveBeenCalled();
    expect(loaders.desktop).not.toHaveBeenCalled();
  });

  it("loads nothing extra on a phone or a desktop", async () => {
    setCoarse(true);
    const phone = makeViews();
    render(<Prefetch views={phone.views} view="phone" />);
    setCoarse(false);
    const desktop = makeViews();
    render(<Prefetch views={desktop.views} view="desktop" />);
    await idle();
    for (const loader of [
      ...Object.values(phone.loaders),
      ...Object.values(desktop.loaders),
    ]) {
      expect(loader).not.toHaveBeenCalled();
    }
  });
});
