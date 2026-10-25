import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ClinicalJourneyHighlight } from "@/components/clinical-journey/ClinicalJourneyHighlight";
import { ClinicalJourneyNav } from "@/components/clinical-journey/ClinicalJourneyNav";
import { CLINICAL_JOURNEY, RELATED_GAMES } from "@/lib/clinical-journey";

afterEach(cleanup);

const LIVE = new Set([
  ...CLINICAL_JOURNEY.map((step) => step.href),
  ...RELATED_GAMES.map((game) => game.href),
]);

function internalLinks(container: HTMLElement): string[] {
  return [...container.querySelectorAll("a")]
    .map((link) => link.getAttribute("href") ?? "")
    .filter((href) => href.startsWith("/"));
}

describe("clinical journey navigation", () => {
  it("marks the current step and links the steps either side", () => {
    render(<ClinicalJourneyNav path="/study-data" />);
    const nav = screen.getByRole("navigation", {
      name: "Clinical data journey",
    });
    expect(within(nav).getByText(/step 3 of 5/)).toBeTruthy();
    const current = nav.querySelector('[aria-current="step"]');
    expect(current?.textContent).toBe(
      "3. Tabulate and analyse: Study Data Pipeline"
    );
    expect(
      within(nav)
        .getByRole("link", { name: "← Previous step: Protocol Drift" })
        .getAttribute("href")
    ).toBe("/protocol-drift");
    expect(
      within(nav)
        .getByRole("link", { name: "Next step: Clinical Data Platform →" })
        .getAttribute("href")
    ).toBe("/platform");
    expect(within(nav).getByText(/Evidence: Synthetic data\./)).toBeTruthy();
  });

  it("gives every link a name and only links pages that exist", () => {
    for (const path of [...LIVE, "/case-studies/crf-xl"]) {
      const { container, unmount } = render(<ClinicalJourneyNav path={path} />);
      for (const link of container.querySelectorAll("a"))
        expect(link.textContent?.trim().length, path).toBeGreaterThan(0);
      for (const href of internalLinks(container))
        expect(
          LIVE.has(href) || href.startsWith("/case-studies/"),
          `${path} links ${href}`
        ).toBe(true);
      unmount();
    }
  });

  it("starts with no previous step and ends with no next step", () => {
    const { unmount } = render(<ClinicalJourneyNav path="/crf" />);
    expect(screen.queryByText(/Previous step/)).toBeNull();
    expect(screen.getByText(/Next step: Protocol Drift/)).toBeTruthy();
    unmount();
    render(<ClinicalJourneyNav path="/case-studies/study-data-pipeline" />);
    expect(screen.queryByText(/Next step/)).toBeNull();
    expect(
      screen.getByRole("link", {
        name: "← Previous step: Clinical Data Platform",
      })
    ).toBeTruthy();
  });

  it("shows planned work as text with its issue, never as a site link", () => {
    render(<ClinicalJourneyNav path="/case-studies/study-data-pipeline" />);
    expect(
      screen.getByText(
        "Planned: Modernizing a clinical data platform: a case study"
      ).tagName
    ).toBe("SPAN");
    expect(
      screen.getByRole("link", { name: "issue #2647" }).getAttribute("href")
    ).toBe("https://github.com/fderuiter/deruiter.dev/issues/2647");
  });

  it("lists the related case studies of Fred's own projects on a step", () => {
    render(<ClinicalJourneyNav path="/crf" />);
    expect(
      screen
        .getByRole("link", { name: "CRF.xl case study" })
        .getAttribute("href")
    ).toBe("/case-studies/crf-xl");
    expect(screen.getAllByText(/Fred's own project/).length).toBe(2);
  });

  it("lists Clinical Trial Chaos on Protocol Drift, labelled a game", () => {
    render(<ClinicalJourneyNav path="/protocol-drift" />);
    expect(
      screen
        .getByRole("link", { name: "Clinical Trial Chaos" })
        .getAttribute("href")
    ).toBe("/arcade/clinical-chaos");
    expect(
      screen.getByText(/^\(Arcade game\): Sort clinical data/)
    ).toBeTruthy();
  });

  it("shows the game on its step only, not on other steps or case studies", () => {
    for (const path of [
      "/crf",
      "/study-data",
      "/case-studies/cadence-clinical",
    ]) {
      const { unmount } = render(<ClinicalJourneyNav path={path} />);
      expect(
        screen.queryByRole("link", { name: "Clinical Trial Chaos" }),
        path
      ).toBeNull();
      unmount();
    }
  });

  it("on a related case study, points to the demo for its step", () => {
    const { container } = render(
      <ClinicalJourneyNav path="/case-studies/clinical-data-mapper" />
    );
    expect(container.querySelector('[aria-current="step"]')).toBeNull();
    expect(screen.getByText(/related to step 3/)).toBeTruthy();
    expect(screen.getByText(/real code, not the synthetic demo/)).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Study Data Pipeline" })
        .getAttribute("href")
    ).toBe("/study-data");
    expect(
      screen.queryByRole("link", { name: /Clinical Data Mapper case study/ })
    ).toBeNull();
  });

  it("renders nothing off the journey", () => {
    const { container } = render(<ClinicalJourneyNav path="/neuro" />);
    expect(container.innerHTML).toBe("");
  });
});

describe("clinical journey highlight", () => {
  it("links every step and starts at CRF Studio, at the given heading level", () => {
    const { container } = render(<ClinicalJourneyHighlight headingLevel={2} />);
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Follow one study from form to portfolio.",
      })
    ).toBeTruthy();
    expect(internalLinks(container)).toEqual([
      ...CLINICAL_JOURNEY.map((step) => step.href),
      "/crf",
    ]);
    expect(
      screen.getByRole("link", { name: "Start the journey at CRF Studio" })
    ).toBeTruthy();
  });

  it("can sit under a section heading", () => {
    render(<ClinicalJourneyHighlight headingLevel={3} />);
    expect(screen.getByRole("heading", { level: 3 })).toBeTruthy();
  });
});
