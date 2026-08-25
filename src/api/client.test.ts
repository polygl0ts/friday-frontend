import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, errorMessage, request, setAuthToken } from "./client";

// This test env's `localStorage` global is unreliable (Node's own
// experimental implementation can shadow jsdom's) - stub a minimal
// in-memory one rather than depend on either.
function stubLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  });
}

describe("request", () => {
  beforeEach(() => {
    stubLocalStorage();
    setAuthToken(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("attaches the bearer token when set", async () => {
    setAuthToken("tok123");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await request("https://api.example", "/foo");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer tok123");
  });

  it("omits the Authorization header when auth: false", async () => {
    setAuthToken("tok123");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await request("https://api.example", "/foo", { auth: false });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("sends a FormData body verbatim, without a Content-Type of its own", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const fd = new FormData();
    fd.append("avatar", new File(["x"], "a.png", { type: "image/png" }));

    await request("https://api.example", "/foo", { method: "PATCH", body: fd });

    const [, init] = fetchMock.mock.calls[0];
    // Same object, not a JSON.stringify of it - and no header, so the browser
    // can supply `multipart/form-data; boundary=...` itself.
    expect(init.body).toBe(fd);
    expect(init.headers["Content-Type"]).toBeUndefined();
  });

  it("still JSON-encodes a plain object body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await request("https://api.example", "/foo", { method: "POST", body: { a: 1 } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe('{"a":1}');
    expect(init.headers["Content-Type"]).toBe("application/json");
  });

  it("throws ApiError with the status code on a non-2xx response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ detail: "nope" }), { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(request("https://api.example", "/foo")).rejects.toMatchObject(
      new ApiError("nope", 403),
    );
  });
});

describe("errorMessage", () => {
  it("reads FastAPI's string detail and rCTF's message", () => {
    expect(errorMessage({ detail: "nope" })).toBe("nope");
    expect(errorMessage({ kind: "badToken", message: "invalid token" })).toBe("invalid token");
  });

  it("renders FastAPI's schema errors instead of [object Object]", () => {
    const body = {
      detail: [
        {
          type: "string_too_long",
          loc: ["body", "summary"],
          msg: "String should have at most 500 characters",
        },
      ],
    };
    expect(errorMessage(body)).toBe("summary: String should have at most 500 characters");
  });

  it("joins multiple field errors", () => {
    const body = {
      detail: [
        { loc: ["body", "summary"], msg: "too long" },
        { loc: ["body", "body_md"], msg: "too long" },
      ],
    };
    expect(errorMessage(body)).toBe("summary: too long; body_md: too long");
  });

  it("returns null when there is nothing readable, so the caller can fall back", () => {
    expect(errorMessage({})).toBeNull();
    expect(errorMessage({ detail: [] })).toBeNull();
    expect(errorMessage("plain text")).toBeNull();
  });
});

describe("request error bodies", () => {
  beforeEach(() => {
    stubLocalStorage();
    setAuthToken(null);
  });

  it("surfaces a validation error as readable text", async () => {
    const body = { detail: [{ loc: ["body", "summary"], msg: "String should have at most 500 characters" }] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 422 })));

    await expect(request("https://api.example", "/foo")).rejects.toThrow(
      "summary: String should have at most 500 characters",
    );
  });
});
