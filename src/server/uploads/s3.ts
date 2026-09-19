import { Readable } from "node:stream";
import { z } from "zod";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, GetBucketVersioningCommand, GetPublicAccessBlockCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { UploadTargetSchema } from "../../contracts/uploads.ts";
import { EntryFault } from "../entries/errors.ts";
import type { UploadStorage } from "./storage.ts";

const configSchema = z.strictObject({
  region: z.string().regex(/^[a-z]{2}-[a-z]+-\d$/),
  bucket: z.string().min(3).max(63).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
  accountId: z.string().regex(/^\d{12}$/),
  accessKeyId: z.string().min(16).max(128), secretAccessKey: z.string().min(32).max(128),
  sessionToken: z.string().min(1).optional(),
}).readonly();
type S3Config = z.infer<typeof configSchema>;
const keySchema = z.string().regex(/^quarantine\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/);
const MAX_BYTES = 64 * 1024 * 1024;

export function configuredS3Storage(env: Readonly<Record<string, string | undefined>>): UploadStorage | null {
  if (env.GYCA_STORAGE_PROVIDER !== "aws-s3") return null;
  const config = configSchema.safeParse({ region: env.GYCA_S3_REGION, bucket: env.GYCA_S3_BUCKET,
    accountId: env.GYCA_S3_ACCOUNT_ID, accessKeyId: env.GYCA_S3_ACCESS_KEY_ID,
    secretAccessKey: env.GYCA_S3_SECRET_ACCESS_KEY, sessionToken: env.GYCA_S3_SESSION_TOKEN });
  return config.success ? createS3Storage(config.data) : null;
}

export function configuredS3RetentionStorage(env: Readonly<Record<string, string | undefined>>): UploadStorage | null {
  if (env.GYCA_STORAGE_PROVIDER !== "aws-s3") return null;
  const config = configSchema.safeParse({ region: env.GYCA_S3_REGION, bucket: env.GYCA_S3_BUCKET,
    accountId: env.GYCA_S3_ACCOUNT_ID, accessKeyId: env.GYCA_S3_RETENTION_ACCESS_KEY_ID,
    secretAccessKey: env.GYCA_S3_RETENTION_SECRET_ACCESS_KEY, sessionToken: env.GYCA_S3_RETENTION_SESSION_TOKEN });
  return config.success ? createS3Storage(config.data) : null;
}

export function configuredS3BlindStorage(env: Readonly<Record<string, string | undefined>>): UploadStorage | null {
  if (env.GYCA_STORAGE_PROVIDER !== "aws-s3") return null;
  const config = configSchema.safeParse({ region: env.GYCA_S3_REGION, bucket: env.GYCA_S3_BUCKET,
    accountId: env.GYCA_S3_ACCOUNT_ID, accessKeyId: env.GYCA_S3_BLIND_ACCESS_KEY_ID,
    secretAccessKey: env.GYCA_S3_BLIND_SECRET_ACCESS_KEY, sessionToken: env.GYCA_S3_BLIND_SESSION_TOKEN });
  return config.success ? createS3Storage(config.data) : null;
}

export function createS3Storage(config: S3Config, dependencies?: {
  readonly client: S3Client; readonly now: () => Date;
}): UploadStorage {
  const client = dependencies?.client ?? new S3Client({ region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey, sessionToken: config.sessionToken },
    maxAttempts: 1, followRegionRedirects: false, requestChecksumCalculation: "WHEN_REQUIRED" });
  const now = dependencies?.now ?? (() => new Date());
  const bucket = { Bucket: config.bucket, ExpectedBucketOwner: config.accountId };
  async function verifyBucket(signal: AbortSignal) {
    const version = await client.send(new GetBucketVersioningCommand(bucket), { abortSignal: signal });
    const access = await client.send(new GetPublicAccessBlockCommand(bucket), { abortSignal: signal });
    const block = access.PublicAccessBlockConfiguration;
    if (version.Status !== "Enabled" || !block?.BlockPublicAcls || !block.IgnorePublicAcls || !block.BlockPublicPolicy || !block.RestrictPublicBuckets)
      throw new EntryFault("STORAGE_UNAVAILABLE", 503);
  }
  async function readObject(keyInput: string, versionInput: string | null, maxBytes: number) {
    let stream: Readable | undefined;
    try {
      const key = keySchema.parse(keyInput);
      const version = versionInput === null ? undefined : z.string().min(1).max(1024).refine(value => value !== "null").parse(versionInput);
      const limit = z.number().int().positive().max(MAX_BYTES).parse(maxBytes);
      const signal = AbortSignal.timeout(30000);
      await verifyBucket(signal);
      const response = await client.send(new GetObjectCommand({ ...bucket, Key: key, VersionId: version }), { abortSignal: signal });
      if (!(response.Body instanceof Readable)) throw new EntryFault("STORAGE_UNAVAILABLE", 503);
      stream = response.Body;
      const responseVersion = response.VersionId;
      if (!responseVersion || responseVersion === "null" || (version && responseVersion !== version)) throw new EntryFault("STORAGE_UNAVAILABLE", 503);
      const length = response.ContentLength;
      if (length === undefined || !Number.isSafeInteger(length) || length < 0) throw new EntryFault("STORAGE_UNAVAILABLE", 503);
      if (length > limit) throw new EntryFault("FILE_TOO_LARGE", 413);
      const chunks: Uint8Array[] = []; let size = 0;
      for await (const raw of stream) {
        if (!(raw instanceof Uint8Array)) throw new EntryFault("STORAGE_UNAVAILABLE", 503);
        size += raw.byteLength;
        if (size > limit) throw new EntryFault("FILE_TOO_LARGE", 413);
        chunks.push(raw);
      }
      if (size !== length) throw new EntryFault("STORAGE_UNAVAILABLE", 503);
      return { bytes: Buffer.concat(chunks, size), version: responseVersion };
    } catch (error) {
      if (error instanceof EntryFault) throw error;
      if (error instanceof Error && (error.name === "NoSuchKey" || error.name === "NoSuchVersion")) return null;
      throw new EntryFault("STORAGE_UNAVAILABLE", 503);
    } finally { stream?.destroy(); }
  }
  return {
    async deleteImmutable(input) {
      try {
        const key = keySchema.parse(input.key);
        const version = z.string().min(1).max(1024).refine(value => value !== "null").parse(input.version);
        const signal = AbortSignal.timeout(30000);
        await verifyBucket(signal);
        await client.send(new DeleteObjectCommand({ ...bucket, Key: key, VersionId: version }), { abortSignal: signal });
      } catch (error) {
        if (error instanceof EntryFault) throw error;
        throw new EntryFault("STORAGE_UNAVAILABLE", 503);
      }
    },
    async checkConfiguration() {
      try {
        await verifyBucket(AbortSignal.timeout(10000));
      } catch (error) {
        if (error instanceof EntryFault) throw error;
        throw new EntryFault("STORAGE_UNAVAILABLE", 503);
      }
    },
    async signDownload(input) {
      try {
        const key = keySchema.parse(input.key);
        const version = z.string().min(1).max(1024).refine(value => value !== "null").parse(input.version);
        const at = now();
        await verifyBucket(AbortSignal.timeout(10000));
        const command = new GetObjectCommand({ ...bucket, Key: key, VersionId: version,
          ResponseContentDisposition: 'attachment; filename="submission-file"',
          ResponseContentType: "application/octet-stream", ResponseCacheControl: "private, no-store" });
        const url = await getSignedUrl(client, command, { expiresIn: 60, signingDate: at });
        return { url, expiresAt: new Date(at.getTime() + 60000).toISOString() };
      } catch (error) {
        if (error instanceof EntryFault) throw error;
        throw new EntryFault("STORAGE_UNAVAILABLE", 503);
      }
    },
    async signCreate(input) {
      try {
        const key = keySchema.parse(input.key);
        const size = z.number().int().positive().max(MAX_BYTES).parse(input.sizeBytes);
        const mediaType = z.enum(["application/pdf", "image/png", "image/jpeg"]).parse(input.mediaType);
        const at = now();
        const expiresIn = Math.min(900, Math.floor((input.expiresAt.getTime() - at.getTime()) / 1000));
        if (expiresIn < 1) throw new EntryFault("UPLOAD_EXPIRED", 409);
        await verifyBucket(AbortSignal.timeout(10000));
        const command = new PutObjectCommand({ ...bucket, Key: key, ContentLength: size, ContentType: mediaType, IfNoneMatch: "*" });
        const url = await getSignedUrl(client, command, { expiresIn, signingDate: at,
          signableHeaders: new Set(["content-type", "content-length", "if-none-match"]),
          unhoistableHeaders: new Set(["x-amz-expected-bucket-owner"]) });
        return UploadTargetSchema.parse({ method: "PUT", url, expiresAt: new Date(at.getTime() + expiresIn * 1000).toISOString(),
          headers: { "Content-Type": mediaType, "If-None-Match": "*", "x-amz-expected-bucket-owner": config.accountId } });
      } catch (error) {
        if (error instanceof EntryFault) throw error;
        throw new EntryFault("STORAGE_UNAVAILABLE", 503);
      }
    },
    async readVersion(input) {
      const result = await readObject(input.key, input.version, input.maxBytes);
      return result && { bytes: result.bytes };
    },
    async writeImmutable(input) {
      try {
        const key = keySchema.parse(input.key);
        const bytes = Buffer.from(input.bytes);
        if (bytes.byteLength < 1 || bytes.byteLength > MAX_BYTES || input.mediaType !== "application/pdf")
          throw new EntryFault("STORAGE_UNAVAILABLE", 503);
        const signal = AbortSignal.timeout(30000);
        await verifyBucket(signal);
        const response = await client.send(new PutObjectCommand({ ...bucket, Key: key, Body: bytes, ContentLength: bytes.byteLength,
          ContentType: input.mediaType, IfNoneMatch: "*" }), { abortSignal: signal });
        if (!response.VersionId || response.VersionId === "null") throw new EntryFault("STORAGE_UNAVAILABLE", 503);
        return { version: response.VersionId };
      } catch (error) {
        if (error instanceof EntryFault) throw error;
        throw new EntryFault("STORAGE_UNAVAILABLE", 503);
      }
    },
    async readImmutable(key, maxBytes) {
      return readObject(key, null, maxBytes);
    },
  };
}
