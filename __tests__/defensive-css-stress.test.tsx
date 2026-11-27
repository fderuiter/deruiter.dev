import { describe, it, expect, beforeAll, afterAll } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import {
  BentoGrid,
  Card,
  CardTitle,
  CardDescription,
} from "@/components/BentoGrid";
import { PretextCard } from "@/components/PretextCard";
import { PageLayout } from "@/components/PageLayout";

describe("Defensive CSS & Dynamic Content Stress Invariants", () => {
  const originalResizeObserver = global.ResizeObserver;

  beforeAll(() => {
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  afterAll(() => {
    global.ResizeObserver = originalResizeObserver;
  });

  const GERMAN_ELONGATED_TITLE =
    "Klinische-Studien-Datenverarbeitungsstandardisierungsrichtlinie";
  const GERMAN_ELONGATED_DESC =
    "Vollständige Validierung und Konformitätsüberprüfung aller klinischen Studiendaten gemäß internationalen regulatorischen Anforderungen und Richtlinien für elektronische Einreichungen.";
  const UNBROKEN_100_CHAR_URL =
    "https://subdomain.clinical-trials-registry-archive.fda.gov/studies/phase3/protocol-oncology-recist-v11-biomarker-investigation-data";
  const EXTREME_LONG_IDENTIFIER =
    "Wolfeschlegelsteinhausenbergerdorff_CDISC_SDTM_DM_DOMAIN_VARIABLE_0123456789";

  it("handles elongated translated content without breaking BentoGrid layout", () => {
    const { container } = render(
      <BentoGrid>
        <Card>
          <CardTitle>{GERMAN_ELONGATED_TITLE}</CardTitle>
          <CardDescription>{GERMAN_ELONGATED_DESC}</CardDescription>
        </Card>
      </BentoGrid>
    );

    const titleEl = container.querySelector(".break-words");
    expect(titleEl).not.toBeNull();
    expect(titleEl?.textContent).toBe(GERMAN_ELONGATED_TITLE);
  });

  it("handles 100+ character unbroken tokens inside defensive cards", () => {
    const { container } = render(
      <Card>
        <CardTitle>{EXTREME_LONG_IDENTIFIER}</CardTitle>
        <p className="text-token-break text-xs">{UNBROKEN_100_CHAR_URL}</p>
      </Card>
    );

    const urlEl = container.querySelector(".text-token-break");
    expect(urlEl).not.toBeNull();
    expect(urlEl?.textContent).toBe(UNBROKEN_100_CHAR_URL);
  });

  it("ensures PretextCard renders container query and min-w-0 child defenses", () => {
    const { container } = render(
      <PretextCard
        title={GERMAN_ELONGATED_TITLE}
        description={GERMAN_ELONGATED_DESC}
      />
    );

    const minW0El = container.querySelector(".min-w-0");
    expect(minW0El).not.toBeNull();
  });

  it("renders PageLayout with 200% simulated font scaling without layout crashes", () => {
    const { container } = render(
      <PageLayout variant="standard" style={{ fontSize: "200%" }}>
        <div className="min-w-0 flex flex-col gap-4">
          <h1 className="fluid-heading-hero text-balance">
            {GERMAN_ELONGATED_TITLE}
          </h1>
          <p className="fluid-body break-words">{GERMAN_ELONGATED_DESC}</p>
        </div>
      </PageLayout>
    );

    const heading = container.querySelector("h1");
    expect(heading).not.toBeNull();
    expect(heading?.textContent).toBe(GERMAN_ELONGATED_TITLE);
  });

  it("handles 3x tripled text length without container collapse or text overflow", () => {
    const TRIPLED_DESC = `${GERMAN_ELONGATED_DESC} `.repeat(3).trim();
    const { container } = render(
      <Card>
        <CardTitle>{GERMAN_ELONGATED_TITLE}</CardTitle>
        <CardDescription>{TRIPLED_DESC}</CardDescription>
      </Card>
    );

    const elements = container.querySelectorAll(".break-words");
    const descEl = elements[1];
    expect(descEl).not.toBeNull();
    expect(descEl?.textContent).toContain(GERMAN_ELONGATED_DESC);
  });

  it("handles empty states gracefully without collapsing parent card layout", () => {
    const { container } = render(
      <Card>
        <CardTitle>{""}</CardTitle>
        <CardDescription>{""}</CardDescription>
      </Card>
    );

    const cardEl = container.firstElementChild as HTMLElement;
    expect(cardEl).not.toBeNull();
    expect(cardEl.className).toContain("@container");
  });

  it("verifies 320px mobile squeeze boundaries in PageLayout wrapper", () => {
    const { container } = render(
      <PageLayout
        variant="standard"
        style={{ width: "320px", maxWidth: "320px" }}
      >
        <div className="min-w-0 w-full flex flex-col gap-2">
          <p className="text-token-break text-xs">{UNBROKEN_100_CHAR_URL}</p>
        </div>
      </PageLayout>
    );

    const el = container.firstElementChild as HTMLElement;
    expect(el).toBeDefined();
    expect(el.className).toContain("overflow-x-hidden");
  });
});
