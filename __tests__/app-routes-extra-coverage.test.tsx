// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import StackPage from "@/app/stack/page";
import ProofWorkspacePage from "@/app/proof/page";
import CRFStudioPage from "@/app/crf/page";
import NotFound from "@/app/not-found";
import OfflinePage from "@/app/offline/page";
import { SearchProvider } from "@/components/providers/SearchProvider";

// Mocks
vi.mock("next/dynamic", () => ({
  default: (
    _fn: () => Promise<unknown>,
    opts?: { loading?: () => React.ReactNode }
  ) => {
    const Component = () => {
      if (opts?.loading) {
        return <>{opts.loading()}</>;
      }
      return <div data-testid="dynamic-component">Mock Dynamic Component</div>;
    };
    return Component;
  },
}));

describe("app routes extra coverage suite", () => {
  it("renders StackPage", () => {
    const { container } = render(<StackPage />);
    expect(container).toBeTruthy();
  });

  it("renders ProofWorkspacePage", () => {
    const { container } = render(<ProofWorkspacePage />);
    expect(container).toBeTruthy();
  });

  it("renders CRFStudioPage", () => {
    const { container } = render(<CRFStudioPage />);
    expect(container).toBeTruthy();
    expect(screen.getByRole("heading", { name: "CRF Studio" })).toBeTruthy();
  });

  it("renders NotFound page", () => {
    const { container } = render(
      <SearchProvider>
        <NotFound />
      </SearchProvider>
    );
    expect(container).toBeTruthy();
  });

  it("renders OfflinePage", () => {
    const { container } = render(<OfflinePage />);
    expect(container).toBeTruthy();
  });
});
