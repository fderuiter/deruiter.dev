import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ALL_SLASH_COMMANDS } from "@/lib/crf";

/**
 * The EDC simulator's electronic signatures are a simulation: the stored
 * token is random and nothing is hashed or signed. Copy describing them must
 * not claim cryptographic attestation (#3617, ADR 0067).
 */
describe("simulated electronic signature claims", () => {
  it("the signature slash command does not claim cryptographic attestation", () => {
    const signature = ALL_SLASH_COMMANDS.find((c) => c.id === "signature");
    expect(signature).toBeDefined();
    expect(signature?.description).not.toMatch(/cryptograph|sha-?256/i);
    expect(signature?.description).toMatch(/simulat/i);
  });

  it("the CONTEXT.md glossary describes signatures as simulated, not cryptographic", () => {
    const context = readFileSync(
      path.resolve(process.cwd(), "CONTEXT.md"),
      "utf8"
    );
    const entry = context
      .split("\n")
      .find((line) => line.startsWith("- **Electronic Signatures"));
    expect(entry).toBeDefined();
    expect(entry).not.toMatch(/cryptograph|sha-?256/i);
    expect(entry).toMatch(/simulat/i);
  });
});
