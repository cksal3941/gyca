// Front-end data adapter (MOCK). Validates raw fixtures against the shared
// contracts and returns branded/typed values wrapped in a UI RequestState.
// This is NOT a live API connection — no network, no persistence.
//
// Domain types come from `@/contracts` (Codex-owned). We never re-declare them
// and never assert strings into branded ids: safeParse produces the branded
// values, and a parse failure becomes an `error` state (never passed as data).

import { z } from "zod";
import {
  CompetitionSchema,
  EntrySummarySchema,
  EntryDetailSchema,
  AssetSchema,
  OrderSummarySchema,
  CertificateSummarySchema,
  CreateEntryRequestSchema,
  UpdateEntryRequestSchema,
  type Competition,
  type EntrySummary,
  type EntryDetail,
  type Asset,
  type OrderSummary,
  type CertificateSummary,
  type UpdateEntryRequest,
  type Page,
} from "@/contracts";
import {
  RAW_COMPETITIONS,
  RAW_ENTRIES,
  RAW_ENTRY_EXTRA,
  RAW_ENTRY_ASSETS,
  RAW_ASSETS,
  RAW_ORDERS,
  RAW_CERTIFICATES,
  RAW_CERT_STATE,
  RAW_PAYMENT_OPTIONS,
  RAW_PAYMENT_ORDER,
} from "@/lib/mock/fixtures";
import {
  PaymentOptionsSchema,
  SelectPaymentRouteSchema,
  type PaymentOptions,
} from "@/contracts/payment-options";
import { PaymentOrderSchema, type PaymentOrder } from "@/contracts/payments";
import {
  SubmissionReadinessSchema,
  SubmissionResultSchema,
  SubmitEntryRequestSchema,
  type SubmissionReadiness,
  type SubmissionResult,
  type SubmitEntryRequest,
} from "@/contracts/submissions";
import { REQUIRED_CONSENTS } from "@/lib/content/submit-consent";
import {
  UploadRequestSchema,
  UploadSessionSchema,
  RemoveUploadSchema,
  type UploadRequest,
  type UploadSession,
} from "@/contracts/uploads";
import { SubmissionRecordSchema } from "@/contracts/submission-record";
import { SubmissionDownloadSchema } from "@/contracts/submission-download";
import { isLive } from "./mode";
import { httpGet, httpSend, httpList } from "./http";

/* ---- UI request state (Claude-owned; not a transport type) ---- */

export type RequestState<T> =
  | { kind: "loading" }
  | { kind: "success"; data: T }
  | { kind: "empty" }
  | { kind: "error"; code: string; message: string; retryable: boolean };

function summarizeIssues(error: z.ZodError): string {
  return error.issues
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}

/** Parse one raw fixture at the adapter boundary. */
function parseOne<S extends z.ZodType>(
  schema: S,
  raw: unknown,
): RequestState<z.infer<S>> {
  const r = schema.safeParse(raw);
  if (r.success) return { kind: "success", data: r.data };
  return {
    kind: "error",
    code: "VALIDATION_FAILED",
    message: summarizeIssues(r.error),
    retryable: false,
  };
}

/** Parse a list; an empty (valid) list becomes the `empty` state so screens can
 *  show a distinct empty view. Any invalid item fails the whole list. */
function parseList<S extends z.ZodType>(
  schema: S,
  raws: readonly unknown[],
): RequestState<Page<z.infer<S>>> {
  const items: z.infer<S>[] = [];
  for (const raw of raws) {
    const r = schema.safeParse(raw);
    if (!r.success) {
      return { kind: "error", code: "VALIDATION_FAILED", message: summarizeIssues(r.error), retryable: false };
    }
    items.push(r.data);
  }
  if (items.length === 0) return { kind: "empty" };
  return { kind: "success", data: { items, nextCursor: null } };
}

/* ---- scenario keys (derived from the fixtures) ---- */

export type CompetitionScenario = keyof typeof RAW_COMPETITIONS;
export type EntryScenario = keyof typeof RAW_ENTRIES;
export type AssetScenario = keyof typeof RAW_ASSETS;
export type ListScenario = "some" | "empty" | "error";

/* ---- synchronous getters (usable from server components) ---- */

export function getCompetitionSync(
  scenario: CompetitionScenario = "open-ready",
): RequestState<Competition> {
  return parseOne(CompetitionSchema, RAW_COMPETITIONS[scenario]);
}

export function getEntrySync(scenario: EntryScenario): RequestState<EntrySummary> {
  return parseOne(EntrySummarySchema, RAW_ENTRIES[scenario]);
}

/** Look up one entry by its (branded) id — the shape my-page cards link with.
 *  Unknown ids resolve to a NOT_FOUND error so detail routes can 404. */
const ENTRIES_BY_ID: Record<string, unknown> = Object.fromEntries(
  Object.values(RAW_ENTRIES).map((e) => [(e as { id: string }).id, e]),
);

export function getEntryByIdSync(id: string): RequestState<EntrySummary> {
  const raw = ENTRIES_BY_ID[id];
  if (raw === undefined)
    return { kind: "error", code: "NOT_FOUND", message: "해당 접수를 찾을 수 없습니다.", retryable: false };
  return parseOne(EntrySummarySchema, raw);
}

export async function getEntryById(
  id: string,
  opts: { delayMs?: number } = {},
): Promise<RequestState<EntrySummary>> {
  if (opts.delayMs) await wait(opts.delayMs);
  return getEntryByIdSync(id);
}

/** Full entry (summary + participant/work/guardian draft) for the detail view. */
export function getEntryDetailByIdSync(id: string): RequestState<EntryDetail> {
  const base = ENTRIES_BY_ID[id];
  if (base === undefined)
    return { kind: "error", code: "NOT_FOUND", message: "해당 접수를 찾을 수 없습니다.", retryable: false };
  const extra = RAW_ENTRY_EXTRA[id] ?? { participant: {}, work: {}, guardian: {} };
  return parseOne(EntryDetailSchema, { ...(base as object), ...extra });
}

/** Live-capable entry detail. Live: GET /entries/{id} (EntryDetail — status,
 *  revision, allowedActions, participant/work/guardian draft). Mock: fixture. */
export async function getEntryDetail(
  id: string,
  opts: { delayMs?: number; signal?: AbortSignal } = {},
): Promise<RequestState<EntryDetail>> {
  if (isLive) return httpGet(`/entries/${encodeURIComponent(id)}`, EntryDetailSchema, opts.signal);
  if (opts.delayMs) await wait(opts.delayMs);
  return getEntryDetailByIdSync(id);
}

/** Live-capable uploaded files. Live: the frozen submission snapshot
 *  (GET /entries/{id}/submission) — its files are all accepted, so they map to
 *  `ready` Assets; a draft has no snapshot yet (404 → no files, not an error).
 *  Mock: the per-entry asset fixtures (which may show in-progress states). */
export async function getEntryAssets(
  id: string,
  opts: { delayMs?: number; signal?: AbortSignal } = {},
): Promise<RequestState<Asset[]>> {
  if (isLive) {
    const r = await httpGet(
      `/entries/${encodeURIComponent(id)}/submission`,
      SubmissionRecordSchema,
      opts.signal,
    );
    if (r.kind === "success") {
      const assets: Asset[] = [];
      for (const a of r.data.assets) {
        const parsed = AssetSchema.safeParse({
          id: a.id,
          purpose: a.purpose,
          displayName: a.displayName,
          sizeBytes: a.sizeBytes,
          state: "ready",
          pageCount: a.pageCount,
          rejectionCode: null,
        });
        if (parsed.success) assets.push(parsed.data);
      }
      return { kind: "success", data: assets };
    }
    // A draft has no frozen snapshot yet — that 404 means "no files", not an error.
    if (r.kind === "error" && r.code === "NOT_FOUND") return { kind: "success", data: [] };
    return r;
  }
  if (opts.delayMs) await wait(opts.delayMs);
  return { kind: "success", data: getEntryAssetsSync(id) };
}

/** Short-lived (60s) signed download URL for one submitted file. Live: POST
 *  /entries/{id}/submission/assets/{assetId}/download (no body; the server signs
 *  only the frozen snapshot's ready file). Draft files are NOT downloadable.
 *  A fresh URL must be requested each time (URLs expire and are not reused/logged).
 *  Mock: no real storage, so this is a live-only action. */
export async function downloadSubmissionAsset(
  entryId: string,
  assetId: string,
  opts: { signal?: AbortSignal } = {},
): Promise<RequestState<z.infer<typeof SubmissionDownloadSchema>>> {
  if (isLive)
    return httpSend(
      "POST",
      `/entries/${encodeURIComponent(entryId)}/submission/assets/${encodeURIComponent(assetId)}/download`,
      SubmissionDownloadSchema,
      { signal: opts.signal },
    );
  return {
    kind: "error",
    code: "NOT_CONNECTED",
    message: "미리보기에서는 파일 다운로드를 지원하지 않습니다.",
    retryable: false,
  };
}

/* ---- entry draft lifecycle writes (LIVE-capable; no payment here) ---- */

/** Create a draft entry. Live: POST /entries (Idempotency-Key required; the same
 *  key + body returns the original result, so retries never double-create) →
 *  EntryDetail. Mock: the draft fixture. The returned `revision`/`allowedActions`
 *  are server facts — the caller must not derive its own. */
export async function createEntry(
  competitionId: string,
  opts: { idempotencyKey: string; delayMs?: number; signal?: AbortSignal },
): Promise<RequestState<EntryDetail>> {
  const req = CreateEntryRequestSchema.safeParse({ competitionId });
  if (!req.success)
    return { kind: "error", code: "VALIDATION_FAILED", message: summarizeIssues(req.error), retryable: false };
  if (isLive)
    return httpSend("POST", "/entries", EntryDetailSchema, {
      body: req.data,
      idempotencyKey: opts.idempotencyKey,
      signal: opts.signal,
    });
  if (opts.delayMs) await wait(opts.delayMs);
  return getEntryDetailByIdSync("entry_draft");
}

/** Save allowed draft fields. Live: PATCH /entries/{id} (server saves only
 *  participant/work/guardian draft fields — never status/price/owner) →
 *  EntryDetail with the new `revision`. Mock: echoes the current draft detail.
 *  A save FAILURE must never be shown as "saved" (the error state stands). */
export async function updateEntry(
  id: string,
  input: UpdateEntryRequest,
  opts: { delayMs?: number; signal?: AbortSignal } = {},
): Promise<RequestState<EntryDetail>> {
  const req = UpdateEntryRequestSchema.safeParse(input);
  if (!req.success)
    return { kind: "error", code: "VALIDATION_FAILED", message: summarizeIssues(req.error), retryable: false };
  if (isLive)
    return httpSend("PATCH", `/entries/${encodeURIComponent(id)}`, EntryDetailSchema, {
      body: req.data,
      signal: opts.signal,
    });
  if (opts.delayMs) await wait(opts.delayMs);
  return getEntryDetailByIdSync(id);
}

/* ---- submit (snapshot creation; still before payment) ---- */

/** Submission readiness — the server's gate + `policyToken` + the three consent
 *  documents to display. Live: GET /entries/{id}/submission-readiness?locale=…
 *  (the client submits only when `allowedActions` includes "submit"). Mock: the
 *  three required consents + a placeholder token. */
export async function getSubmissionReadiness(
  id: string,
  locale: "en" | "ko" = "en",
  opts: { delayMs?: number; signal?: AbortSignal } = {},
): Promise<RequestState<SubmissionReadiness>> {
  if (isLive)
    return httpGet(
      `/entries/${encodeURIComponent(id)}/submission-readiness?locale=${locale}`,
      SubmissionReadinessSchema,
      opts.signal,
    );
  if (opts.delayMs) await wait(opts.delayMs);
  return parseOne(SubmissionReadinessSchema, {
    entryId: id,
    revision: 1,
    policyToken: "0".repeat(64),
    locale,
    documents: REQUIRED_CONSENTS.map((c) => ({
      kind: c.kind,
      version: c.version,
      locale,
      title: c.title[locale],
      text: c.summary[locale],
    })),
    allowedActions: ["submit"],
    blockingReasons: [],
    fieldErrors: [],
    ageGroup: null,
  });
}

/** Submit the entry — creates the frozen snapshot and moves draft → submitted.
 *  Live: POST /entries/{id}/submit (Idempotency-Key required; body validated
 *  against SubmitEntryRequest — exactly the three required consents, all accepted)
 *  → SubmissionResult. A `submitted` result is NOT a confirmed entry: payment is
 *  still required (blockingReasons). Mock: a submitted result awaiting payment. */
export async function submitEntry(
  id: string,
  input: SubmitEntryRequest,
  opts: { idempotencyKey: string; delayMs?: number; signal?: AbortSignal },
): Promise<RequestState<SubmissionResult>> {
  const req = SubmitEntryRequestSchema.safeParse(input);
  if (!req.success)
    return { kind: "error", code: "VALIDATION_FAILED", message: summarizeIssues(req.error), retryable: false };
  if (isLive)
    return httpSend("POST", `/entries/${encodeURIComponent(id)}/submit`, SubmissionResultSchema, {
      body: req.data,
      idempotencyKey: opts.idempotencyKey,
      signal: opts.signal,
    });
  if (opts.delayMs) await wait(opts.delayMs);
  return parseOne(SubmissionResultSchema, {
    entryId: id,
    revision: input.revision,
    entryStatus: "submitted",
    submittedAt: "2027-01-01T00:00:00Z",
    receiptNumber: null,
    receivedAt: null,
    allowedActions: ["view_submission"],
    blockingReasons: ["PAYMENT_REQUIRED"],
  });
}

/** Work title for an entry (MOCK). EntrySummary has no workTitle field yet — this
 *  joins the draft fixture so lists can show it. Contract gap flagged for Codex. */
export function getEntryWorkTitle(id: string): string | null {
  const extra = RAW_ENTRY_EXTRA[id];
  const w = extra?.work as { englishTitle?: string } | undefined;
  return w?.englishTitle?.trim() ? w.englishTitle! : null;
}

/** Uploaded files for an entry (validated Assets; empty when none). */
export function getEntryAssetsSync(id: string): Asset[] {
  const out: Asset[] = [];
  for (const raw of RAW_ENTRY_ASSETS[id] ?? []) {
    const r = AssetSchema.safeParse(raw);
    if (r.success) out.push(r.data);
  }
  return out;
}

/** Certificate lifecycle state (MOCK — not in CertificateSummary; Codex to model). */
export type CertLifecycleState = "issued" | "pending" | "reissuing" | "error";
export function getCertState(id: string): CertLifecycleState {
  return RAW_CERT_STATE[id] ?? "issued";
}

export function getAssetSync(scenario: AssetScenario): RequestState<Asset> {
  return parseOne(AssetSchema, RAW_ASSETS[scenario]);
}

/* ---- async variants (simulate loading / error / retry for screens) ---- */

const wait = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

export async function getCompetition(
  scenario: CompetitionScenario = "open-ready",
  opts: { delayMs?: number } = {},
): Promise<RequestState<Competition>> {
  if (opts.delayMs) await wait(opts.delayMs);
  return getCompetitionSync(scenario);
}

/** Live-capable competition lookup by slug. Live: GET /competitions/{slug}
 *  (published + public content only; unknown/unpublished → NOT_FOUND). Mock: the
 *  open-ready fixture (the Leipzig first-launch competition). */
export async function getCompetitionBySlug(
  slug: string,
  opts: { delayMs?: number; signal?: AbortSignal } = {},
): Promise<RequestState<Competition>> {
  if (isLive) return httpGet(`/competitions/${encodeURIComponent(slug)}`, CompetitionSchema, opts.signal);
  if (opts.delayMs) await wait(opts.delayMs);
  return getCompetitionSync("open-ready");
}

/** Published competitions (id + title etc.). Live: GET /competitions. Mock: the
 *  fixture competitions, deduped by id. Used to resolve a competitionId → title
 *  where the entry contracts only carry the id (see My Page cards / entry detail).
 *  An empty list is a `success` page here (not `empty`) so callers get a map. */
export async function listCompetitions(
  opts: { signal?: AbortSignal } = {},
): Promise<RequestState<Page<Competition>>> {
  if (isLive) {
    const r = await httpList("/competitions?limit=50", CompetitionSchema, opts.signal);
    return r.kind === "empty" ? { kind: "success", data: { items: [], nextCursor: null } } : r;
  }
  const seen = new Map<string, Competition>();
  for (const s of ["open-ready", "upcoming", "archived"] as const) {
    const r = getCompetitionSync(s);
    if (r.kind === "success") seen.set(r.data.id, r.data);
  }
  return { kind: "success", data: { items: [...seen.values()], nextCursor: null } };
}

export async function listMyEntries(
  scenario: ListScenario = "some",
  opts: { delayMs?: number; signal?: AbortSignal } = {},
): Promise<RequestState<Page<EntrySummary>>> {
  if (isLive) return httpList("/entries?limit=50", EntrySummarySchema, opts.signal);
  if (opts.delayMs) await wait(opts.delayMs);
  if (scenario === "error") {
    return { kind: "error", code: "RATE_LIMITED", message: "일시적으로 요청이 많습니다. 잠시 후 다시 시도하세요.", retryable: true };
  }
  const source = scenario === "empty" ? [] : Object.values(RAW_ENTRIES);
  return parseList(EntrySummarySchema, source);
}

export async function listMyOrders(
  scenario: ListScenario = "some",
  opts: { delayMs?: number; signal?: AbortSignal } = {},
): Promise<RequestState<Page<OrderSummary>>> {
  if (isLive) return httpList("/orders?limit=50", OrderSummarySchema, opts.signal);
  if (opts.delayMs) await wait(opts.delayMs);
  if (scenario === "error") {
    return { kind: "error", code: "INTERNAL_ERROR", message: "주문 내역을 불러오지 못했습니다.", retryable: true };
  }
  return parseList(OrderSummarySchema, scenario === "empty" ? RAW_ORDERS.empty : RAW_ORDERS.some);
}

export async function listMyCertificates(
  scenario: ListScenario = "some",
  opts: { delayMs?: number; signal?: AbortSignal } = {},
): Promise<RequestState<Page<CertificateSummary>>> {
  if (isLive) return httpList("/certificates?limit=50", CertificateSummarySchema, opts.signal);
  if (opts.delayMs) await wait(opts.delayMs);
  if (scenario === "error") {
    return { kind: "error", code: "INTERNAL_ERROR", message: "인증서를 불러오지 못했습니다.", retryable: true };
  }
  return parseList(CertificateSummarySchema, scenario === "empty" ? RAW_CERTIFICATES.empty : RAW_CERTIFICATES.some);
}

/* ---- action gating helpers (drive CTAs off server-provided actions) ---- */

/** HOME/detail Apply is offered only when the parsed competition explicitly
 *  allows `start_entry`. The client never derives new allowed actions. */
export function canStartEntry(competition: Competition): boolean {
  return competition.allowedActions.includes("start_entry");
}

export function canViewGuidelines(competition: Competition): boolean {
  return competition.allowedActions.includes("view_guidelines") && competition.guidelines !== null;
}

/* ---- payment routing (MOCK — no real PG / payment window) ---- */

export type PaymentOptionsScenario = keyof typeof RAW_PAYMENT_OPTIONS;

export function getPaymentOptionsSync(
  scenario: PaymentOptionsScenario = "createReady",
): RequestState<PaymentOptions> {
  return parseOne(PaymentOptionsSchema, RAW_PAYMENT_OPTIONS[scenario]);
}

export async function getPaymentOptions(
  scenario: PaymentOptionsScenario = "createReady",
  opts: { delayMs?: number } = {},
): Promise<RequestState<PaymentOptions>> {
  if (opts.delayMs) await wait(opts.delayMs);
  return getPaymentOptionsSync(scenario);
}

/** Whether the options allow creating an order. NOTE: order creation is NOT a
 *  payment window — the real PG/checkout is still not wired. */
export function canCreateOrder(options: PaymentOptions): boolean {
  return options.allowedActions.includes("create_order");
}

/** Stable idempotency key per order-creation attempt (reuse across retries). */
export function newIdempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `idem-${Date.now()}`;
}

type CreateOrderResult = "success" | "consent_required" | "idempotency_conflict";

/**
 * MOCK order creation. Validates the outgoing body against SelectPaymentRoute
 * (acceptedRefundNotice must be true; no amount/country/merchant), then returns
 * a PaymentOrder or a contract error. No real order/PG is created.
 */
export async function createOrder(
  input: { routeId: string; policyToken: string; acceptedRefundNotice: true },
  opts: { idempotencyKey: string; result?: CreateOrderResult; delayMs?: number },
): Promise<RequestState<PaymentOrder>> {
  if (opts.delayMs) await wait(opts.delayMs);
  const req = SelectPaymentRouteSchema.safeParse(input);
  if (!req.success) {
    return { kind: "error", code: "VALIDATION_FAILED", message: summarizeIssues(req.error), retryable: false };
  }
  if (opts.result === "consent_required") {
    return { kind: "error", code: "CONSENT_REQUIRED", message: "환불 안내가 변경되었습니다. 다시 확인 후 동의해 주세요.", retryable: true };
  }
  if (opts.result === "idempotency_conflict") {
    return { kind: "error", code: "IDEMPOTENCY_CONFLICT", message: "이미 다른 경로로 주문이 생성되었습니다.", retryable: false };
  }
  return parseOne(PaymentOrderSchema, RAW_PAYMENT_ORDER);
}

/* ---- LIVE-capable payment adapters (entry-id aware; used by the real flow) ----
 * The scenario-based getPaymentOptions/createOrder above stay for the DS demo +
 * styleguide. These take the real entry/order ids. NOTE: creating an order is
 * NOT a payment window — the PG provider/checkout redirect is still not wired. */

/** Server-priced payment options for an entry (routes + policyToken + money).
 *  Live: GET /entries/{id}/payment-options. Mock: the createReady fixture. */
export async function getEntryPaymentOptions(
  entryId: string,
  opts: { delayMs?: number; signal?: AbortSignal } = {},
): Promise<RequestState<PaymentOptions>> {
  if (isLive)
    return httpGet(`/entries/${encodeURIComponent(entryId)}/payment-options`, PaymentOptionsSchema, opts.signal);
  if (opts.delayMs) await wait(opts.delayMs);
  return getPaymentOptionsSync("createReady");
}

/** Create (or reuse) the entry-fee order for a chosen route. Live: POST
 *  /entries/{id}/orders — Idempotency-Key required; body is SelectPaymentRoute
 *  (acceptedRefundNotice must be true). The same key + body returns the original
 *  order (no double-charge); a different body under the same key is a 409. Server
 *  sets the price — no amount/country/merchant is sent. Mock: the order fixture. */
export async function createEntryOrder(
  entryId: string,
  input: { routeId: string; policyToken: string; acceptedRefundNotice: true },
  opts: { idempotencyKey: string; delayMs?: number; signal?: AbortSignal },
): Promise<RequestState<PaymentOrder>> {
  const req = SelectPaymentRouteSchema.safeParse(input);
  if (!req.success)
    return { kind: "error", code: "VALIDATION_FAILED", message: summarizeIssues(req.error), retryable: false };
  if (isLive)
    return httpSend("POST", `/entries/${encodeURIComponent(entryId)}/orders`, PaymentOrderSchema, {
      body: req.data,
      idempotencyKey: opts.idempotencyKey,
      signal: opts.signal,
    });
  if (opts.delayMs) await wait(opts.delayMs);
  return parseOne(PaymentOrderSchema, RAW_PAYMENT_ORDER);
}

/** Poll an order's state (the "check payment" / receipt-pending re-read). Live:
 *  GET /orders/{id}. Reaching a success URL is NOT completion — the server state
 *  is the source of truth. Mock: the order fixture. */
export async function getOrder(
  orderId: string,
  opts: { delayMs?: number; signal?: AbortSignal } = {},
): Promise<RequestState<PaymentOrder>> {
  if (isLive) return httpGet(`/orders/${encodeURIComponent(orderId)}`, PaymentOrderSchema, opts.signal);
  if (opts.delayMs) await wait(opts.delayMs);
  return parseOne(PaymentOrderSchema, RAW_PAYMENT_ORDER);
}

/* ---- uploads (draft file lifecycle; the browser does the presigned transfer) ---- */

const RemoveUploadResultSchema = z.object({ revision: z.number().int().positive() }).readonly();

/** List an entry's draft files. Live: GET /entries/{id}/uploads → Asset[] with
 *  their live validation states (the frozen submission snapshot is a SEPARATE
 *  call — see getEntryAssets). Mock: the per-entry asset fixtures. */
export async function listEntryUploads(
  entryId: string,
  opts: { signal?: AbortSignal } = {},
): Promise<RequestState<Page<Asset>>> {
  if (isLive) return httpList(`/entries/${encodeURIComponent(entryId)}/uploads`, AssetSchema, opts.signal);
  const items = getEntryAssetsSync(entryId);
  if (items.length === 0) return { kind: "empty" };
  return { kind: "success", data: { items, nextCursor: null } };
}

/** Begin an upload: reserve an asset + get the presigned transfer target. Live:
 *  POST /entries/{id}/uploads (Idempotency-Key required; body = UploadRequest with
 *  the current revision) → UploadSession (asset, new revision, upload target,
 *  expiry). The browser then transfers the bytes to `upload.url`; THIS response
 *  alone does not mean the file is stored or valid. Mock: a session, no target. */
export async function createUpload(
  entryId: string,
  input: UploadRequest,
  opts: { idempotencyKey: string; delayMs?: number; signal?: AbortSignal },
): Promise<RequestState<UploadSession>> {
  const req = UploadRequestSchema.safeParse(input);
  if (!req.success)
    return { kind: "error", code: "VALIDATION_FAILED", message: summarizeIssues(req.error), retryable: false };
  if (isLive)
    return httpSend("POST", `/entries/${encodeURIComponent(entryId)}/uploads`, UploadSessionSchema, {
      body: req.data,
      idempotencyKey: opts.idempotencyKey,
      signal: opts.signal,
    });
  if (opts.delayMs) await wait(opts.delayMs);
  return parseOne(UploadSessionSchema, {
    asset: {
      id: "asset_mock",
      purpose: input.purpose,
      displayName: input.filename,
      sizeBytes: input.sizeBytes,
      state: "pending_upload",
      pageCount: null,
      rejectionCode: null,
    },
    revision: input.revision + 1,
    upload: null,
    expiresAt: "2027-01-01T00:00:00Z",
  });
}

/** Confirm the browser finished transferring. Live: POST
 *  /entries/{id}/uploads/{assetId}/complete → Asset. Validation is queued: the
 *  returned state may still be `validating` — readiness is decided by the server,
 *  not by this response. Mock: an asset moving to `validating`. */
export async function completeUpload(
  entryId: string,
  assetId: string,
  opts: { delayMs?: number; signal?: AbortSignal } = {},
): Promise<RequestState<Asset>> {
  if (isLive)
    return httpSend(
      "POST",
      `/entries/${encodeURIComponent(entryId)}/uploads/${encodeURIComponent(assetId)}/complete`,
      AssetSchema,
      { body: {}, signal: opts.signal },
    );
  if (opts.delayMs) await wait(opts.delayMs);
  return parseOne(AssetSchema, {
    id: assetId,
    purpose: "book_pdf",
    displayName: "book.pdf",
    sizeBytes: 1_000_000,
    state: "validating",
    pageCount: null,
    rejectionCode: null,
  });
}

/** Remove a draft file reference. Live: DELETE /entries/{id}/uploads/{assetId}
 *  (body = the current revision) → the new revision. A frozen submitted file
 *  cannot be removed (server enforces). Mock: the next revision. */
export async function removeUpload(
  entryId: string,
  assetId: string,
  revision: number,
  opts: { delayMs?: number; signal?: AbortSignal } = {},
): Promise<RequestState<{ revision: number }>> {
  const req = RemoveUploadSchema.safeParse({ revision });
  if (!req.success)
    return { kind: "error", code: "VALIDATION_FAILED", message: summarizeIssues(req.error), retryable: false };
  if (isLive)
    return httpSend(
      "DELETE",
      `/entries/${encodeURIComponent(entryId)}/uploads/${encodeURIComponent(assetId)}`,
      RemoveUploadResultSchema,
      { body: req.data, signal: opts.signal },
    );
  if (opts.delayMs) await wait(opts.delayMs);
  return { kind: "success", data: { revision: revision + 1 } };
}
