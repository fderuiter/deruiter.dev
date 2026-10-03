import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  buildCreditsDataset,
  countByLicense,
  diffCreditsAgainstLockfile,
  findUnannotatedDirect,
  groupDirectRuntimeByPurpose,
  isDriftFree,
  normalizeProjectUrl,
  renderThirdPartyNotices,
  type LockfileShape,
  type RootPackageShape,
} from "../lib/oss-credits";
import { CREDITS_DATASET } from "../lib/oss-credits/dataset";
import { DIRECT_ANNOTATIONS, GROUP_ORDER } from "../lib/oss-credits/presets";

const ROOT = path.resolve(__dirname, "..");
const readJson = <T>(rel: string): T =>
  JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")) as T;

const lockfile: LockfileShape = {
  packages: {
    "": {},
    "node_modules/app-lib": { version: "1.2.0", license: "MIT" },
    "node_modules/@scope/helper": { version: "2.0.0", license: "ISC" },
    "node_modules/dev-tool": {
      version: "3.0.0",
      license: "Apache-2.0",
      dev: true,
    },
    "node_modules/app-lib/node_modules/nested": {
      version: "0.1.0",
      license: "MIT",
    },
    "node_modules/mystery": { version: "1.0.0" },
    "node_modules/linked": { version: "1.0.0", license: "MIT", link: true },
  },
};
const root: RootPackageShape = {
  dependencies: { "app-lib": "^1.0.0", "@scope/helper": "^2.0.0" },
  devDependencies: { "dev-tool": "^3.0.0" },
};
const annotations = {
  "app-lib": { group: "Framework and runtime", reason: "Does the thing." },
  "@scope/helper": { group: "Framework and runtime", reason: "Helps." },
  "dev-tool": { group: "Testing", reason: "Tests." },
};
const build = () =>
  buildCreditsDataset({
    lockfile,
    root,
    annotations,
    readMeta: (lockPath) =>
      lockPath === "node_modules/app-lib"
        ? {
            homepage: "http://app-lib.dev/",
            repository: { url: "git+https://github.com/acme/app-lib.git" },
          }
        : null,
  });

describe("buildCreditsDataset", () => {
  it("lists packages sorted, skips the root and links", () => {
    const names = build().packages.map((p) => p.name);
    expect(names).toEqual([
      "@scope/helper",
      "app-lib",
      "dev-tool",
      "mystery",
      "nested",
    ]);
  });

  it("marks scope and direct correctly", () => {
    const byName = Object.fromEntries(build().packages.map((p) => [p.name, p]));
    expect(byName["dev-tool"].scope).toBe("tooling");
    expect(byName["app-lib"].scope).toBe("runtime");
    expect(byName["app-lib"].direct).toBe(true);
    expect(byName["nested"].direct).toBe(false);
    expect(byName["nested"].group).toBeUndefined();
  });

  it("never defaults a missing license silently", () => {
    expect(build().packages.find((p) => p.name === "mystery")?.license).toBe(
      "UNKNOWN"
    );
  });

  it("normalizes homepage and repository links", () => {
    const pkg = build().packages.find((p) => p.name === "app-lib");
    expect(pkg?.homepage).toBe("https://app-lib.dev");
    expect(pkg?.repository).toBe("https://github.com/acme/app-lib");
  });

  it("is byte-stable across runs", () => {
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
  });

  it("counts packages by scope", () => {
    expect(build().counts).toEqual({
      total: 5,
      runtime: 4,
      tooling: 1,
      direct: 3,
    });
  });

  it("reports direct dependencies lacking an annotation", () => {
    const dataset = buildCreditsDataset({
      lockfile,
      root,
      annotations: {},
      readMeta: () => null,
    });
    expect(findUnannotatedDirect(dataset).sort()).toEqual([
      "@scope/helper",
      "app-lib",
      "dev-tool",
    ]);
  });

  it("groups direct runtime dependencies by purpose and counts licenses", () => {
    const dataset = build();
    expect(groupDirectRuntimeByPurpose(dataset).map((g) => g.group)).toEqual([
      "Framework and runtime",
    ]);
    expect(countByLicense(dataset)[0]).toEqual({ license: "MIT", count: 2 });
  });
});

describe("normalizeProjectUrl", () => {
  it.each([
    ["git+https://github.com/a/b.git", "https://github.com/a/b"],
    ["git://github.com/a/b.git", "https://github.com/a/b"],
    ["git@github.com:a/b.git", "https://github.com/a/b"],
    ["github:a/b", "https://github.com/a/b"],
    ["a/b", "https://github.com/a/b"],
    ["http://example.com/path/#readme", "https://example.com/path"],
  ])("%s -> %s", (raw, expected) => {
    expect(normalizeProjectUrl(raw)).toBe(expected);
  });

  it.each([[undefined], [""], ["not a url"], ["javascript:alert(1)"]])(
    "rejects %s",
    (raw) => {
      expect(normalizeProjectUrl(raw)).toBeNull();
    }
  );
});

describe("diffCreditsAgainstLockfile", () => {
  it("is clean for a freshly built dataset", () => {
    expect(isDriftFree(diffCreditsAgainstLockfile(build(), lockfile))).toBe(
      true
    );
  });

  it("flags added, removed and re-licensed packages", () => {
    const { "node_modules/mystery": _removed, ...remaining } =
      lockfile.packages;
    void _removed;
    const drift = diffCreditsAgainstLockfile(build(), {
      packages: {
        ...remaining,
        "node_modules/new-pkg": { version: "1.0.0", license: "MIT" },
        "node_modules/dev-tool": {
          version: "3.0.0",
          license: "GPL-3.0-only",
          dev: true,
        },
      },
    });
    expect(drift.missing).toContain("new-pkg@1.0.0");
    expect(drift.stale).toContain("mystery@1.0.0");
    expect(drift.changed).toContain("dev-tool@3.0.0");
  });
});

describe("renderThirdPartyNotices", () => {
  const mit = (year: string, holder: string) =>
    `MIT License\n\nCopyright (c) ${year} ${holder}\n\nPermission is hereby granted.`;
  const text = renderThirdPartyNotices([
    {
      name: "b",
      version: "1.0.0",
      license: "MIT",
      licenseText: mit("2021", "Bee"),
    },
    {
      name: "a",
      version: "1.0.0",
      license: "MIT",
      licenseText: mit("2020", "Ay"),
      noticeText: "Ay NOTICE",
    },
    {
      name: "c",
      version: "1.0.0",
      license: "ISC",
      licenseText:
        "ISC License\n\nCopyright (c) 2022 Cee\n\nPermission to use.",
    },
  ]);

  it("prints one copy of identical license text with every copyright line", () => {
    expect(text.match(/Permission is hereby granted\./g)).toHaveLength(1);
    expect(text).toContain("Copyright (c) 2020 Ay");
    expect(text).toContain("Copyright (c) 2021 Bee");
    expect(text).toContain("2 distinct license texts");
  });

  it("reproduces Apache NOTICE files and is deterministic", () => {
    expect(text).toContain("a@1.0.0 NOTICE\nAy NOTICE");
    expect(text).toBe(
      renderThirdPartyNotices([
        {
          name: "c",
          version: "1.0.0",
          license: "ISC",
          licenseText:
            "ISC License\n\nCopyright (c) 2022 Cee\n\nPermission to use.",
        },
        {
          name: "a",
          version: "1.0.0",
          license: "MIT",
          licenseText: mit("2020", "Ay"),
          noticeText: "Ay NOTICE",
        },
        {
          name: "b",
          version: "1.0.0",
          license: "MIT",
          licenseText: mit("2021", "Bee"),
        },
      ])
    );
  });
});

describe("committed credits match the repository", () => {
  const lock = readJson<LockfileShape>("package-lock.json");

  it("dataset has no drift from package-lock.json (fix: npm run oss:credits)", () => {
    const drift = diffCreditsAgainstLockfile(CREDITS_DATASET, lock);
    expect(drift, "run `npm run oss:credits` to regenerate").toEqual({
      missing: [],
      stale: [],
      changed: [],
    });
  });

  it("every direct dependency has a purpose group and reason", () => {
    expect(findUnannotatedDirect(CREDITS_DATASET)).toEqual([]);
  });

  it("curated annotations only name real direct dependencies", () => {
    const pkg = readJson<RootPackageShape>("package.json");
    const direct = new Set([
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ]);
    expect(
      Object.keys(DIRECT_ANNOTATIONS).filter((n) => !direct.has(n))
    ).toEqual([]);
  });

  it("every annotation group is in the display order", () => {
    const groups = new Set(
      Object.values(DIRECT_ANNOTATIONS).map((a) => a.group)
    );
    expect([...groups].filter((g) => !GROUP_ORDER.includes(g))).toEqual([]);
  });

  it("third-party notices list every shipped package", () => {
    const notices = fs.readFileSync(
      path.join(ROOT, "public/third-party-notices.txt"),
      "utf8"
    );
    const missing = CREDITS_DATASET.packages
      .filter((p) => p.scope === "runtime")
      .map((p) => `${p.name}@${p.version}`)
      .filter((k) => !notices.includes(k));
    expect(missing, "run `npm run oss:credits` to regenerate").toEqual([]);
  });
});
