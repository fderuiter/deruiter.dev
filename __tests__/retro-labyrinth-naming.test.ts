import { describe, it, expect } from "vitest";
import {
  RETRO_LABYRINTH_HIGH_SCORE_KEY,
  formatCampaignRoomBadge,
  generateRoguelikeCampaign,
} from "@/lib/dungeon";
import { GAME_MANUALS } from "@/lib/game-manuals";
import { ARCADE_GAMES_METADATA } from "@/lib/arcade-data";

// #1322: room 1 read "TIER 03" and room 2 "ROOM 02", and the manual named a
// high-score key the game never wrote.

describe("Retro Labyrinth room badges (#1322)", () => {
  it("numbers campaign rooms by their position", () => {
    expect(
      generateRoguelikeCampaign().map((room, i) =>
        formatCampaignRoomBadge(room.badge, i)
      )
    ).toEqual([
      "ROOM 01 :: AIRGAP ENCLAVE",
      "ROOM 02 :: BOSS ARENA",
      "ROOM 03 :: GAZE TRACKING",
      "ROOM 04 :: DARKNET VAULT",
    ]);
  });

  it("keeps a badge with no separator as the room name", () => {
    expect(formatCampaignRoomBadge("Vault", 9)).toBe("ROOM 10 :: Vault");
  });
});

describe("Retro Labyrinth high-score key (#1322)", () => {
  it("is the key the game writes, in the manual and the catalogue", () => {
    expect(RETRO_LABYRINTH_HIGH_SCORE_KEY).toBe("retro_labyrinth_highscore");
    expect(GAME_MANUALS["retro-labyrinth"].storageKey).toBe(
      RETRO_LABYRINTH_HIGH_SCORE_KEY
    );
    expect(
      ARCADE_GAMES_METADATA.find((g) => g.route === "/arcade/retro-labyrinth")
        ?.storageKey
    ).toBe(RETRO_LABYRINTH_HIGH_SCORE_KEY);
  });
});
