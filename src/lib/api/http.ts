// Common HTTP adapter — same-origin `/api/v1` calls with the Better Auth session.
//
// Contract rules honoured:
//   - Success is `{ data, meta }`, failure is `{ error, meta }`; BOTH are Zod-
//     validated. An HTTP 200 whose body doesn't match the contract is an error.
//   - 401 → UNAUTHENTICATED (login), 403 → FORBIDDEN (no permission), 404 →
//     NOT_FOUND. Network failure, non-JSON, 5xx, and abort are distinct errors.
//   - Never falls back to mock data.
//   - Cookies/tokens are sent via the browser session (credentials); nothing is
//     logged or persisted here.
//   - Mutations send a JSON Content-Type + optional Idempotency-Key, same-origin
//     (the server enforces an Origin/CORS check).

import type { z } from "zod";
// Relative (not "@/contracts") so this module loads standalone under the node
// test runner, which does not resolve the "@/" tsconfig alias. `RequestState` is
// a type-only import (erased), so importing this file does not pull in index.ts.
import { ApiFailureSchema, apiSuccessSchema, pageSchema, type Page } from "../../contracts/index.ts";
import type { RequestState } from "./index";

const BASE = "/api/v1";

export type SendOpts = {
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

async function request<S extends z.ZodType>(
  method: string,
  path: string,
  dataSchema: S,
  opts: SendOpts = {},
): Promise<RequestState<z.infer<S>>> {
  const hasBody = opts.body !== undefined;
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : {}),
      },
      body: hasBody ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError")
      return { kind: "error", code: "ABORTED", message: "요청이 취소되었습니다.", retryable: true };
    return { kind: "error", code: "NETWORK", message: "네트워크 오류입니다. 연결을 확인해 주세요.", retryable: true };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    // Non-JSON body (e.g. an HTML error page or empty response).
    return {
      kind: "error",
      code: "INVALID_RESPONSE",
      message: "서버 응답을 해석할 수 없습니다.",
      retryable: res.status >= 500,
    };
  }

  if (res.ok) {
    const parsed = apiSuccessSchema(dataSchema).safeParse(json);
    if (parsed.success) {
      const data = (parsed.data as { data: z.infer<S> }).data;
      return { kind: "success", data };
    }
    return {
      kind: "error",
      code: "VALIDATION_FAILED",
      message: "서버 응답이 계약과 일치하지 않습니다.",
      retryable: false,
    };
  }

  // Error path — prefer the server's typed {error, meta} envelope.
  const fail = ApiFailureSchema.safeParse(json);
  if (fail.success) {
    const e = fail.data.error;
    return { kind: "error", code: e.code, message: e.message, retryable: e.retryable };
  }
  const byStatus: Record<number, string> = { 401: "UNAUTHENTICATED", 403: "FORBIDDEN", 404: "NOT_FOUND" };
  return {
    kind: "error",
    code: byStatus[res.status] ?? "INTERNAL_ERROR",
    message: `요청 실패 (${res.status})`,
    retryable: res.status >= 500,
  };
}

/** GET a single resource, validated against `dataSchema`. */
export function httpGet<S extends z.ZodType>(
  path: string,
  dataSchema: S,
  signal?: AbortSignal,
): Promise<RequestState<z.infer<S>>> {
  return request("GET", path, dataSchema, { signal });
}

/** POST/PATCH/DELETE with optional JSON body + idempotency key. */
export function httpSend<S extends z.ZodType>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  dataSchema: S,
  opts: SendOpts = {},
): Promise<RequestState<z.infer<S>>> {
  return request(method, path, dataSchema, opts);
}

/** GET a paged list (`{ items, nextCursor }`). An empty page becomes `empty`. */
export async function httpList<S extends z.ZodType>(
  path: string,
  itemSchema: S,
  signal?: AbortSignal,
): Promise<RequestState<Page<z.infer<S>>>> {
  const r = await request("GET", path, pageSchema(itemSchema), { signal });
  if (r.kind === "success" && r.data.items.length === 0) return { kind: "empty" };
  return r as RequestState<Page<z.infer<S>>>;
}
