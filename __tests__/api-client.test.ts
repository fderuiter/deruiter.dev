// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function lastInit(): RequestInit {
  return fetchMock.mock.calls.at(-1)?.[1] as RequestInit;
}

describe("apiClient", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("requests", () => {
    it("sends GET without a body or JSON content type", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ ok: 1 }));

      await apiClient.get("/api/x");

      expect(fetchMock).toHaveBeenCalledWith("/api/x", expect.any(Object));
      const init = lastInit();
      expect(init.method).toBe("GET");
      expect(init.body).toBeUndefined();
      expect(new Headers(init.headers).has("Content-Type")).toBe(false);
    });

    it.each([
      ["post", "POST"],
      ["put", "PUT"],
      ["patch", "PATCH"],
    ] as const)(
      "%s serialises the body as JSON with a JSON content type",
      async (verb, method) => {
        fetchMock.mockResolvedValue(jsonResponse({}));

        await apiClient[verb]("/api/x", { a: 1, b: ["c"] });

        const init = lastInit();
        expect(init.method).toBe(method);
        expect(init.body).toBe(JSON.stringify({ a: 1, b: ["c"] }));
        expect(new Headers(init.headers).get("Content-Type")).toBe(
          "application/json"
        );
      }
    );

    it("sends DELETE without a body", async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

      await apiClient.delete("/api/x/1");

      expect(lastInit().method).toBe("DELETE");
      expect(lastInit().body).toBeUndefined();
    });

    it("sends a POST with no body when none is given", async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));

      await apiClient.post("/api/x");

      expect(lastInit().body).toBeUndefined();
      expect(new Headers(lastInit().headers).has("Content-Type")).toBe(false);
    });

    it("keeps caller headers and init options, and never overrides a caller content type", async () => {
      fetchMock.mockResolvedValue(jsonResponse({}));
      const controller = new AbortController();

      await apiClient.post(
        "/api/x",
        { a: 1 },
        {
          headers: {
            "content-type": "application/vnd.custom+json",
            "X-Trace": "t1",
          },
          signal: controller.signal,
          method: "GET",
        }
      );

      const init = lastInit();
      const headers = new Headers(init.headers);
      expect(init.method).toBe("POST");
      expect(init.signal).toBe(controller.signal);
      expect(headers.get("Content-Type")).toBe("application/vnd.custom+json");
      expect(headers.get("X-Trace")).toBe("t1");
    });

    it("detects FormData bodies, omits application/json Content-Type, and passes raw FormData", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
      const formData = new FormData();
      formData.append("file", "test");

      await apiClient.post("/api/upload", formData);

      const init = lastInit();
      expect(init.method).toBe("POST");
      expect(init.body).toBe(formData);
      expect(new Headers(init.headers).has("Content-Type")).toBe(false);
    });
  });

  describe("successful responses", () => {
    it("returns parsed JSON as data and body, and exposes response headers", async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify({ id: "abc" }), {
          status: 201,
          headers: {
            "Content-Type": "application/json",
            "x-telemetry-offline": "expected",
          },
        })
      );

      const res = await apiClient.post<{ id: string }>("/api/x", {});

      expect(res).toEqual({
        data: { id: "abc" },
        error: null,
        details: [],
        body: { id: "abc" },
        headers: expect.any(Headers),
        status: 201,
        ok: true,
        networkError: false,
      });
      expect(res.headers.get("x-telemetry-offline")).toBe("expected");
    });

    it("does not treat an `error` field on a 2xx body as a failure", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ error: "ignored" }));

      const res = await apiClient.get("/api/x");

      expect(res.ok).toBe(true);
      expect(res.error).toBeNull();
    });

    it.each([204, 205])(
      "returns null data for a %i response",
      async (status) => {
        fetchMock.mockResolvedValue(new Response(null, { status }));

        const res = await apiClient.delete("/api/x");

        expect(res).toMatchObject({ ok: true, status, data: null, body: null });
      }
    );

    it("returns null data for a zero-length body", async () => {
      fetchMock.mockResolvedValue(
        new Response("", { status: 200, headers: { "Content-Length": "0" } })
      );

      const res = await apiClient.get("/api/x");

      expect(res).toMatchObject({ ok: true, data: null });
    });

    it("returns null data for an empty body without a length header", async () => {
      fetchMock.mockResolvedValue(new Response("", { status: 200 }));

      const res = await apiClient.get("/api/x");

      expect(res).toMatchObject({ ok: true, data: null });
    });

    it("returns null data for a non-JSON 2xx body instead of throwing", async () => {
      fetchMock.mockResolvedValue(
        new Response("<html>ok</html>", { status: 200 })
      );

      const res = await apiClient.get("/api/x");

      expect(res).toMatchObject({ ok: true, status: 200, data: null });
    });

    it("works with minimal fetch doubles that only implement json()", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ counts: { a: 1 } }),
      });

      const res = await apiClient.get("/api/x");

      expect(res.data).toEqual({ counts: { a: 1 } });
    });
  });

  describe("error responses", () => {
    it("parses the createApiHandler envelope", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(
          {
            error: "Validation failed",
            details: [{ path: "slug", message: "Slug is required" }],
          },
          400
        )
      );

      const res = await apiClient.post("/api/x", {});

      expect(res).toEqual({
        data: null,
        error: "Validation failed",
        details: [{ path: "slug", message: "Slug is required" }],
        body: {
          error: "Validation failed",
          details: [{ path: "slug", message: "Slug is required" }],
        },
        headers: expect.any(Headers),
        status: 400,
        ok: false,
        networkError: false,
      });
    });

    it("keeps extra fields of an error body available on `body`", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ error: "Duplicate", counts: { a: 2 } }, 429)
      );

      const res = await apiClient.post("/api/x", {});

      expect(res.error).toBe("Duplicate");
      expect(res.data).toBeNull();
      expect(res.body).toEqual({ error: "Duplicate", counts: { a: 2 } });
    });

    it("drops malformed detail entries and defaults a missing path", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(
          {
            error: "Bad",
            details: [
              null,
              "text",
              { path: 3, message: "no path" },
              { path: "x" },
              { path: "y", message: "kept" },
            ],
          },
          422
        )
      );

      const res = await apiClient.post("/api/x", {});

      expect(res.details).toEqual([
        { path: "", message: "no path" },
        { path: "y", message: "kept" },
      ]);
    });

    it("ignores details that are not an array", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ error: "Bad", details: { path: "x" } }, 400)
      );

      const res = await apiClient.post("/api/x", {});

      expect(res.details).toEqual([]);
    });

    it.each([
      ["a non-string error", { error: 42 }],
      ["a blank error", { error: "   " }],
      ["no error field", { message: "nope" }],
      ["an array body", ["error"]],
      ["a primitive body", "oops"],
    ])("reports error as null for %s", async (_label, body) => {
      fetchMock.mockResolvedValue(jsonResponse(body, 500));

      const res = await apiClient.get("/api/x");

      expect(res).toMatchObject({
        ok: false,
        status: 500,
        error: null,
        details: [],
      });
    });

    it("falls back gracefully for a non-JSON error page", async () => {
      fetchMock.mockResolvedValue(
        new Response("<html>502 Bad Gateway</html>", {
          status: 502,
          headers: { "Content-Type": "text/html" },
        })
      );

      const res = await apiClient.get("/api/x");

      expect(res).toEqual({
        data: null,
        error: null,
        details: [],
        body: null,
        headers: expect.any(Headers),
        status: 502,
        ok: false,
        networkError: false,
      });
    });

    it("reports a network failure as status 0 without throwing", async () => {
      fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

      const res = await apiClient.post("/api/x", { a: 1 });

      expect(res).toEqual({
        data: null,
        error: null,
        details: [],
        body: null,
        headers: expect.any(Headers),
        status: 0,
        ok: false,
        networkError: true,
      });
    });

    it("reports an aborted request as a network failure", async () => {
      fetchMock.mockRejectedValue(new DOMException("aborted", "AbortError"));

      const res = await apiClient.get("/api/x");

      expect(res).toMatchObject({ status: 0, networkError: true });
    });
  });
});
