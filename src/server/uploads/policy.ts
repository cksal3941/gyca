import type { FormSpec } from "../../contracts/index.ts";

export const MAX_UPLOAD_BYTES = 64 * 1024 * 1024;
export function supportsUploadRule(rule: FormSpec["uploads"][number]): boolean {
  if (rule.maxBytes === null || rule.maxBytes > MAX_UPLOAD_BYTES || rule.allowedMediaTypes.length === 0) return false;
  if (rule.purpose === "cover_image") return rule.minPages === null
    && rule.allowedMediaTypes.every(type => type === "image/png" || type === "image/jpeg");
  return rule.allowedMediaTypes.every(type => type === "application/pdf");
}
