import { compileTerms } from "@/lib/term-compiler";
import type { CaseStudyData } from "./types";

/**
 * Compiles glossary term links and tooltips for a case study's content.
 *
 * Ensures that whenever a case study is imported, its editorial copy and
 * architectural narrative are fully compiled and render-ready (#3488).
 */
export function compileCaseStudy(study: CaseStudyData): CaseStudyData {
  return {
    ...study,
    editorial_content: compileTerms(study.editorial_content),
    architectural_narrative: compileTerms(study.architectural_narrative),
  };
}
