import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, act, cleanup } from "@testing-library/react";
import {
  useStudioHashParams,
  writeHashParams,
} from "@/hooks/useStudioHashParams";

function TestConsumer() {
  const { params, getParam, setParam, setParams } = useStudioHashParams();

  return (
    <div>
      <span data-testid="mode-val">{getParam("mode", "default-mode")}</span>
      <span data-testid="form-val">{getParam("form", "none")}</span>
      <span data-testid="field-val">{getParam("field", "none")}</span>
      <span data-testid="raw-params">{JSON.stringify(params)}</span>

      <button onClick={() => setParam("mode", "rules", { replace: false })}>
        Set Mode Rules (Push)
      </button>

      <button onClick={() => setParam("form", "ae", { replace: true })}>
        Set Form AE (Replace)
      </button>

      <button
        onClick={() =>
          setParams(
            { mode: "matrix", form: "cm", field: null },
            { replace: true }
          )
        }
      >
        Batch Set (Replace)
      </button>

      <button onClick={() => setParam("form", null, { replace: true })}>
        Clear Form
      </button>
    </div>
  );
}

describe("useStudioHashParams External Store & State Synchronization", () => {
  beforeEach(() => {
    window.location.hash = "";
    cleanup();
  });

  afterEach(() => {
    window.location.hash = "";
    cleanup();
  });

  it("reads initial parameters from window.location.hash", () => {
    window.location.hash = "#mode=rules&form=dm";

    render(<TestConsumer />);

    expect(screen.getByTestId("mode-val").textContent).toBe("rules");
    expect(screen.getByTestId("form-val").textContent).toBe("dm");
    expect(screen.getByTestId("field-val").textContent).toBe("none");
  });

  it("updates parameters and modifies window.location.hash with pushState", () => {
    render(<TestConsumer />);

    expect(screen.getByTestId("mode-val").textContent).toBe("default-mode");

    const pushBtn = screen.getByRole("button", {
      name: "Set Mode Rules (Push)",
    });
    act(() => {
      pushBtn.click();
    });

    expect(screen.getByTestId("mode-val").textContent).toBe("rules");
    expect(window.location.hash).toBe("#mode=rules");
  });

  it("updates parameters in place with replaceState", () => {
    window.location.hash = "#mode=rules";
    render(<TestConsumer />);

    const replaceBtn = screen.getByRole("button", {
      name: "Set Form AE (Replace)",
    });
    act(() => {
      replaceBtn.click();
    });

    expect(screen.getByTestId("form-val").textContent).toBe("ae");
    expect(window.location.hash).toBe("#mode=rules&form=ae");
  });

  it("supports batch updates and deletion of null parameters", () => {
    window.location.hash = "#mode=rules&form=ae&field=f_1";
    render(<TestConsumer />);

    const batchBtn = screen.getByRole("button", {
      name: "Batch Set (Replace)",
    });
    act(() => {
      batchBtn.click();
    });

    expect(screen.getByTestId("mode-val").textContent).toBe("matrix");
    expect(screen.getByTestId("form-val").textContent).toBe("cm");
    expect(screen.getByTestId("field-val").textContent).toBe("none");
    expect(window.location.hash).toBe("#mode=matrix&form=cm");
  });

  it("clears parameter when set to null", () => {
    window.location.hash = "#mode=rules&form=ae";
    render(<TestConsumer />);

    const clearBtn = screen.getByRole("button", { name: "Clear Form" });
    act(() => {
      clearBtn.click();
    });

    expect(screen.getByTestId("form-val").textContent).toBe("none");
    expect(window.location.hash).toBe("#mode=rules");
  });

  it("reacts synchronously to browser hashchange events", () => {
    render(<TestConsumer />);

    expect(screen.getByTestId("mode-val").textContent).toBe("default-mode");

    act(() => {
      window.location.hash = "#mode=edc&form=vs";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(screen.getByTestId("mode-val").textContent).toBe("edc");
    expect(screen.getByTestId("form-val").textContent).toBe("vs");
  });

  it("handles writeHashParams directly with push and replace semantics", () => {
    window.location.hash = "";
    writeHashParams(
      { theorem: "quorum-overlap", tab: "systems" },
      { replace: false }
    );
    expect(window.location.hash).toBe("#theorem=quorum-overlap&tab=systems");

    writeHashParams({ inspect: "N2" }, { replace: true });
    expect(window.location.hash).toBe(
      "#theorem=quorum-overlap&tab=systems&inspect=N2"
    );

    writeHashParams({ tab: null, inspect: null }, { replace: true });
    expect(window.location.hash).toBe("#theorem=quorum-overlap");
  });

  it("handles neuro studio hash serialization properly", () => {
    window.location.hash = "";
    writeHashParams(
      {
        scenario: "wm_hypointensity",
        view: "3d",
        dataset: "mni152",
        tool: "paint",
      },
      { replace: false }
    );
    expect(window.location.hash).toBe(
      "#scenario=wm_hypointensity&view=3d&dataset=mni152&tool=paint"
    );

    writeHashParams({ tool: null, view: null }, { replace: true });
    expect(window.location.hash).toBe(
      "#scenario=wm_hypointensity&dataset=mni152"
    );
  });
});
