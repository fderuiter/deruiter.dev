import { z } from "zod";
import { ProjectImageErrorCode, type ProjectImageResult } from "../shared";

export const UploadProjectImageInputSchema = z.object({
  slug: z.string().trim().min(1, "Project slug is required"),
  fileBuffer: z.custom<Buffer>((val) => Buffer.isBuffer(val), {
    message: "Invalid image payload: File is empty or missing.",
  }),
  mimeType: z.string(),
});

export type UploadProjectImageInput = z.infer<
  typeof UploadProjectImageInputSchema
>;

export { ProjectImageErrorCode, type ProjectImageResult };

export interface UploadProjectImageSpec {
  execute(input: UploadProjectImageInput): Promise<ProjectImageResult>;
}
