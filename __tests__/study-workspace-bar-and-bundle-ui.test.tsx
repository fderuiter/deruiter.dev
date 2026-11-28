/**
 * @vitest-environment jsdom
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const downloads = vi.hoisted(
  () => [] as { content: string; name: string; mimeType?: string }[]
);
vi.mock("@/lib/download", () => ({
  downloadFile: (
    content: string,
    name: string,
    options?: { mimeType?: string }
  ) => {
    downloads.push({ content, name, mimeType: options?.mimeType });
  },
}));

import { RANDOMIZATION_RESOURCE_LIMITS } from "@/lib/randomization";
import {
  TAVR_SAVR_USDM,
  importUsdmStudy,
  serializeStudyWorkspace,
} from "@/lib/study-workspace";
import { StudyDesignGrid } from "@/components/study-workspace/StudyDesignGrid";

beforeEach(() => {
  downloads.length = 0;
});
afterEach(cleanup);

async function openStudio() {
  const view = render(<StudyDesignGrid />);
  await screen.findByRole("table");
  return view;
}

const governanceBar = () => within(screen.getByTestId("study-workspace-bar"));
const rndArea = () =>
  within(screen.getByRole("region", { name: "Randomization work area" }));
const runArea = () =>
  within(screen.getByRole("region", { name: "Run and results", hidden: true }));
const verifyArea = () =>
  within(
    screen.getByRole("region", { name: "Verify an artifact", hidden: true })
  );
const stageButton = (title: string) =>
  within(rndArea().getByRole("navigation", { name: "Randomization stages" }))
    .getAllByRole("button")
    .find((button) => button.textContent?.endsWith(title))!;

function commitInput(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

describe("StudyWorkspaceBar governance, plan strip, and multi-format export bundle", () => {
  it("opens USDM v4 with preserved items, inspects them, exports validated USDM, and enforces 8 MiB & SHA-256 checks", async () => {
    await openStudio();

    const doc = structuredClone(TAVR_SAVR_USDM) as unknown as {
      study: {
        extensionAttributes?: unknown[];
      };
    };
    doc.study.extensionAttributes = [
      {
        id: "ExtensionAttribute_ArchiveTag_1",
        url: "https://clinicaltrials.example.org/usdm/archive-tag",
        valueString: "archived-sponsor-metadata",
        instanceType: "ExtensionAttribute",
      },
    ];

    const fileInput = governanceBar().getByTestId(
      "study-repository-file-input"
    ) as HTMLInputElement;

    // 1. Reject file larger than RANDOMIZATION_RESOURCE_LIMITS.maxImportBytes (8 MiB)
    const oversizedFile = new File(["{}"], "huge.usdm.json", {
      type: "application/json",
    });
    Object.defineProperty(oversizedFile, "size", {
      value: RANDOMIZATION_RESOURCE_LIMITS.maxImportBytes + 1024,
    });
    fireEvent.change(fileInput, { target: { files: [oversizedFile] } });
    await waitFor(() =>
      expect(
        governanceBar().getByTestId("study-repository-feedback").textContent
      ).toMatch(/8\.0 MiB/i)
    );

    // 2. Reject tampered .study.json workspace SHA-256 hash
    const importedRef = await importUsdmStudy({ document: TAVR_SAVR_USDM });
    expect(importedRef.status).toBe("ok");
    if (importedRef.status !== "ok") return;
    const baselinePreservedCount = importedRef.workspace.preserved.length;
    const rawWorkspaceJson = serializeStudyWorkspace(importedRef.workspace);
    const tamperedJson = rawWorkspaceJson.replaceAll(
      importedRef.workspace.usdm.study.name,
      "Tampered Without Recomputing Hash"
    );
    const tamperedFile = new File([tamperedJson], "tampered.study.json", {
      type: "application/json",
    });
    fireEvent.change(fileInput, { target: { files: [tamperedFile] } });
    await waitFor(() =>
      expect(
        governanceBar().getByTestId("study-repository-feedback").textContent
      ).toMatch(/SHA-256|integrity|mismatch/i)
    );

    // 3. Import valid USDM v4 JSON with preserved extensionAttributes and inspect in drawer
    const multiFile = new File(
      [JSON.stringify(doc)],
      "with-extension.usdm.json",
      {
        type: "application/json",
      }
    );
    fireEvent.change(fileInput, { target: { files: [multiFile] } });

    const expectedPreserved = baselinePreservedCount + 1;
    await waitFor(() =>
      expect(
        governanceBar().getByTestId("study-governance-inspector-trigger")
          .textContent
      ).toContain(
        `${expectedPreserved} preserved ${expectedPreserved === 1 ? "item" : "items"}`
      )
    );

    fireEvent.click(
      governanceBar().getByTestId("study-governance-inspector-trigger")
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByTestId("study-governance-preserved-list").textContent
    ).toContain("Extension attributes");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));

    // 4. Export validated USDM JSON and verify preserved extensionAttributes are written back
    fireEvent.click(
      governanceBar().getByRole("button", {
        name: "Export USDM (.usdm.json)",
      })
    );
    await waitFor(() => expect(downloads).toHaveLength(1));
    const exportedUsdm = JSON.parse(downloads[0].content) as {
      study: { extensionAttributes?: { id: string }[] };
    };
    expect(
      exportedUsdm.study.extensionAttributes?.some(
        (ext) => ext.id === "ExtensionAttribute_ArchiveTag_1"
      )
    ).toBe(true);
  });

  it("syncs inline Protocol ID, Study name, and Phase edits between StudyWorkspaceBar, MetadataStage, Undo/Redo, and CSV headers", async () => {
    await openStudio();

    commitInput(governanceBar().getByLabelText("Protocol ID"), "GOV-SYNC-404");
    commitInput(
      governanceBar().getByLabelText("Study name"),
      "Adaptive Valve Governance Study"
    );
    fireEvent.change(governanceBar().getByLabelText("Phase"), {
      target: { value: "C15601" },
    });

    expect(governanceBar().getByText("Revision R4")).toBeTruthy();

    // Add a randomization plan, acknowledge notice, and verify MetadataStage reflects the study edits
    fireEvent.click(
      rndArea().getByRole("button", { name: "Add a plan for this design" })
    );
    fireEvent.click(rndArea().getByRole("checkbox"));
    fireEvent.click(stageButton("Study metadata"));

    expect(
      (rndArea().getByLabelText("Protocol ID") as HTMLInputElement).value
    ).toBe("GOV-SYNC-404");
    expect(
      (rndArea().getByLabelText("Study name") as HTMLInputElement).value
    ).toBe("Adaptive Valve Governance Study");
    expect((rndArea().getByLabelText("Phase") as HTMLSelectElement).value).toBe(
      "C15601"
    );

    // Edit Protocol ID inline inside MetadataStage and verify Undo/Redo updates StudyWorkspaceBar
    commitInput(rndArea().getByLabelText("Protocol ID"), "META-STAGE-505");
    expect(
      (governanceBar().getByLabelText("Protocol ID") as HTMLInputElement).value
    ).toBe("META-STAGE-505");

    fireEvent.click(governanceBar().getByRole("button", { name: "Undo" }));
    expect(
      (governanceBar().getByLabelText("Protocol ID") as HTMLInputElement).value
    ).toBe("GOV-SYNC-404");

    fireEvent.click(governanceBar().getByRole("button", { name: "Redo" }));
    expect(
      (governanceBar().getByLabelText("Protocol ID") as HTMLInputElement).value
    ).toBe("META-STAGE-505");
  });

  it("adds, renames, and removes randomization plans in the plan strip with full Undo and Redo support", async () => {
    await openStudio();

    fireEvent.click(
      rndArea().getByRole("button", { name: "Add a plan for this design" })
    );
    const strip = within(rndArea().getByTestId("randomization-plan-strip"));
    const workingOn = strip.getByRole("combobox", {
      name: "Working on",
    }) as HTMLSelectElement;
    expect(workingOn.value).toBe("RandomizationPlan_1");

    // Rename plan
    commitInput(strip.getByLabelText("Plan name"), "Pivotal Cohort Schedule");
    expect(
      within(workingOn).getByRole("option", { name: "Pivotal Cohort Schedule" })
    ).toBeTruthy();

    // Remove plan
    fireEvent.click(strip.getByRole("button", { name: "Remove plan" }));
    expect(workingOn.value).toBe("exploration");
    expect(
      within(workingOn).queryByRole("option", {
        name: "Pivotal Cohort Schedule",
      })
    ).toBeNull();

    // Undo restores removed plan; selecting it shows its renamed title
    fireEvent.click(governanceBar().getByRole("button", { name: "Undo" }));
    expect(
      within(workingOn).getByRole("option", { name: "Pivotal Cohort Schedule" })
    ).toBeTruthy();

    // Redo removes it again
    fireEvent.click(governanceBar().getByRole("button", { name: "Redo" }));
    expect(
      within(workingOn).queryByRole("option", {
        name: "Pivotal Cohort Schedule",
      })
    ).toBeNull();
  });

  it("enables all five export formats after unmasking and confirming full disclosure, resets confirmation on state changes, and verifies allocation-json via one-click and file upload", async () => {
    await openStudio();

    // Promote an exploration plan
    fireEvent.click(rndArea().getByRole("checkbox"));
    fireEvent.click(stageButton("Review"));
    fireEvent.click(
      rndArea().getByRole("button", {
        name: "Promote to a plan for this study",
      })
    );

    // Set seed on the promoted plan (mechanics already came from Simple exploration)
    fireEvent.click(stageButton("Mechanics"));
    commitInput(rndArea().getByLabelText("Seed"), "FullBundleSeed77");
    fireEvent.click(stageButton("Review"));

    // Run schedule
    fireEvent.click(runArea().getByRole("button", { name: "Run" }));
    await runArea().findByRole("table");

    const bundle = () =>
      within(runArea().getByTestId("randomization-export-bundle"));

    // Initially masked: CSV & Validation manifest enabled, allocation-sensitive formats disabled
    expect(
      (
        bundle().getByRole("button", {
          name: "Download CSV",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false);
    expect(
      (
        bundle().getByRole("button", {
          name: "Validation manifest",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false);
    expect(
      (
        bundle().getByRole("button", {
          name: "Artifact JSON",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(
      (
        bundle().getByRole("button", {
          name: "Seed & config",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(
      (
        bundle().getByRole("button", {
          name: "Reproduction script",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);

    // Unmask treatment by selecting Biostatistician persona
    fireEvent.change(runArea().getByLabelText("Persona"), {
      target: { value: "Biostatistician" },
    });

    // Still disabled until full-disclosure checkbox is confirmed
    const confirmCheckbox = bundle().getByRole("checkbox") as HTMLInputElement;
    expect(confirmCheckbox.disabled).toBe(false);
    expect(confirmCheckbox.checked).toBe(false);
    expect(
      (
        bundle().getByRole("button", {
          name: "Download CSV",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);

    // Check full-disclosure confirmation -> all 5 formats + Verify generated artifact enabled!
    fireEvent.click(confirmCheckbox);
    expect(confirmCheckbox.checked).toBe(true);

    for (const label of [
      "Download CSV",
      "Artifact JSON",
      "Seed & config",
      "Reproduction script",
      "Validation manifest",
      "Verify generated artifact",
    ]) {
      const btn = bundle().getByRole("button", {
        name: label,
      }) as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    }

    // Export all 5 formats
    for (const label of [
      "Download CSV",
      "Artifact JSON",
      "Seed & config",
      "Reproduction script",
      "Validation manifest",
    ]) {
      fireEvent.click(bundle().getByRole("button", { name: label }));
    }
    await waitFor(() => expect(downloads).toHaveLength(5));

    const artifactDownload = downloads.find((d) =>
      d.name.endsWith("-artifact.json")
    )!;
    expect(artifactDownload).toBeTruthy();

    // 1. One-click verification in VerificationPanel returns Verified.
    fireEvent.click(
      bundle().getByRole("button", { name: "Verify generated artifact" })
    );
    await waitFor(() =>
      expect(verifyArea().getByText(/Verified\./)).toBeTruthy()
    );

    // 2. Uploading the exported allocation-json file in VerificationPanel also returns Verified.
    const verifyInput = verifyArea().getByLabelText(
      /Artifact file/i
    ) as HTMLInputElement;
    const uploadedArtifactFile = new File(
      [artifactDownload.content],
      "uploaded-allocation.json",
      { type: "application/json" }
    );
    fireEvent.change(verifyInput, {
      target: { files: [uploadedArtifactFile] },
    });
    await waitFor(() =>
      expect(verifyArea().getByText(/uploaded-allocation\.json:/)).toBeTruthy()
    );
    expect(verifyArea().getByText(/Verified\./)).toBeTruthy();

    // 3. Updating DisclosureControls resets fullDisclosureAcknowledged to false
    fireEvent.change(runArea().getByLabelText("Organization"), {
      target: { value: "Academic" },
    });
    expect((bundle().getByRole("checkbox") as HTMLInputElement).checked).toBe(
      false
    );

    // Re-unmask and re-check, then verify Run again resets fullDisclosureAcknowledged to false
    fireEvent.change(runArea().getByLabelText("Organization"), {
      target: { value: "Sponsor" },
    });
    fireEvent.click(bundle().getByRole("checkbox"));
    expect((bundle().getByRole("checkbox") as HTMLInputElement).checked).toBe(
      true
    );
    fireEvent.click(runArea().getByRole("button", { name: "Run again" }));
    await waitFor(() =>
      expect((bundle().getByRole("checkbox") as HTMLInputElement).checked).toBe(
        false
      )
    );
  });
});
