import type { UploadTarget } from "../../contracts/uploads.ts";

/** Adapters must issue create-only writes and read immutable versions with streaming size limits. */
export interface UploadStorage {
  checkConfiguration?(): Promise<void>;
  /** Permanently delete only the named immutable object version. */
  deleteImmutable?(input: { readonly key: string; readonly version: string }): Promise<void>;
  signDownload?(input: { readonly key: string; readonly version: string }): Promise<{ readonly url: string; readonly expiresAt: string }>;
  signCreate(input: { readonly key: string; readonly mediaType: string; readonly sizeBytes: number; readonly expiresAt: Date }): Promise<UploadTarget>;
  readImmutable(key: string, maxBytes: number): Promise<{ readonly bytes: Uint8Array; readonly version: string } | null>;
  /** Server-only exact-version read used by derived asset workers. */
  readVersion?(input: { readonly key: string; readonly version: string; readonly maxBytes: number }): Promise<{ readonly bytes: Uint8Array } | null>;
  /** Server-only create-only write; the returned version is the immutable object identity. */
  writeImmutable?(input: { readonly key: string; readonly bytes: Uint8Array; readonly mediaType: "application/pdf" }): Promise<{ readonly version: string }>;
}
