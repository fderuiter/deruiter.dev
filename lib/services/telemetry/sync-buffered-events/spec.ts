import { z } from "zod";
import type { TelemetrySyncResult } from "../shared";

export const SyncBufferedEventsInputSchema = z.object({
  batchSize: z.number().int().positive().max(5000).default(100),
});

export type SyncBufferedEventsInput = z.input<
  typeof SyncBufferedEventsInputSchema
>;

export type SyncBufferedEventsResult = TelemetrySyncResult;

export interface SyncBufferedEventsSpec {
  execute(input?: SyncBufferedEventsInput): Promise<SyncBufferedEventsResult>;
}
