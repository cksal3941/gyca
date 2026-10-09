import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { httpGet, httpSend, httpList } from "../src/lib/api/http.ts";

// Adapter behaviour tests — mock global.fetch and assert the RequestState mapping.
// No server/DB required; this verifies envelope validation + error classification.

const meta = { requestId: "req_1", serverTime: "2027-01-01T00:00:00Z" };
const Item = z.object({ id: z.string() });

const jsonResponse = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function withFetch(impl, fn) {
  const orig = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await fn();
  } finally {
    globalThis.fetch = orig;
  }
}

test("httpGet success validates {data,meta}", async () => {
  await withFetch(
    async () => jsonResponse(200, { data: { id: "x" }, meta }),
    async () => {
      const r = await httpGet("/thing", Item);
      assert.equal(r.kind, "success");
      assert.equal(r.data.id, "x");
    },
  );
});

test("200 body that violates the contract → VALIDATION_FAILED", async () => {
  await withFetch(
    async () => jsonResponse(200, { data: { nope: 1 }, meta }),
    async () => {
      const r = await httpGet("/thing", Item);
      assert.equal(r.kind, "error");
      assert.equal(r.code, "VALIDATION_FAILED");
    },
  );
});

test("401 → UNAUTHENTICATED (typed error envelope)", async () => {
  await withFetch(
    async () =>
      jsonResponse(401, {
        error: { code: "UNAUTHENTICATED", message: "UNAUTHENTICATED", retryable: false, fieldErrors: [] },
        meta,
      }),
    async () => {
      const r = await httpGet("/thing", Item);
      assert.equal(r.code, "UNAUTHENTICATED");
      assert.equal(r.retryable, false);
    },
  );
});

test("403 → FORBIDDEN, 404 → NOT_FOUND (status fallback when JSON isn't the error envelope)", async () => {
  await withFetch(
    async () => jsonResponse(403, { unexpected: true }),
    async () => {
      const r = await httpGet("/thing", Item);
      assert.equal(r.code, "FORBIDDEN");
    },
  );
  await withFetch(
    async () => jsonResponse(404, { unexpected: true }),
    async () => {
      const r = await httpGet("/thing", Item);
      assert.equal(r.code, "NOT_FOUND");
    },
  );
});

test("5xx non-JSON → INVALID_RESPONSE, retryable", async () => {
  await withFetch(
    async () => new Response("<html>500</html>", { status: 500 }),
    async () => {
      const r = await httpGet("/thing", Item);
      assert.equal(r.kind, "error");
      assert.equal(r.code, "INVALID_RESPONSE");
      assert.equal(r.retryable, true);
    },
  );
});

test("network failure → NETWORK", async () => {
  await withFetch(
    async () => {
      throw new TypeError("failed to fetch");
    },
    async () => {
      const r = await httpGet("/thing", Item);
      assert.equal(r.code, "NETWORK");
      assert.equal(r.retryable, true);
    },
  );
});

test("aborted request → ABORTED", async () => {
  await withFetch(
    async () => {
      throw new DOMException("aborted", "AbortError");
    },
    async () => {
      const r = await httpGet("/thing", Item);
      assert.equal(r.code, "ABORTED");
    },
  );
});

test("httpList: empty page → empty; non-empty → success", async () => {
  await withFetch(
    async () => jsonResponse(200, { data: { items: [], nextCursor: null }, meta }),
    async () => {
      const r = await httpList("/things", Item);
      assert.equal(r.kind, "empty");
    },
  );
  await withFetch(
    async () => jsonResponse(200, { data: { items: [{ id: "a" }], nextCursor: null }, meta }),
    async () => {
      const r = await httpList("/things", Item);
      assert.equal(r.kind, "success");
      assert.equal(r.data.items.length, 1);
    },
  );
});

test("httpSend POST sends JSON body + Idempotency-Key and returns validated data", async () => {
  let seen;
  await withFetch(
    async (url, init) => {
      seen = { url, init };
      return jsonResponse(201, { data: { id: "created" }, meta });
    },
    async () => {
      const r = await httpSend("POST", "/entries", Item, {
        body: { competitionId: "c1" },
        idempotencyKey: "key-123",
      });
      assert.equal(r.kind, "success");
      assert.equal(r.data.id, "created");
    },
  );
  assert.equal(seen.init.method, "POST");
  assert.equal(seen.init.headers["Content-Type"], "application/json");
  assert.equal(seen.init.headers["Idempotency-Key"], "key-123");
  assert.equal(seen.init.body, JSON.stringify({ competitionId: "c1" }));
});

test("httpSend PATCH omits Idempotency-Key when none given; maps typed error envelope", async () => {
  let seen;
  await withFetch(
    async (url, init) => {
      seen = { url, init };
      return jsonResponse(422, {
        error: { code: "VALIDATION_FAILED", message: "bad", retryable: false, fieldErrors: [] },
        meta,
      });
    },
    async () => {
      const r = await httpSend("PATCH", "/entries/e1", Item, { body: { work: {} } });
      assert.equal(r.kind, "error");
      assert.equal(r.code, "VALIDATION_FAILED");
    },
  );
  assert.equal(seen.init.method, "PATCH");
  assert.equal("Idempotency-Key" in seen.init.headers, false);
});

test("does not fall back to mock on failure (error stays error)", async () => {
  await withFetch(
    async () => jsonResponse(500, { error: { code: "INTERNAL_ERROR", message: "x", retryable: true, fieldErrors: [] }, meta }),
    async () => {
      const r = await httpGet("/thing", Item);
      assert.equal(r.kind, "error");
      assert.notEqual(r.kind, "success");
    },
  );
});
