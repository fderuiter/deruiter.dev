import { z } from "zod";
import type { GameEngineState } from "@/lib/garmin-engine";
import type { ServiceResult } from "@/lib/services/service-result";

export const GarbageCollectInputSchema = z.object({
  state: z.custom<GameEngineState>(
    (val) => Boolean(val && typeof val === "object"),
    {
      message: "GameEngineState is required",
    }
  ),
});

export type GarbageCollectInput = z.infer<typeof GarbageCollectInputSchema>;

export const GarbageCollectErrorCode = z.enum([
  "GC_ALREADY_ACTIVE",
  "GC_COOLDOWN",
  "INVALID_GAME_STATE",
]);

export type GarbageCollectErrorCode = z.infer<typeof GarbageCollectErrorCode>;

export interface GarbageCollectData {
  state: GameEngineState;
  freedKb: number;
  remainingRamKb: number;
}

export type GarbageCollectResult = ServiceResult<
  GarbageCollectData,
  GarbageCollectErrorCode
>;

export interface GarbageCollectSpec {
  execute(input: GarbageCollectInput): GarbageCollectResult;
}
