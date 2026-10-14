import { z } from "zod";
import type { WorkingWithDuckState } from "@/lib/working-with-duck-engine";
import type { ServiceResult } from "@/lib/services/service-result";

export const DuckTrickSchema = z.enum(["SIT", "HIGH_FIVE", "DROP_IT", "SPIN"]);
export const DuckAccessorySchema = z.enum([
  "none",
  "bucket-hat",
  "bowtie",
  "bandana",
  "rain-boots",
  "graduation-hat",
]);

export const DuckCommandInputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("trick"),
    state: z.custom<WorkingWithDuckState>((val) =>
      Boolean(val && typeof val === "object")
    ),
    trick: DuckTrickSchema,
  }),
  z.object({
    type: z.literal("accessory"),
    state: z.custom<WorkingWithDuckState>((val) =>
      Boolean(val && typeof val === "object")
    ),
    accessory: DuckAccessorySchema,
  }),
  z.object({
    type: z.literal("treat"),
    state: z.custom<WorkingWithDuckState>((val) =>
      Boolean(val && typeof val === "object")
    ),
  }),
  z.object({
    type: z.literal("pet"),
    state: z.custom<WorkingWithDuckState>((val) =>
      Boolean(val && typeof val === "object")
    ),
    x: z.number().default(400),
    y: z.number().default(250),
  }),
  z.object({
    type: z.literal("throw_ball"),
    state: z.custom<WorkingWithDuckState>((val) =>
      Boolean(val && typeof val === "object")
    ),
    targetX: z.number(),
    targetY: z.number(),
  }),
  z.object({
    type: z.literal("station"),
    state: z.custom<WorkingWithDuckState>((val) =>
      Boolean(val && typeof val === "object")
    ),
    station: z.enum(["water", "food", "bed", "bath"]),
  }),
  z.object({
    type: z.literal("advance_level"),
    state: z.custom<WorkingWithDuckState>((val) =>
      Boolean(val && typeof val === "object")
    ),
  }),
]);

export type DuckCommandInput = z.infer<typeof DuckCommandInputSchema>;

export const DuckCommandErrorCode = z.enum([
  "INVALID_BEHAVIOR_STATE",
  "UNKNOWN_COMMAND",
  "INVALID_STATE",
  "EXECUTION_FAILED",
]);

export type DuckCommandErrorCode = z.infer<typeof DuckCommandErrorCode>;

export interface DuckCommandData {
  state: WorkingWithDuckState;
  commandExecuted: string;
  mood: string;
  naughtyVsGood: number;
}

export type DuckCommandResult = ServiceResult<
  DuckCommandData,
  DuckCommandErrorCode
>;

export interface DuckCommandSpec {
  execute(input: DuckCommandInput): DuckCommandResult;
}
