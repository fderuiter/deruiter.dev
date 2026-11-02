/**
 * Regenerates the seed-301 reviewer guide golden that
 * __tests__/study-data-reviewer-guides.test.ts compares against: both
 * guides of DEMO-301, seed 301, 90 subjects, with the ARS reporting event,
 * formatted as Prettier formats the committed file.
 *
 *   npx tsx scripts/study-data-guides-golden.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as prettier from "prettier";
import {
  DEMO_301_STUDY,
  buildReviewerGuides,
  buildTlfOutputs,
  runPipeline,
} from "../lib/study-data";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GOLDEN = "__tests__/fixtures/study-data/guides/seed-301.json";

async function main(): Promise<void> {
  const run = runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 90 });
  const { reportingEvent } = buildTlfOutputs(DEMO_301_STUDY, run);
  const file = path.join(ROOT, GOLDEN);
  const options = (await prettier.resolveConfig(file)) ?? {};
  fs.writeFileSync(
    file,
    await prettier.format(
      JSON.stringify(buildReviewerGuides(run, reportingEvent), null, 2),
      { ...options, filepath: file }
    )
  );
  console.log(`Wrote ${GOLDEN}`);
}

void main();
