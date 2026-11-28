import fs from "node:fs";
import path from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { JourneyStepLabel } from "@/components/clinical-journey/JourneyStepLabel";
import { CLINICAL_JOURNEY } from "@/lib/clinical-journey";

afterEach(cleanup);

describe("JourneyStepLabel (#3143)", () => {
  it.each(CLINICAL_JOURNEY.map((step, index) => [step.href, index] as const))(
    "labels %s with its journey step number",
    (href, index) => {
      const { container } = render(
        <JourneyStepLabel path={href} fallback="unused" />
      );
      expect(container.textContent).toBe(
        `Step ${index + 1} of ${CLINICAL_JOURNEY.length}: ${CLINICAL_JOURNEY[index].stage}`
      );
    }
  );

  it("shows the plain fallback, with no number, off the journey", () => {
    const { container } = render(
      <JourneyStepLabel
        path="/clinical/standards"
        fallback="Standards evidence"
      />
    );
    expect(container.textContent).toBe("Standards evidence");
  });
});

describe("clinical page eyebrows (#3143)", () => {
  const root = process.cwd();
  const dirs = ["app/clinical", "app/study-data", "app/platform", "app/crf"];
  const pages = dirs.flatMap((dir) =>
    fs
      .readdirSync(path.join(root, dir), { recursive: true, encoding: "utf8" })
      .filter((file) => file.endsWith("page.tsx"))
      .map((file) => path.join(dir, file))
  );

  it("finds the clinical pages", () => {
    expect(pages.length).toBeGreaterThan(3);
  });

  it.each(pages)("%s uses no internal label or bare section index", (file) => {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    expect(source).not.toMatch(/Clinical systems \//);
    expect(source).not.toMatch(/Clinical · /);
    // An eyebrow such as "System flow / 02": words, a slash, a padded index.
    expect(source).not.toMatch(/^\s*[A-Z][A-Za-z ]+ \/ \d{2}\s*$/m);
  });
});
