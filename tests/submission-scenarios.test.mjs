import assert from 'node:assert/strict';
import test from 'node:test';
import { FormSpecSchema, UpdateEntryRequestSchema, FORM_FIELD_PATHS, ASSET_PURPOSES, CompetitionSchema } from '../src/contracts/index.ts';
import { ConsentDocumentSchema, CONSENT_KINDS, SubmitEntryRequestSchema } from '../src/contracts/submissions.ts';

test('handoff scenarios cover full contract and reduced launch without enabling production', async () => {
  const { submissionScenarios } = await import('../docs/backend/examples/submission-scenarios.mjs');
  for (const scenario of submissionScenarios) {
    assert.equal(scenario.demoOnly, true);
    FormSpecSchema.parse(scenario.competition.formSpec);
    const competition = CompetitionSchema.parse(scenario.competition);
    assert.deepEqual(competition.allowedActions, []);
    assert.equal(competition.readiness.application, false);
    assert.equal(competition.readiness.payment, false);
    const draft = UpdateEntryRequestSchema.parse(scenario.draft);
    for (const field of competition.formSpec.fields) {
      const [section, key] = field.path.split('.');
      assert.notEqual(draft[section]?.[key], undefined, field.path);
    }
    for (const locale of ['en', 'ko']) {
      const documents = scenario.documents.filter(doc => doc.locale === locale).map(doc => ConsentDocumentSchema.parse(doc));
      assert.deepEqual(documents.map(doc => doc.kind), [...CONSENT_KINDS]);
      const body = { revision: 1, locale, policyToken: 'a'.repeat(64), consents: documents.map(doc => ({ kind: doc.kind, version: doc.version, accepted: true })) };
      SubmitEntryRequestSchema.parse(body);
      assert.equal(SubmitEntryRequestSchema.safeParse({ ...body, consents: [...body.consents, { kind: 'marketing', version: 'demo', accepted: true }] }).success, false);
    }
    assert.deepEqual(scenario.optionalConsents, []);
    for (const upload of competition.formSpec.uploads) assert.ok(upload.maxBytes <= 64 * 1024 * 1024);
  }
  const full = submissionScenarios.find(scenario => scenario.id === 'full-preview');
  assert.deepEqual(full.competition.formSpec.fields.map(field => field.path), [...FORM_FIELD_PATHS]);
  assert.deepEqual(full.competition.formSpec.uploads.map(upload => upload.purpose), [...ASSET_PURPOSES]);
  const launch = submissionScenarios.find(scenario => scenario.id === 'first-release');
  assert.equal(launch.competition.formSpec.uploads.length, 2);
  assert.equal(launch.competition.formSpec.uploads.find(upload => upload.purpose === 'book_pdf').minPages, 20);
});
