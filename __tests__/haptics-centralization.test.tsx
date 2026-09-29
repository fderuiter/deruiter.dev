// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const { mockTriggerHaptic } = vi.hoisted(() => ({
  mockTriggerHaptic: vi.fn(),
}));

vi.mock("@/lib/haptics", () => ({
  triggerHaptic: mockTriggerHaptic,
}));

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playClick: vi.fn(),
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
  }),
}));

import { VirtualDPad } from "@/components/ui/VirtualDPad";
import { VirtualGamepad } from "@/components/arcade/VirtualGamepad";

const vibrateSpy = vi.fn();

function dispatch(el: Element | null, type: string) {
  expect(el).not.toBeNull();
  act(() => {
    el?.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
  });
}

describe("Centralized haptics (#1130)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.defineProperty(navigator, "vibrate", {
      value: vibrateSpy,
      writable: true,
      configurable: true,
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockTriggerHaptic.mockClear();
    vibrateSpy.mockClear();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("VirtualDPad routes press feedback through triggerHaptic, not navigator.vibrate", () => {
    const onDirectionPress = vi.fn();
    const onActionAPress = vi.fn();
    act(() => {
      root.render(
        <VirtualDPad
          onDirectionPress={onDirectionPress}
          onActionAPress={onActionAPress}
          actionALabel="JUMP"
        />
      );
    });

    dispatch(
      container.querySelector('button[aria-label="Move Up"]'),
      "touchstart"
    );
    expect(onDirectionPress).toHaveBeenCalledWith("up");
    expect(mockTriggerHaptic).toHaveBeenCalledTimes(1);
    expect(mockTriggerHaptic).toHaveBeenCalledWith(15);

    dispatch(
      container.querySelector('button[aria-label="JUMP"]'),
      "touchstart"
    );
    expect(onActionAPress).toHaveBeenCalledTimes(1);
    expect(mockTriggerHaptic).toHaveBeenCalledTimes(2);

    expect(vibrateSpy).not.toHaveBeenCalled();
  });

  it("VirtualDPad release does not trigger haptics", () => {
    act(() => {
      root.render(<VirtualDPad onDirectionRelease={vi.fn()} />);
    });
    dispatch(
      container.querySelector('button[aria-label="Move Up"]'),
      "touchend"
    );
    expect(mockTriggerHaptic).not.toHaveBeenCalled();
  });

  it("VirtualGamepad direction and action presses trigger haptics; releases do not", () => {
    const onDirectionPress = vi.fn();
    const onDirectionRelease = vi.fn();
    const onActionAPress = vi.fn();
    const onActionARelease = vi.fn();
    const onActionBPress = vi.fn();
    const onActionBRelease = vi.fn();
    act(() => {
      root.render(
        <VirtualGamepad
          forceVisible
          onDirectionPress={onDirectionPress}
          onDirectionRelease={onDirectionRelease}
          onActionAPress={onActionAPress}
          onActionARelease={onActionARelease}
          onActionBPress={onActionBPress}
          onActionBRelease={onActionBRelease}
        />
      );
    });

    const left = container.querySelector('button[aria-label="Move Left"]');
    dispatch(left, "touchstart");
    expect(onDirectionPress).toHaveBeenCalledWith("left");
    expect(mockTriggerHaptic).toHaveBeenCalledTimes(1);
    expect(mockTriggerHaptic).toHaveBeenLastCalledWith(15);

    dispatch(left, "touchend");
    expect(onDirectionRelease).toHaveBeenCalledWith("left");
    expect(mockTriggerHaptic).toHaveBeenCalledTimes(1);

    const attack = container.querySelector('button[aria-label="Attack"]');
    dispatch(attack, "touchstart");
    expect(onActionAPress).toHaveBeenCalledTimes(1);
    expect(mockTriggerHaptic).toHaveBeenCalledTimes(2);
    dispatch(attack, "touchend");
    expect(onActionARelease).toHaveBeenCalledTimes(1);
    expect(mockTriggerHaptic).toHaveBeenCalledTimes(2);

    const potion = container.querySelector('button[aria-label="Potion"]');
    dispatch(potion, "touchstart");
    expect(onActionBPress).toHaveBeenCalledTimes(1);
    expect(mockTriggerHaptic).toHaveBeenCalledTimes(3);
    dispatch(potion, "touchend");
    expect(onActionBRelease).toHaveBeenCalledTimes(1);
    expect(mockTriggerHaptic).toHaveBeenCalledTimes(3);

    expect(vibrateSpy).not.toHaveBeenCalled();
  });
});

describe("ESLint navigator.vibrate restriction (#1130)", () => {
  const root = process.cwd();
  const source = "export const buzz = () => navigator.vibrate(15);\n";

  async function lintAs(relativePath: string) {
    const { ESLint } = await import("eslint");
    const eslint = new ESLint({ cwd: root });
    const [result] = await eslint.lintText(source, {
      filePath: path.join(root, relativePath),
    });
    return result.messages.filter(
      (m) => m.ruleId === "no-restricted-properties"
    );
  }

  it("flags direct navigator.vibrate access in application modules", async () => {
    const messages = await lintAs("components/ui/HapticProbe.tsx");
    expect(messages).toHaveLength(1);
    expect(messages[0].message).toContain("triggerHaptic");
  }, 60_000);

  it("allows navigator.vibrate inside lib/haptics.ts", async () => {
    const messages = await lintAs("lib/haptics.ts");
    expect(messages).toHaveLength(0);
  }, 60_000);
});
