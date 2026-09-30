import { configuredS3Storage } from '../src/server/uploads/s3.ts';

if (process.argv.length !== 2) {
  console.error('FAIL unsupported arguments. Supply storage configuration through environment variables.');
  process.exitCode = 1;
} else {
  const storage = configuredS3Storage(process.env);
  if (!storage?.checkConfiguration) {
    console.error('MISSING storage configuration. No AWS request was sent.');
    process.exitCode = 1;
  } else {
    try {
      await storage.checkConfiguration();
      console.log('PASS bucket owner check, enabled versioning and all four public access blocks.');
    } catch {
      console.error('FAIL storage configuration or AWS access. Check permissions, connectivity and bucket settings.');
      process.exitCode = 1;
    }
  }
}
console.log('Read-only scope: no object upload, download, deletion or configuration change. CORS, object permissions, encryption, lifecycle and end-to-end transfer remain unverified.');
