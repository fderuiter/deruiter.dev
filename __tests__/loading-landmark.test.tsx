// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import RootLoading from "../app/loading";
import CaseStudyLoading from "../app/(desktop)/case-studies/[slug]/loading";

describe("Route loading skeletons: single main landmark", () => {
  afterEach(() => {
    cleanup();
  });

  it("root loading skeleton does not render its own <main> (it mounts inside the root layout's <main id=main-content>)", () => {
    const { container } = render(<RootLoading />);
    expect(container.querySelector("main")).toBeNull();
  });

  it("case-study loading skeleton does not render its own <main>", () => {
    const { container } = render(<CaseStudyLoading />);
    expect(container.querySelector("main")).toBeNull();
  });
});
