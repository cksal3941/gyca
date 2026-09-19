import { runScheduledJobs, ScheduledJobError } from './lib/scheduled-jobs.mjs';

try {
  const result = await runScheduledJobs(process.env);
  console.log(JSON.stringify(result));
  if (result.stalled) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof ScheduledJobError ? error.message : 'Scheduled job execution failed.');
  process.exitCode = 1;
}
