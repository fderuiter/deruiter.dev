// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const report = require("../scripts/generate-accessibility-report.js") as {
  markdownCodeSpan: (value: string) => string;
  markdownText: (value: string) => string;
  markdownLink: (label: string, url: string) => string;
  main: (paths: {
    resultsDir: string;
    summaryPath: string;
    statusPath: string;
  }) => string;
};

/** Reads a code span back the way CommonMark does (section 6.1). */
function readCodeSpan(span: string): string {
  const fence = /^`+/.exec(span)![0];
  expect(span.endsWith(fence)).toBe(true);
  let inner = span.slice(fence.length, span.length - fence.length);
  // The closing fence must be the only run of exactly this length.
  expect(
    inner.match(/`+/g)?.some((run) => run.length === fence.length)
  ).not.toBe(true);
  if (inner.startsWith(" ") && inner.endsWith(" ") && inner.trim()) {
    inner = inner.slice(1, -1);
  }
  return inner;
}

// CodeQL alert 11: axe snippets and selectors are page data, not Markdown.
describe("accessibility report serializers", () => {
  it.each([
    "<a href='#'>plain</a>",
    "<code>`x`</code>",
    "<pre>``fenced`` and ```three```</pre>",
    "`leading and trailing`",
    " spaced ",
    "a\\`b",
    "| pipe | [link](https://evil.invalid) <img src=x onerror=alert(1)>",
  ])("keeps %j as one literal code span", (snippet) => {
    const span = report.markdownCodeSpan(snippet);
    expect(readCodeSpan(span)).toBe(snippet);
  });

  it("puts a multi-line snippet on one line", () => {
    const span = report.markdownCodeSpan("<div>\r\n  <p>a</p>\n</div>");
    expect(span).not.toMatch(/[\r\n]/);
    expect(readCodeSpan(span)).toBe("<div>   <p>a</p> </div>");
  });

  it("escapes text so it cannot open a link, raw HTML or a new table cell", () => {
    const text = report.markdownText("a | b [x](y) <img> **c**\nd");
    expect(text).not.toMatch(/[\r\n]/);
    expect(text).not.toMatch(/(?<!\\)[|[\]()<>*]/);
  });

  it("links only to http(s) rule references", () => {
    expect(
      report.markdownLink(
        "Rule Reference",
        "https://dequeuniversity.com/rules/axe/4.10/color-contrast?application=playwright"
      )
    ).toBe(
      "[Rule Reference](<https://dequeuniversity.com/rules/axe/4.10/color-contrast?application=playwright>)"
    );
    expect(report.markdownLink("Rule Reference", "javascript:alert(1)")).toBe(
      "Rule Reference"
    );
    expect(report.markdownLink("Rule Reference", "not a url")).toBe(
      "Rule Reference"
    );
    expect(
      report.markdownLink("R", "https://e.invalid/a) [x](https://evil.invalid")
    ).toBe("[R](<https://e.invalid/a)%20[x](https://evil.invalid>)");
  });
});

describe("accessibility report generator", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  function run(files: Record<string, unknown>) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "a11y-report-"));
    dirs.push(dir);
    const resultsDir = path.join(dir, "results");
    fs.mkdirSync(resultsDir);
    for (const [name, data] of Object.entries(files)) {
      fs.writeFileSync(path.join(resultsDir, name), JSON.stringify(data));
    }
    const summaryPath = path.join(dir, "summary.md");
    const statusPath = path.join(dir, "status.txt");
    vi.spyOn(console, "log").mockImplementation(() => {});
    const status = report.main({ resultsDir, summaryPath, statusPath });
    return {
      status,
      statusFile: fs.readFileSync(statusPath, "utf8"),
      markdown: fs.readFileSync(summaryPath, "utf8"),
    };
  }

  const hostileState = "home | `menu`\nopen";
  const hostileNode = {
    html: "<button>``x`` | [y](https://evil.invalid)\n<script>1</script></button>",
    target: ["#nav > .item", "a[href='`x`']"],
  };

  it("keeps hostile evidence inside its own row, item and code spans", () => {
    const { status, statusFile, markdown } = run({
      "a.json": {
        project: "chromium",
        state: hostileState,
        url: "/",
        violationsCount: 1,
        violations: [
          {
            id: "color-contrast",
            impact: "serious",
            description: "Elements must meet contrast | ratios",
            help: "Fix [it](https://evil.invalid)",
            helpUrl:
              "https://dequeuniversity.com/rules/axe/4.10/color-contrast",
            nodes: [hostileNode],
          },
        ],
      },
      "b.json": {
        project: "firefox",
        state: "about",
        url: "/about",
        violationsCount: 0,
      },
    });

    expect(status).toBe("❌ Fail");
    expect(statusFile).toBe("❌ Fail");

    // Two result files make exactly two table body rows of four cells.
    const rows = markdown
      .split("\n")
      .filter(
        (line) =>
          line.startsWith("| ") &&
          !line.startsWith("| Project") &&
          !line.startsWith("| ---")
      );
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.match(/(?<!\\)\|/g)).toHaveLength(5);
    }

    // The only link outside a code span is the rule reference.
    // (The snippet's own "](" sits inside its code span, checked below.)
    const outsideSnippets = markdown
      .split("\n")
      .filter((line) => !line.includes("HTML Snippet:"))
      .join("\n");
    expect(outsideSnippets.match(/(?<!\\)\]\(/g)).toHaveLength(1);
    expect(markdown).toContain(
      "([Rule Reference](<https://dequeuniversity.com/rules/axe/4.10/color-contrast>))"
    );

    const selectorLine = markdown
      .split("\n")
      .find((l) => l.includes("CSS Selector:"))!;
    const snippetLine = markdown
      .split("\n")
      .find((l) => l.includes("HTML Snippet:"))!;
    expect(readCodeSpan(selectorLine.split("CSS Selector: ")[1])).toBe(
      "#nav > .item > a[href='`x`']"
    );
    expect(readCodeSpan(snippetLine.split("HTML Snippet: ")[1])).toBe(
      "<button>``x`` | [y](https://evil.invalid) <script>1</script></button>"
    );
  });

  it("keeps the pass, fail and empty statuses unchanged", () => {
    expect(
      run({
        "a.json": {
          project: "chromium",
          state: "home",
          url: "/",
          violationsCount: 0,
        },
      }).statusFile
    ).toBe("✅ Pass");
    const empty = run({});
    expect(empty.statusFile).toBe("❌ Fail");
    expect(empty.markdown).toContain("No accessibility results found");
  });
});
