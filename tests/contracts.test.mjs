import assert from 'node:assert/strict';
import test from 'node:test';
import * as contracts from '../src/contracts/index.ts';

const entry = () => ({
  id: 'entry_example', competitionId: 'competition_leipzig', revision: 1,
  competitionTitle: { en: 'Leipzig', ko: '라이프치히' }, workTitle: 'Example', categoryLabel: null,
  entryStatus: 'submitted', receiptNumber: null, submittedAt: '2026-12-20T00:00:00Z', receivedAt: null,
  payment: { orderId: 'order_example', state: 'succeeded', amountMinor: 7000, currency: 'EUR' },
  reviewStatus: 'not_started', publishedResult: null,
  finalParticipation: { state: 'not_available', revision: 0, invitationPublishedAt: null, confirmedAt: null, orderId: null, allowedActions: [] },
  guardianVerification: { method: 'not_configured', status: 'not_required' },
  allowedActions: ['check_payment'], blockingReasons: ['RECEIPT_PENDING'],
});

test('accepts successful payment while receipt confirmation is pending', () => {
  const given = entry();
  const result = contracts.EntrySummarySchema.safeParse(given);
  assert.equal(result.success, true);
});

test('rejects a receipt number before entry confirmation', () => {
  const given = { ...entry(), receiptNumber: 'GYCA-001' };
  const result = contracts.EntrySummarySchema.safeParse(given);
  assert.equal(result.success, false);
});

test('rejects a new payment action after verified payment', () => {
  const given = { ...entry(), allowedActions: ['start_payment'] };
  const result = contracts.EntrySummarySchema.safeParse(given);
  assert.equal(result.success, false);
});

test('accepts a confirmed receipt backed by verified payment', () => {
  const given = { ...entry(), entryStatus: 'received', receiptNumber: 'GYCA-001', receivedAt: '2026-12-20T00:01:00Z', allowedActions: ['view_submission'], blockingReasons: [] };
  const result = contracts.EntrySummarySchema.safeParse(given);
  assert.equal(result.success, true);
});

test('rejects received entries without verified payment', () => {
  const given = { ...entry(), entryStatus: 'received', receiptNumber: 'GYCA-001', receivedAt: '2026-12-20T00:01:00Z', payment: null };
  const result = contracts.EntrySummarySchema.safeParse(given);
  assert.equal(result.success, false);
});

const competition = () => ({
  id: 'competition_leipzig', slug: 'leipzig-2027', status: 'open',
  title: { en: 'Leipzig', ko: '라이프치히' }, fee: { amountMinor: 7000, currency: 'EUR' },
  readiness: { application: false, payment: false }, allowedActions: [],
  blockingReasons: ['POLICY_NOT_CONFIGURED'], opensAt: null,
  submissionClosesAtExclusive: null, paymentClosesAtExclusive: null,
  timezone: 'Asia/Seoul', keyDates: [], formSpec: null, exhibition: null, guidelines: null,
});

test('accepts a public competition while operating policies remain unresolved', () => {
  const given = competition();
  const result = contracts.CompetitionSchema.safeParse(given);
  assert.equal(result.success, true);
});

test('rejects a download action without a published guidelines asset', () => {
  const given = { ...competition(), allowedActions: ['view_guidelines'] };
  const result = contracts.CompetitionSchema.safeParse(given);
  assert.equal(result.success, false);
});

test('rejects entry action on an archived competition', () => {
  const given = { ...competition(), status: 'archived', allowedActions: ['start_entry'] };
  const result = contracts.CompetitionSchema.safeParse(given);
  assert.equal(result.success, false);
});

test('rejects readiness with unresolved application policy', () => {
  const given = { ...competition(), readiness: { application: true, payment: true } };
  const result = contracts.CompetitionSchema.safeParse(given);
  assert.equal(result.success, false);
});

test('rejects official venue disclosure before exhibition approval', () => {
  const given = { ...competition(), exhibition: { approvalStatus: 'pending',
    displayName: { en: 'Planned', ko: '예정' }, venueName: 'Unapproved venue', logoUrl: null, period: null } };
  const result = contracts.CompetitionSchema.safeParse(given);
  assert.equal(result.success, false);
});

test('rejects fractional minor units', () => {
  const given = { amountMinor: 7000.5, currency: 'EUR' };
  const result = contracts.MoneySchema.safeParse(given);
  assert.equal(result.success, false);
});

test('rejects status escalation in a draft update', () => {
  const given = { revision: 1, work: { englishTitle: 'Book' }, entryStatus: 'received' };
  const result = contracts.UpdateEntryRequestSchema.safeParse(given);
  assert.equal(result.success, false);
});

test('accepts incomplete draft without deciding name or age policy', () => {
  const given = { revision: 1, participant: { nameEn: 'Élodie' }, work: { englishTitle: '' } };
  const result = contracts.UpdateEntryRequestSchema.safeParse(given);
  assert.equal(result.success, true);
});
