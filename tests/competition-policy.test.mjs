import assert from 'node:assert/strict';
import test from 'node:test';
import * as policy from '../src/server/competitions/policy.ts';

export const content = () => ({
  title: { en: 'Test competition', ko: '테스트 공모' }, fee: { amountMinor: 7000, currency: 'EUR' },
  timezone: 'Asia/Seoul', keyDates: [], exhibition: null, guidelines: null,
  formSpec: { version: 'test-only', ageReferenceDate: '2026-01-01', categories: [], ageGroups: [], fields: [], uploads: [] },
});
const row = () => ({ id: 'test', slug: 'test', published: true, draft_enabled: true,
  opens_at: new Date('2026-01-01Z'), closes_at: new Date('2027-01-01Z'),
  phase: 'scheduled', public_content: content(), payment_enabled: false, payment_closes_at: null });
const now = new Date('2026-09-15Z');

test('projects current open status and permits drafts from configured policy', () => {
  const result = policy.projectCompetition(row(), now);
  assert.equal(result.status, 'open');
  assert.deepEqual(result.allowedActions, ['start_entry']);
  assert.equal(result.readiness.payment, false);
});
test('does not serve hidden competitions', () => {
  assert.equal(policy.projectCompetition({ ...row(), published: false }, now), null);
});
test('archived overrides dates and disables application', () => {
  const result = policy.projectCompetition({ ...row(), phase: 'archived' }, now);
  assert.equal(result.status, 'archived');
  assert.deepEqual(result.allowedActions, []);
});
test('exact exclusive closing time disables application', () => {
  const result = policy.projectCompetition(row(), new Date('2027-01-01Z'));
  assert.equal(result.status, 'closed');
  assert.ok(result.blockingReasons.includes('DEADLINE_PASSED'));
});
test('unset age policy fails closed for both public and entry gate', () => {
  const given = row(); given.public_content.formSpec.ageReferenceDate = null;
  const result = policy.projectCompetition(given, now);
  assert.equal(result.readiness.application, false);
  assert.equal(policy.draftPolicyError(given, now).code, 'POLICY_NOT_CONFIGURED');
});
test('removes unapproved venue and logo from public response', () => {
  const given = row(); given.public_content.exhibition = { approvalStatus: 'pending',
    displayName: { en: 'Planned', ko: '예정' }, venueName: 'PRIVATE', logoUrl: 'https://example.com/private.png', period: null };
  const result = policy.projectCompetition(given, now);
  assert.equal(result.exhibition.venueName, null);
  assert.equal(result.exhibition.logoUrl, null);
});

test('public entry actions reject unsupported upload policy instead of allowing a blocked draft', () => {
  for (const patch of [{ maxBytes: 67108865 }, { allowedMediaTypes: ['video/mp4'] }, { allowedMediaTypes: ['image/png'] }]) {
    const given = row();
    given.public_content.formSpec.uploads = [{ purpose: 'book_pdf', requiredOnSubmit: true, allowedMediaTypes: ['application/pdf'],
      maxBytes: 1024, maxFiles: 1, minPages: 20, ...patch }];
    const result = policy.projectCompetition(given, now);
    assert.equal(result.readiness.application, false);
    assert.ok(!result.allowedActions.includes('start_entry'));
    assert.equal(policy.draftPolicyError(given, now).code, 'POLICY_NOT_CONFIGURED');
  }
});

test('zero fee is not payment ready because current order creation requires a positive amount', () => {
  const given = { ...row(), payment_enabled: true, payment_closes_at: new Date('2027-01-02Z') };
  given.public_content.fee.amountMinor = 0;
  assert.equal(policy.projectCompetition(given, now).readiness.payment, false);
  given.public_content.fee.amountMinor = 7000;
  assert.equal(policy.projectCompetition(given, now).readiness.payment, true);
});
