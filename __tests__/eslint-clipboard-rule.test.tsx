// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { Linter } from "eslint";
import * as tsParser from "@typescript-eslint/parser";

describe("ESLint custom button clipboard rule", () => {
  const linter = new Linter({ configType: "flat" });

  const config: Linter.Config[] = [
    {
      files: ["**/*.tsx"],
      languageOptions: {
        parser: tsParser,
        parserOptions: { jsx: true },
      },
      rules: {
        "no-restricted-syntax": [
          "error",
          {
            selector:
              "JSXElement[openingElement.name.name='button']:has(JSXAttribute[name.name='onClick'] MemberExpression[property.name='clipboard'])",
            message:
              "Do not re-implement copy button logic using raw <button> and navigator.clipboard. Use the canonical <CopyButton /> component or useClipboard hook instead.",
          },
        ],
      },
    },
  ];

  it("fails when <button> has onClick with arrow function writing to navigator.clipboard", () => {
    const code = `<button type="button" onClick={() => navigator.clipboard.writeText("test")}>Copy</button>`;
    const msgs = linter.verify(code, config, "test.tsx");
    expect(msgs.length).toBeGreaterThan(0);
    expect(msgs[0].message).toContain("Do not re-implement copy button logic using raw <button>");
  });

  it("fails when <button> has onClick referencing navigator.clipboard directly", () => {
    const code = `<button onClick={navigator.clipboard.writeText}>Copy</button>`;
    const msgs = linter.verify(code, config, "test.tsx");
    expect(msgs.length).toBeGreaterThan(0);
    expect(msgs[0].message).toContain("Do not re-implement copy button logic using raw <button>");
  });

  it("fails when attribute order has type and className before onClick", () => {
    const code = `<button className="a" type="button" onClick={async () => { await navigator.clipboard.writeText("test"); }}>Copy</button>`;
    const msgs = linter.verify(code, config, "test.tsx");
    expect(msgs.length).toBeGreaterThan(0);
    expect(msgs[0].message).toContain("Do not re-implement copy button logic using raw <button>");
  });

  it("fails when using window.navigator.clipboard inside onClick handler", () => {
    const code = `<button type="button" onClick={() => window.navigator.clipboard.writeText("test")}>Copy</button>`;
    const msgs = linter.verify(code, config, "test.tsx");
    expect(msgs.length).toBeGreaterThan(0);
    expect(msgs[0].message).toContain("Do not re-implement copy button logic using raw <button>");
  });

  it("passes when using <CopyButton /> component", () => {
    const code = `<CopyButton text="test text" />`;
    const msgs = linter.verify(code, config, "test.tsx");
    expect(msgs.length).toBe(0);
  });

  it("passes when <button> has standard onClick handler without clipboard access", () => {
    const code = `<button type="button" onClick={handleSave}>Save</button>`;
    const msgs = linter.verify(code, config, "test.tsx");
    expect(msgs.length).toBe(0);
  });
});
