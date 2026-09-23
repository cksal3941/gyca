import { FORM_FIELD_PATHS, ASSET_PURPOSES } from '../../../src/contracts/index.ts';
import { CONSENT_KINDS } from '../../../src/contracts/submissions.ts';

const launchPaths = ['participant.name', 'participant.dateOfBirth', 'participant.residenceCountry',
  'guardian.name', 'guardian.email', 'work.englishTitle', 'work.englishDescription', 'work.category'];
const mandatory = new Set(['participant.name', 'participant.dateOfBirth', 'participant.residenceCountry',
  'work.englishTitle', 'work.englishDescription', 'work.category']);
const inputType = path => path === 'participant.dateOfBirth' ? 'date' : path === 'guardian.email' ? 'email'
  : ['work.category', 'work.publicationStatus'].includes(path) ? 'choice'
  : ['work.description', 'work.englishDescription', 'work.creatorBio'].includes(path) ? 'textarea' : 'text';
const documents = ['en', 'ko'].flatMap(locale => CONSENT_KINDS.map(kind => ({ kind, locale, version: 'demo-only-1',
  title: locale === 'ko' ? `시연용 동의문: ${kind}` : `Demo consent: ${kind}`,
  text: locale === 'ko' ? '화면 검토용 예시입니다. 실제 참가 규정이나 이용허락 문구가 아닙니다.'
    : 'Display fixture only. This is not an operative participation, privacy or licensing policy.',
})));
const completeDraft = {
  revision: 1,
  participant: { name: '샘플 참가자', nameEn: 'Sample Artist', dateOfBirth: '2010-06-01', residenceCountry: 'KR',
    nationality: 'KR', school: 'Sample School', grade: '10' },
  guardian: { name: 'Sample Guardian', email: 'guardian@example.org' },
  work: { title: '작은 정원', description: '정원을 소재로 한 시연용 책입니다.', englishTitle: 'A Small Garden',
    englishDescription: 'A sample illustrated book about a garden.', creatorBio: 'Demo creator biography.',
    category: 'art_book', language: 'en', publicationStatus: 'unpublished' },
};

function scenario(id, paths, purposes) {
  const draft = { revision: 1, participant: {}, guardian: {}, work: {} };
  for (const path of paths) {
    const [section, key] = path.split('.');
    draft[section][key] = completeDraft[section][key];
  }
  return {
    id, demoOnly: true, optionalConsents: [], documents, draft,
    competition: {
      id: `demo-${id}`, slug: `demo-${id}`, status: 'upcoming',
      title: { en: 'Art Book — display fixture', ko: '아트북 — 화면 시연 데이터' },
      fee: { amountMinor: 7000, currency: 'EUR' }, timezone: 'Asia/Seoul',
      readiness: { application: false, payment: false }, allowedActions: [], blockingReasons: ['POLICY_NOT_CONFIGURED'],
      opensAt: null, submissionClosesAtExclusive: null, paymentClosesAtExclusive: null, keyDates: [], exhibition: null, guidelines: null,
      formSpec: {
        version: `demo-${id}-1`, ageReferenceDate: null,
        categories: [{ id: 'art_book', label: { en: 'Art Book', ko: '아트북' } }],
        ageGroups: [],
        fields: paths.map(path => ({ path, inputType: inputType(path), requiredOnSubmit: mandatory.has(path) })),
        uploads: purposes.map(purpose => ({ purpose,
          requiredOnSubmit: ['cover_image', 'book_pdf'].includes(purpose), maxFiles: 1,
          allowedMediaTypes: purpose === 'cover_image' ? ['image/jpeg', 'image/png'] : ['application/pdf'],
          maxBytes: purpose === 'book_pdf' ? 64 * 1024 * 1024 : 10 * 1024 * 1024,
          minPages: purpose === 'book_pdf' ? 20 : null,
        })),
      },
    },
  };
}

export const submissionScenarios = [
  scenario('first-release', launchPaths, ['cover_image', 'book_pdf']),
  scenario('full-preview', FORM_FIELD_PATHS, ASSET_PURPOSES),
];
