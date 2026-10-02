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
