import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';
import { S3Client } from '@aws-sdk/client-s3';
import { createS3Storage, configuredS3Storage, configuredS3RetentionStorage, configuredS3BlindStorage } from '../src/server/uploads/s3.ts';

const config = { region: 'eu-central-1', bucket: 'gyca-fixture-only', accountId: '123456789012',
  accessKeyId: 'AKIAFIXTUREEXAMPLE', secretAccessKey: 'fixture-secret-not-a-real-credential-123456' };
const at = new Date('2026-09-16T00:00:00Z');
const key = 'quarantine/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002';
function fixture(overrides = {}) {
  const calls = [];
  const client = new S3Client({ region: config.region, credentials: config, maxAttempts: 1, requestChecksumCalculation: 'WHEN_REQUIRED' });
  client.middlewareStack.add((next, context) => async args => {
    if ((context.commandName === 'PutObjectCommand' && args.input.Body === undefined)
      || (context.commandName === 'GetObjectCommand' && args.input.ResponseContentDisposition)) return next(args);
    calls.push({ command: context.commandName, input: args.input });
    let output;
    if (context.commandName === 'GetBucketVersioningCommand') output = { Status: 'Enabled' };
    if (context.commandName === 'GetPublicAccessBlockCommand') output = { PublicAccessBlockConfiguration: {
      BlockPublicAcls: true, IgnorePublicAcls: true, BlockPublicPolicy: true, RestrictPublicBuckets: true } };
    if (context.commandName === 'GetObjectCommand') output = { Body: Readable.from([Buffer.from('pdf')]), ContentLength: 3, VersionId: 'version-1' };
    if (context.commandName === 'PutObjectCommand') output = { VersionId: 'created-version' };
    if (context.commandName === 'DeleteObjectCommand') output = {};
    if (overrides[context.commandName]) output = await overrides[context.commandName](args.input);
    return { response: {}, output: { ...output, $metadata: {} } };
  }, { step: 'initialize', name: 'fixtureResponses', priority: 'high' });
  return { storage: createS3Storage(config, { client, now: () => at }), calls };
}
const input = { key, mediaType: 'application/pdf', sizeBytes: 3, expiresAt: new Date(at.getTime() + 60000) };

test('S3 configuration is opt-in and incomplete credentials remain disabled', () => {
  assert.equal(configuredS3Storage({}), null);
  assert.equal(configuredS3Storage({ GYCA_STORAGE_PROVIDER: 'aws-s3' }), null);
  assert.equal(configuredS3RetentionStorage({ GYCA_STORAGE_PROVIDER: 'aws-s3' }), null);
  assert.equal(configuredS3BlindStorage({ GYCA_STORAGE_PROVIDER: 'aws-s3' }), null);
});
test('retention deletion permanently targets only the exact immutable version', async () => {
  const { storage, calls } = fixture();
  await storage.deleteImmutable({ key, version: 'saved-version' });
  const deleted = calls.find(call => call.command === 'DeleteObjectCommand');
  assert.deepEqual(deleted.input, { Bucket: config.bucket, ExpectedBucketOwner: config.accountId, Key: key, VersionId: 'saved-version' });
  await assert.rejects(storage.deleteImmutable({ key, version: 'null' }), { code: 'STORAGE_UNAVAILABLE' });
  await assert.rejects(storage.deleteImmutable({ key: '../../private', version: 'v1' }), { code: 'STORAGE_UNAVAILABLE' });
});
test('real AWS presigner binds create-only headers, size, owner and expiration', async () => {
  const { storage, calls } = fixture();
  const target = await storage.signCreate(input); const url = new URL(target.url);
  assert.equal(url.hostname, 'gyca-fixture-only.s3.eu-central-1.amazonaws.com');
  assert.equal(url.searchParams.get('X-Amz-Expires'), '60');
  const signed = url.searchParams.get('X-Amz-SignedHeaders').split(';');
  for (const header of ['content-length','content-type','if-none-match','x-amz-expected-bucket-owner']) assert.ok(signed.includes(header), header);
  assert.equal(target.headers['If-None-Match'], '*'); assert.equal(target.headers['Content-Length'], undefined);
  assert.equal(target.expiresAt, input.expiresAt.toISOString());
  assert.ok(calls.every(c => c.input.ExpectedBucketOwner === config.accountId));
  assert.equal(target.url.includes(config.secretAccessKey), false);
});
test('expired requests and non-quarantine keys never get URLs', async () => {
  const { storage, calls } = fixture();
  await assert.rejects(storage.signCreate({ ...input, expiresAt: at }), { code: 'UPLOAD_EXPIRED' });
  await assert.rejects(storage.signCreate({ ...input, key: '../../private' }), { code: 'STORAGE_UNAVAILABLE' });
  assert.equal(calls.length, 0);
});

test('download URL pins immutable version, expires in sixty seconds and forces attachment', async () => {
  const { storage } = fixture();
  const result = await storage.signDownload({ key, version: 'saved-version' });
  const url = new URL(result.url);
  assert.equal(url.searchParams.get('versionId'), 'saved-version');
  assert.equal(url.searchParams.get('X-Amz-Expires'), '60');
  assert.equal(url.searchParams.get('response-content-type'), 'application/octet-stream');
  assert.match(url.searchParams.get('response-content-disposition'), /^attachment/);
  assert.equal(url.searchParams.get('response-cache-control'), 'private, no-store');
  assert.equal(result.expiresAt, '2026-09-16T00:01:00.000Z');
  await assert.rejects(storage.signDownload({ key, version: 'null' }), { code: 'STORAGE_UNAVAILABLE' });
});
test('public or unversioned buckets are rejected', async () => {
  for (const overrides of [
    { GetBucketVersioningCommand: () => ({ Status: 'Suspended' }) },
    { GetPublicAccessBlockCommand: () => ({ PublicAccessBlockConfiguration: { BlockPublicAcls: true } }) },
  ]) await assert.rejects(fixture(overrides).storage.signCreate(input), { code: 'STORAGE_UNAVAILABLE' });
});

test('configuration preflight performs only read-only bucket checks and redacts errors', async () => {
  const { storage, calls } = fixture();
  await storage.checkConfiguration();
  assert.deepEqual(calls.map(call => call.command), ['GetBucketVersioningCommand', 'GetPublicAccessBlockCommand']);
  assert.ok(calls.every(call => call.input.ExpectedBucketOwner === config.accountId));
  for (const overrides of [
    { GetBucketVersioningCommand: () => ({ Status: 'Suspended' }) },
    { GetPublicAccessBlockCommand: () => ({ PublicAccessBlockConfiguration: { BlockPublicAcls: true } }) },
    { GetBucketVersioningCommand: () => { throw new Error('PRIVATE AWS credentials'); } },
  ]) await assert.rejects(fixture(overrides).storage.checkConfiguration(), error =>
    error.code === 'STORAGE_UNAVAILABLE' && !error.message.includes('PRIVATE'));
});
test('reads bytes with the exact response version and closes stream', async () => {
  const stream = Readable.from([Buffer.from('pdf')]);
  const { storage } = fixture({ GetObjectCommand: () => ({ Body: stream, ContentLength: 3, VersionId: 'immutable-version' }) });
  const result = await storage.readImmutable(key, 10);
  assert.equal(Buffer.from(result.bytes).toString(), 'pdf'); assert.equal(result.version, 'immutable-version');
  assert.equal(stream.destroyed, true);
});
test('worker exact reads and create-only writes preserve immutable object identity', async () => {
  const { storage, calls } = fixture({ GetObjectCommand: input => ({ Body: Readable.from([Buffer.from('pdf')]), ContentLength: 3, VersionId: input.VersionId }) });
  assert.equal(Buffer.from((await storage.readVersion({ key, version: 'source-v1', maxBytes: 10 })).bytes).toString(), 'pdf');
  assert.deepEqual(await storage.writeImmutable({ key, bytes: Buffer.from('new-pdf'), mediaType: 'application/pdf' }), { version: 'created-version' });
  const read = calls.find(call => call.command === 'GetObjectCommand');
  assert.equal(read.input.VersionId, 'source-v1');
  const write = calls.find(call => call.command === 'PutObjectCommand');
  assert.equal(write.input.IfNoneMatch, '*'); assert.equal(write.input.ContentType, 'application/pdf'); assert.equal(write.input.ContentLength, 7);
});
test('bounds both reported size and actual streamed bytes', async () => {
  for (const length of [100, 1]) {
    const stream = Readable.from([Buffer.from('too large')]);
    const { storage } = fixture({ GetObjectCommand: () => ({ Body: stream, ContentLength: length, VersionId: 'v1' }) });
    await assert.rejects(storage.readImmutable(key, 3), { code: 'FILE_TOO_LARGE' });
    assert.equal(stream.destroyed, true);
  }
});
test('missing versions and truncated streams never become validated assets', async () => {
  for (const properties of [{ ContentLength: 3, VersionId: 'null' }, { ContentLength: 4, VersionId: 'v1' }]) {
    const { storage } = fixture({ GetObjectCommand: () => ({ Body: Readable.from([Buffer.from('pdf')]), ...properties }) });
    await assert.rejects(storage.readImmutable(key, 10), { code: 'STORAGE_UNAVAILABLE' });
  }
});
test('missing objects remain pending; service errors do not expose provider details', async () => {
  const missing = fixture({ GetObjectCommand: () => { const error = new Error('private error'); error.name = 'NoSuchKey'; throw error; } });
  assert.equal(await missing.storage.readImmutable(key, 10), null);
  const denied = fixture({ GetObjectCommand: () => { throw new Error('secret token and bucket'); } });
  await assert.rejects(denied.storage.readImmutable(key, 10), error => error.code === 'STORAGE_UNAVAILABLE' && !error.message.includes('secret'));
});
