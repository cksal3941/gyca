"use client";

// MOCK submit state machine (Claude-owned UI orchestration; NOT a live API).
//
// It simulates the server-authoritative behaviour the real flow will have, so the
// screens can be built and every required scenario reproduced, without a network.
// Boundaries honoured:
//   - Server is the source of truth: file "ready", PDF pageCount, payment state,
//     and entry "received" are decided HERE (the mock server), not by the client
//     form. Client-side checks are hints only.
//   - A failed save never reports "saved".
//   - Reaching a success step never marks the entry received; only the server
//     (this machine) flips to `received` with a receipt number.
//   - Retrying payment never loses saved fields or uploads.
//   - No sensitive application data is persisted to localStorage.

import { useReducer, useRef, useCallback } from "react";

export type Scenario =
  | "happy"
  | "resume"
  | "saveFail"
  | "pdfReject"
  | "uploadAbort"
  | "payCancel"
  | "approvalDelay"
  | "receiptDelay"
  | "deadlinePassed";

export type SaveStatus = "idle" | "saving" | "saved" | "error";
export type EntryStatus = "draft" | "submitted" | "received";
export type PaymentState =
  | "none"
  | "redirecting" // moving to the (mock) payment window
  | "checking" //    back from window, verifying with server
  | "pending" //     awaiting approval
  | "failed"
  | "cancelled"
  | "succeeded";
export type AssetState = "empty" | "uploading" | "uploaded" | "validating" | "ready" | "rejected";
export type UploadPurpose = "cover_image" | "book_pdf";

export type AssetView = {
  purpose: UploadPurpose;
  filename: string | null;
  sizeBytes: number | null;
  state: AssetState;
  progress: number; // 0..100 during upload
  pageCount: number | null; // server-confirmed (PDF only)
  rejectionCode: string | null; // server rejection reason
};

const emptyAsset = (purpose: UploadPurpose): AssetView => ({
  purpose,
  filename: null,
  sizeBytes: null,
  state: "empty",
  progress: 0,
  pageCount: null,
  rejectionCode: null,
});

export type FlowState = {
  scenario: Scenario;
  entryId: string;
  revision: number;
  /** Field values keyed by full path, e.g. "participant.name", "work.englishTitle". */
  values: Record<string, string>;
  guardian: { name: string; email: string };
  assets: Record<UploadPurpose, AssetView>;
  /** Accepted required consents, keyed by kind. */
  consents: Record<string, boolean>;
  /** Optional (demo-only) consents, keyed by key. Never sent to the real API. */
  optionalConsents: Record<string, boolean>;
  entryStatus: EntryStatus;
  payment: PaymentState;
  amountMinor: number;
  currency: "EUR";
  receiptNumber: string | null;
  submittedAt: string | null;
  receivedAt: string | null;
  blockingReasons: string[];
  saveStatus: SaveStatus;
  lastError: string | null;
};

const RESUME_VALUES: Record<string, string> = {
  "participant.name": "홍길동",
  "participant.nameEn": "Gildong Hong",
  "participant.dateOfBirth": "2011-05-04",
  "work.englishTitle": "Quiet Morning",
  "work.englishDescription": "A wordless picture book about a slow morning by the sea.",
  "work.category": "art_book",
};

function initialState(scenario: Scenario): FlowState {
  const resume = scenario === "resume";
  return {
    scenario,
    entryId: "entry_mock_1",
    revision: resume ? 3 : 1,
    values: resume ? { ...RESUME_VALUES } : {},
    guardian: resume ? { name: "홍부모", email: "parent@example.com" } : { name: "", email: "" },
    assets: { cover_image: emptyAsset("cover_image"), book_pdf: emptyAsset("book_pdf") },
    consents: {},
    optionalConsents: {},
    entryStatus: "draft",
    payment: "none",
    amountMinor: 7000,
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
  | { type: "SAVE_START" }
  | { type: "SAVE_OK"; revision: number }
  | { type: "SAVE_FAIL"; message: string }
  | { type: "ASSET"; purpose: UploadPurpose; patch: Partial<AssetView> }
  | { type: "SUBMIT_OK"; submittedAt: string }
  | { type: "SUBMIT_BLOCK"; message: string }
  | { type: "PAYMENT"; state: PaymentState }
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
    case "SAVE_START":
      return { ...s, saveStatus: "saving", lastError: null };
    case "SAVE_OK":
      return { ...s, saveStatus: "saved", revision: a.revision };
    case "SAVE_FAIL":
      // A failed save must NOT report "saved".
      return { ...s, saveStatus: "error", lastError: a.message };
    case "ASSET":
      return { ...s, assets: { ...s.assets, [a.purpose]: { ...s.assets[a.purpose], ...a.patch } } };
    case "SUBMIT_OK":
      return { ...s, entryStatus: "submitted", submittedAt: a.submittedAt, blockingReasons: ["PAYMENT_REQUIRED"], lastError: null };
    case "SUBMIT_BLOCK":
      return { ...s, blockingReasons: ["DEADLINE_PASSED"], lastError: a.message };
    case "PAYMENT":
      return { ...s, payment: a.state };
    case "RECEIVED":
      return { ...s, entryStatus: "received", receiptNumber: a.receiptNumber, receivedAt: a.receivedAt, blockingReasons: [] };
    case "ERROR":
      return { ...s, lastError: a.message };
    default:
      return s;
  }
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type SubmitFlow = {
  state: FlowState;
  setField: (path: string, value: string) => void;
  setGuardian: (key: "name" | "email", value: string) => void;
  toggleConsent: (kind: string) => void;
  toggleOptional: (key: string) => void;
  saveDraft: () => Promise<boolean>;
  selectFile: (purpose: UploadPurpose, file: File) => Promise<void>;
  abortUpload: (purpose: UploadPurpose) => void;
  removeAsset: (purpose: UploadPurpose) => void;
  submit: () => Promise<boolean>;
  startPayment: () => Promise<void>;
  refreshPayment: () => Promise<void>;
  clearError: () => void;
};

/** Drives the mock flow. `scenario` selects which failures/timings to reproduce. */
export function useSubmitFlow(scenario: Scenario): SubmitFlow {
  const [state, dispatch] = useReducer(reducer, scenario, initialState);
  // Track aborts across async upload steps without re-rendering.
  const aborted = useRef<Record<string, boolean>>({});
  const sc = state.scenario;

  const setField = useCallback((path: string, value: string) => dispatch({ type: "SET_FIELD", path, value }), []);
  const setGuardian = useCallback((key: "name" | "email", value: string) => dispatch({ type: "SET_GUARDIAN", key, value }), []);
  const toggleConsent = useCallback((kind: string) => dispatch({ type: "TOGGLE_CONSENT", kind }), []);
  const toggleOptional = useCallback((key: string) => dispatch({ type: "TOGGLE_OPTIONAL", key }), []);
  const clearError = useCallback(() => dispatch({ type: "ERROR", message: null }), []);

  const saveDraft = useCallback(async () => {
    dispatch({ type: "SAVE_START" });
    await delay(600);
    if (sc === "saveFail") {
      dispatch({ type: "SAVE_FAIL", message: "임시저장에 실패했습니다. 네트워크 확인 후 다시 시도하세요." });
      return false;
    }
    dispatch({ type: "SAVE_OK", revision: state.revision + 1 });
    return true;
  }, [sc, state.revision]);

  const selectFile = useCallback(
    async (purpose: UploadPurpose, file: File) => {
      aborted.current[purpose] = false;
      dispatch({ type: "ASSET", purpose, patch: { filename: file.name, sizeBytes: file.size, state: "uploading", progress: 0, rejectionCode: null, pageCount: null } });
      // Simulated transfer progress.
      for (const p of [20, 45, 70, 90]) {
        await delay(250);
        if (aborted.current[purpose]) {
          dispatch({ type: "ASSET", purpose, patch: emptyAsset(purpose) });
          return;
        }
        dispatch({ type: "ASSET", purpose, patch: { progress: p } });
      }
      dispatch({ type: "ASSET", purpose, patch: { state: "uploaded", progress: 100 } });
      await delay(300);
      // Server-side validation (authoritative).
      dispatch({ type: "ASSET", purpose, patch: { state: "validating" } });
      await delay(800);
      if (purpose === "book_pdf" && sc === "pdfReject") {
        dispatch({ type: "ASSET", purpose, patch: { state: "rejected", pageCount: 12, rejectionCode: "PDF_TOO_FEW_PAGES" } });
        return;
      }
      dispatch({
        type: "ASSET",
        purpose,
        patch: { state: "ready", pageCount: purpose === "book_pdf" ? 24 : null },
      });
    },
    [sc],
  );

  const abortUpload = useCallback((purpose: UploadPurpose) => {
    aborted.current[purpose] = true;
  }, []);

  const removeAsset = useCallback((purpose: UploadPurpose) => {
    aborted.current[purpose] = true;
    dispatch({ type: "ASSET", purpose, patch: emptyAsset(purpose) });
  }, []);

  const submit = useCallback(async () => {
    dispatch({ type: "ERROR", message: null });
    if (sc === "deadlinePassed") {
      dispatch({ type: "SUBMIT_BLOCK", message: "접수가 마감되어 제출할 수 없습니다." });
      return false;
    }
    await delay(600);
    dispatch({ type: "SUBMIT_OK", submittedAt: new Date().toISOString() });
    return true;
  }, [sc]);

  const startPayment = useCallback(async () => {
    // Move to (mock) payment window, then verify with the server on return.
    dispatch({ type: "PAYMENT", state: "redirecting" });
    await delay(700);
    dispatch({ type: "PAYMENT", state: "checking" });
    await delay(900);
    if (sc === "payCancel") {
      dispatch({ type: "PAYMENT", state: "cancelled" });
      return;
    }
    if (sc === "approvalDelay") {
      dispatch({ type: "PAYMENT", state: "pending" });
      return;
    }
    if (sc === "receiptDelay") {
      // Payment confirmed, but the entry is not yet confirmed by the server.
      dispatch({ type: "PAYMENT", state: "succeeded" });
      return;
    }
    // Happy path: payment confirmed AND server confirms the entry.
    dispatch({ type: "PAYMENT", state: "succeeded" });
    await delay(700);
    dispatch({ type: "RECEIVED", receiptNumber: "GYCA-2027-000123", receivedAt: new Date().toISOString() });
  }, [sc]);

  // Re-query the server for the latest state (reconcile / check_payment).
  const refreshPayment = useCallback(async () => {
    await delay(900);
    if (sc === "approvalDelay") {
      // Approval comes through on re-check; then the server confirms the entry.
      dispatch({ type: "PAYMENT", state: "succeeded" });
      await delay(500);
      dispatch({ type: "RECEIVED", receiptNumber: "GYCA-2027-000124", receivedAt: new Date().toISOString() });
      return;
    }
    if (sc === "receiptDelay") {
      // Payment already succeeded; the server now confirms the entry.
      dispatch({ type: "RECEIVED", receiptNumber: "GYCA-2027-000125", receivedAt: new Date().toISOString() });
      return;
    }
  }, [sc]);

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
