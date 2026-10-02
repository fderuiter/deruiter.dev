import type {
  CustomScenarioSpec,
  Scenario,
  StudyEvent,
  TlfCard,
} from "../types";
import { CustomScenarioSpecSchema, ScenarioSchema } from "../types";
import { DEMOGRAPHICS_SCENARIO, SCENARIOS } from "../scenarios";

/**
 * Returns all available unique TLF cards across all built-in scenarios in the Codex.
 */
export function getAllCodexCards(): TlfCard[] {
  const map = new Map<string, TlfCard>();
  for (const scenario of Object.values(SCENARIOS)) {
    for (const card of scenario.deck) {
      if (!map.has(card.id)) {
        map.set(card.id, card);
      }
    }
  }
  return Array.from(map.values());
}

/**
 * Compiles a CustomScenarioSpec into a fully playable Scenario object
 * that conforms to ScenarioSchema.
 */
export function createCustomScenario(
  spec: CustomScenarioSpec,
  cardLibrary: readonly TlfCard[] = getAllCodexCards()
): Scenario {
  const validatedSpec = CustomScenarioSpecSchema.parse(spec);

  const libraryMap = new Map<string, TlfCard>();
  for (const card of cardLibrary) {
    libraryMap.set(card.id, card);
  }

  const fallbackCard = DEMOGRAPHICS_SCENARIO.deck[0];

  const matchedCards: TlfCard[] = validatedSpec.cardIds.map((cardId, idx) => {
    const found = libraryMap.get(cardId);
    if (found) {
      return { ...found };
    }
    // Synthesize valid placeholder TLF card if ID not in library
    return {
      ...fallbackCard,
      id: cardId,
      title: `Custom Output ${idx + 1}`,
      number: `T14.${idx + 1}.1`,
    };
  });

  const baseRulebook = DEMOGRAPHICS_SCENARIO.rulebook;
  const customRulebook = {
    ...baseRulebook,
    percentPrecision: validatedSpec.rulebook.percentPrecision,
    meanPrecision: validatedSpec.rulebook.meanPrecision,
    roundingMode: validatedSpec.rulebook.roundingMode,
    populationSuit:
      validatedSpec.rulebook.populationSuit ?? baseRulebook.populationSuit,
  };

  const scenarioId =
    validatedSpec.id ?? `custom-scenario-${Date.now().toString(36)}`;
  const title = validatedSpec.title;
  const summary =
    validatedSpec.summary ??
    "A custom clinical trial scenario built with the Deck Builder.";
  const intro =
    validatedSpec.intro ??
    `Custom Deck Challenge: Achieve ${validatedSpec.quota} study quota with your deck.`;

  const rawScenario: Scenario = {
    id: scenarioId,
    title,
    summary,
    intro,
    blind: {
      name: "Custom Study Quota",
      quota: validatedSpec.quota,
      tier: "SMALL_BLIND",
    },

    handType: "HIGH_TABLE",
    startingCpu: validatedSpec.startingCpu,
    rulebook: customRulebook,
    populationSnapshot: DEMOGRAPHICS_SCENARIO.populationSnapshot,
    shells: DEMOGRAPHICS_SCENARIO.shells,
    drawPile: DEMOGRAPHICS_SCENARIO.drawPile,
    table: {
      startingCpu: validatedSpec.startingCpu,
      handSize: 8,
      maxSelection: 5,
    },
    deck: matchedCards,
    ...(validatedSpec.events ? { events: validatedSpec.events } : {}),
  };

  return ScenarioSchema.parse(rawScenario);
}

/**
 * Compact internal representations for payload compression.
 */
interface CompactSpec {
  id?: string;
  t: string;
  s?: string;
  i?: string;
  q: number;
  cpu: number;
  r: {
    p: number;
    m: number;
    rm: "HALF_EVEN" | "HALF_AWAY_FROM_ZERO" | "TRUNCATE";
    ps?: "SCREENED" | "ITT" | "SAFETY" | "PER_PROTOCOL" | "FAS";
  };
  c: string[];
  e?: unknown[];
}

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(binary, "binary").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(base64url: string): string {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary =
    typeof atob === "function"
      ? atob(base64)
      : Buffer.from(base64, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Encodes a CustomScenarioSpec into a compressed URL-safe string.
 */
export function encodeCustomScenario(spec: CustomScenarioSpec): string {
  const validated = CustomScenarioSpecSchema.parse(spec);
  const compact: CompactSpec = {
    ...(validated.id ? { id: validated.id } : {}),
    t: validated.title,
    ...(validated.summary ? { s: validated.summary } : {}),
    ...(validated.intro ? { i: validated.intro } : {}),
    q: validated.quota,
    cpu: validated.startingCpu,
    r: {
      p: validated.rulebook.percentPrecision,
      m: validated.rulebook.meanPrecision,
      rm: validated.rulebook.roundingMode,
      ...(validated.rulebook.populationSuit
        ? { ps: validated.rulebook.populationSuit }
        : {}),
    },
    c: validated.cardIds,
    ...(validated.events ? { e: validated.events } : {}),
  };

  const json = JSON.stringify(compact);
  return toBase64Url(json);
}

/**
 * Decodes a compressed URL-safe string back into a CustomScenarioSpec,
 * returning null if malformed or invalid.
 */
export function decodeCustomScenario(
  encoded: string
): CustomScenarioSpec | null {
  try {
    const json = fromBase64Url(encoded);
    const compact = JSON.parse(json) as CompactSpec;
    if (!compact || typeof compact !== "object") return null;

    const spec = {
      ...(compact.id ? { id: compact.id } : {}),
      title: compact.t,
      ...(compact.s ? { summary: compact.s } : {}),
      ...(compact.i ? { intro: compact.i } : {}),
      quota: compact.q,
      startingCpu: compact.cpu,
      rulebook: {
        percentPrecision: compact.r.p,
        meanPrecision: compact.r.m,
        roundingMode: compact.r.rm,
        ...(compact.r.ps ? { populationSuit: compact.r.ps } : {}),
      },
      cardIds: compact.c,
      ...(compact.e ? { events: compact.e as StudyEvent[] } : {}),
    };

    const parsed = CustomScenarioSpecSchema.safeParse(spec);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Serializes a CustomScenarioSpec as a JSON string for export.
 */
export function exportScenarioJson(spec: CustomScenarioSpec): string {
  const validated = CustomScenarioSpecSchema.parse(spec);
  return JSON.stringify(validated, null, 2);
}

/**
 * Parses and validates an imported scenario JSON payload string.
 */
export function importScenarioJson(jsonStr: string): CustomScenarioSpec {
  const parsed = JSON.parse(jsonStr);
  return CustomScenarioSpecSchema.parse(parsed);
}
