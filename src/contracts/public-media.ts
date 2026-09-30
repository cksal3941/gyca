import { z } from "zod";

export const PublicMediaReferenceSchema = z.string().min(1).max(2000).refine(value => {
  if (/[\s\\?#]/u.test(value)) return false;
  try {
    const decoded = decodeURIComponent(value);
    if (/[\s\\?#]/u.test(decoded) || decoded.includes('..')) return false;
    const base = new URL('https://gyca.invalid');
    const url = new URL(value, base);
    if (value.startsWith('/')) return !decoded.startsWith('//') && url.origin === base.origin;
    return /^https:\/\//iu.test(value) && url.protocol === 'https:' && !url.username && !url.password;
  } catch (error) {
    if (error instanceof TypeError || error instanceof URIError) return false;
    throw error;
  }
}, "Use a public site path or HTTPS URL without credentials, query or fragment");

export const PublicCopySchema = z.strictObject({
  en: z.string().trim().min(1).max(5000), ko: z.string().trim().min(1).max(5000),
}).readonly();
export const PublicMediaSchema = z.strictObject({
  src: PublicMediaReferenceSchema, alt: PublicCopySchema, caption: PublicCopySchema.nullable(),
}).readonly();
