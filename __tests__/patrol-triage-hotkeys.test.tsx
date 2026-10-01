// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import React, { useState } from "react";
import { render, screen, act, cleanup } from "@testing-library/react";
import { usePatrolTriageHotkeys } from "@/hooks/usePatrolTriageHotkeys";
import { SceneInteraction } from "@/components/patrol/SceneInteraction";
import { DispatchOverlay } from "@/components/patrol/DispatchOverlay";
import { ModalContainer } from "@/components/ui/ModalContainer";
import type { PatrolScenario } from "@/lib/patrol";

/** Dispatches a keydown event on window. */
function pressKey(key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

const mockScenarioWithActions: PatrolScenario = {
  id: "test-hotkeys-scenario",
  title: "Test Hotkeys Scenario",
  description: "Test scenario for keyboard triage hotkeys",
  difficulty: "beginner",
  location: "Test Hill",
  estimatedMinutes: 10,
  debriefRules: [],
  actions: [
    {
      id: "action-1",
      label: "Assess Scene Safety",
      description: "Ensure scene is safe from hazards.",
      category: "assessment",
    },
    {
      id: "action-2",
      label: "Primary Assessment",
      description: "Perform primary ABC assessment.",
      category: "assessment",
      preconditions: ["action-1"],
    },
    {
      id: "action-3",
      label: "ApplySAM Splint",
      description: "Apply SAM splint to leg fracture.",
      category: "treatment",
      preconditions: ["action-2"],
    },
  ],
};

describe("Patrol Triage Hotkeys Suite", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe("usePatrolTriageHotkeys Hook Unit Tests", () => {
    const TestComponent: React.FC<{
      items?: string[];
      phase?: string;
      onSelect?: (idx: number, item?: string) => void;
      onAdvance?: () => void;
      selectableMap?: boolean[];
    }> = ({
      items = ["A", "B", "C"],
      phase = "phase1",
      onSelect,
      onAdvance,
      selectableMap,
    }) => {
      const { focusedIndex, getHotkeyBadge, isFocused } =
        usePatrolTriageHotkeys({
          items,
          phase,
          isItemSelectable: (_item, idx) =>
            selectableMap ? selectableMap[idx] : true,
          onSelectItem: onSelect,
          onAdvancePhase: onAdvance,
        });

      return (
        <div>
          <div data-testid="focused-index">{focusedIndex}</div>
          {items.map((item, idx) => (
            <div
              key={item}
              data-testid={`item-${idx}`}
              data-focused={isFocused(idx)}
            >
              {item} - {getHotkeyBadge(idx)}
            </div>
          ))}
        </div>
      );
    };

    it("initializes focusedIndex to 0 and provides hotkey badges [1], [2], [3]", () => {
      render(<TestComponent />);
      expect(screen.getByTestId("focused-index").textContent).toBe("0");
      expect(screen.getByTestId("item-0").textContent).toContain("[1]");
      expect(screen.getByTestId("item-1").textContent).toContain("[2]");
      expect(screen.getByTestId("item-2").textContent).toContain("[3]");
    });

    it("navigates forward with j or ArrowDown and backward with k or ArrowUp", () => {
      render(<TestComponent />);
      expect(screen.getByTestId("focused-index").textContent).toBe("0");

      pressKey("j");
      expect(screen.getByTestId("focused-index").textContent).toBe("1");

      pressKey("j");
      expect(screen.getByTestId("focused-index").textContent).toBe("2");

      pressKey("k");
      expect(screen.getByTestId("focused-index").textContent).toBe("1");

      pressKey("ArrowDown");
      expect(screen.getByTestId("focused-index").textContent).toBe("2");

      pressKey("ArrowUp");
      expect(screen.getByTestId("focused-index").textContent).toBe("1");
    });

    it("triggers direct selection via numeric keys 1-9", () => {
      const handleSelect = vi.fn();
      render(<TestComponent onSelect={handleSelect} />);

      pressKey("2");
      expect(handleSelect).toHaveBeenCalledWith(1, "B");

      pressKey("1");
      expect(handleSelect).toHaveBeenCalledWith(0, "A");
    });

    it("resets focusedIndex to 0 when phase changes", () => {
      const { rerender } = render(<TestComponent phase="phase1" />);
      pressKey("j");
      expect(screen.getByTestId("focused-index").textContent).toBe("1");

      rerender(<TestComponent phase="phase2" />);
      expect(screen.getByTestId("focused-index").textContent).toBe("0");
    });

    it("skips non-selectable items during j/k navigation and direct numeric keypresses", () => {
      const handleSelect = vi.fn();
      // B (index 1) is not selectable
      render(
        <TestComponent
          onSelect={handleSelect}
          selectableMap={[true, false, true]}
        />
      );

      // Pressing j from 0 jumps over 1 to 2
      pressKey("j");
      expect(screen.getByTestId("focused-index").textContent).toBe("2");

      // Pressing numeric key 2 (index 1, disabled) is ignored
      pressKey("2");
      expect(handleSelect).not.toHaveBeenCalledWith(1, "B");

      // Pressing numeric key 3 (index 2, selectable) calls onSelect
      pressKey("3");
      expect(handleSelect).toHaveBeenCalledWith(2, "C");
    });
  });

  describe("SceneInteraction Integration Tests", () => {
    it("renders hotkey badges and highlights focused action card", () => {
      const handleExecute = vi.fn();
      const handleTransport = vi.fn();

      render(
        <SceneInteraction
          scenario={mockScenarioWithActions}
          actionHistory={[]}
          onExecuteAction={handleExecute}
          onPrepareTransport={handleTransport}
        />
      );

      expect(
        screen.getByTestId("action-hotkey-badge-action-1").textContent
      ).toBe("[1]");

      // Action 2 is locked (unmet precondition action-1), so it should not have an active hotkey badge
      expect(screen.queryByTestId("action-hotkey-badge-action-2")).toBeNull();
    });

    it("pressing numeric key 1 executes the first available action card", () => {
      const handleExecute = vi.fn();
      const handleTransport = vi.fn();

      render(
        <SceneInteraction
          scenario={mockScenarioWithActions}
          actionHistory={[]}
          onExecuteAction={handleExecute}
          onPrepareTransport={handleTransport}
        />
      );

      pressKey("1");
      expect(handleExecute).toHaveBeenCalledWith(
        expect.objectContaining({ id: "action-1" })
      );
    });

    it("skips locked actions with unmet preconditions when pressing numeric key 2", () => {
      const handleExecute = vi.fn();
      const handleTransport = vi.fn();

      render(
        <SceneInteraction
          scenario={mockScenarioWithActions}
          actionHistory={[]}
          onExecuteAction={handleExecute}
          onPrepareTransport={handleTransport}
        />
      );

      // Action 2 requires Action 1 and is locked
      pressKey("2");
      expect(handleExecute).not.toHaveBeenCalled();
    });
  });

  describe("DispatchOverlay Integration Tests", () => {
    it("renders hotkey badge and acknowledges dispatch via Enter or numeric key 1", () => {
      const handleAcknowledge = vi.fn();

      render(
        <DispatchOverlay
          scenario={mockScenarioWithActions}
          onAcknowledge={handleAcknowledge}
        />
      );

      expect(screen.getByTestId("dispatch-hotkey-badge").textContent).toBe(
        "[1]"
      );

      pressKey("Enter");
      expect(handleAcknowledge).toHaveBeenCalledTimes(1);

      pressKey("1");
      expect(handleAcknowledge).toHaveBeenCalledTimes(2);
    });
  });

  describe("Input Field and Focus Trap Suppression Tests", () => {
    it("suppresses hotkeys when focused inside an input or textarea element", () => {
      const handleSelect = vi.fn();

      render(
        <div>
          <input data-testid="test-input" type="text" />
          <SceneInteraction
            scenario={mockScenarioWithActions}
            actionHistory={[]}
            onExecuteAction={handleSelect}
            onPrepareTransport={vi.fn()}
          />
        </div>
      );

      const input = screen.getByTestId("test-input");
      input.focus();

      // Dispatch keydown directly on the input element
      const event = new KeyboardEvent("keydown", {
        key: "1",
        bubbles: true,
        cancelable: true,
      });
      input.dispatchEvent(event);

      expect(handleSelect).not.toHaveBeenCalled();
    });

    it("suppresses hotkeys when a modal with focus trap is open", () => {
      const handleSelect = vi.fn();

      const ModalContainerWrapper = () => {
        const [open, setOpen] = useState(true);
        return (
          <div>
            <ModalContainer
              isOpen={open}
              onClose={() => setOpen(false)}
              titleId="test-modal-title"
            >
              <div id="test-modal-title">Test Modal Title</div>
              <button type="button" onClick={() => setOpen(false)}>
                Close Modal
              </button>
            </ModalContainer>

            <SceneInteraction
              scenario={mockScenarioWithActions}
              actionHistory={[]}
              onExecuteAction={handleSelect}
              onPrepareTransport={vi.fn()}
            />
          </div>
        );
      };

      render(<ModalContainerWrapper />);

      pressKey("1");
      expect(handleSelect).not.toHaveBeenCalled();
    });
  });
});
