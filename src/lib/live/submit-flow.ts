"use client";

// LIVE submit flow (real /api/v1 adapters). Same `SubmitFlow` interface as the
// mock `useSubmitFlow`, so the presentational form consumes either one. Only
// mounted when NEXT_PUBLIC_API_MODE=live (the mock hook still drives previews).
//
// Boundaries mirror the server + the mock's contract:
//   - The server is the source of truth: file "ready"/pageCount, payment state,
//     and entry "received" come from the server, never from a client check.
//   - A failed save is never shown as "saved".
//   - Reaching a step never marks the entry received; only a server order +
//     entry state flip to received (with a receipt number).
//   - Retrying payment never loses saved fields or uploads (they live on the
//     server draft, keyed by the entry id).
//   - No sensitive application data is persisted to localStorage.
//
// NOTE: creating an order is NOT a payment window — the PG provider/redirect is
// not selected yet. startPayment creates the order; refreshPayment polls it.

import { useCallback, useReducer, useRef } from "react";
import {
  createEntry,
  updateEntry,
  createUpload,
  completeUpload,
  listEntryUploads,
  removeUpload,
  getSubmissionReadiness,
  submitEntry,
  getEntryPaymentOptions,
  createEntryOrder,
  getOrder,
  getEntryDetail,
  newIdempotencyKey,
} from "@/lib/api";
import { REQUIRED_CONSENTS } from "@/lib/content/submit-consent";
import type { Competition, PaymentState as ServerPaymentState } from "@/contracts";
import type {
  FlowState,
  SubmitFlow,
  AssetView,
  UploadPurpose,
  PaymentState,
} from "@/lib/mock/submit-machine";

const UPLOAD_MEDIA_TYPES = ["application/pdf", "image/png", "image/jpeg"] as const;
type UploadMediaType = (typeof UPLOAD_MEDIA_TYPES)[number];
const isUploadMediaType = (t: string): t is UploadMediaType =>
  (UPLOAD_MEDIA_TYPES as readonly string[]).includes(t);

const emptyAsset = (purpose: UploadPurpose): AssetView => ({
  purpose,
  filename: null,
  sizeBytes: null,
  state: "empty",
  progress: 0,
  pageCount: null,
  rejectionCode: null,
});

/** Map the server order state onto the flow's payment vocabulary. */
function mapPayment(state: ServerPaymentState): PaymentState {
  switch (state) {
    case "succeeded":
      return "succeeded";
    case "failed":
    case "expired":
      return "failed";
    case "cancelled":
      return "cancelled";
    case "pending":
    default:
      return "pending";
  }
}

function initialState(competition: Competition, entryId: string | null): FlowState {
  return {
    scenario: "happy", // unused in live; satisfies the shared FlowState type
    entryId: entryId ?? "",
    revision: 1,
    values: {},
    guardian: { name: "", email: "" },
    assets: { cover_image: emptyAsset("cover_image"), book_pdf: emptyAsset("book_pdf") },
    consents: {},
    optionalConsents: {},
    entryStatus: "draft",
    payment: "none",
    amountMinor: competition.fee?.amountMinor ?? 0,
    currency: "EUR",
    receiptNumber: null,
    submittedAt: null,
    receivedAt: null,
    blockingReasons: [],
    saveStatus: "idle",
    lastError: null,
  };
}

type Action =
  | { type: "SET_FIELD"; path: string; value: string }
  | { type: "SET_GUARDIAN"; key: "name" | "email"; value: string }
  | { type: "TOGGLE_CONSENT"; kind: string }
  | { type: "TOGGLE_OPTIONAL"; key: string }
  | { type: "SET_ENTRY_ID"; entryId: string }
  | { type: "SAVE_START" }
  | { type: "SAVE_OK"; revision: number }
  | { type: "SAVE_FAIL"; message: string }
  | { type: "ASSET"; purpose: UploadPurpose; patch: Partial<AssetView> }
  | { type: "SUBMIT_OK"; submittedAt: string; blockingReasons: string[] }
  | { type: "SUBMIT_BLOCK"; message: string; blockingReasons: string[] }
  | { type: "PAYMENT"; state: PaymentState; amountMinor?: number }
  | { type: "RECEIVED"; receiptNumber: string; receivedAt: string }
  | { type: "ERROR"; message: string | null };

function reducer(s: FlowState, a: Action): FlowState {
  switch (a.type) {
    case "SET_FIELD":
      return { ...s, values: { ...s.values, [a.path]: a.value }, saveStatus: "idle" };
    case "SET_GUARDIAN":
      return { ...s, guardian: { ...s.guardian, [a.key]: a.value }, saveStatus: "idle" };
    case "TOGGLE_CONSENT":
      return { ...s, consents: { ...s.consents, [a.kind]: !s.consents[a.kind] } };
    case "TOGGLE_OPTIONAL":
      return { ...s, optionalConsents: { ...s.optionalConsents, [a.key]: !s.optionalConsents[a.key] } };
    case "SET_ENTRY_ID":
      return { ...s, entryId: a.entryId };
    case "SAVE_START":
      return { ...s, saveStatus: "saving", lastError: null };
    case "SAVE_OK":
      return { ...s, saveStatus: "saved", revision: a.revision };
    case "SAVE_FAIL":
      return { ...s, saveStatus: "error", lastError: a.message };
    case "ASSET":
      return { ...s, assets: { ...s.assets, [a.purpose]: { ...s.assets[a.purpose], ...a.patch } } };
    case "SUBMIT_OK":
      return { ...s, entryStatus: "submitted", submittedAt: a.submittedAt, blockingReasons: a.blockingReasons, lastError: null };
    case "SUBMIT_BLOCK":
      return { ...s, blockingReasons: a.blockingReasons, lastError: a.message };
    case "PAYMENT":
      return { ...s, payment: a.state, amountMinor: a.amountMinor ?? s.amountMinor };
    case "RECEIVED":
      return { ...s, entryStatus: "received", receiptNumber: a.receiptNumber, receivedAt: a.receivedAt, blockingReasons: [] };
    case "ERROR":
      return { ...s, lastError: a.message };
    default:
      return s;
  }
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Split flat "group.key" values into a draft group object (non-empty only). */
function groupValues(values: Record<string, string>, group: "participant" | "work"): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, v] of Object.entries(values)) {
    if (!path.startsWith(`${group}.`)) continue;
    const key = path.slice(group.length + 1);
    const trimmed = v.trim();
    if (trimmed) out[key] = trimmed;
  }
  return out;
}

export function useLiveSubmitFlow({
  competition,
  locale,
  initialEntryId = null,
}: {
  competition: Competition;
  locale: "en" | "ko";
  initialEntryId?: string | null;
}): SubmitFlow {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialState(competition, initialEntryId));

  // Stable idempotency keys so retries of the SAME create never double-create.
  const createEntryKey = useRef<string | null>(null);
  const orderKey = useRef<string | null>(null);
  const uploadKeys = useRef<Record<string, string>>({});
  // Latest entry id / revision available to async steps without stale closures.
  const entryIdRef = useRef<string>(initialEntryId ?? "");
  const revisionRef = useRef<number>(1);
  const orderIdRef = useRef<string | null>(null);
  const assetIdRef = useRef<Record<string, string>>({});
  const aborted = useRef<Record<string, boolean>>({});

  const setField = useCallback((path: string, value: string) => dispatch({ type: "SET_FIELD", path, value }), []);
  const setGuardian = useCallback((key: "name" | "email", value: string) => dispatch({ type: "SET_GUARDIAN", key, value }), []);
  const toggleConsent = useCallback((kind: string) => dispatch({ type: "TOGGLE_CONSENT", kind }), []);
  const toggleOptional = useCallback((key: string) => dispatch({ type: "TOGGLE_OPTIONAL", key }), []);
  const clearError = useCallback(() => dispatch({ type: "ERROR", message: null }), []);

  /** Ensure a server draft exists; returns its id or null on failure. */
  const ensureEntry = useCallback(async (): Promise<string | null> => {
    if (entryIdRef.current) return entryIdRef.current;
    if (createEntryKey.current === null) createEntryKey.current = newIdempotencyKey();
    const r = await createEntry(competition.id, { idempotencyKey: createEntryKey.current });
    if (r.kind !== "success") {
      dispatch({ type: "SAVE_FAIL", message: r.kind === "error" ? r.message : "초안 생성에 실패했습니다." });
      return null;
    }
    entryIdRef.current = r.data.id;
    revisionRef.current = r.data.revision;
    dispatch({ type: "SET_ENTRY_ID", entryId: r.data.id });
    return r.data.id;
  }, [competition.id]);

  const saveDraft = useCallback(async () => {
    dispatch({ type: "SAVE_START" });
    const id = await ensureEntry();
    if (!id) return false;
    const guardian: { name?: string; email?: string } = {};
    if (state.guardian.name.trim()) guardian.name = state.guardian.name.trim();
    // Allow "" to clear; only send email when it is either empty or a full value.
    if (state.guardian.email.trim()) guardian.email = state.guardian.email.trim();
    const r = await updateEntry(id, {
      revision: revisionRef.current,
      participant: groupValues(state.values, "participant"),
      work: groupValues(state.values, "work"),
      ...(guardian.name !== undefined || guardian.email !== undefined ? { guardian } : {}),
    });
    if (r.kind !== "success") {
      dispatch({ type: "SAVE_FAIL", message: r.kind === "error" ? r.message : "임시저장에 실패했습니다." });
      return false;
    }
    revisionRef.current = r.data.revision;
    dispatch({ type: "SAVE_OK", revision: r.data.revision });
    return true;
  }, [ensureEntry, state.guardian.name, state.guardian.email, state.values]);

  /** Poll the uploads list until this asset reaches a terminal state. */
  const pollAsset = useCallback(async (entryId: string, purpose: UploadPurpose, assetId: string) => {
    for (let i = 0; i < 20; i++) {
      if (aborted.current[purpose]) return;
      const r = await listEntryUploads(entryId);
      const items = r.kind === "success" ? r.data.items : [];
      const found = items.find((a) => a.id === assetId);
      if (found) {
        if (found.state === "ready" || found.state === "rejected") {
          dispatch({
            type: "ASSET",
            purpose,
            patch: { state: found.state, pageCount: found.pageCount, rejectionCode: found.rejectionCode },
          });
          return;
        }
        dispatch({ type: "ASSET", purpose, patch: { state: found.state === "validating" ? "validating" : "uploaded" } });
      }
      await delay(1200);
    }
    // Timed out waiting for validation — leave as validating; the user can re-open later.
  }, []);

  const selectFile = useCallback(
    async (purpose: UploadPurpose, file: File) => {
      aborted.current[purpose] = false;
      const mediaType = file.type;
      if (!isUploadMediaType(mediaType)) {
        dispatch({ type: "ASSET", purpose, patch: { filename: file.name, sizeBytes: file.size, state: "rejected", rejectionCode: "UNSUPPORTED_MEDIA_TYPE", pageCount: null } });
        return;
      }
      const id = await ensureEntry();
      if (!id) return;
      dispatch({ type: "ASSET", purpose, patch: { filename: file.name, sizeBytes: file.size, state: "uploading", progress: 0, rejectionCode: null, pageCount: null } });

      if (uploadKeys.current[purpose] === undefined) uploadKeys.current[purpose] = newIdempotencyKey();
      const session = await createUpload(
        id,
        { revision: revisionRef.current, purpose, filename: file.name, sizeBytes: file.size, mediaType },
        { idempotencyKey: uploadKeys.current[purpose] },
      );
      if (session.kind !== "success") {
        dispatch({ type: "ASSET", purpose, patch: { state: "rejected", rejectionCode: "FILE_UNSAFE" } });
        dispatch({ type: "ERROR", message: session.kind === "error" ? session.message : "업로드를 시작하지 못했습니다." });
        return;
      }
      revisionRef.current = session.data.revision;
      assetIdRef.current[purpose] = session.data.asset.id;

      // Transfer the bytes to the presigned target (browser → storage).
      const target = session.data.upload;
      if (target) {
        dispatch({ type: "ASSET", purpose, patch: { progress: 40 } });
        try {
          const res = await fetch(target.url, { method: target.method, headers: target.headers, body: file });
          if (!res.ok) throw new Error(`transfer ${res.status}`);
        } catch {
          if (aborted.current[purpose]) {
            dispatch({ type: "ASSET", purpose, patch: emptyAsset(purpose) });
            return;
          }
          dispatch({ type: "ASSET", purpose, patch: { state: "rejected", rejectionCode: "FILE_CORRUPTED" } });
          return;
        }
      }
      if (aborted.current[purpose]) {
        dispatch({ type: "ASSET", purpose, patch: emptyAsset(purpose) });
        return;
      }
      dispatch({ type: "ASSET", purpose, patch: { state: "uploaded", progress: 100 } });

      const done = await completeUpload(id, session.data.asset.id);
      if (done.kind === "success") {
        if (done.data.state === "ready" || done.data.state === "rejected") {
          dispatch({ type: "ASSET", purpose, patch: { state: done.data.state, pageCount: done.data.pageCount, rejectionCode: done.data.rejectionCode } });
          return;
        }
        dispatch({ type: "ASSET", purpose, patch: { state: "validating" } });
      } else {
        dispatch({ type: "ASSET", purpose, patch: { state: "validating" } });
      }
      // Validation is the server's call — poll until ready/rejected.
      await pollAsset(id, purpose, session.data.asset.id);
    },
    [ensureEntry, pollAsset],
  );

  const abortUpload = useCallback((purpose: UploadPurpose) => {
    aborted.current[purpose] = true;
  }, []);

  const removeAsset = useCallback((purpose: UploadPurpose) => {
    aborted.current[purpose] = true;
    const assetId = assetIdRef.current[purpose];
    const id = entryIdRef.current;
    dispatch({ type: "ASSET", purpose, patch: emptyAsset(purpose) });
    if (id && assetId) {
      void removeUpload(id, assetId, revisionRef.current).then((r) => {
        if (r.kind === "success") revisionRef.current = r.data.revision;
      });
      delete assetIdRef.current[purpose];
      delete uploadKeys.current[purpose];
    }
  }, []);

  const submit = useCallback(async () => {
    dispatch({ type: "ERROR", message: null });
    const id = entryIdRef.current || (await ensureEntry());
    if (!id) return false;
    const readiness = await getSubmissionReadiness(id, locale);
    if (readiness.kind !== "success") {
      dispatch({ type: "SUBMIT_BLOCK", message: readiness.kind === "error" ? readiness.message : "제출 준비 상태를 확인하지 못했습니다.", blockingReasons: [] });
      return false;
    }
    const ready = readiness.data;
    if (!ready.allowedActions.includes("submit") || ready.policyToken === null) {
      dispatch({ type: "SUBMIT_BLOCK", message: "아직 제출할 수 없습니다. 필수 항목·파일·동의를 확인해 주세요.", blockingReasons: [...ready.blockingReasons] });
      return false;
    }
    revisionRef.current = ready.revision;
    const r = await submitEntry(
      id,
      {
        revision: ready.revision,
        locale,
        policyToken: ready.policyToken,
        consents: REQUIRED_CONSENTS.map((c) => ({ kind: c.kind, version: c.version, accepted: true as const })),
      },
      { idempotencyKey: newIdempotencyKey() },
    );
    if (r.kind !== "success") {
      dispatch({ type: "SUBMIT_BLOCK", message: r.kind === "error" ? r.message : "제출에 실패했습니다.", blockingReasons: [] });
      return false;
    }
    revisionRef.current = r.data.revision;
    dispatch({ type: "SUBMIT_OK", submittedAt: r.data.submittedAt, blockingReasons: [...r.data.blockingReasons] });
    return true;
  }, [ensureEntry, locale]);

  const startPayment = useCallback(async () => {
    const id = entryIdRef.current;
    if (!id) return;
    dispatch({ type: "PAYMENT", state: "checking" });
    const options = await getEntryPaymentOptions(id);
    if (options.kind !== "success" || !options.data.allowedActions.includes("create_order") || options.data.routes.length === 0) {
      dispatch({ type: "PAYMENT", state: "failed" });
      dispatch({ type: "ERROR", message: options.kind === "error" ? options.message : "결제 옵션을 불러오지 못했습니다." });
      return;
    }
    const route = options.data.routes[0];
    if (orderKey.current === null) orderKey.current = newIdempotencyKey();
    const order = await createEntryOrder(
      id,
      { routeId: route.id, policyToken: route.policyToken, acceptedRefundNotice: true },
      { idempotencyKey: orderKey.current },
    );
    if (order.kind !== "success") {
      dispatch({ type: "PAYMENT", state: "failed" });
      dispatch({ type: "ERROR", message: order.kind === "error" ? order.message : "주문 생성에 실패했습니다." });
      return;
    }
    orderIdRef.current = order.data.id;
    // No PG redirect is wired yet; reflect the server order state and let the user
    // re-check. A success URL would never be treated as completion regardless.
    dispatch({ type: "PAYMENT", state: mapPayment(order.data.state), amountMinor: order.data.money.amountMinor });
  }, []);

  const refreshPayment = useCallback(async () => {
    const orderId = orderIdRef.current;
    const id = entryIdRef.current;
    if (!orderId) return;
    const order = await getOrder(orderId);
    if (order.kind !== "success") {
      dispatch({ type: "ERROR", message: order.kind === "error" ? order.message : "결제 상태를 확인하지 못했습니다." });
      return;
    }
    dispatch({ type: "PAYMENT", state: mapPayment(order.data.state), amountMinor: order.data.money.amountMinor });
    if (order.data.state === "succeeded" && id) {
      // Payment confirmed — the entry is received only when the server says so.
      const detail = await getEntryDetail(id);
      if (detail.kind === "success" && detail.data.entryStatus === "received" && detail.data.receiptNumber && detail.data.receivedAt) {
        dispatch({ type: "RECEIVED", receiptNumber: detail.data.receiptNumber, receivedAt: detail.data.receivedAt });
      }
    }
  }, []);

  return {
    state,
    setField,
    setGuardian,
    toggleConsent,
    toggleOptional,
    saveDraft,
    selectFile,
    abortUpload,
    removeAsset,
    submit,
    startPayment,
    refreshPayment,
    clearError,
  };
}
