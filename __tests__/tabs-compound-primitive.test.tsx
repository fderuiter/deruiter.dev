// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

describe("Compound Tabs Primitive System Suite", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    if (container.parentNode) {
      document.body.removeChild(container);
    }
  });

  it("renders tablist role with explicit aria-label and orientation", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <Tabs defaultValue="tab1">
          <TabsList aria-label="Test Tabs List">
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );
    });

    const tablist = container.querySelector('[role="tablist"]');
    expect(tablist).not.toBeNull();
    expect(tablist?.getAttribute("aria-label")).toBe("Test Tabs List");
    expect(tablist?.getAttribute("aria-orientation")).toBe("horizontal");
  });

  it("renders tab triggers with role='tab', aria-selected, roving tabIndex, and aria-controls", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <Tabs defaultValue="tab1" id="custom-test">
          <TabsList aria-label="Test Tabs">
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );
    });

    const triggers = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    );
    expect(triggers).toHaveLength(2);

    const [trigger1, trigger2] = triggers;

    expect(trigger1.id).toBe("custom-test-trigger-tab1");
    expect(trigger1.getAttribute("aria-controls")).toBe(
      "custom-test-content-tab1"
    );
    expect(trigger1.getAttribute("aria-selected")).toBe("true");
    expect(trigger1.tabIndex).toBe(0);

    expect(trigger2.id).toBe("custom-test-trigger-tab2");
    expect(trigger2.getAttribute("aria-controls")).toBe(
      "custom-test-content-tab2"
    );
    expect(trigger2.getAttribute("aria-selected")).toBe("false");
    expect(trigger2.tabIndex).toBe(-1);
  });

  it("renders tabpanel role with matching id, aria-labelledby, and tabIndex=0", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <Tabs defaultValue="tab1" id="custom-test">
          <TabsList aria-label="Test Tabs">
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );
    });

    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel).not.toBeNull();
    expect(panel?.id).toBe("custom-test-content-tab1");
    expect(panel?.getAttribute("aria-labelledby")).toBe(
      "custom-test-trigger-tab1"
    );
    expect(panel?.getAttribute("tabindex")).toBe("0");
    expect(panel?.textContent).toBe("Content 1");
  });

  it("handles keyboard navigation: ArrowRight / ArrowDown moves focus and selects next tab", async () => {
    const onValueChange = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <Tabs defaultValue="tab1" onValueChange={onValueChange}>
          <TabsList aria-label="Test Keyboard Navigation">
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
            <TabsTrigger value="tab3">Tab 3</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
          <TabsContent value="tab3">Content 3</TabsContent>
        </Tabs>
      );
    });

    const [t1, t2, t3] = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    );

    t1.focus();
    expect(document.activeElement).toBe(t1);

    // Press ArrowRight
    await act(async () => {
      t1.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
      );
    });

    expect(onValueChange).toHaveBeenCalledWith("tab2");
    expect(t2.getAttribute("aria-selected")).toBe("true");

    // Press ArrowDown
    await act(async () => {
      t2.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
      );
    });

    expect(onValueChange).toHaveBeenCalledWith("tab3");
    expect(t3.getAttribute("aria-selected")).toBe("true");

    // Press ArrowRight on last tab (wraps to first)
    await act(async () => {
      t3.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
      );
    });

    expect(onValueChange).toHaveBeenCalledWith("tab1");
    expect(t1.getAttribute("aria-selected")).toBe("true");
  });

  it("handles keyboard navigation: ArrowLeft / ArrowUp moves focus and selects previous tab", async () => {
    const onValueChange = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <Tabs defaultValue="tab1" onValueChange={onValueChange}>
          <TabsList aria-label="Test Keyboard Navigation">
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
            <TabsTrigger value="tab3">Tab 3</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
          <TabsContent value="tab3">Content 3</TabsContent>
        </Tabs>
      );
    });

    const [t1, t2, t3] = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    );

    t1.focus();

    // ArrowLeft on first tab wraps to last tab
    await act(async () => {
      t1.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
      );
    });

    expect(onValueChange).toHaveBeenCalledWith("tab3");
    expect(t3.getAttribute("aria-selected")).toBe("true");

    // ArrowUp on tab3 moves to tab2
    await act(async () => {
      t3.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true })
      );
    });

    expect(onValueChange).toHaveBeenCalledWith("tab2");
    expect(t2.getAttribute("aria-selected")).toBe("true");
  });

  it("handles Home and End keys for rapid navigation", async () => {
    const onValueChange = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <Tabs defaultValue="tab2" onValueChange={onValueChange}>
          <TabsList aria-label="Test Home/End">
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
            <TabsTrigger value="tab3">Tab 3</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
          <TabsContent value="tab3">Content 3</TabsContent>
        </Tabs>
      );
    });

    const [t1, t2, t3] = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    );

    t2.focus();

    // Press End -> tab3
    await act(async () => {
      t2.dispatchEvent(
        new KeyboardEvent("keydown", { key: "End", bubbles: true })
      );
    });

    expect(onValueChange).toHaveBeenCalledWith("tab3");
    expect(t3.getAttribute("aria-selected")).toBe("true");

    // Press Home -> tab1
    await act(async () => {
      t3.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Home", bubbles: true })
      );
    });

    expect(onValueChange).toHaveBeenCalledWith("tab1");
    expect(t1.getAttribute("aria-selected")).toBe("true");
  });

  it("supports controlled component state", async () => {
    function ControlledTest() {
      const [active, setActive] = useState("a");
      return (
        <Tabs value={active} onValueChange={setActive}>
          <TabsList aria-label="Controlled Tabs">
            <TabsTrigger value="a">A</TabsTrigger>
            <TabsTrigger value="b">B</TabsTrigger>
          </TabsList>
          <TabsContent value="a">Panel A</TabsContent>
          <TabsContent value="b">Panel B</TabsContent>
        </Tabs>
      );
    }

    await act(async () => {
      root = createRoot(container);
      root.render(<ControlledTest />);
    });

    const [trigA, trigB] = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    );

    expect(trigA.getAttribute("aria-selected")).toBe("true");
    expect(container.querySelector('[role="tabpanel"]')?.textContent).toBe(
      "Panel A"
    );

    await act(async () => {
      trigB.click();
    });

    expect(trigB.getAttribute("aria-selected")).toBe("true");
    expect(
      Array.from(container.querySelectorAll('[role="tabpanel"]')).find(
        (p) => !p.hasAttribute("hidden")
      )?.textContent
    ).toBe("Panel B");
  });

  it("renders tabpanel DOM nodes for inactive TabsContent to satisfy aria-controls DOM presence", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <Tabs defaultValue="tab1" id="dom-presence">
          <TabsList aria-label="Presence Test">
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      );
    });

    const panels = Array.from(
      container.querySelectorAll<HTMLDivElement>('[role="tabpanel"]')
    );
    expect(panels).toHaveLength(2);

    const [panel1, panel2] = panels;
    expect(panel1.id).toBe("dom-presence-content-tab1");
    expect(panel1.hasAttribute("hidden")).toBe(false);
    expect(panel1.style.display).toBe("");

    expect(panel2.id).toBe("dom-presence-content-tab2");
    expect(panel2.hasAttribute("hidden")).toBe(true);
    expect(panel2.style.display).toBe("none");

    // Both triggers should reference existing panel elements in the DOM
    expect(document.getElementById("dom-presence-content-tab1")).not.toBeNull();
    expect(document.getElementById("dom-presence-content-tab2")).not.toBeNull();
  });

  it("omits aria-controls on TabsTrigger when no matching TabsContent panel is registered", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <Tabs defaultValue="mode1">
          <TabsList aria-label="Mode Switcher">
            <TabsTrigger value="mode1">Mode 1</TabsTrigger>
            <TabsTrigger value="mode2">Mode 2</TabsTrigger>
          </TabsList>
        </Tabs>
      );
    });

    const triggers = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    );
    expect(triggers[0].getAttribute("aria-controls")).toBeNull();
    expect(triggers[1].getAttribute("aria-controls")).toBeNull();
  });

  it("allows explicit aria-controls prop override on TabsTrigger", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <Tabs defaultValue="custom">
          <TabsList aria-label="Custom Controls">
            <TabsTrigger value="custom" aria-controls="external-panel">
              Custom Trigger
            </TabsTrigger>
          </TabsList>
        </Tabs>
      );
    });

    const trigger = container.querySelector<HTMLButtonElement>('[role="tab"]');
    expect(trigger?.getAttribute("aria-controls")).toBe("external-panel");
  });
});
