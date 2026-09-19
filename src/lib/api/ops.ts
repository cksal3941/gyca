// Operations (admin + judge) data adapter — MOCK. NOT a live API.
//
// The participant-facing adapter lives in `./index`. This file adds the operator
// surfaces. Boundaries honoured (mirrors the real API + server-side authz):
//   - The client NEVER changes a completed payment. There is no such action here;
//     payment recovery is a separate server flow (requeue_recovery).
//   - Result publish / certificate issue / CSV export are guarded server actions.
//     Here they are mock and return per-item success/failure.
//   - Access control (which entries an admin sees, which works a judge is assigned)
//     is the server's job. The "forbidden" scenario models a 403.
//   - Blind judging uses a SEPARATE data type (JudgeAssignment) that carries no
//     participant identity — not participant data hidden with CSS.
//
// Rubric criteria + max scores come from a settings fixture (dev values, clearly
// labelled) — the UI renders whatever settings return and never fixes scores.

import type { RequestState } from "./index";
import type { EntryStatus, ReviewStatus, PublishedResult, PaymentState, Page } from "@/contracts";
import { AdminAccessSchema, type AdminAccess } from "@/contracts/admin-access";
import { AdminEntrySchema, AdminEntriesPageSchema } from "@/contracts/admin-entries";
import { AdminEntryDetailSchema } from "@/contracts/admin-entry-detail";
import { CompetitionEditSchema, type CompetitionEdit } from "@/contracts/competition-admin";
import { LaunchReadinessSchema } from "@/contracts/launch-readiness";
import { OpenApplicationsSchema, OpenedApplicationsSchema } from "@/contracts/launch-control";
import {
  PauseApplicationsSchema,
  PausedApplicationsSchema,
  ResumeApplicationsSchema,
  ResumedApplicationsSchema,
} from "@/contracts/application-pause";
import {
  EditorialAdminItemSchema,
  EditorialAdminPageSchema,
  type EditorialBody,
} from "@/contracts/editorial-content";
import {
  PartnerAdminItemSchema,
  PartnerAdminPageSchema,
  type PartnerBody,
} from "@/contracts/partner-content";
import {
  AdminPrivacyRequestSchema,
  type ReviewPrivacyRequest,
} from "@/contracts/privacy-requests";
import {
  AdminCompetitionPresentationSchema,
  type CompetitionPresentationSchema,
} from "@/contracts/competition-presentation";
import {
  ArchiveAdminItemSchema,
  type ArchiveContent,
  type ArchivePublicationEvidenceSchema,
} from "@/contracts/project-archive";
import { AdminDashboardSchema } from "@/contracts/admin-dashboard";
import { PaymentHealthSchema } from "@/contracts/payment-health";
import { PaymentReviewSchema } from "@/contracts/payment-admin";
import {
  JudgeAssignmentsSchema,
  JudgeReviewContextSchema,
  JudgeReviewMutationSchema,
  JudgeAccountSchema,
  JudgeAccountsSchema,
  ReviewRubricDetailSchema,
} from "@/contracts/judge";
import { z } from "zod";
import { isLive } from "./mode";
import { httpGet, httpSend, httpList } from "./http";

// Published competitions an organizer can operate on (id/slug for the picker).
const AdminCompetitionListSchema = z.object({
  items: z.array(z.object({ id: z.string(), slug: z.string(), published: z.boolean() })).readonly(),
  nextCursor: z.string().nullable(),
});
export type AdminCompetitionRef = { id: string; slug: string; published: boolean };

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/* ---- operator access gate (LIVE-capable) ---- */

/**
 * Operator access. Live: GET /admin/access — the `organizer` flag plus the
 * per-competition payment permissions the server grants this user; this is the
 * gate for the whole admin surface (the server also enforces it on every list).
 * Mock: an organizer with no payment permissions (the entries list itself is
 * still mock — see the contract gap in docs/frontend-handoff.md §0-A).
 */
export async function getAdminAccess(
  opts: { delayMs?: number; signal?: AbortSignal } = {},
): Promise<RequestState<AdminAccess>> {
  if (isLive) return httpGet("/admin/access", AdminAccessSchema, opts.signal);
  if (opts.delayMs) await wait(opts.delayMs);
  const parsed = AdminAccessSchema.safeParse({ organizer: true, paymentPermissions: [], nextCursor: null });
  if (parsed.success) return { kind: "success", data: parsed.data };
  return { kind: "error", code: "VALIDATION_FAILED", message: "mock admin access invalid", retryable: false };
}

/* ================================================================== */
/* ADMIN                                                              */
/* ================================================================== */

export type FileAggState = "ready" | "validating" | "rejected" | "pending";

export type AdminEntryView = {
  id: string;
  receiptNumber: string | null;
  participantName: string;
  workTitle: string;
  category: string; // KO display label (operator screen)
  ageGroup: string;
  entryStatus: EntryStatus;
  reviewStatus: ReviewStatus;
  publishedResult: PublishedResult | null;
  fileState: FileAggState;
  payment: { state: PaymentState; amountMinor: number; needsReview: boolean } | null;
  createdAt: string; // ISO
  submittedAt: string | null;
  certificateIssued: boolean;
};

export type AdminEntriesPage = {
  items: AdminEntryView[];
  nextCursor: string | null;
  total: number; // total matching the query (for the count line)
};

export type AdminScenario = "some" | "empty" | "forbidden";

export type AdminQuery = {
  search?: string;
  status?: EntryStatus | "all";
  payment?: PaymentState | "all";
  result?: PublishedResult | "not_announced" | "all";
  sort?: "created_desc" | "created_asc" | "name_asc";
  cursor?: string | null;
  pageSize?: number;
};

const EUR = (amountMinor: number) => amountMinor;

// ~14 rows so filtering/sorting/pagination are demonstrable.
const ADMIN_ENTRIES: AdminEntryView[] = [
  row("entry_received", "GYCA-2027-000123", "Ella Park", "Quiet Morning", "그림책", "미들", "received", "under_review", null, "ready", "succeeded", false),
  row("entry_official", "GYCA-2027-000200", "Aria Han", "Quiet Morning", "그림책", "미들", "received", "completed", "official_selection", "ready", "succeeded", true),
  row("entry_finalist", "GYCA-2027-000201", "Noah Jung", "Harbor at Dawn", "그래픽 스토리", "유스", "received", "completed", "finalist", "ready", "succeeded", false),
  row("entry_not_selected", "GYCA-2027-000150", "Leo Kim", "Rainy Street", "그래픽 스토리", "주니어", "received", "completed", "not_selected", "ready", "succeeded", false),
  row("entry_sub_pending", null, "Daniel Cho", "City Lights", "아트북", "유스", "submitted", "not_started", null, "ready", "pending", false),
  row("entry_receipt_pending", null, "Sofia Lee", "Morning Harbor", "그림책", "미들", "submitted", "not_started", null, "ready", "succeeded", false),
  row("entry_pdf_reject", null, "Yuna Kim", "Paper Boats", "일러스트 스토리", "유스", "draft", "not_started", null, "rejected", null, false),
  row("entry_draft", null, "Mina Seo", "—", "그림책", "주니어", "draft", "not_started", null, "pending", null, false),
  row("e_009", "GYCA-2027-000131", "Hana Lim", "Snow Garden", "그림책", "주니어", "received", "under_review", null, "ready", "succeeded", false),
  row("e_010", "GYCA-2027-000132", "Ravi Menon", "Paper Kites", "아트북", "미들", "received", "under_review", null, "validating", "succeeded", false),
  row("e_011", "GYCA-2027-000133", "Yui Tanaka", "Foghorn", "그래픽 스토리", "유스", "received", "completed", "official_selection", "ready", "succeeded", true),
  row("e_012", null, "Omar Farouk", "Desert Lines", "실험적 북 프로젝트", "유스", "submitted", "not_started", null, "ready", "failed", false),
  row("e_013", "GYCA-2027-000135", "Chloe Dubois", "Two Rivers", "일러스트 스토리", "미들", "received", "completed", "not_selected", "ready", "succeeded", false),
  row("e_014", "GYCA-2027-000136", "Ben Cohen", "Night Bus", "아트북", "유스", "received", "completed", "finalist", "ready", "succeeded", false),
];

function row(
  id: string, receiptNumber: string | null, participantName: string, workTitle: string,
  category: string, ageGroup: string, entryStatus: EntryStatus, reviewStatus: ReviewStatus,
  publishedResult: PublishedResult | null, fileState: FileAggState,
  pay: PaymentState | null, certificateIssued: boolean,
): AdminEntryView {
  return {
    id, receiptNumber, participantName, workTitle, category, ageGroup, entryStatus, reviewStatus,
    publishedResult, fileState,
    payment: pay ? { state: pay, amountMinor: EUR(7000), needsReview: pay === "failed" } : null,
    createdAt: "2026-12-10T09:00:00Z", submittedAt: entryStatus === "draft" ? null : "2026-12-10T09:10:00Z",
    certificateIssued,
  };
}

// Give rows distinct createdAt so sorting is visible (index-based, deterministic).
ADMIN_ENTRIES.forEach((e, i) => {
  const day = String(28 - i).padStart(2, "0");
  e.createdAt = `2026-12-${day}T09:00:00Z`;
  if (e.submittedAt) e.submittedAt = `2026-12-${day}T09:10:00Z`;
});

function applyQuery(all: AdminEntryView[], q: AdminQuery): AdminEntryView[] {
  let rows = [...all];
  const s = q.search?.trim().toLowerCase();
  if (s)
    rows = rows.filter(
      (r) =>
        r.participantName.toLowerCase().includes(s) ||
        r.workTitle.toLowerCase().includes(s) ||
        (r.receiptNumber ?? "").toLowerCase().includes(s),
    );
  if (q.status && q.status !== "all") rows = rows.filter((r) => r.entryStatus === q.status);
  if (q.payment && q.payment !== "all") rows = rows.filter((r) => r.payment?.state === q.payment);
  if (q.result && q.result !== "all")
    rows = rows.filter((r) =>
      q.result === "not_announced" ? r.publishedResult === null : r.publishedResult === q.result,
    );
  const sort = q.sort ?? "created_desc";
  rows.sort((a, b) => {
    if (sort === "name_asc") return a.participantName.localeCompare(b.participantName);
    const cmp = a.createdAt.localeCompare(b.createdAt);
    return sort === "created_asc" ? cmp : -cmp;
  });
  return rows;
}

/** Published competitions the operator can act on. Live: GET /admin/competitions
 *  (organizer only). Mock: the single Leipzig fixture. Used to pick a competitionId
 *  for the entries list (the entries endpoint is per-competition). */
export async function listAdminCompetitions(
  opts: { signal?: AbortSignal } = {},
): Promise<RequestState<AdminCompetitionRef[]>> {
  if (isLive) {
    const r = await httpGet("/admin/competitions?limit=50", AdminCompetitionListSchema, opts.signal);
    if (r.kind !== "success") return r;
    return { kind: "success", data: r.data.items.map((c) => ({ id: c.id, slug: c.slug, published: c.published })) };
  }
  return { kind: "success", data: [{ id: "leipzig-2027", slug: "leipzig-2027", published: true }] };
}

/* ---- editorial content CMS (LIVE, organizer) ---- */

export type EditorialAdminItem = z.infer<typeof EditorialAdminItemSchema>;
export type EditorialAdminQuery = { category?: string | null; status?: string | null; cursor?: string | null; limit?: number };

/** Admin editorial list (notice/schedule/faq/news/press · draft/published/archived).
 *  Live: GET /admin/content/editorial. */
export async function listAdminEditorial(
  query: EditorialAdminQuery = {}, opts: { signal?: AbortSignal } = {},
): Promise<RequestState<Page<EditorialAdminItem>>> {
  if (!isLive) return { kind: "error", code: "NOT_CONNECTED", message: "미리보기에서는 CMS를 지원하지 않습니다.", retryable: false };
  const p = new URLSearchParams();
  if (query.category) p.set("category", query.category);
  if (query.status) p.set("status", query.status);
  if (query.cursor) p.set("cursor", query.cursor);
  p.set("limit", String(query.limit ?? 50));
  const r = await httpGet(`/admin/content/editorial?${p.toString()}`, EditorialAdminPageSchema, opts.signal);
  return r as RequestState<Page<EditorialAdminItem>>;
}

/** Create editorial content (draft). Live: POST /admin/content/editorial. */
export async function createEditorial(
  input: { actionId: string; slug: string; category: string; content: EditorialBody }, opts: { signal?: AbortSignal } = {},
): Promise<RequestState<EditorialAdminItem>> {
  if (!isLive) return { kind: "error", code: "NOT_CONNECTED", message: "미리보기에서는 CMS를 지원하지 않습니다.", retryable: false };
  return httpSend("POST", "/admin/content/editorial", EditorialAdminItemSchema, { body: input, signal: opts.signal });
}

/** Edit editorial content. Live: PATCH /admin/content/editorial/{id}. */
export async function updateEditorial(
  id: string, input: { actionId: string; expectedRevision: number; content: EditorialBody }, opts: { signal?: AbortSignal } = {},
): Promise<RequestState<EditorialAdminItem>> {
  if (!isLive) return { kind: "error", code: "NOT_CONNECTED", message: "미리보기에서는 CMS를 지원하지 않습니다.", retryable: false };
  return httpSend("PATCH", `/admin/content/editorial/${encodeURIComponent(id)}`, EditorialAdminItemSchema, { body: input, signal: opts.signal });
}

/** Publish / archive a content item. Live: POST .../{id}/publish|archive. */
export async function transitionEditorial(
  id: string, action: "publish" | "archive", input: { actionId: string; expectedRevision: number }, opts: { signal?: AbortSignal } = {},
): Promise<RequestState<EditorialAdminItem>> {
  if (!isLive) return { kind: "error", code: "NOT_CONNECTED", message: "미리보기에서는 CMS를 지원하지 않습니다.", retryable: false };
  return httpSend("POST", `/admin/content/editorial/${encodeURIComponent(id)}/${action}`, EditorialAdminItemSchema, { body: input, signal: opts.signal });
}

/* ---- payment operations (read; LIVE, organizer) ---- */

export type AdminDashboard = z.infer<typeof AdminDashboardSchema>;
export type PaymentHealth = z.infer<typeof PaymentHealthSchema>;
export type PaymentReview = z.infer<typeof PaymentReviewSchema>;
const opsOff = <T,>(): RequestState<T> => ({ kind: "error", code: "NOT_CONNECTED", message: "미리보기에서는 운영 조회를 지원하지 않습니다.", retryable: false });

/** Operations dashboard (accounts, applicants, per-competition counts). Live:
 *  GET /admin/dashboard. Approved amounts are gross (pre-refund), not settlement. */
export async function getAdminDashboard(opts: { signal?: AbortSignal } = {}): Promise<RequestState<AdminDashboard>> {
  if (!isLive) return opsOff();
  return httpGet("/admin/dashboard", AdminDashboardSchema, opts.signal);
}

/** Payment health for a competition (order + recovery counts). Live: GET
 *  /admin/competitions/{id}/payment-health. Overlapping buckets are not summed. */
export async function getPaymentHealth(competitionId: string, opts: { signal?: AbortSignal } = {}): Promise<RequestState<PaymentHealth>> {
  if (!isLive) return opsOff();
  return httpGet(`/admin/competitions/${encodeURIComponent(competitionId)}/payment-health`, PaymentHealthSchema, opts.signal);
}

/** Orders that need review (NOT all orders). Live: GET
 *  /admin/competitions/{id}/payment-reviews. */
export async function listPaymentReviews(competitionId: string, opts: { signal?: AbortSignal } = {}): Promise<RequestState<Page<PaymentReview>>> {
  if (!isLive) return opsOff();
  const r = await httpList(`/admin/competitions/${encodeURIComponent(competitionId)}/payment-reviews?limit=50`, PaymentReviewSchema, opts.signal);
  return r as RequestState<Page<PaymentReview>>;
}

/* ---- partner content CMS (LIVE, organizer) ---- */

export type PartnerAdminItem = z.infer<typeof PartnerAdminItemSchema>;
const partnerOff = <T,>(): RequestState<T> => ({ kind: "error", code: "NOT_CONNECTED", message: "미리보기에서는 CMS를 지원하지 않습니다.", retryable: false });

/** Partner list (draft/published + relationship pending/confirmed/revoked).
 *  Live: GET /admin/content/partners. */
export async function listAdminPartners(opts: { signal?: AbortSignal } = {}): Promise<RequestState<Page<PartnerAdminItem>>> {
  if (!isLive) return partnerOff();
  const r = await httpGet("/admin/content/partners?limit=50", PartnerAdminPageSchema, opts.signal);
  return r as RequestState<Page<PartnerAdminItem>>;
}

/** Create a partner (draft). Live: POST /admin/content/partners. */
export async function createPartner(
  input: { actionId: string; slug: string; partnerType: string; content: PartnerBody }, opts: { signal?: AbortSignal } = {},
): Promise<RequestState<PartnerAdminItem>> {
  if (!isLive) return partnerOff();
  return httpSend("POST", "/admin/content/partners", PartnerAdminItemSchema, { body: input, signal: opts.signal });
}

/** Edit partner content. Live: PATCH /admin/content/partners/{id}. */
export async function updatePartner(
  id: string, input: { actionId: string; expectedRevision: number; content: PartnerBody }, opts: { signal?: AbortSignal } = {},
): Promise<RequestState<PartnerAdminItem>> {
  if (!isLive) return partnerOff();
  return httpSend("PATCH", `/admin/content/partners/${encodeURIComponent(id)}`, PartnerAdminItemSchema, { body: input, signal: opts.signal });
}

/** Confirm / revoke the partner relationship (evidence + reason required).
 *  A partner cannot be published until the relationship is confirmed. */
export async function partnerRelationship(
  id: string, action: "confirm" | "revoke",
  input: { actionId: string; expectedRevision: number; evidenceReference: string; reason: string }, opts: { signal?: AbortSignal } = {},
): Promise<RequestState<PartnerAdminItem>> {
  if (!isLive) return partnerOff();
  return httpSend("POST", `/admin/content/partners/${encodeURIComponent(id)}/${action}`, PartnerAdminItemSchema, { body: input, signal: opts.signal });
}

/** Publish / archive a partner. Live: POST .../{id}/publish|archive. */
export async function transitionPartner(
  id: string, action: "publish" | "archive", input: { actionId: string; expectedRevision: number }, opts: { signal?: AbortSignal } = {},
): Promise<RequestState<PartnerAdminItem>> {
  if (!isLive) return partnerOff();
  return httpSend("POST", `/admin/content/partners/${encodeURIComponent(id)}/${action}`, PartnerAdminItemSchema, { body: input, signal: opts.signal });
}

/* ---- judge admin: accounts + review rubric (LIVE, organizer) ---- */

export type JudgeAccount = z.infer<typeof JudgeAccountSchema>;
export type ReviewRubricDetail = z.infer<typeof ReviewRubricDetailSchema>;
const cmsOff = <T,>(): RequestState<T> => ({ kind: "error", code: "NOT_CONNECTED", message: "미리보기에서는 운영 API를 지원하지 않습니다.", retryable: false });

/** Judge accounts (active/inactive, unfinished assignments). Live: GET /admin/judges. */
export async function listJudges(opts: { signal?: AbortSignal } = {}): Promise<RequestState<JudgeAccount[]>> {
  if (!isLive) return cmsOff();
  const r = await httpGet("/admin/judges", JudgeAccountsSchema, opts.signal);
  return r as RequestState<JudgeAccount[]>;
}

/** Activate/deactivate a judge. Live: PUT /admin/judges/{userId}. */
export async function updateJudge(
  userId: string, input: { expectedActive: boolean | null; active: boolean; reason: string }, opts: { signal?: AbortSignal } = {},
): Promise<RequestState<JudgeAccount>> {
  if (!isLive) return cmsOff();
  return httpSend("PUT", `/admin/judges/${encodeURIComponent(userId)}`, JudgeAccountSchema, { body: input, signal: opts.signal });
}

/** Per-competition review rubric (criteria + max scores). Live: GET .../review-rubric. */
export async function getReviewRubric(
  competitionId: string, opts: { signal?: AbortSignal } = {},
): Promise<RequestState<ReviewRubricDetail>> {
  if (!isLive) return cmsOff();
  return httpGet(`/admin/competitions/${encodeURIComponent(competitionId)}/review-rubric`, ReviewRubricDetailSchema, opts.signal);
}

/** Set the review rubric. Live: PUT .../review-rubric ({competitionRevision, rubric}). */
export async function updateReviewRubric(
  competitionId: string,
  input: { competitionRevision: number; rubric: { version: string; criteria: { id: string; label: string; description: string; maxScore: number }[]; editableAfterSubmit: boolean } },
  opts: { signal?: AbortSignal } = {},
): Promise<RequestState<ReviewRubricDetail>> {
  if (!isLive) return cmsOff();
  return httpSend("PUT", `/admin/competitions/${encodeURIComponent(competitionId)}/review-rubric`, ReviewRubricDetailSchema, { body: input, signal: opts.signal });
}

/* ---- competition registration / launch control (LIVE, organizer) ---- */

// One competition's admin record: edit input + revision + draft/payment flags.
const AdminCompetitionSchema = z.object({
  id: z.string(), revision: z.number().int().positive(),
  draftEnabled: z.boolean(), paymentEnabled: z.boolean(), input: CompetitionEditSchema,
});
export type AdminCompetition = z.infer<typeof AdminCompetitionSchema>;

const liveOnly = <T,>(): RequestState<T> => ({
  kind: "error", code: "NOT_CONNECTED", message: "미리보기에서는 공모 운영 API를 지원하지 않습니다.", retryable: false,
});

/** One competition for editing. Live: GET /admin/competitions/{id}. */
export async function getAdminCompetition(
  id: string, opts: { signal?: AbortSignal } = {},
): Promise<RequestState<AdminCompetition>> {
  if (!isLive) return liveOnly();
  return httpGet(`/admin/competitions/${encodeURIComponent(id)}`, AdminCompetitionSchema, opts.signal);
}

/** Register a competition. Live: POST /admin/competitions ({id, input}). The
 *  server sets revision; publishing/opening are separate steps. */
export async function createCompetition(
  id: string, input: CompetitionEdit, opts: { signal?: AbortSignal } = {},
): Promise<RequestState<AdminCompetition>> {
  if (!isLive) return liveOnly();
  return httpSend("POST", "/admin/competitions", AdminCompetitionSchema, { body: { id, input }, signal: opts.signal });
}

/** Edit a competition. Live: PATCH /admin/competitions/{id} ({revision, input}).
 *  A stale revision is a 409 REVISION_CONFLICT (never auto-overwrite). */
export async function updateCompetition(
  id: string, revision: number, input: CompetitionEdit, opts: { signal?: AbortSignal } = {},
): Promise<RequestState<AdminCompetition>> {
  if (!isLive) return liveOnly();
  return httpSend("PATCH", `/admin/competitions/${encodeURIComponent(id)}`, AdminCompetitionSchema, {
    body: { revision, input }, signal: opts.signal,
  });
}

/** Launch readiness checks + status (configured/missing/unverified). Live: GET
 *  /admin/competitions/{id}/launch-readiness. Opening is blocked until all pass. */
export async function getLaunchReadiness(
  id: string, opts: { signal?: AbortSignal } = {},
): Promise<RequestState<z.infer<typeof LaunchReadinessSchema>>> {
  if (!isLive) return liveOnly();
  return httpGet(`/admin/competitions/${encodeURIComponent(id)}/launch-readiness`, LaunchReadinessSchema, opts.signal);
}

/** Open applications (enables drafts + payment). Live: POST .../open-applications.
 *  Server enforces launch-readiness — a 503 means readiness is not yet met. */
export async function openApplications(
  id: string, input: z.infer<typeof OpenApplicationsSchema>, opts: { signal?: AbortSignal } = {},
): Promise<RequestState<z.infer<typeof OpenedApplicationsSchema>>> {
  if (!isLive) return liveOnly();
  return httpSend("POST", `/admin/competitions/${encodeURIComponent(id)}/open-applications`, OpenedApplicationsSchema, {
    body: input, signal: opts.signal,
  });
}

/** Pause new applications (existing submitted entries' payment policy unchanged).
 *  Live: POST .../pause-applications ({revision, reason}). */
export async function pauseApplications(
  id: string, input: z.infer<typeof PauseApplicationsSchema>, opts: { signal?: AbortSignal } = {},
): Promise<RequestState<z.infer<typeof PausedApplicationsSchema>>> {
  if (!isLive) return liveOnly();
  return httpSend("POST", `/admin/competitions/${encodeURIComponent(id)}/pause-applications`, PausedApplicationsSchema, {
    body: input, signal: opts.signal,
  });
}

/** Resume applications. Live: POST .../resume-applications ({revision, reason}). */
export async function resumeApplications(
  id: string, input: z.infer<typeof ResumeApplicationsSchema>, opts: { signal?: AbortSignal } = {},
): Promise<RequestState<z.infer<typeof ResumedApplicationsSchema>>> {
  if (!isLive) return liveOnly();
  return httpSend("POST", `/admin/competitions/${encodeURIComponent(id)}/resume-applications`, ResumedApplicationsSchema, {
    body: input, signal: opts.signal,
  });
}

// Map the server AdminEntry (contract) to the operator-screen view.
function mapAdminEntry(a: z.infer<typeof AdminEntrySchema>): AdminEntryView {
  return {
    id: a.id,
    receiptNumber: a.receiptNumber,
    participantName: a.participantName ?? "—",
    workTitle: a.workTitle ?? "—",
    category: a.category ?? "—",
    ageGroup: a.ageGroup ?? "—",
    entryStatus: a.entryStatus,
    reviewStatus: a.reviewStatus,
    publishedResult: a.publishedResult,
    fileState: a.fileState,
    payment: a.payment
      ? { state: a.payment.state, amountMinor: a.payment.money.amountMinor, needsReview: a.payment.needsReview }
      : null,
    createdAt: a.createdAt,
    submittedAt: a.submittedAt,
    certificateIssued: a.certificateIssued,
  };
}

export async function listAdminEntries(
  query: AdminQuery = {},
  opts: { competitionId?: string; scenario?: AdminScenario; delayMs?: number; signal?: AbortSignal } = {},
): Promise<RequestState<AdminEntriesPage>> {
  // Live: GET /admin/competitions/{id}/entries with q/entryStatus/paymentState/
  // publishedResult/sort/cursor/limit. The server returns an opaque cursor; the
  // caller pages forward with it. The full AdminEntry contract is mapped 1:1.
  if (isLive) {
    if (!opts.competitionId)
      return { kind: "error", code: "POLICY_NOT_CONFIGURED", message: "공모를 먼저 선택하세요.", retryable: false };
    const p = new URLSearchParams();
    if (query.search) p.set("q", query.search);
    if (query.status && query.status !== "all") p.set("entryStatus", query.status);
    if (query.payment && query.payment !== "all") p.set("paymentState", query.payment);
    if (query.result && query.result !== "all") p.set("publishedResult", query.result);
    if (query.sort) p.set("sort", query.sort);
    if (query.cursor) p.set("cursor", query.cursor);
    p.set("limit", String(query.pageSize ?? 8));
    const r = await httpGet(
      `/admin/competitions/${encodeURIComponent(opts.competitionId)}/entries?${p.toString()}`,
      AdminEntriesPageSchema,
      opts.signal,
    );
    if (r.kind !== "success") return r;
    if (r.data.items.length === 0 && r.data.total === 0) return { kind: "empty" };
    return {
      kind: "success",
      data: { items: r.data.items.map(mapAdminEntry), nextCursor: r.data.nextCursor, total: r.data.total },
    };
  }
  if (opts.delayMs) await wait(opts.delayMs);
  if (opts.scenario === "forbidden")
    return { kind: "error", code: "FORBIDDEN", message: "이 목록에 접근할 권한이 없습니다.", retryable: false };
  const source = opts.scenario === "empty" ? [] : ADMIN_ENTRIES;
  const filtered = applyQuery(source, query);
  const pageSize = query.pageSize ?? 8;
  const start = query.cursor ? Number(query.cursor) : 0;
  const items = filtered.slice(start, start + pageSize);
  const nextStart = start + pageSize;
  const nextCursor = nextStart < filtered.length ? String(nextStart) : null;
  if (filtered.length === 0) return { kind: "empty" };
  return { kind: "success", data: { items, nextCursor, total: filtered.length } };
}

/* ---- entry detail (admin) ---- */

export type AuditEvent = { id: string; at: string; actor: string; action: string; detail: string };

export type AdminEntryDetail = AdminEntryView & {
  participant: { name: string; nameEn: string; dateOfBirth: string; residence: string };
  work: { englishTitle: string; englishDescription: string };
  files: { purpose: string; name: string; sizeBytes: number; state: string; pageCount: number | null; rejectionCode: string | null }[];
  guardianVerification: string;
  consents: { kind: string; version: string; acceptedAt: string | null }[];
  audit: AuditEvent[];
  // Server-provided; note payment state change is NOT among these.
  allowedActions: ("publish_result" | "issue_certificate" | "view_guardian_consents" | "request_export")[];
};

export function getAdminEntrySync(id: string): RequestState<AdminEntryDetail> {
  const base = ADMIN_ENTRIES.find((e) => e.id === id);
  if (!base) return { kind: "error", code: "NOT_FOUND", message: "해당 접수를 찾을 수 없습니다.", retryable: false };
  const detail: AdminEntryDetail = {
    ...base,
    participant: {
      name: base.participantName, nameEn: base.participantName,
      dateOfBirth: "2011-07-08", residence: "KR",
    },
    work: {
      englishTitle: base.workTitle,
      englishDescription: "A short description provided by the participant.",
    },
    files: [
      { purpose: "cover_image", name: "cover.jpg", sizeBytes: 820000, state: "ready", pageCount: null, rejectionCode: null },
      base.fileState === "rejected"
        ? { purpose: "book_pdf", name: "short.pdf", sizeBytes: 1200000, state: "rejected", pageCount: 12, rejectionCode: "PDF_TOO_FEW_PAGES" }
        : { purpose: "book_pdf", name: "book.pdf", sizeBytes: 6200000, state: base.fileState, pageCount: base.fileState === "ready" ? 24 : null, rejectionCode: null },
    ],
    guardianVerification: base.entryStatus === "draft" ? "required" : "verified",
    consents:
      base.entryStatus === "draft"
        ? []
        : [
            { kind: "participation_rules", version: "2027.1", acceptedAt: "2026-12-10T09:09:00Z" },
            { kind: "privacy", version: "2027.1", acceptedAt: "2026-12-10T09:09:00Z" },
            { kind: "work_license", version: "2027.1", acceptedAt: "2026-12-10T09:09:00Z" },
          ],
    audit: [
      { id: "au1", at: "2026-12-10T09:10:00Z", actor: "system", action: "entry.submitted", detail: "참가자 제출" },
      ...(base.payment?.state === "succeeded"
        ? [{ id: "au2", at: "2026-12-10T09:12:00Z", actor: "system", action: "payment.succeeded", detail: "결제 승인(서버)" }]
        : []),
      ...(base.publishedResult
        ? [{ id: "au3", at: "2027-01-11T00:00:00Z", actor: "admin:kim", action: "result.published", detail: `결과 발표: ${base.publishedResult}` }]
        : []),
      ...(base.certificateIssued
        ? [{ id: "au4", at: "2027-01-12T00:00:00Z", actor: "admin:kim", action: "certificate.issued", detail: "인증서 발급" }]
        : []),
    ],
    allowedActions: [
      "view_guardian_consents",
      ...(base.entryStatus === "received" ? (["publish_result"] as const) : []),
      ...(base.publishedResult && base.publishedResult !== "not_selected" ? (["issue_certificate"] as const) : []),
    ],
  };
  return { kind: "success", data: detail };
}

/** Live admin entry detail (contract shape). GET
 *  /admin/competitions/{competitionId}/entries/{entryId} → AdminEntryDetailSchema
 *  (participant/work drafts, files with displayName, guardianVerificationStatus,
 *  consents, certificates, and a ≤100-event audit). Rendered only in live mode;
 *  mock mode uses getAdminEntrySync. */
export async function getAdminEntryDetail(
  competitionId: string,
  entryId: string,
  opts: { signal?: AbortSignal } = {},
): Promise<RequestState<z.infer<typeof AdminEntryDetailSchema>>> {
  if (!isLive)
    return { kind: "error", code: "NOT_CONNECTED", message: "미리보기에서는 관리자 상세 라이브 조회를 지원하지 않습니다.", retryable: false };
  return httpGet(
    `/admin/competitions/${encodeURIComponent(competitionId)}/entries/${encodeURIComponent(entryId)}`,
    AdminEntryDetailSchema,
    opts.signal,
  );
}

/** Live CSV export for the current search/filter/sort. POST
 *  /admin/competitions/{competitionId}/entries/export (EntryExportRequest body).
 *  Success is a text/csv Blob (the full result set, NOT the current page); an
 *  error is the JSON envelope. Returns the Blob for the caller to download. */
export async function exportAdminEntriesCsv(
  competitionId: string,
  query: AdminQuery,
  opts: { signal?: AbortSignal } = {},
): Promise<RequestState<Blob>> {
  if (!isLive)
    return { kind: "error", code: "NOT_CONNECTED", message: "미리보기에서는 CSV 내보내기를 지원하지 않습니다.", retryable: false };
  const body: Record<string, unknown> = {};
  if (query.search) body.q = query.search;
  if (query.status && query.status !== "all") body.entryStatus = query.status;
  if (query.payment && query.payment !== "all") body.paymentState = query.payment;
  if (query.result && query.result !== "all") body.publishedResult = query.result;
  if (query.sort) body.sort = query.sort;
  let res: Response;
  try {
    res = await fetch(`/api/v1/admin/competitions/${encodeURIComponent(competitionId)}/entries/export`, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "text/csv" },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch {
    return { kind: "error", code: "NETWORK", message: "네트워크 오류입니다. 연결을 확인해 주세요.", retryable: true };
  }
  if (res.ok && (res.headers.get("content-type") ?? "").includes("csv")) {
    return { kind: "success", data: await res.blob() };
  }
  const json = await res.json().catch(() => null);
  const err = (json as { error?: { code: string; message: string; retryable: boolean } } | null)?.error;
  if (err) return { kind: "error", code: err.code, message: err.message, retryable: err.retryable };
  const byStatus: Record<number, string> = { 401: "UNAUTHENTICATED", 403: "FORBIDDEN", 404: "NOT_FOUND" };
  return { kind: "error", code: byStatus[res.status] ?? "INTERNAL_ERROR", message: `내보내기 실패 (${res.status})`, retryable: res.status >= 500 };
}

/* ---- bulk operations (result publish / certificate issue) ---- */

export type BulkOutcome = {
  requested: number;
  succeeded: string[];
  failed: { id: string; reason: string }[];
};

export type BulkScenario = "ok" | "partial" | "forbidden";

async function runBulk(
  ids: string[],
  opts: { scenario?: BulkScenario; delayMs?: number },
  failReason: string,
): Promise<RequestState<BulkOutcome>> {
  if (opts.delayMs) await wait(opts.delayMs);
  if (opts.scenario === "forbidden")
    return { kind: "error", code: "FORBIDDEN", message: "이 작업을 수행할 권한이 없습니다.", retryable: false };
  const succeeded: string[] = [];
  const failed: { id: string; reason: string }[] = [];
  ids.forEach((id, i) => {
    // In the "partial" scenario, every 3rd item fails.
    if (opts.scenario === "partial" && i % 3 === 2) failed.push({ id, reason: failReason });
    else succeeded.push(id);
  });
  return { kind: "success", data: { requested: ids.length, succeeded, failed } };
}

export function bulkPublishResult(
  ids: string[],
  _result: PublishedResult,
  opts: { actionId: string; scenario?: BulkScenario; delayMs?: number },
): Promise<RequestState<BulkOutcome>> {
  return runBulk(ids, opts, "이미 다른 결과가 확정되어 변경할 수 없습니다.");
}

export function bulkIssueCertificates(
  ids: string[],
  opts: { actionId: string; scenario?: BulkScenario; delayMs?: number },
): Promise<RequestState<BulkOutcome>> {
  return runBulk(ids, opts, "결과 미발표 또는 발급 대상이 아닙니다.");
}

export async function requestCsvExport(
  _query: AdminQuery,
  opts: { delayMs?: number } = {},
): Promise<RequestState<{ exportId: string; status: "queued" }>> {
  if (opts.delayMs) await wait(opts.delayMs);
  return { kind: "success", data: { exportId: "exp_mock_1", status: "queued" } };
}

/* ================================================================== */
/* JUDGE (blind)                                                       */
/* ================================================================== */

// Blind assignment carries NO participant identity — a code + facets + a PDF.
export type JudgeReviewState = "not_started" | "in_progress" | "submitted";

export type JudgeAssignment = {
  id: string; // review id
  code: string; // blind code shown to the judge
  category: string;
  ageGroup: string;
  reviewState: JudgeReviewState;
  editableAfterSubmit: boolean;
};

export type JudgeScenario = "some" | "empty" | "forbidden";

const JUDGE_ASSIGNMENTS: JudgeAssignment[] = [
  { id: "rev_1", code: "L27-0421", category: "그림책", ageGroup: "미들", reviewState: "not_started", editableAfterSubmit: false },
  { id: "rev_2", code: "L27-0422", category: "아트북", ageGroup: "유스", reviewState: "in_progress", editableAfterSubmit: false },
  { id: "rev_3", code: "L27-0423", category: "그래픽 스토리", ageGroup: "주니어", reviewState: "submitted", editableAfterSubmit: true },
  { id: "rev_4", code: "L27-0424", category: "일러스트 스토리", ageGroup: "유스", reviewState: "not_started", editableAfterSubmit: false },
  { id: "rev_5", code: "L27-0425", category: "실험적 북 프로젝트", ageGroup: "미들", reviewState: "submitted", editableAfterSubmit: false },
];

export async function listJudgeAssignments(
  opts: { scenario?: JudgeScenario; delayMs?: number; signal?: AbortSignal } = {},
): Promise<RequestState<JudgeAssignment[]>> {
  // Live: GET /judge/assignments — a bare array (blind: code + facets + state, no
  // participant identity). An empty array becomes `empty` so the screen shows the
  // "no assignments" view. Access is enforced by the server (401/403).
  if (isLive) {
    const r = await httpGet("/judge/assignments", JudgeAssignmentsSchema, opts.signal);
    if (r.kind !== "success") return r;
    return r.data.length === 0 ? { kind: "empty" } : { kind: "success", data: [...r.data] };
  }
  if (opts.delayMs) await wait(opts.delayMs);
  if (opts.scenario === "forbidden")
    return { kind: "error", code: "FORBIDDEN", message: "배정된 심사가 없거나 접근 권한이 없습니다.", retryable: false };
  if (opts.scenario === "empty") return { kind: "empty" };
  return { kind: "success", data: JUDGE_ASSIGNMENTS };
}

// Rubric comes from settings (dev values — NOT confirmed scoring policy).
export type RubricCriterion = { id: string; label: string; description: string; maxScore: number };

export const REVIEW_RUBRIC_SETTINGS: RubricCriterion[] = [
  { id: "creativity", label: "창의성", description: "발상과 표현의 독창성", maxScore: 20 },
  { id: "theme", label: "주제 이해", description: "주제 해석의 깊이와 적합성", maxScore: 20 },
  { id: "expression", label: "표현력", description: "시각·서사 표현의 완성도", maxScore: 20 },
  { id: "completeness", label: "완성도", description: "구성·마감의 완성도", maxScore: 20 },
  { id: "potential", label: "발전 가능성", description: "성장·확장 가능성", maxScore: 20 },
];

export type ReviewDraft = { scores: Record<string, number>; comment: string };

export type ReviewContext = {
  assignment: JudgeAssignment;
  rubric: RubricCriterion[];
  draft: ReviewDraft;
  submitted: boolean;
  editableAfterSubmit: boolean;
  revision: number;
  // The blinded PDF is null until the server has prepared it (see blockingReasons).
  pdf: { blindedName: string; url: string; expiresAt?: string } | null;
  blockingReasons: "BLINDED_FILE_NOT_READY"[];
};

export function getReviewContextSync(reviewId: string): RequestState<ReviewContext> {
  const a = JUDGE_ASSIGNMENTS.find((x) => x.id === reviewId);
  if (!a) return { kind: "error", code: "NOT_FOUND", message: "배정을 찾을 수 없습니다.", retryable: false };
  const submitted = a.reviewState === "submitted";
  const draft: ReviewDraft =
    a.reviewState === "not_started"
      ? { scores: {}, comment: "" }
      : {
          scores: { creativity: 16, theme: 15, expression: 17, completeness: 14, potential: 15 },
          comment: submitted ? "구성이 탄탄하고 색 사용이 인상적입니다." : "표현이 좋으나 후반부 밀도가 아쉽습니다.",
        };
  return {
    kind: "success",
    data: {
      assignment: a,
      rubric: REVIEW_RUBRIC_SETTINGS,
      draft,
      submitted,
      editableAfterSubmit: a.editableAfterSubmit,
      revision: 3,
      // Blinded filename — the server strips identifying info (see proposal doc).
      pdf: { blindedName: `${a.code}.pdf`, url: "#" },
      blockingReasons: [],
    },
  };
}

/** Live-capable blind review context. Live: GET /judge/reviews/{id}
 *  (JudgeReviewContext — assignment, rubric, saved draft, revision, blinded PDF
 *  or a BLINDED_FILE_NOT_READY block). Access is enforced by the server; an
 *  unassigned/unknown id resolves to a NOT_FOUND/FORBIDDEN error. Mock: fixture. */
export async function getReviewContext(
  reviewId: string,
  opts: { signal?: AbortSignal } = {},
): Promise<RequestState<ReviewContext>> {
  if (isLive) {
    const r = await httpGet(`/judge/reviews/${encodeURIComponent(reviewId)}`, JudgeReviewContextSchema, opts.signal);
    if (r.kind !== "success") return r;
    const d = r.data;
    return {
      kind: "success",
      data: {
        assignment: { ...d.assignment },
        rubric: d.rubric.map((c) => ({ ...c })),
        draft: { scores: { ...d.draft.scores }, comment: d.draft.comment },
        submitted: d.submitted,
        editableAfterSubmit: d.editableAfterSubmit,
        revision: d.revision,
        pdf: d.pdf ? { blindedName: d.pdf.blindedName, url: d.pdf.url, expiresAt: d.pdf.expiresAt } : null,
        blockingReasons: [...d.blockingReasons],
      },
    };
  }
  return getReviewContextSync(reviewId);
}

export type SaveScenario = "ok" | "fail";
export type SubmitScenario = "ok" | "conflict";

export async function saveReviewDraft(
  reviewId: string,
  draft: ReviewDraft,
  opts: { expectedRevision: number; scenario?: SaveScenario; delayMs?: number; signal?: AbortSignal },
): Promise<RequestState<{ savedAt: string; revision: number }>> {
  // Live: PUT /judge/reviews/{id}/draft with {expectedRevision, draft}. The new
  // revision is returned so the next save/submit can use it (optimistic-lock).
  if (isLive) {
    const r = await httpSend("PUT", `/judge/reviews/${encodeURIComponent(reviewId)}/draft`, JudgeReviewMutationSchema, {
      body: { expectedRevision: opts.expectedRevision, draft },
      signal: opts.signal,
    });
    if (r.kind !== "success") return r;
    return { kind: "success", data: { savedAt: r.data.savedAt, revision: r.data.revision } };
  }
  if (opts.delayMs) await wait(opts.delayMs);
  if (opts.scenario === "fail")
    return { kind: "error", code: "INTERNAL_ERROR", message: "임시저장에 실패했습니다. 다시 시도해 주세요.", retryable: true };
  return { kind: "success", data: { savedAt: "2027-01-05T10:00:00Z", revision: opts.expectedRevision + 1 } };
}

export async function submitReview(
  reviewId: string,
  draft: ReviewDraft,
  opts: { expectedRevision: number; scenario?: SubmitScenario; delayMs?: number; signal?: AbortSignal },
): Promise<RequestState<{ submittedAt: string; revision: number }>> {
  // Live: POST /judge/reviews/{id}/submit with {expectedRevision, draft}. A
  // REVISION_CONFLICT (409) means someone saved first — surfaced, never overwritten.
  if (isLive) {
    const r = await httpSend("POST", `/judge/reviews/${encodeURIComponent(reviewId)}/submit`, JudgeReviewMutationSchema, {
      body: { expectedRevision: opts.expectedRevision, draft },
      signal: opts.signal,
    });
    if (r.kind !== "success") return r;
    return { kind: "success", data: { submittedAt: r.data.submittedAt ?? r.data.savedAt, revision: r.data.revision } };
  }
  if (opts.delayMs) await wait(opts.delayMs);
  if (opts.scenario === "conflict")
    return { kind: "error", code: "REVISION_CONFLICT", message: "다른 기기에서 먼저 저장되었습니다. 최신 내용을 불러온 뒤 다시 제출하세요.", retryable: true };
  return { kind: "success", data: { submittedAt: "2027-01-05T10:05:00Z", revision: opts.expectedRevision + 1 } };
}

/* ---- privacy requests admin (account closure + erasure review; LIVE, organizer) ---- */

export type AdminPrivacyRequest = z.infer<typeof AdminPrivacyRequestSchema>;

/** Privacy requests queue (account closure + erasure). Live: GET
 *  /admin/privacy-requests. */
export async function listAdminPrivacyRequests(opts: { signal?: AbortSignal } = {}): Promise<RequestState<Page<AdminPrivacyRequest>>> {
  if (!isLive) return cmsOff();
  const r = await httpList("/admin/privacy-requests?limit=50", AdminPrivacyRequestSchema, opts.signal);
  return r as RequestState<Page<AdminPrivacyRequest>>;
}

/** Transition a privacy request (start_review / place_retention_hold /
 *  resume_review / approve_for_execution). Live: POST
 *  /admin/privacy-requests/{id}/review. Approving execution is guarded and
 *  irreversible — the caller confirms before invoking that decision. */
export async function reviewPrivacyRequest(
  id: string, input: ReviewPrivacyRequest, opts: { signal?: AbortSignal } = {},
): Promise<RequestState<AdminPrivacyRequest>> {
  if (!isLive) return cmsOff();
  return httpSend("POST", `/admin/privacy-requests/${encodeURIComponent(id)}/review`, AdminPrivacyRequestSchema, { body: input, signal: opts.signal });
}

/* ---- competition presentation (public card copy; LIVE, organizer) ---- */

export type AdminCompetitionPresentation = z.infer<typeof AdminCompetitionPresentationSchema>;
export type CompetitionPresentation = z.infer<typeof CompetitionPresentationSchema>;

/** Card presentation copy for a competition (summary/category/city/cover). Live:
 *  GET /admin/competitions/{id}/presentation. No data yet → revision 0, all null. */
export async function getCompetitionPresentation(competitionId: string, opts: { signal?: AbortSignal } = {}): Promise<RequestState<AdminCompetitionPresentation>> {
  if (!isLive) return cmsOff();
  return httpGet(`/admin/competitions/${encodeURIComponent(competitionId)}/presentation`, AdminCompetitionPresentationSchema, opts.signal);
}

/** Save card presentation copy. Live: PUT /admin/competitions/{id}/presentation
 *  with {expectedRevision, content, evidenceReference}. First save uses revision 0.
 *  There is no actionId — on an unclear result GET to re-check; on 409 compare. */
export async function updateCompetitionPresentation(
  competitionId: string, input: { expectedRevision: number; content: CompetitionPresentation; evidenceReference: string }, opts: { signal?: AbortSignal } = {},
): Promise<RequestState<AdminCompetitionPresentation>> {
  if (!isLive) return cmsOff();
  return httpSend("PUT", `/admin/competitions/${encodeURIComponent(competitionId)}/presentation`, AdminCompetitionPresentationSchema, { body: input, signal: opts.signal });
}

/* ---- project archive CMS (completed projects; LIVE, organizer) ---- */

export type ArchiveAdminItem = z.infer<typeof ArchiveAdminItemSchema>;
export type ArchivePublicationEvidence = z.infer<typeof ArchivePublicationEvidenceSchema>;

/** Archive projects (draft/published/archived). Live: GET /admin/content/projects. */
export async function listAdminProjects(
  status: string | null = null, opts: { signal?: AbortSignal } = {},
): Promise<RequestState<Page<ArchiveAdminItem>>> {
  if (!isLive) return cmsOff();
  const p = new URLSearchParams();
  if (status) p.set("status", status);
  p.set("limit", "20");
  const r = await httpList(`/admin/content/projects?${p.toString()}`, ArchiveAdminItemSchema, opts.signal);
  return r as RequestState<Page<ArchiveAdminItem>>;
}

/** One archive project (admin). Live: GET /admin/content/projects/{id}. */
export async function getAdminProject(id: string, opts: { signal?: AbortSignal } = {}): Promise<RequestState<ArchiveAdminItem>> {
  if (!isLive) return cmsOff();
  return httpGet(`/admin/content/projects/${encodeURIComponent(id)}`, ArchiveAdminItemSchema, opts.signal);
}

/** Create a draft project. Live: POST /admin/content/projects. */
export async function createProject(
  input: { actionId: string; slug: string; content: ArchiveContent }, opts: { signal?: AbortSignal } = {},
): Promise<RequestState<ArchiveAdminItem>> {
  if (!isLive) return cmsOff();
  return httpSend("POST", "/admin/content/projects", ArchiveAdminItemSchema, { body: input, signal: opts.signal });
}

/** Edit a project (whole content). Live: PATCH /admin/content/projects/{id}.
 *  Editing a PUBLISHED project reverts it to draft (removed from public). */
export async function updateProject(
  id: string, input: { actionId: string; expectedRevision: number; content: ArchiveContent }, opts: { signal?: AbortSignal } = {},
): Promise<RequestState<ArchiveAdminItem>> {
  if (!isLive) return cmsOff();
  return httpSend("PATCH", `/admin/content/projects/${encodeURIComponent(id)}`, ArchiveAdminItemSchema, { body: input, signal: opts.signal });
}

/** Publish a draft (records publication evidence). Live: POST .../{id}/publish. */
export async function publishProject(
  id: string, input: { actionId: string; expectedRevision: number; evidence: ArchivePublicationEvidence }, opts: { signal?: AbortSignal } = {},
): Promise<RequestState<ArchiveAdminItem>> {
  if (!isLive) return cmsOff();
  return httpSend("POST", `/admin/content/projects/${encodeURIComponent(id)}/publish`, ArchiveAdminItemSchema, { body: input, signal: opts.signal });
}

/** Archive a project (terminal — no restore). Live: POST .../{id}/archive. */
export async function archiveProject(
  id: string, input: { actionId: string; expectedRevision: number }, opts: { signal?: AbortSignal } = {},
): Promise<RequestState<ArchiveAdminItem>> {
  if (!isLive) return cmsOff();
  return httpSend("POST", `/admin/content/projects/${encodeURIComponent(id)}/archive`, ArchiveAdminItemSchema, { body: input, signal: opts.signal });
}
