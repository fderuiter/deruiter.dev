import { z } from "zod";
import {
  ProjectImageErrorCode,
  type ProjectImageValidationResult,
} from "../shared";

export const ValidateProjectImageInputSchema = z.object({
  buffer: z.custom<Buffer>((val) => Buffer.isBuffer(val), {
    message: "Invalid image payload: File is empty or missing.",
  }),
  mimeType: z.string(),
});

export type ValidateProjectImageInput = z.infer<
  typeof ValidateProjectImageInputSchema
>;

export { ProjectImageErrorCode, type ProjectImageValidationResult };

export interface ValidateProjectImageSpec {
  execute(input: ValidateProjectImageInput): ProjectImageValidationResult;
}
