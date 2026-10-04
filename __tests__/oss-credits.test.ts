import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  buildCreditsDataset,
  countByLicense,
  diffFactsAgainstLockfile,
  fillSpdxTemplate,
  findUnannotatedDirect,
  groupDirectRuntimeByPurpose,
  isFactsDriftFree,
  listNoticedPackages,
  MIN_LICENSE_BODY_CHARS,
  noticeSourcesFromFacts,
  normalizeProjectUrl,
  renderThirdPartyNotices,
  spdxIdsOf,
  templateNeedsHolder,
  type FactsStore,
  type LockfileShape,
  type RootPackageShape,
} from "../lib/oss-credits";
import { CREDITS_DATASET } from "../lib/oss-credits/dataset";
import { REGISTRY_FACTS } from "../lib/oss-credits/facts";
import { DIRECT_ANNOTATIONS, GROUP_ORDER } from "../lib/oss-credits/presets";
import {
  DATASET_PATH,
  FACTS_PATH,
  NOTICES_PATH,
  renderOutputs,
  serializeFacts,
} from "../scripts/oss-credits";
import { TarPicker, parseResolvedUrl } from "../scripts/oss-credits-fetch";

const ROOT = path.resolve(__dirname, "..");
const readJson = <T>(rel: string): T =>
  JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")) as T;
const readText = (rel: string): string =>
  fs.readFileSync(path.join(ROOT, rel), "utf8");

const lockfile: LockfileShape = {
  packages: {
    "": {},
    "node_modules/app-lib": {
      version: "1.2.0",
      license: "MIT",
      integrity: "sha512-app",
    },
    "node_modules/@scope/helper": {
      version: "2.0.0",
      license: "ISC",
      integrity: "sha512-helper",
    },
    "node_modules/dev-tool": {
      version: "3.0.0",
      license: "Apache-2.0",
      dev: true,
      integrity: "sha512-dev",
    },
    "node_modules/app-lib/node_modules/nested": {
      version: "0.1.0",
      license: "MIT",
      integrity: "sha512-nested",
    },
    "node_modules/mystery": { version: "1.0.0", integrity: "sha512-mystery" },
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

const MIT_TEXT =
  "MIT License\n\nCopyright (c) 2020 Acme\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software.";
const SHA = {
  mit: "a".repeat(64),
  isc: "b".repeat(64),
  derived: "c".repeat(64),
};
const facts = (): FactsStore => ({
  schemaVersion: 1,
  texts: {
    [SHA.mit]: MIT_TEXT,
    [SHA.isc]: "ISC License\n\nCopyright (c) 2021 Helper\n\nPermission to use.",
    [SHA.derived]: "MIT License\n\nCopyright (c) Mystery Author\n\nPermission.",
  },
  packages: {
    "app-lib@1.2.0": {
      integrity: "sha512-app",
      homepage: "http://app-lib.dev/",
      repository: "git+https://github.com/acme/app-lib.git",
      author: "Acme",
      licenses: [{ kind: "file", name: "LICENSE", sha: SHA.mit }],
      notices: [],
    },
    "@scope/helper@2.0.0": {
      integrity: "sha512-helper",
      homepage: null,
      repository: null,
      author: null,
      licenses: [{ kind: "file", name: "LICENSE", sha: SHA.isc }],
      notices: [],
    },
    "dev-tool@3.0.0": {
      integrity: "sha512-dev",
      homepage: null,
      repository: null,
      author: null,
      licenses: [],
      notices: [],
    },
    "nested@0.1.0": {
      integrity: "sha512-nested",
      homepage: null,
      repository: null,
      author: null,
      licenses: [{ kind: "file", name: "LICENSE", sha: SHA.mit }],
      notices: [],
    },
    "mystery@1.0.0": {
      integrity: "sha512-mystery",
      homepage: null,
      repository: null,
      author: "Mystery Author",
      licenses: [
        {
          kind: "derived",
          name: "MIT",
          sha: SHA.derived,
          holder: "Mystery Author",
        },
      ],
      notices: [],
    },
  },
});
const build = (store: FactsStore = facts()) =>
  buildCreditsDataset({ lockfile, root, annotations, facts: store });

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

  it("normalizes homepage and repository links from the registry facts", () => {
    const pkg = build().packages.find((p) => p.name === "app-lib");
    expect(pkg?.homepage).toBe("https://app-lib.dev");
    expect(pkg?.repository).toBe("https://github.com/acme/app-lib");
  });

  it("is byte-stable across runs and lockfile order", () => {
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
    const reversed: LockfileShape = {
      packages: Object.fromEntries(Object.entries(lockfile.packages).reverse()),
    };
    expect(
      JSON.stringify(
        buildCreditsDataset({
          lockfile: reversed,
          root,
          annotations,
          facts: facts(),
        })
      )
    ).toBe(JSON.stringify(build()));
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
      facts: facts(),
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

describe("diffFactsAgainstLockfile", () => {
  it("is clean for facts that cover the lockfile", () => {
    expect(isFactsDriftFree(diffFactsAgainstLockfile(facts(), lockfile))).toBe(
      true
    );
  });

  it("flags added, removed and re-pinned packages", () => {
    const store = facts();
    delete store.packages["nested@0.1.0"];
    store.packages["gone@1.0.0"] = { ...store.packages["app-lib@1.2.0"] };
    store.packages["dev-tool@3.0.0"].integrity = "sha512-other";
    const drift = diffFactsAgainstLockfile(store, lockfile);
    expect(drift.missing).toEqual(["nested@0.1.0"]);
    expect(drift.stale).toEqual(["gone@1.0.0"]);
    expect(drift.integrityChanged).toEqual(["dev-tool@3.0.0"]);
  });

  it("flags a shipped package with no resolved license text", () => {
    const store = facts();
    store.packages["app-lib@1.2.0"].licenses = [];
    expect(diffFactsAgainstLockfile(store, lockfile).unresolved).toEqual([
      "app-lib@1.2.0",
    ]);
  });

  it("does not require license text for tooling", () => {
    expect(diffFactsAgainstLockfile(facts(), lockfile).unresolved).toEqual([]);
  });

  it("flags a referenced text that is empty or absent, and orphan texts", () => {
    const store = facts();
    store.texts[SHA.mit] = "   ";
    store.texts["d".repeat(64)] = "orphan";
    const broken = diffFactsAgainstLockfile(store, lockfile).brokenTexts;
    expect(broken.some((b) => b.includes(SHA.mit))).toBe(true);
    expect(broken).toContain(`unreferenced ${"d".repeat(64)}`);
  });
});

describe("spdx helpers", () => {
  it("lists every identifier in an expression", () => {
    expect(spdxIdsOf("(MIT OR Apache-2.0) AND BSD-3-Clause")).toEqual([
      "MIT",
      "Apache-2.0",
      "BSD-3-Clause",
    ]);
    expect(spdxIdsOf("GPL-2.0 WITH Classpath-exception-2.0")).toEqual([
      "GPL-2.0",
      "Classpath-exception-2.0",
    ]);
  });

  it("fills the year and owner placeholders of a template", () => {
    const template =
      "Copyright (c) <year> <copyright holders>\n\nPermission.\n";
    expect(templateNeedsHolder(template)).toBe(true);
    expect(fillSpdxTemplate(template, "Acme")).toBe(
      "Copyright (c) Acme\n\nPermission."
    );
    expect(templateNeedsHolder("The Unlicense text")).toBe(false);
  });
});

describe("tarball and registry URL reading", () => {
  const entry = (name: string, body: string, type = "0") => {
    const header = Buffer.alloc(512);
    header.write(name, 0, "utf8");
    header.write(body.length.toString(8).padStart(11, "0"), 124, "ascii");
    header.write(type, 156, "ascii");
    const content = Buffer.from(body);
    const pad = Buffer.alloc((512 - (content.length % 512)) % 512);
    return Buffer.concat([header, content, pad]);
  };
  const tar = (...entries: Buffer[]) =>
    Buffer.concat([...entries, Buffer.alloc(1024)]);

  it("picks top-level license and notice files whatever the root directory is", () => {
    const picker = new TarPicker();
    picker.push(
      tar(
        entry("d3-color/LICENSE", "MIT text"),
        entry("d3-color/index.d.ts", "x".repeat(1500)),
        entry("d3-color/NOTICE", "notice text"),
        entry("d3-color/docs/LICENSE", "nested, ignored"),
        entry("d3-color/package.json", "{}")
      )
    );
    expect(picker.licenseFiles).toEqual([
      { name: "LICENSE", text: "MIT text" },
    ]);
    expect(picker.noticeFiles).toEqual([
      { name: "NOTICE", text: "notice text" },
    ]);
  });

  it("reads a tarball delivered in small chunks", () => {
    const data = tar(entry("package/LICENSE.md", "chunked license"));
    const picker = new TarPicker();
    for (let i = 0; i < data.length; i += 100) {
      picker.push(data.subarray(i, i + 100));
    }
    expect(picker.licenseFiles.map((f) => f.text)).toEqual(["chunked license"]);
  });

  it("skips a large binary without buffering it", () => {
    const picker = new TarPicker();
    picker.push(
      tar(
        entry("package/next-swc.node", "\0".repeat(5000)),
        entry("package/LICENSE", "after the binary")
      )
    );
    expect(picker.licenseFiles).toHaveLength(1);
  });

  it("maps a resolved URL to the package and version", () => {
    expect(
      parseResolvedUrl(
        "https://registry.npmjs.org/@types/d3-color/-/d3-color-3.1.0.tgz"
      )
    ).toEqual({ name: "@types/d3-color", version: "3.1.0" });
    expect(
      parseResolvedUrl(
        "https://registry.npmjs.org/left-pad/-/left-pad-1.3.0.tgz"
      )
    ).toEqual({ name: "left-pad", version: "1.3.0" });
    expect(parseResolvedUrl("https://example.com/x/-/x-1.0.0.tgz")).toBeNull();
    expect(parseResolvedUrl("not a url")).toBeNull();
  });
});

describe("noticeSourcesFromFacts and listNoticedPackages", () => {
  it("renders every shipped package under a real license text and none from tooling", () => {
    const notices = renderThirdPartyNotices(
      noticeSourcesFromFacts(facts(), lockfile)
    );
    const noticed = listNoticedPackages(notices);
    expect([...noticed.keys()].sort()).toEqual([
      "@scope/helper@2.0.0",
      "app-lib@1.2.0",
      "mystery@1.0.0",
      "nested@0.1.0",
    ]);
    for (const length of noticed.values()) {
      expect(length).toBeGreaterThanOrEqual(MIN_LICENSE_BODY_CHARS - 80);
    }
  });

  it("does not count an identifier-only entry as noticed", () => {
    const text = [
      "=".repeat(78),
      "LICENSE TEXT 1 of 1, applies to 1 package(s):",
      "",
      "- lonely@1.0.0 (MIT)",
      "",
      "MIT",
      "",
    ].join("\n");
    expect(listNoticedPackages(text).get("lonely@1.0.0")).toBeLessThan(
      MIN_LICENSE_BODY_CHARS
    );
    expect(
      listNoticedPackages(
        "PACKAGES THAT DISTRIBUTE NO LICENSE FILE\n\nlonely@1.0.0 (MIT)\n"
      ).size
    ).toBe(0);
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
  const pkg = readJson<RootPackageShape>("package.json");
  // Everything below reads committed files only: no node_modules, no network.
  // That is what makes the check identical on Linux, macOS and Windows.

  it("registry facts cover the lockfile exactly (fix: npm run oss:credits)", () => {
    expect(
      diffFactsAgainstLockfile(REGISTRY_FACTS, lock),
      "run `npm run oss:credits` to regenerate"
    ).toEqual({
      missing: [],
      stale: [],
      integrityChanged: [],
      unresolved: [],
      brokenTexts: [],
    });
  });

  it("committed files are byte-identical to what the generator renders", () => {
    const rendered = renderOutputs(REGISTRY_FACTS, lock, pkg);
    expect(readText(DATASET_PATH) === rendered.dataset).toBe(true);
    expect(readText(NOTICES_PATH) === rendered.notices).toBe(true);
    expect(readText(FACTS_PATH) === serializeFacts(REGISTRY_FACTS)).toBe(true);
    expect(JSON.stringify(CREDITS_DATASET)).toBe(
      JSON.stringify(JSON.parse(rendered.dataset))
    );
  });

  it("every direct dependency has a purpose group and reason", () => {
    expect(findUnannotatedDirect(CREDITS_DATASET)).toEqual([]);
  });

  it("curated annotations only name real direct dependencies", () => {
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

  it("every shipped package sits under a full license text in the notices", () => {
    const noticed = listNoticedPackages(readText(NOTICES_PATH));
    const short = CREDITS_DATASET.packages
      .filter((p) => p.scope === "runtime")
      .map((p) => `${p.name}@${p.version}`)
      .filter((k) => (noticed.get(k) ?? 0) < MIN_LICENSE_BODY_CHARS);
    expect(short, "run `npm run oss:credits` to regenerate").toEqual([]);
  });

  it("the notices carry no identifier-only section", () => {
    expect(readText(NOTICES_PATH)).not.toContain(
      "PACKAGES THAT DISTRIBUTE NO LICENSE FILE"
    );
  });

  it("inherited texts point at a parent that ships its own file", () => {
    for (const [key, entry] of Object.entries(REGISTRY_FACTS.packages)) {
      for (const ref of entry.licenses.filter((l) => l.kind === "inherited")) {
        const parent = REGISTRY_FACTS.packages[ref.from ?? ""];
        expect(parent, `${key} inherits from ${ref.from}`).toBeDefined();
        expect(parent.licenses.some((l) => l.kind === "file")).toBe(true);
      }
    }
  });

  it("derived texts name a holder whenever the template has one", () => {
    for (const [key, entry] of Object.entries(REGISTRY_FACTS.packages)) {
      for (const ref of entry.licenses.filter((l) => l.kind === "derived")) {
        const text = REGISTRY_FACTS.texts[ref.sha];
        // Licenses whose templates carry a holder line must name the holder.
        if (/^(MIT|ISC|BSD-[23]-Clause)$/.test(ref.name)) {
          expect(ref.holder, key).toBeTruthy();
        }
        if (ref.holder) expect(text, key).toContain(ref.holder);
        expect(text).not.toMatch(/<(year|owner|copyright holders?)>/i);
      }
    }
  });
});
