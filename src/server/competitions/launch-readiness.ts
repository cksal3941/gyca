import { z } from "zod";
import { CompetitionContentSchema } from "../../contracts/competition-admin.ts";
import { LaunchReadinessSchema } from "../../contracts/launch-readiness.ts";
import type { LaunchCheck } from "../../contracts/launch-readiness.ts";
import { CONSENT_KINDS } from "../../contracts/submissions.ts";
import { SubmissionPolicySchema } from "../entries/submissions.ts";
import { PaymentRoutingPolicySchema } from "../payments/options.ts";
import type { PaymentProvider } from "../payments/provider.ts";
import type { EntryDatabase } from "../entries/database.ts";
import { EntryFault } from "../entries/errors.ts";
import { supportsUploadRule } from "../uploads/policy.ts";
import { RetentionPolicySchema } from "../../contracts/retention-policy.ts";

const rowSchema = z.object({ revision: z.number().int(), published: z.boolean(), phase: z.string(), public_content: z.unknown(),
  draft_enabled: z.boolean(), payment_enabled: z.boolean(),
  opens_at: z.date().nullable(), closes_at: z.date().nullable(), payment_closes_at: z.date().nullable(),
  submission_policy: z.unknown(), payment_policy: z.unknown(), payment_routing: z.unknown(), retention_policy: z.unknown().optional() });
import { PaymentPolicySchema as paymentPolicy } from "../../contracts/payment-policy.ts";
type ProviderIdentity = Pick<PaymentProvider, "id" | "merchantAccount" | "liveMode" | "beginCheckout">;

export function createLaunchReadiness(database: EntryDatabase,
  runtime: { readonly providers: readonly ProviderIdentity[]; readonly now: () => Date; readonly storageConfigured?: boolean;
    readonly guardianVerificationConfigured?: boolean }) {
  return (actor: string, id: string) => database.transaction(async db => {
    if ((await db.query("SELECT user_id FROM gyca_competition_editors WHERE user_id=$1 FOR SHARE", [actor])).rows.length === 0)
      throw new EntryFault("FORBIDDEN", 403);
    const raw = (await db.query("SELECT * FROM gyca_competitions WHERE id=$1 FOR SHARE", [id])).rows[0];
    if (raw === undefined) throw new EntryFault("NOT_FOUND", 404);
    const row = rowSchema.parse(raw);
    const verified = new Set((await db.query(`SELECT DISTINCT ON (code) code FROM gyca_launch_verifications
      WHERE competition_id=$1 AND competition_revision=$2 AND valid_until>$3
      ORDER BY code,verified_at DESC,id DESC`, [id, row.revision, runtime.now()])).rows.map(item => z.object({ code: z.string() }).parse(item).code));
    const content = CompetitionContentSchema.safeParse(row.public_content);
    const submission = SubmissionPolicySchema.safeParse(row.submission_policy);
    const routing = PaymentRoutingPolicySchema.safeParse(row.payment_routing);
    const spec = content.success ? content.data.formSpec : null;
    const checks: { code: LaunchCheck; status: "configured" | "missing" | "unverified" }[] = [];
    const check = (code: LaunchCheck, configured: boolean) => checks.push({ code, status: configured ? "configured" : "missing" });
    check("public_content", content.success);
    check("published", row.published);
    check("schedule", row.phase === "scheduled" && row.opens_at !== null && row.closes_at !== null && row.payment_closes_at !== null
      && row.opens_at < row.closes_at && row.payment_closes_at >= row.closes_at && runtime.now() < row.closes_at);
    check("form", spec !== null && spec.ageReferenceDate !== null && spec.categories.length > 0 && spec.ageGroups.length > 0
      && new Set(spec.categories.map(c => c.id)).size === spec.categories.length
      && new Set(spec.ageGroups.map(g => g.id)).size === spec.ageGroups.length
      && !spec.ageGroups.some((g, i) => spec.ageGroups.some((h, j) => i !== j && g.minAgeInclusive <= h.maxAgeInclusive && h.minAgeInclusive <= g.maxAgeInclusive))
      && new Set(spec.fields.map(f => f.path)).size === spec.fields.length
      && spec.fields.every(f => f.requiredOnSubmit !== null)
      && new Set(spec.uploads.map(u => u.purpose)).size === spec.uploads.length
      && spec.uploads.every(u => u.requiredOnSubmit !== null && supportsUploadRule(u))
      && spec.uploads.some(u => u.purpose === "book_pdf" && u.requiredOnSubmit && u.maxFiles === 1 && (u.minPages ?? 0) >= 20)
      && spec.uploads.some(u => u.purpose === "cover_image" && u.requiredOnSubmit && u.maxFiles === 1));
    check("consents", submission.success && ["en", "ko"].every(locale => CONSENT_KINDS.every(kind =>
      submission.data.documents.some(d => d.kind === kind && d.locale === locale))));
    const routes = routing.success ? routing.data.routes.filter(route => route.enabled) : [];
    check("guardian_policy", submission.success && routes.length > 0 && routes.every(route => route.countries.every(country =>
      submission.data.guardianAgeByCountry[country] !== undefined)));
    check("payment_policy", paymentPolicy.safeParse(row.payment_policy).success && content.success && content.data.fee !== null && content.data.fee.amountMinor > 0);
    check("payment_routes", routes.length > 0 && routes.every(route => runtime.providers.some(provider =>
      provider.id === route.provider && provider.merchantAccount === route.merchantAccount && provider.liveMode === route.liveMode)));
    // Configuration alone is not an opening approval; external services retain an unverified state until exercised.
    checks.push({ code: "storage", status: !runtime.storageConfigured ? "missing" : verified.has("storage") ? "configured" : "unverified" });
    check("guardian_verification", runtime.guardianVerificationConfigured === true);
    check("checkout", routes.length > 0 && routes.every(route => runtime.providers.some(provider =>
      provider.id === route.provider && provider.merchantAccount === route.merchantAccount
      && provider.liveMode === route.liveMode && provider.beginCheckout !== undefined)));
    const retentionReady = RetentionPolicySchema.safeParse(row.retention_policy).success;
    checks.push({ code: "retention", status: !retentionReady ? "missing" : verified.has("retention") ? "configured" : "unverified" });
    const liveRoutes = routes.length > 0 && routes.every(route => route.liveMode);
    checks.push({ code: "live_payment_verification", status: liveRoutes && verified.has("live_payment_verification") ? "configured" : "unverified" });
    const canOpen = !row.draft_enabled && !row.payment_enabled && checks.every(item => item.status === "configured");
    return LaunchReadinessSchema.parse({ competitionId: id, revision: row.revision, checks, canOpen,
      allowedActions: canOpen ? ["open_applications"] : [] });
  });
}
