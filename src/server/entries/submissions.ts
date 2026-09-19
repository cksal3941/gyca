import { createHash } from "node:crypto";
import { z } from "zod";
import { EntryIdSchema, ParticipantDraftSchema, WorkDraftSchema, GuardianDraftSchema } from "../../contracts/index.ts";
import type { EntryId, ApiError, BlockingReason } from "../../contracts/index.ts";
import { CONSENT_KINDS, SubmissionReadinessSchema, SubmissionResultSchema } from "../../contracts/submissions.ts";
import { SubmissionPolicySchema } from "../../contracts/submission-policy.ts";
export { SubmissionPolicySchema } from "../../contracts/submission-policy.ts";
import type { SubmitEntryRequest, SubmissionReadiness, SubmissionResult } from "../../contracts/submissions.ts";
import { CompetitionRowSchema, draftPolicyError, projectCompetition } from "../competitions/policy.ts";
import type { EntryDatabase, SqlConnection } from "./database.ts";
import { EntryFault } from "./errors.ts";
import { supportsUploadRule } from "../uploads/policy.ts";

const rowSchema = z.object({ id: EntryIdSchema, competition_id: z.string(), revision: z.number(), status: z.string(),
  participant: ParticipantDraftSchema, work: WorkDraftSchema, guardian: GuardianDraftSchema });
const assetSchema = z.object({ id: z.uuid(), purpose: z.string(), display_name: z.string(), state: z.string(),
  object_key: z.string(), object_version: z.string().nullable(), checksum: z.string().nullable(),
  declared_type: z.string(), declared_size: z.coerce.number(), size_bytes: z.coerce.number(), page_count: z.number().nullable() });
const guardianVerificationSchema = z.object({ request_id: z.uuid(), entry_revision: z.number().int().positive(),
  policy_token: z.string(), accepted_at: z.coerce.date(), verified_at: z.coerce.date() });
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function load(db: SqlConnection, owner: string, id: EntryId) {
  // Same lock order as draft and upload mutations. The clock is read only after both locks are held.
  const entry = (await db.query("SELECT * FROM gyca_entries WHERE id=$1 AND owner_id=$2 FOR UPDATE", [id, owner])).rows[0];
  if (entry === undefined) throw new EntryFault("NOT_FOUND", 404);
  const row = rowSchema.parse(entry);
  const rawPolicy = (await db.query("SELECT * FROM gyca_competitions WHERE id=$1 FOR SHARE", [row.competition_id])).rows[0];
  const policy = CompetitionRowSchema.extend({ submission_policy: z.unknown() }).parse(rawPolicy);
  const assets = z.array(assetSchema).parse((await db.query(
    "SELECT * FROM gyca_assets WHERE entry_id=$1 AND removed_at IS NULL ORDER BY id", [id])).rows);
  const guardianRaw = (await db.query(`SELECT r.id AS request_id,r.entry_revision,r.policy_token,c.accepted_at,v.verified_at
    FROM gyca_guardian_requests r JOIN gyca_guardian_consents c ON c.request_id=r.id
    JOIN gyca_guardian_verifications v ON v.request_id=r.id
    WHERE r.entry_id=$1 ORDER BY r.created_at DESC,r.id DESC LIMIT 1`, [id])).rows[0];
  const guardianVerification = guardianRaw === undefined ? null : guardianVerificationSchema.parse(guardianRaw);
  return { row, policy, assets, guardianVerification };
}
type Loaded = Awaited<ReturnType<typeof load>>;

function assess(loaded: Loaded, locale: "en" | "ko", now: Date): SubmissionReadiness {
  const { row, policy, assets } = loaded;
  const base = { entryId: row.id, revision: row.revision, locale, policyToken: null, documents: [],
    allowedActions: [], fieldErrors: [], ageGroup: null };
  if (row.status !== "draft") return SubmissionReadinessSchema.parse({ ...base, blockingReasons: ["ENTRY_LOCKED"] });
  const blocked = draftPolicyError(policy, now);
  if (blocked !== null) return SubmissionReadinessSchema.parse({ ...base, blockingReasons: [blocked.code] });
  const parsed = SubmissionPolicySchema.safeParse(policy.submission_policy);
  const competition = projectCompetition(policy, now);
  const spec = competition?.formSpec;
  if (!parsed.success || spec === undefined || spec === null || spec.ageReferenceDate === null
    || competition?.fee === null || policy.payment_closes_at === null || policy.closes_at === null
    || policy.payment_closes_at < policy.closes_at
    || spec.categories.length === 0 || spec.ageGroups.length === 0
    || new Set(spec.categories.map((c) => c.id)).size !== spec.categories.length
    || new Set(spec.ageGroups.map((g) => g.id)).size !== spec.ageGroups.length
    || new Set(spec.fields.map((f) => f.path)).size !== spec.fields.length
    || new Set(spec.uploads.map((u) => u.purpose)).size !== spec.uploads.length
    || !spec.uploads.every(supportsUploadRule)
    || !spec.uploads.some((u) => u.purpose === "book_pdf" && u.requiredOnSubmit && u.maxFiles === 1 && (u.minPages ?? 0) >= 20)
    || !spec.uploads.some((u) => u.purpose === "cover_image" && u.requiredOnSubmit && u.maxFiles === 1)
    || spec.ageGroups.some((g, i) => spec.ageGroups.some((h, j) => i !== j && g.minAgeInclusive <= h.maxAgeInclusive && h.minAgeInclusive <= g.maxAgeInclusive))) {
    return SubmissionReadinessSchema.parse({ ...base, blockingReasons: ["POLICY_NOT_CONFIGURED"] });
  }
  const documents = parsed.data.documents.filter((d) => d.locale === locale);
  if (documents.length !== CONSENT_KINDS.length)
    return SubmissionReadinessSchema.parse({ ...base, blockingReasons: ["POLICY_NOT_CONFIGURED"] });
  const token = hash({ policy: parsed.data, formSpec: spec, opensAt: policy.opens_at, closesAt: policy.closes_at,
    fee: competition?.fee, paymentClosesAt: policy.payment_closes_at, timezone: competition?.timezone });
  const errors: { path: string; code: ApiError["fieldErrors"][number]["code"] }[] = [];
  const values = new Map<string, unknown>([
    ...Object.entries(row.participant).map(([key, value]) => [`participant.${key}`, value] satisfies [string, unknown]),
    ...Object.entries(row.work).map(([key, value]) => [`work.${key}`, value] satisfies [string, unknown]),
    ...Object.entries(row.guardian).map(([key, value]) => [`guardian.${key}`, value] satisfies [string, unknown]),
  ]);
  const required = new Set(["work.englishTitle", "work.englishDescription", "work.category", "participant.dateOfBirth", "participant.residenceCountry",
    ...spec.fields.filter((f) => f.requiredOnSubmit).map((f) => f.path)]);
  for (const path of required) {
    const value = values.get(path);
    if (typeof value !== "string" || value.trim() === "") errors.push({ path, code: "REQUIRED" });
  }
  if (row.work.category && !spec.categories.some((c) => c.id === row.work.category)) errors.push({ path: "work.category", code: "INVALID_CHOICE" });
  const birth = row.participant.dateOfBirth;
  const reference = spec.ageReferenceDate;
  const age = birth ? Number(reference.slice(0, 4)) - Number(birth.slice(0, 4)) - (reference.slice(5) < birth.slice(5) ? 1 : 0) : null;
  const group = age === null ? undefined : spec.ageGroups.find((g) => age >= g.minAgeInclusive && age <= g.maxAgeInclusive);
  if (birth && group === undefined) errors.push({ path: "participant.dateOfBirth", code: "AGE_OUT_OF_RANGE" });
  const reasons: BlockingReason[] = [];
  if (errors.length) reasons.push("REQUIRED_FIELDS_MISSING");
  const country = row.participant.residenceCountry ?? "";
  const guardianAge = parsed.data.guardianAgeByCountry[country];
  const parts = new Intl.DateTimeFormat("en", { timeZone: competition?.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const consentAge = birth ? Number(year) - Number(birth.slice(0, 4)) - (`${month}-${day}` < birth.slice(5) ? 1 : 0) : null;
  if (guardianAge === undefined) reasons.push("POLICY_NOT_CONFIGURED");
  else if (consentAge !== null && consentAge < guardianAge) {
    const verification = loaded.guardianVerification;
    const verified = verification !== null && verification.entry_revision === row.revision
      && verification.policy_token === token && verification.verified_at >= verification.accepted_at;
    if (!verified) reasons.push("GUARDIAN_VERIFICATION_REQUIRED");
  }
  const invalidAsset = assets.some((a) => {
    const rule = spec.uploads.find((u) => u.purpose === a.purpose);
    return rule === undefined || a.state !== "ready" || !a.object_version || !a.checksum?.match(/^[a-f0-9]{64}$/)
      || a.size_bytes <= 0 || a.size_bytes !== a.declared_size || rule.maxBytes === null || a.size_bytes > rule.maxBytes
      || !rule.allowedMediaTypes.includes(a.declared_type) || (rule.minPages !== null && (a.page_count ?? 0) < rule.minPages);
  });
  if (invalidAsset || spec.uploads.some((u) => {
    const count = assets.filter((a) => a.purpose === u.purpose).length;
    return (u.requiredOnSubmit && count === 0) || count > u.maxFiles;
  })) reasons.push("FILE_NOT_READY");
  return SubmissionReadinessSchema.parse({ ...base, policyToken: token, documents, fieldErrors: errors,
    ageGroup: group?.id ?? null, allowedActions: reasons.length === 0 ? ["submit"] : [], blockingReasons: reasons });
}

export function createSubmissionService(database: EntryDatabase, now: () => Date) {
  return {
    readiness: (owner: string, id: EntryId, locale: "en" | "ko") => database.transaction(async (db) =>
      assess(await load(db, owner, id), locale, now())),
    submit: (owner: string, id: EntryId, key: string, input: SubmitEntryRequest): Promise<SubmissionResult> => database.transaction(async (db) => {
      const loaded = await load(db, owner, id);
      const fingerprint = hash({ ...input, consents: [...input.consents].sort((a, b) => a.kind.localeCompare(b.kind)) });
      const previous = (await db.query("SELECT request_key,request_hash,result FROM gyca_submissions WHERE entry_id=$1", [id])).rows[0];
      if (previous !== undefined) {
        const saved = z.object({ request_key: z.string(), request_hash: z.string(), result: SubmissionResultSchema }).parse(previous);
        if (saved.request_key !== key || saved.request_hash !== fingerprint) throw new EntryFault("IDEMPOTENCY_CONFLICT", 409);
        return saved.result;
      }
      if (loaded.row.status !== "draft") throw new EntryFault("ENTRY_LOCKED", 409);
      if (loaded.row.revision !== input.revision) throw new EntryFault("REVISION_CONFLICT", 409);
      const acceptedAt = now();
      const readiness = assess(loaded, input.locale, acceptedAt);
      if (!readiness.allowedActions.includes("submit")) {
        const reason = readiness.blockingReasons[0];
        if (reason === "REQUIRED_FIELDS_MISSING") throw new EntryFault("VALIDATION_FAILED", 422, readiness.fieldErrors);
        const known = z.enum(["POLICY_NOT_CONFIGURED", "GUARDIAN_VERIFICATION_REQUIRED", "FILE_NOT_READY", "DEADLINE_PASSED", "NOT_OPEN_YET", "COMPETITION_ARCHIVED", "ENTRY_LOCKED"]).parse(reason);
        throw new EntryFault(known, known === "POLICY_NOT_CONFIGURED" ? 503 : 409);
      }
      if (input.policyToken !== readiness.policyToken) throw new EntryFault("CONSENT_REQUIRED", 409);
      if (readiness.documents.some((doc) => !input.consents.some((c) => c.kind === doc.kind && c.version === doc.version && c.accepted)))
        throw new EntryFault("CONSENT_REQUIRED", 422);
      const result = SubmissionResultSchema.parse({ entryId: id, revision: loaded.row.revision + 1, entryStatus: "submitted",
        submittedAt: acceptedAt.toISOString(), receiptNumber: null, receivedAt: null,
        allowedActions: ["view_submission"], blockingReasons: ["PAYMENT_REQUIRED", "PAYMENT_UNAVAILABLE"] });
      const snapshot = { participant: loaded.row.participant, work: loaded.row.work, guardian: loaded.row.guardian,
        competition: { ...loaded.policy }, assets: loaded.assets, ageGroup: readiness.ageGroup,
        policyToken: readiness.policyToken, consents: readiness.documents.map((document) => ({ ...document,
          textSha256: createHash("sha256").update(document.text).digest("hex"), actorId: owner, acceptedAt: result.submittedAt })) };
      await db.query("INSERT INTO gyca_submissions(entry_id,request_key,request_hash,submitted_at,snapshot,result) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)",
        [id, key, fingerprint, acceptedAt, JSON.stringify(snapshot), JSON.stringify(result)]);
      await db.query("UPDATE gyca_entries SET status='submitted',submitted_at=$2,revision=revision+1,updated_at=$2 WHERE id=$1", [id, acceptedAt]);
      return result;
    }),
  };
}
