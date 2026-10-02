import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  checkMarkdownLinkIntegrity,
  listMarkdownFiles,
} from "../scripts/markdown-link-check";

const temporaryDirectories: string[] = [];

function createDocsFixture(): string {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "portfolio-markdown-link-check-")
  );
  temporaryDirectories.push(root);
  const docs = path.join(root, "docs");
  fs.mkdirSync(docs, { recursive: true });
  return docs;
}

function createFullWorkspaceFixture(): string {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "portfolio-markdown-workspace-")
  );
  temporaryDirectories.push(root);
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  fs.mkdirSync(path.join(root, "adr"), { recursive: true });
  return root;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("markdown link integrity checking (ADR 0023)", () => {
  it("passes when every relative link resolves to a real file", () => {
    const docs = createDocsFixture();
    fs.mkdirSync(path.join(docs, "how-to"), { recursive: true });
    fs.writeFileSync(
      path.join(docs, "tutorials.md"),
      "See the [how-to guide](how-to/guide.md) for details.\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(docs, "how-to", "guide.md"),
      "# Guide\n",
      "utf8"
    );

    const result = checkMarkdownLinkIntegrity(path.dirname(docs), docs);

    expect(result).toEqual({ status: "pass", details: [] });
  });

  it("reports a broken cross-quadrant relative link", () => {
    const docs = createDocsFixture();
    fs.writeFileSync(
      path.join(docs, "tutorials.md"),
      "See the [missing guide](how-to/does-not-exist.md) for details.\n",
      "utf8"
    );

    const result = checkMarkdownLinkIntegrity(path.dirname(docs), docs);

    expect(result.status).toBe("fail");
    expect(result.details).toEqual([
      "docs/tutorials.md: broken link to 'how-to/does-not-exist.md'",
    ]);
  });

  it("skips external, mailto, and same-page anchor links", () => {
    const docs = createDocsFixture();
    fs.writeFileSync(
      path.join(docs, "index.md"),
      [
        "[External](https://example.com/does-not-exist)",
        "[Email](mailto:someone@example.com)",
        "[Anchor](#some-section)",
      ].join("\n") + "\n",
      "utf8"
    );

    const result = checkMarkdownLinkIntegrity(path.dirname(docs), docs);

    expect(result).toEqual({ status: "pass", details: [] });
  });

  it("skips the machine-generated reference/ subtree", () => {
    const docs = createDocsFixture();
    fs.mkdirSync(path.join(docs, "reference", "api"), { recursive: true });
    fs.writeFileSync(
      path.join(docs, "reference", "api", "modules.md"),
      "[Broken](./does-not-exist.md)\n",
      "utf8"
    );

    const result = checkMarkdownLinkIntegrity(path.dirname(docs), docs);

    expect(result).toEqual({ status: "pass", details: [] });
  });

  it("resolves a leading-slash link relative to the workspace root", () => {
    const docs = createDocsFixture();
    const root = path.dirname(docs);
    fs.writeFileSync(
      path.join(root, "ARCHITECTURE.md"),
      "# Architecture\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(docs, "explanation.md"),
      "[Architecture](/ARCHITECTURE.md)\n",
      "utf8"
    );

    const result = checkMarkdownLinkIntegrity(root, docs);

    expect(result).toEqual({ status: "pass", details: [] });
  });

  it("verifies top-level workspace root markdown files and adr/ files by default", () => {
    const root = createFullWorkspaceFixture();
    fs.writeFileSync(
      path.join(root, "README.md"),
      "Check [Architecture](ARCHITECTURE.md) and [ADR 0001](adr/0001.md).\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(root, "ARCHITECTURE.md"),
      "# Architecture\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(root, "adr", "0001.md"),
      "See [README](../README.md)\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(root, "docs", "guide.md"),
      "See [Root Readme](/README.md)\n",
      "utf8"
    );

    const result = checkMarkdownLinkIntegrity(root);

    expect(result).toEqual({ status: "pass", details: [] });
  });

  it("detects broken links in top-level root markdown files and adr/ files", () => {
    const root = createFullWorkspaceFixture();
    fs.writeFileSync(
      path.join(root, "README.md"),
      "Check [Missing](MISSING.md).\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(root, "adr", "0001.md"),
      "Check [Invalid ADR](0002-missing.md).\n",
      "utf8"
    );

    const result = checkMarkdownLinkIntegrity(root);

    expect(result.status).toBe("fail");
    expect(result.details).toContain("README.md: broken link to 'MISSING.md'");
    expect(result.details).toContain(
      "adr/0001.md: broken link to '0002-missing.md'"
    );
  });

  it("accepts configurable target paths array", () => {
    const root = createFullWorkspaceFixture();
    fs.writeFileSync(
      path.join(root, "README.md"),
      "Check [Broken](BROKEN.md).\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(root, "adr", "0001.md"),
      "Check [Valid](0001.md).\n",
      "utf8"
    );

    // Only verify adr/ explicitly, ignoring broken link in README.md
    const result = checkMarkdownLinkIntegrity(root, ["adr"]);

    expect(result).toEqual({ status: "pass", details: [] });
  });

  it("listMarkdownFiles lists files from root, directories, and skips build folders", () => {
    const root = createFullWorkspaceFixture();
    fs.writeFileSync(path.join(root, "README.md"), "# Root\n", "utf8");
    fs.writeFileSync(path.join(root, "adr", "0001.md"), "# ADR\n", "utf8");
    fs.mkdirSync(path.join(root, "node_modules", "some-pkg"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(root, "node_modules", "some-pkg", "README.md"),
      "# Ignored\n",
      "utf8"
    );

    const files = listMarkdownFiles(["README.md", "adr", "node_modules"], root);

    expect(files).toContain(path.join(root, "README.md"));
    expect(files).toContain(path.join(root, "adr", "0001.md"));
    expect(files).not.toContain(
      path.join(root, "node_modules", "some-pkg", "README.md")
    );
  });
});
