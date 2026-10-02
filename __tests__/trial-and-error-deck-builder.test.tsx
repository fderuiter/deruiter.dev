import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  CustomScenarioSpecSchema,
  type CustomScenarioSpec,
  createCustomScenario,
  encodeCustomScenario,
  decodeCustomScenario,
  exportScenarioJson,
  importScenarioJson,
  challengeHash,
  parseChallengeHash,
  getAllCodexCards,
  SCENARIOS,
} from "@/lib/trial-and-error";
import { DeckBuilder } from "@/components/trial-and-error/DeckBuilder";

describe("Custom Scenario & Deck Builder Engine", () => {
  const sampleCards = getAllCodexCards();
  const validSpec: CustomScenarioSpec = {
    title: "Oncology Precision Trial",
    summary: "Custom high-quota deckbuilder trial.",
    quota: 750,
    startingCpu: 15,
    rulebook: {
      percentPrecision: 2,
      meanPrecision: 3,
      roundingMode: "HALF_EVEN",
      populationSuit: "ITT",
    },
    cardIds: sampleCards.slice(0, 8).map((c) => c.id),
  };

  it("validates CustomScenarioSpecSchema", () => {
    expect(CustomScenarioSpecSchema.safeParse(validSpec).success).toBe(true);

    const invalidSpec = { ...validSpec, quota: 10 }; // below min 50
    expect(CustomScenarioSpecSchema.safeParse(invalidSpec).success).toBe(false);

    const tooFewCards = { ...validSpec, cardIds: ["c1", "c2"] }; // below min 5 cards
    expect(CustomScenarioSpecSchema.safeParse(tooFewCards).success).toBe(false);
  });

  it("creates a fully playable Scenario passing ScenarioSchema", () => {
    const scenario = createCustomScenario(validSpec);
    expect(scenario.id).toBeDefined();
    expect(scenario.title).toBe("Oncology Precision Trial");
    expect(scenario.blind.quota).toBe(750);
    expect(scenario.startingCpu).toBe(15);
    expect(scenario.rulebook.percentPrecision).toBe(2);
    expect(scenario.rulebook.meanPrecision).toBe(3);
    expect(scenario.deck.length).toBe(8);
  });

  it("compresses custom scenario into URL-safe payload under 2,000 chars", () => {
    const encoded = encodeCustomScenario(validSpec);
    expect(typeof encoded).toBe("string");
    expect(encoded.length).toBeLessThan(1000);

    const hash = challengeHash("7K3M-Q9PX", { kind: "SEEDED" }, {}, validSpec);
    expect(hash.length).toBeLessThan(2000);
    expect(hash).toContain("#seed=7K3M-Q9PX&custom=");

    const parsed = parseChallengeHash(hash);
    expect(parsed).not.toBeNull();
    expect(parsed?.customScenario).toEqual(validSpec);
  });

  it("decodes compressed scenario payload accurately and handles corrupt data", () => {
    const encoded = encodeCustomScenario(validSpec);
    const decoded = decodeCustomScenario(encoded);
    expect(decoded).toEqual(validSpec);

    expect(decodeCustomScenario("invalid-garbage-payload!!!")).toBeNull();
  });

  it("exports and imports JSON scenario specifications", () => {
    const jsonStr = exportScenarioJson(validSpec);
    expect(jsonStr).toContain("Oncology Precision Trial");

    const imported = importScenarioJson(jsonStr);
    expect(imported).toEqual(validSpec);
  });
});

// Branch coverage for the payload engine's optional fields and fallbacks:
// every optional key must survive a round trip, a bare payload must stay
// bare, and anything that is not an encoded spec object decodes to null.
describe("Custom scenario payload edge cases", () => {
  const cards = getAllCodexCards();
  const scenarioEvents = Object.values(SCENARIOS).find(
    (s) => (s.events?.length ?? 0) > 0
  )?.events;

  const fullSpec: CustomScenarioSpec = {
    id: "custom-oncology",
    title: "Full Spec",
    summary: "Every optional field set.",
    intro: "Read the SAP first.",
    quota: 500,
    startingCpu: 12,
    rulebook: {
      percentPrecision: 1,
      meanPrecision: 2,
      roundingMode: "TRUNCATE",
      populationSuit: "SAFETY",
    },
    cardIds: cards.slice(0, 5).map((c) => c.id),
    ...(scenarioEvents ? { events: scenarioEvents } : {}),
  };

  const bareSpec: CustomScenarioSpec = {
    title: "Bare Spec",
    quota: 50,
    startingCpu: 1,
    rulebook: {
      percentPrecision: 0,
      meanPrecision: 0,
      roundingMode: "HALF_AWAY_FROM_ZERO",
    },
    cardIds: ["not-a-card-1", "not-a-card-2", "x3", "x4", "x5"],
  };

  it("round-trips every optional field, and keeps a bare spec bare", () => {
    expect(scenarioEvents?.length).toBeGreaterThan(0);
    expect(decodeCustomScenario(encodeCustomScenario(fullSpec))).toEqual(
      fullSpec
    );
    expect(decodeCustomScenario(encodeCustomScenario(bareSpec))).toEqual(
      bareSpec
    );
  });

  it("decodes non-object and schema-invalid payloads to null", () => {
    const encode = (value: string) =>
      Buffer.from(value, "utf8")
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    expect(decodeCustomScenario(encode("null"))).toBeNull();
    expect(decodeCustomScenario(encode("42"))).toBeNull();
    expect(
      decodeCustomScenario(
        encode(JSON.stringify({ t: "x", q: 1, cpu: 1, r: {}, c: [] }))
      )
    ).toBeNull();
  });

  it("builds a scenario with the spec's id, defaults and placeholder cards", () => {
    const full = createCustomScenario(fullSpec);
    expect(full.id).toBe("custom-oncology");
    expect(full.summary).toBe("Every optional field set.");
    expect(full.intro).toBe("Read the SAP first.");
    expect(full.rulebook.populationSuit).toBe("SAFETY");
    expect(full.events).toEqual(scenarioEvents);

    const bare = createCustomScenario(bareSpec);
    expect(bare.id).toMatch(/^custom-scenario-/);
    expect(bare.summary).toContain("Deck Builder");
    expect(bare.intro).toContain("50 study quota");
    expect(bare.events).toBeUndefined();
    expect(bare.deck.map((c) => c.id)).toEqual(bareSpec.cardIds);
    expect(bare.deck[0].title).toBe("Custom Output 1");
  });

  it("opens a custom-only challenge link on the default seed", () => {
    const encoded = encodeCustomScenario(bareSpec);
    const parsed = parseChallengeHash(`#scenario=${encoded}`);
    expect(parsed?.seed).toBe("7K3M-Q9PX");
    expect(parsed?.customScenario).toEqual(bareSpec);
    expect(parseChallengeHash("#custom=garbage")).toBeNull();
  });
});

describe("DeckBuilder Component Modal UI", () => {
  it("renders modal, filters cards, and handles user interactions", async () => {
    const onStartCustomRun = vi.fn();
    const onClose = vi.fn();

    render(
      <DeckBuilder onStartCustomRun={onStartCustomRun} onClose={onClose} />
    );

    expect(screen.getByText(/Arcade Deck Builder/i)).toBeDefined();

    const titleInput = screen.getByLabelText(/Scenario Title/i);
    fireEvent.change(titleInput, { target: { value: "My Custom Deck" } });

    const quotaInput = screen.getByLabelText(/Study Quota/i);
    fireEvent.change(quotaInput, { target: { value: "600" } });

    const searchInput = screen.getByPlaceholderText(/Search cards/i);
    fireEvent.change(searchInput, { target: { value: "Table" } });

    const startBtn = screen.getByRole("button", { name: /Start Custom Run/i });
    fireEvent.click(startBtn);

    await waitFor(() => {
      expect(onStartCustomRun).toHaveBeenCalled();
      const spec = onStartCustomRun.mock.calls[0][0];
      expect(spec.title).toBe("My Custom Deck");
      expect(spec.quota).toBe(600);
    });
  });
});
