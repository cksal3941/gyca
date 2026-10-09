import { z } from "zod";

export const LAUNCH_CHECKS = ["public_content", "published", "schedule", "form", "consents", "guardian_policy",
  "payment_policy", "payment_routes", "storage", "guardian_verification", "checkout", "retention", "live_payment_verification"] as const;
export const LaunchReadinessSchema = z.object({
  competitionId: z.string(), revision: z.number().int().positive(),
  checks: z.array(z.object({ code: z.enum(LAUNCH_CHECKS), status: z.enum(["configured", "missing", "unverified"]) }).readonly()).readonly(),
  canOpen: z.boolean(), allowedActions: z.array(z.literal("open_applications")).readonly(),
}).superRefine((value, context) => {
  if (value.canOpen !== value.allowedActions.includes("open_applications"))
    context.addIssue({ code: "custom", path: ["allowedActions"], message: "Opening action must match readiness" });
}).readonly();
export type LaunchCheck = (typeof LAUNCH_CHECKS)[number];
export type LaunchReadiness = z.infer<typeof LaunchReadinessSchema>;
