import fs from "fs";
import path from "path";
import { dictionary } from "../lib/i18n-dictionary";
import { FALLBACK_CASE_STUDIES } from "../lib/case-studies-data";
import { validateTermTags } from "../lib/term-compiler";

function extractStringsFromObject(obj: unknown): string[] {
  const result: string[] = [];
  function traverse(current: unknown) {
    if (typeof current === "string") {
      result.push(current);
    } else if (Array.isArray(current)) {
      for (const item of current) {
        traverse(item);
      }
    } else if (current && typeof current === "object") {
      for (const key of Object.keys(current)) {
        traverse((current as Record<string, unknown>)[key]);
      }
    }
  }
  traverse(obj);
  return result;
}

function extractSeedNarratives(fileContent: string): string[] {
  const narratives: string[] = [];
  const payloadsBlockMatch = fileContent.match(
    /const\s+SEED_PAYLOADS\s*=([\s\S]*?);\s*(?:async\s+)?function/
  );
  const blockToParse = payloadsBlockMatch ? payloadsBlockMatch[1] : fileContent;

  const fieldRegex =
    /(?:architectural_narrative|editorial_content)\s*:\s*([`"'])([\s\S]*?)\1/g;
  let match;
  while ((match = fieldRegex.exec(blockToParse)) !== null) {
    narratives.push(match[2]);
  }

  return narratives;
}

export function checkDictionaryDuplication(): string[] {
  const errors: string[] = [];

  const detailedTimelineStrings = new Set<string>();
  dictionary.detailed.timeline.forEach((item) => {
    if (item.professionalDescription)
      detailedTimelineStrings.add(item.professionalDescription.trim());
    if (item.realityDescription)
      detailedTimelineStrings.add(item.realityDescription.trim());
  });

  const detailedDomainStrings = new Set<string>();
  dictionary.detailed.domains.items.forEach((item) => {
    if (item.description) detailedDomainStrings.add(item.description.trim());
    if (item.tooltip) detailedDomainStrings.add(item.tooltip.trim());
  });

  dictionary.simplified.timeline.forEach((item, idx) => {
    if (detailedTimelineStrings.has(item.professionalDescription.trim())) {
      errors.push(
        `[lib/i18n-dictionary.ts] Simplified timeline item [index=${idx}].professionalDescription is duplicate of detailed timeline content: "${item.professionalDescription}"`
      );
    }
    if (detailedTimelineStrings.has(item.realityDescription.trim())) {
      errors.push(
        `[lib/i18n-dictionary.ts] Simplified timeline item [index=${idx}].realityDescription is duplicate of detailed timeline content: "${item.realityDescription}"`
      );
    }
  });

  dictionary.simplified.domains.items.forEach((item, idx) => {
    if (detailedDomainStrings.has(item.description.trim())) {
      errors.push(
        `[lib/i18n-dictionary.ts] Simplified domain item [index=${idx}].description is duplicate of detailed domain content: "${item.description}"`
      );
    }
    if (detailedDomainStrings.has(item.tooltip.trim())) {
      errors.push(
        `[lib/i18n-dictionary.ts] Simplified domain item [index=${idx}].tooltip is duplicate of detailed domain content: "${item.tooltip}"`
      );
    }
  });

  return errors;
}

export function runTerminologyVerification(): {
  success: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 1. Verify i18n-dictionary
  const dictionaryStrings = extractStringsFromObject(dictionary);
  dictionaryStrings.forEach((str, idx) => {
    if (
      str.includes("data-key") ||
      str.includes("data-term") ||
      str.includes("data-definition")
    ) {
      const res = validateTermTags(
        str,
        undefined,
        `lib/i18n-dictionary.ts[index=${idx}]`
      );
      if (!res.valid) {
        errors.push(...res.errors);
      }
    }
  });

  // 2. Verify FALLBACK_CASE_STUDIES
  FALLBACK_CASE_STUDIES.forEach((study) => {
    if (study.architectural_narrative) {
      const res = validateTermTags(
        study.architectural_narrative,
        undefined,
        `FALLBACK_CASE_STUDIES[slug=${study.slug}].architectural_narrative`
      );
      if (!res.valid) errors.push(...res.errors);
    }
    if (study.editorial_content) {
      const res = validateTermTags(
        study.editorial_content,
        undefined,
        `FALLBACK_CASE_STUDIES[slug=${study.slug}].editorial_content`
      );
      if (!res.valid) errors.push(...res.errors);
    }
  });

  // 3. Verify prisma/seed.ts
  const seedFilePath = path.resolve(process.cwd(), "prisma/seed.ts");
  if (fs.existsSync(seedFilePath)) {
    const seedFileContent = fs.readFileSync(seedFilePath, "utf-8");
    const seedNarratives = extractSeedNarratives(seedFileContent);
    seedNarratives.forEach((narrative, idx) => {
      const res = validateTermTags(
        narrative,
        undefined,
        `prisma/seed.ts[narrative_index=${idx}]`
      );
      if (!res.valid) errors.push(...res.errors);
    });
  }

  // 4. Verify non-duplication between detailed and simplified dictionary entries
  const duplicationErrors = checkDictionaryDuplication();
  if (duplicationErrors.length > 0) {
    errors.push(...duplicationErrors);
  }

  return {
    success: errors.length === 0,
    errors,
  };
}

if (
  require.main === module ||
  (typeof process !== "undefined" && process.argv[1]?.includes("verify-terms"))
) {
  console.log(
    "--- Verifying Terminology Glossary Keys & Tag Schema Integrity ---"
  );
  const result = runTerminologyVerification();

  if (!result.success) {
    console.error("\n❌ Terminology Build Verification Failed:");
    result.errors.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  } else {
    console.log("✔ 100% Terminology Tag Schema & Glossary Integrity Verified!");
    process.exit(0);
  }
}
