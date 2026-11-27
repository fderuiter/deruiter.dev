import { z } from "zod";
import type { TelemetryRetentionResult } from "../shared";

export const RollupAndPruneTelemetryInputSchema = z.object({
  before: z.date(),
});

export type RollupAndPruneTelemetryInput = z.infer<
  typeof RollupAndPruneTelemetryInputSchema
>;

export type RollupAndPruneTelemetryResult = TelemetryRetentionResult;

export interface RollupAndPruneTelemetrySpec {
  execute(
    input: RollupAndPruneTelemetryInput
  ): Promise<RollupAndPruneTelemetryResult>;
}
