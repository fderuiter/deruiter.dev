// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  GetRequestConnectionHashHandler,
  type GetRequestConnectionHashDeps,
} from "@/lib/services";

type RequestInput = NonNullable<
  NonNullable<
    Parameters<GetRequestConnectionHashHandler["execute"]>[0]
  >["requestOrHeaders"]
>;

describe("GetRequestConnectionHashHandler (Logic Test)", () => {
  it("hashes IP and user-agent while ignoring spoofed x-connection-hash", async () => {
    const handler = new GetRequestConnectionHashHandler();
    const reqA = fromPartial<RequestInput>({
      headers: new Headers({
        "x-forwarded-for": "203.0.113.5",
        "user-agent": "Agent/1.0",
        "x-connection-hash": "spoofed-a",
      }),
    });
    const reqB = fromPartial<RequestInput>({
      headers: new Headers({
        "x-forwarded-for": "203.0.113.5",
        "user-agent": "Agent/1.0",
        "x-connection-hash": "spoofed-b",
      }),
    });

    const resA = await handler.execute({ requestOrHeaders: reqA });
    const resB = await handler.execute({ requestOrHeaders: reqB });

    expect(resA.success).toBe(true);
    expect(resB.success).toBe(true);
    if (resA.success && resB.success) {
      expect(resA.data.hash).toBe(resB.data.hash);
    }
  });

  it("returns HASH_FAILED when hash dependency rejects", async () => {
    const deps = fromPartial<GetRequestConnectionHashDeps>({
      hashFn: async () => {
        throw new Error("crypto unavailable");
      },
    });
    const handler = new GetRequestConnectionHashHandler(deps);
    const result = await handler.execute({});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("HASH_FAILED");
    }
  });
});
