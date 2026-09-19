import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export const platformMigrationNames = ['001_entries', '002_competitions', '003_uploads', '004_submissions', '005_payments',
  '006_payment_confirmations', '007_payment_recovery', '008_payment_admin', '009_payment_routing', '010_order_routes',
  '011_competition_admin', '012_receipt_email', '013_guardian_consent', '014_organizer_access_audit', '015_payment_access_audit', '016_submission_policy_admin', '017_payment_policy_admin', '018_application_pauses', '019_draft_withdrawals', '020_guardian_verifications', '021_application_resumes', '022_retention_policy', '023_asset_deletion_jobs', '024_result_publication', '025_judge_reviews', '026_judge_operations', '027_judge_assignment_lifecycle', '028_result_rounds_and_final_participation', '029_certificates', '030_late_payment_acceptance', '031_refunds', '032_launch_control', '033_entry_exports', '034_admin_dashboard', '035_privacy_requests', '036_editorial_content', '037_partner_content'];

export async function loadPlatformMigrations() {
  return Promise.all(platformMigrationNames.map(async name => {
    const sql = await readFile(new URL(`../../migrations/${name}.sql`, import.meta.url), 'utf8');
    return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
  }));
}
