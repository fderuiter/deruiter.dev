import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildReviewPackage,
  collectReviewPackageFindings,
  computeStudyChecksum,
  createReviewPackageSnapshot,
  openReviewPackage,
  parseUniversalCrf,
  previewReviewPackage,
  ReviewPackageBuildError,
  reviewPackageFilename,
  StudyProtocolEngine,
  zipReviewPackage,
  PK_ESCALATION_PRESET,
  type ReviewPackageArtifact,
  type ReviewPackageProgress,
  type StudyProtocol,
} from "@/lib/crf";
import { amend, baseStudy, reviewedStudy } from "./review-package-fixtures";

/**
 * #680: a review package is generated from one study snapshot, carries a
 * deterministic manifest, keeps open threads and stale-test labels, and its
 * native source reopens.
 */

const pdfFailure = vi.hoisted(() => ({ remaining: 0 }));

vi.mock("@/lib/crf/export-pdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/crf/export-pdf")>();
  return {
    ...actual,
    generateStudyPdf: async (
      ...args: Parameters<typeof actual.generateStudyPdf>
    ) => {
      if (pdfFailure.remaining > 0) {
        pdfFailure.remaining--;
        throw new Error("Synthetic renderer failure");
      }
      return actual.generateStudyPdf(...args);
    },
  };
});

const GENERATED_AT = "2026-10-01T09:00:00.000Z";
function textOf(artifacts: ReviewPackageArtifact[], id: string): string {
  const artifact = artifacts.find((a) => a.id === id);
  if (!artifact || typeof artifact.content !== "string") {
    throw new Error(`No text artifact ${id}`);
  }
  return artifact.content;
}

describe("[#680] review package builder", () => {
  beforeEach(() => {
    pdfFailure.remaining = 0;
  });

  it("produces the same manifest for the same snapshot", async () => {
    const study = reviewedStudy();
    const options = { generatedAt: GENERATED_AT };
    const first = await buildReviewPackage(
      createReviewPackageSnapshot(study),
      options
    );
    const second = await buildReviewPackage(
      createReviewPackageSnapshot(study),
      options
    );

    expect(JSON.stringify(first.manifest)).toBe(
      JSON.stringify(second.manifest)
    );
    expect(textOf(first.artifacts, "manifest")).toBe(
      textOf(second.artifacts, "manifest")
    );

    const { manifest } = first;
    expect(manifest.format).toBe("crf-review-package");
    expect(manifest.generator.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(manifest.generatedAt).toBe(GENERATED_AT);
    expect(manifest.revision).toMatchObject({
      studyId: "study_rp_synthetic",
      protocolNumber: "SYN-RP-001",
      version: "1.0",
      checksum: computeStudyChecksum(study),
    });
    expect(manifest.limitations.length).toBeGreaterThan(0);
    expect(manifest.unresolvedFindings.openReviewThreads).toHaveLength(1);
    expect(manifest.unresolvedFindings.resolvedReviewThreadCount).toBe(1);
    expect(manifest.unresolvedFindings.passingTestCount).toBe(1);

    // Text artifacts are checksummed; rendered PDFs are listed without one.
    const pdf = manifest.contents.find((c) => c.id === "forms_pdf");
    expect(pdf?.checksum).toBeNull();
    const dictionary = manifest.contents.find(
      (c) => c.id === "data_dictionary_csv"
    );
    expect(dictionary?.checksum).toMatch(/^[0-9a-f]{8}$/);
    expect(manifest.excluded.map((e) => e.id).sort()).toEqual([
      "change_summary_csv",
      "change_summary_pdf",
    ]);
  });

  it("generates every artifact from one snapshot, unaffected by later edits", async () => {
    const study = reviewedStudy();
    const snapshot = createReviewPackageSnapshot(study);
    expect(Object.isFrozen(snapshot.study)).toBe(true);
    expect(Object.isFrozen(snapshot.study.forms[0].sections[0].fields[0])).toBe(
      true
    );

    // The working draft keeps changing after the snapshot is taken.
    study.forms[0].sections[0].fields[0].label = "Edited after snapshot";
    study.version = "9.9";

    const result = await buildReviewPackage(snapshot, {
      generatedAt: GENERATED_AT,
      exclude: ["forms_pdf"],
    });

    for (const artifact of result.artifacts) {
      expect(artifact.revisionChecksum).toBe(snapshot.revision.checksum);
    }
    for (const id of [
      "edit_checks",
      "test_report",
      "readiness_report",
      "readme",
    ]) {
      expect(textOf(result.artifacts, id)).toContain(
        `checksum ${snapshot.revision.checksum}`
      );
    }
    const everything = result.artifacts
      .filter((a) => typeof a.content === "string")
      .map((a) => a.content as string)
      .join("\n");
    expect(everything).toContain("Systolic Blood Pressure");
    expect(everything).not.toContain("Edited after snapshot");
    expect(result.manifest.revision.version).toBe("1.0");
    expect(computeStudyChecksum(snapshot.study as StudyProtocol)).toBe(
      snapshot.revision.checksum
    );
  });

  it("reopens the included native source with threads and scenarios intact", async () => {
    const study = reviewedStudy();
    const result = await buildReviewPackage(
      createReviewPackageSnapshot(study),
      {
        generatedAt: GENERATED_AT,
        exclude: ["forms_pdf"],
      }
    );
    expect(result.manifest.nativeSource).toMatchObject({
      path: "study/SYN-RP-001.crf.json",
      reopens: true,
      reviewThreadsPreserved: true,
      testScenariosPreserved: true,
    });

    const archive = await zipReviewPackage(result);
    const opened = await openReviewPackage(archive);

    expect(opened.manifest).toEqual(result.manifest);
    expect(opened.paths).toEqual(
      [...result.artifacts.map((a) => a.path)].sort()
    );
    expect(opened.study.reviewThreads).toEqual(study.reviewThreads);
    expect(opened.study.testScenarios).toEqual(study.testScenarios);
    expect(opened.study.forms[0].sections[0].fields).toEqual(
      study.forms[0].sections[0].fields
    );
    expect(computeStudyChecksum(opened.study)).toBe(
      result.manifest.nativeSource.reopenedChecksum
    );

    // Zipping the same package twice yields the same bytes.
    expect(await zipReviewPackage(result)).toEqual(archive);
    expect(reviewPackageFilename(result.manifest.revision)).toBe(
      "SYN-RP-001-v1.0-review-package.zip"
    );
  });

  it("stays consistent after an amendment and labels the now-stale test", async () => {
    const before = reviewedStudy();
    const baseline = {
      id: "baseline_v1",
      versionTag: "v1.0",
      label: "Approved for review",
      study: before,
    };
    const amended = amend(before);
    const snapshot = createReviewPackageSnapshot(amended);
    const preview = previewReviewPackage(snapshot, { baseline });
    expect(preview.entries.every((e) => e.included)).toBe(true);
    expect(preview.findings.staleTests.map((t) => t.scenarioId)).toEqual([
      "scenario_high_bp",
    ]);

    const result = await buildReviewPackage(snapshot, {
      generatedAt: GENERATED_AT,
      baseline,
    });
    const { manifest, artifacts } = result;

    expect(manifest.revision.version).toBe("1.1");
    expect(manifest.comparison).toMatchObject({
      baselineId: "baseline_v1",
      baselineChecksum: computeStudyChecksum(before),
    });
    expect(manifest.comparison!.totalChanges).toBeGreaterThan(0);

    // Every artifact describes the amended revision.
    expect(textOf(artifacts, "change_summary_csv")).toContain(
      "Systolic Blood Pressure"
    );
    expect(textOf(artifacts, "data_dictionary_csv")).toContain(
      "Systolic Blood Pressure,number,Yes,mmHg,60,200"
    );
    expect(textOf(artifacts, "edit_checks")).toContain(
      "Systolic Blood Pressure (SYSBP) is greater than 180"
    );

    // The old green result is labelled stale, not reported as a pass.
    const testReport = textOf(artifacts, "test_report");
    expect(testReport).toContain("[STALE] High reading raises a query");
    expect(testReport).not.toContain("[PASSING]");
    expect(manifest.unresolvedFindings.staleTests[0]).toMatchObject({
      scenarioId: "scenario_high_bp",
      stale: true,
      passed: 1,
    });

    // The open thread survives the amendment, in the manifest, the readiness
    // report and the native source.
    expect(manifest.unresolvedFindings.openReviewThreads[0]).toMatchObject({
      fieldId: "f_sysbp",
      lastComment: "Should the upper limit follow the protocol's 200 mmHg?",
    });
    expect(textOf(artifacts, "readiness_report")).toContain(
      "Should the upper limit follow the protocol's 200 mmHg?"
    );
    const reopened = parseUniversalCrf(textOf(artifacts, "native_source"));
    expect(StudyProtocolEngine.countOpenReviewThreads(reopened)).toBe(1);
    expect(reopened.version).toBe("1.1");
  });

  it("accepts an external staleness decision per scenario", () => {
    const study = reviewedStudy();
    const resolver = vi.fn(() => ({
      stale: true,
      reason: "A rule this scenario covers was edited.",
    }));
    const findings = collectReviewPackageFindings(
      createReviewPackageSnapshot(study),
      { isScenarioStale: resolver }
    );
    expect(resolver).toHaveBeenCalledWith(
      expect.objectContaining({ id: "scenario_high_bp" }),
      expect.objectContaining({ id: "form_vs" })
    );
    expect(findings.staleTests[0]).toMatchObject({
      scenarioId: "scenario_high_bp",
      staleReason: "A rule this scenario covers was edited.",
    });
    expect(findings.passingTestCount).toBe(0);

    const notStale = collectReviewPackageFindings(
      createReviewPackageSnapshot(amend(study)),
      { isScenarioStale: () => false }
    );
    expect(notStale.staleTests).toHaveLength(0);
    expect(notStale.passingTestCount).toBe(1);
  });

  it("carries no portfolio promotion in any artifact", async () => {
    const result = await buildReviewPackage(
      createReviewPackageSnapshot(reviewedStudy()),
      {
        generatedAt: GENERATED_AT,
        baseline: {
          id: "b",
          versionTag: "v0",
          label: "Original",
          study: baseStudy(),
        },
      }
    );
    for (const artifact of result.artifacts) {
      const text =
        typeof artifact.content === "string"
          ? artifact.content
          : new TextDecoder("latin1").decode(artifact.content);
      expect(text, artifact.path).not.toMatch(/Schedule Consultation/i);
      expect(text, artifact.path).not.toContain("/schedule");
    }
    const pdf = result.artifacts.find((a) => a.id === "forms_pdf")!;
    expect(new TextDecoder("latin1").decode(pdf.content as Uint8Array)).toMatch(
      /^%PDF/
    );
  });

  it("reports a failed step with what completed and resumes on retry", async () => {
    const snapshot = createReviewPackageSnapshot(reviewedStudy());
    pdfFailure.remaining = 1;

    let failure: ReviewPackageBuildError | undefined;
    try {
      await buildReviewPackage(snapshot, { generatedAt: GENERATED_AT });
    } catch (err) {
      failure = err as ReviewPackageBuildError;
    }
    expect(failure).toBeInstanceOf(ReviewPackageBuildError);
    expect(failure!.stepId).toBe("forms_pdf");
    expect(failure!.aborted).toBe(false);
    expect(failure!.message).toContain("Synthetic renderer failure");
    expect(failure!.completed.map((a) => a.id)).toEqual(["native_source"]);

    const progress: ReviewPackageProgress[] = [];
    const result = await buildReviewPackage(snapshot, {
      generatedAt: GENERATED_AT,
      reuse: failure!.completed,
      onProgress: (p) => progress.push(p),
    });
    expect(progress[0]).toMatchObject({
      stepId: "native_source",
      status: "reused",
    });
    expect(progress.at(-1)).toMatchObject({
      stepId: "manifest",
      status: "done",
    });
    expect(result.artifacts.some((a) => a.id === "forms_pdf")).toBe(true);

    // Artifacts from a different revision are never reused.
    const other = createReviewPackageSnapshot(amend(reviewedStudy()));
    const otherProgress: ReviewPackageProgress[] = [];
    await buildReviewPackage(other, {
      generatedAt: GENERATED_AT,
      exclude: ["forms_pdf"],
      reuse: failure!.completed,
      onProgress: (p) => otherProgress.push(p),
    });
    expect(otherProgress.some((p) => p.status === "reused")).toBe(false);
  });

  it("stops when aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      buildReviewPackage(createReviewPackageSnapshot(baseStudy()), {
        signal: controller.signal,
      })
    ).rejects.toMatchObject({ name: "ReviewPackageBuildError", aborted: true });
  });

  it("records a native source that does not reopen as a limitation", async () => {
    const result = await buildReviewPackage(
      createReviewPackageSnapshot(PK_ESCALATION_PRESET),
      { generatedAt: GENERATED_AT, exclude: ["forms_pdf"] }
    );
    expect(result.manifest.nativeSource.reopens).toBe(false);
    expect(result.manifest.nativeSource.error).toContain("validation failed");
    expect(
      result.manifest.limitations.some((l) =>
        l.includes("did not pass schema validation")
      )
    ).toBe(true);
    expect(textOf(result.artifacts, "readme")).toContain(
      "did not pass schema validation"
    );
  });
});
