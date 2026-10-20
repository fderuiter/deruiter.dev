import { z } from "zod";
import type { GameEngineState } from "@/lib/garmin/engine";
import type { ServiceResult } from "@/lib/services/service-result";

export const VariableTypeSchema = z.enum(["int", "float", "string", "array"]);

export const AllocateGarminMemoryInputSchema = z.object({
  state: z.custom<GameEngineState>(
    (val) => Boolean(val && typeof val === "object"),
    {
      message: "GameEngineState is required",
    }
  ),
  type: VariableTypeSchema,
  name: z.string().optional(),
});

export type AllocateGarminMemoryInput = z.infer<
  typeof AllocateGarminMemoryInputSchema
>;

export const AllocateGarminMemoryErrorCode = z.enum([
  "OUT_OF_MEMORY",
  "INVALID_VARIABLE_TYPE",
  "INVALID_STATE",
]);

export type AllocateGarminMemoryErrorCode = z.infer<
  typeof AllocateGarminMemoryErrorCode
>;

export interface AllocateGarminMemoryData {
  state: GameEngineState;
  allocatedSizeKb: number;
  newRamKb: number;
  ramLimitKb: number;
}

export type AllocateGarminMemoryResult = ServiceResult<
  AllocateGarminMemoryData,
  AllocateGarminMemoryErrorCode
>;

export interface AllocateGarminMemorySpec {
  execute(input: AllocateGarminMemoryInput): AllocateGarminMemoryResult;
}
