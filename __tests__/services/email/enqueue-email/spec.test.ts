// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  EnqueueEmailErrorCode,
  EnqueueEmailOptionsSchema,
} from "@/lib/services";

describe("EnqueueEmail Spec (Contract Test)", () => {
  it("accepts valid outbound email options", () => {
    expect(
      EnqueueEmailOptionsSchema.safeParse({
        to: "reader@example.com",
        subject: "Welcome",
        html: "<p>Hello</p>",
      }).success
    ).toBe(true);
  });

  it("rejects empty subject and defines ENQUEUE_FAILED and INVALID_INPUT", () => {
    expect(
      EnqueueEmailOptionsSchema.safeParse({
        to: "reader@example.com",
        subject: "",
        html: "<p>Hello</p>",
      }).success
    ).toBe(false);
    expect(EnqueueEmailErrorCode.options).toEqual(
      expect.arrayContaining(["ENQUEUE_FAILED", "INVALID_INPUT"])
    );
  });
});
