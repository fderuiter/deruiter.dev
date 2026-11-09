import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import axe from "axe-core";
import {
  CLINICAL_GLOSSARY,
  getClinicalGlossaryEntry,
} from "@/lib/clinical-glossary";
import { GlossaryTerm } from "@/components/ui/GlossaryTerm";

// #3385: one shared list of clinical terms and the keyboard-first button
// that shows a definition. Wiring it into pages is #3194.
describe("clinical glossary data", () => {
  it("lists exactly the ten agreed terms", () => {
    expect(CLINICAL_GLOSSARY.map((entry) => entry.term).sort()).toEqual(
      [
        "ADaM",
        "CDASH",
        "CORE",
        "CRF",
        "Database Lock",
        "Define-XML",
        "Protocol amendment",
        "SDTM",
        "TLF",
        "USDM",
      ].sort()
    );
    expect(new Set(CLINICAL_GLOSSARY.map((entry) => entry.id)).size).toBe(10);
  });

  it.each(CLINICAL_GLOSSARY.map((entry) => [entry.term, entry] as const))(
    "defines %s in one plain sentence",
    (_, entry) => {
      const { definition } = entry;
      expect(definition.length).toBeGreaterThan(30);
      expect(definition.endsWith(".")).toBe(true);
      // One sentence: the only full stop is the last character.
      expect(definition.slice(0, -1)).not.toMatch(/[.!?]\s/);
    }
  );

  it("links a standard only where a public page exists, over https", () => {
    const unlinked = CLINICAL_GLOSSARY.filter((entry) => !entry.standard).map(
      (entry) => entry.id
    );
    expect(unlinked.sort()).toEqual(["database-lock", "protocol-amendment"]);
    for (const entry of CLINICAL_GLOSSARY) {
      if (entry.standard) {
        expect(entry.standard.url).toMatch(/^https:\/\//);
        expect(entry.standard.name.length).toBeGreaterThan(0);
      }
    }
  });

  it("looks a term up by its key", () => {
    expect(getClinicalGlossaryEntry("sdtm").term).toBe("SDTM");
  });
});

describe("GlossaryTerm", () => {
  afterEach(cleanup);

  it("starts closed, with the definition hidden from assistive technology", () => {
    render(<GlossaryTerm term="sdtm" />);
    const button = screen.getByRole("button", { name: "SDTM" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("is a native button, so Enter and Space toggle it", () => {
    // Browsers turn Enter and Space on a focused <button type="button"> into
    // a click; JSDOM does not, so the test pins the element and drives the
    // click that those keys produce.
    render(<GlossaryTerm term="sdtm" />);
    const button = screen.getByRole("button", { name: "SDTM" });
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");

    button.focus();
    expect(document.activeElement).toBe(button);

    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    const note = screen.getByRole("note");
    expect(button.getAttribute("aria-controls")).toBe(note.id);
    expect(note.textContent).toContain(
      getClinicalGlossaryEntry("sdtm").definition
    );

    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("closes on Escape and keeps focus on the term", () => {
    render(<GlossaryTerm term="adam" />);
    const button = screen.getByRole("button", { name: "ADaM" });
    button.focus();
    fireEvent.click(button);
    expect(screen.getByRole("note")).not.toBeNull();

    fireEvent.keyDown(button, { key: "Escape" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
  });

  it("links the standard in a new tab and says so", () => {
    render(<GlossaryTerm term="define-xml" />);
    fireEvent.click(screen.getByRole("button", { name: "Define-XML" }));
    const link = screen.getByRole("link", {
      name: "CDISC Define-XML (opens in a new tab)",
    });
    expect(link.getAttribute("href")).toBe(
      "https://www.cdisc.org/standards/data-exchange/define-xml"
    );
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("shows no link for a term without a public standard", () => {
    render(<GlossaryTerm term="database-lock" />);
    fireEvent.click(screen.getByRole("button", { name: "Database Lock" }));
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("can show other text, such as a plural, for the term", () => {
    render(<GlossaryTerm term="crf">CRFs</GlossaryTerm>);
    expect(screen.getByRole("button", { name: "CRFs" })).not.toBeNull();
  });
  it("has no axe violations open or closed", async () => {
    const { container } = render(
      <p>
        The pipeline maps collected data into <GlossaryTerm term="sdtm" />.
      </p>
    );
    const closed = await axe.run(container);
    expect(closed.violations).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "SDTM" }));
    const open = await axe.run(container);
    expect(open.violations).toEqual([]);
  });
});
