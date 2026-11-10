// @vitest-environment jsdom
/**
 * The plain-language start on /clinical (#3142): one sentence on what the
 * section is, and a "Start here" block with a single link to step 1.
 */
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ClinicalPage from "@/app/clinical/page";
import { CLINICAL_JOURNEY } from "@/lib/clinical-journey";

afterEach(cleanup);

const CDISC_TERMS = /\b(USDM|SDTM|ADaM|TLF|CRF|CORE|CDASH)\b/;

describe("/clinical start here (#3142)", () => {
  it("opens with one plain sentence and no unexplained CDISC term", () => {
    const { container } = render(<ClinicalPage />);
    const intro = container.querySelector("header h1 + p");
    expect(intro?.textContent).toMatch(/^This section follows one made-up/);
    expect(intro?.textContent).not.toMatch(CDISC_TERMS);
  });

  it("recommends exactly one first page: step 1 of the journey", () => {
    render(<ClinicalPage />);
    const block = screen.getByRole("complementary", { name: "Start here" });
    const links = block.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe(CLINICAL_JOURNEY[0].href);
    expect(links[0].textContent).toBe(
      `Open step 1: ${CLINICAL_JOURNEY[0].title}`
    );
  });
});
