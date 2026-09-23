# Leipzig 2027 & Klimt Villa — content-needed list + CMS fields

Deliverable for the first-launch public pages (Home / Leipzig 2027 detail / Klimt Villa
archive). Lists (A) the **real content still to be collected** and (B) the **CMS data
fields** that back these pages, so nothing on the site is fabricated and the structure
can move to a CMS later.

Ownership note: authoritative operational values (exact fee, deadline, `allowedActions`,
payment) are **server/Codex-owned** via the competition spec. Everything below is either
display copy (Claude) or content material to be provided. Values marked **준비 중 /
pending** render a clearly-labelled placeholder today — they are not shown as facts.

---

## A. Real content still needed

### Leipzig 2027 detail (`/contests/leipzig-2027`)
Source: `src/lib/content/leipzig-detail.ts`. Everything else is already written.

| Item | Where it shows | Current state |
|------|----------------|---------------|
| Exact age brackets / judging groups | Divisions & categories | `DIVISIONS.ageBrackets` = pending |
| Max PDF file size | Submission specs | `SUBMISSION.specs` "파일 용량" = pending |
| Exhibition official name + venue | Core facts + Exhibition | `pending` until local approval — do **not** assert an approved name/venue |
| Finalist-stage self-cost amount(s) | Exhibition support & costs | `EXHIBITION.selfCost.amount` = pending; announced only after selection |
| Guidelines / terms document (URL + version) | FAQ + sticky "공모요강 다운로드" | `FAQ.termsReady = false`; link only when publicly approved |

The **€70 entry fee** and the finalist-stage costs are intentionally shown as two separate
things (`CORE.feeNote`, `EXHIBITION.boundaryNote`). Do not merge them. Finalist additional
payment is **not implemented at this stage** (no on-site collection).

### Home (`/`)
No extra content beyond the above — the home reuses the deployed sections (Hero slides,
DarkProjects Klimt archive) plus the Leipzig summary sections, all already written.

### Klimt Villa archive (`/archive/klimt-villa`)
Source: `src/lib/content/klimt-villa.ts`. Areas ① and ② have real framing copy; the rest
are `status: "pending"` placeholders until the material below is provided. Flip a section
to `status: "ready"` and fill its payload to publish it.

| # | Area | Material to provide |
|---|------|---------------------|
| ③ | Selected works | Work images + titles + creator names (consented) |
| ④ | Vienna exhibition photos | Real installation / visitor photos |
| ⑤ | Awards ceremony photos | Real ceremony photos |
| ⑥ | Artwork sales cases | Confirmed sale cases (work + context). **Amounts only if confirmed** |
| ⑦ | Buyer interviews | Consented quotes + attribution |
| ⑧ | Exhibition certificate | A real certificate scan/sample |
| ⑨ | Sales certificate | A real certificate scan/sample |
| ⑩ | Results & outcomes | Verified figures: works exhibited, participating creators, works sold |
| — | Hero image | Approved hero photograph (`hero.image.src`) |
| — | Project dates | Exact period (`hero.period` currently just "Completed") |

Rule kept in the model: no invented photos, interviews, sale amounts, or result figures.
Optional sections (`optional: true`) are hidden entirely when empty; core narrative
sections stay visible with a placeholder so the page always composes naturally.

---

## B. CMS data fields

These mirror the current TypeScript content shapes, so a CMS can populate them 1:1. All
text fields are bilingual `{ en, ko }` unless noted.

### Competition (Leipzig 2027 detail)
Display copy in `leipzig-detail.ts`. Operational values (fee amount, deadline, open/closed)
should ultimately come from the server competition spec, not the CMS.

- `meta`: eyebrow, title, summary
- `core.facts[]`: { label, value: **Maybe** } — `Maybe` = confirmed `{en,ko}` **or** `pending`
- `core.feeNote`
- `divisions`: intro, category, `ageBrackets: Maybe`, ageBracketsNote
- `submission.specs[]`: { label, value: Maybe } · `submission.materials.items[]`
- `judging.criteria[]`: { label, note } · `judging.reviewNote`
- `schedule`: timezoneNote, `rows[]`: { label, value }   *(shared with the home Key Dates)*
- `selection.stages[]`: { name, note }
- `certificates`: intro, `items[]`: { name, when }
- `exhibition`: plannedName, `approvalStatus: "pending" | "approved"`, venueNote,
  `provided.items[]`, `selfCost.items[]`, `selfCost.amount: Maybe`, boundaryNote
- `faq`: `items[]` { q, a }, `termsReady: boolean`, `terms.url?`, termsPendingNote

### Home Leipzig sections
Display copy in `leipzig-home.ts` (HERO, WHY, JOURNEY, KEY_DATES, FEE_SPEC, APPLY). These
are static first-launch copy; a CMS is optional. `APPLY`/apply-gating reads the competition
`allowedActions` (`start_entry`) — server-owned, not CMS.

### ProjectArchive (reusable — Klimt Villa and future programs)
Model in `src/lib/content/archive.ts`. One record per completed project; the same display
component (`ProjectArchiveView`) renders any record.

- `slug: string`, `status: "completed" | "ongoing"`
- `hero`: eyebrow, program, location, period, summary, `operated[]`,
  `image: { src: string | null, alt, caption }`
- `sections[]` (the ten Klimt areas; any subset for other programs):
  - `kind`: `intro | process | selection | exhibition_photos | ceremony_photos | sales |
    buyer_interviews | exhibition_certificate | sales_certificate | results`
  - `order: 1..10`, `title`, `intro?`
  - `status: "ready" | "pending"`, `optional?: boolean`, `pendingNote?`
  - payloads (only those relevant to `kind`):
    - `gallery[]` / `documents[]`: `{ src: string | null, alt?, caption? }`
    - `quotes[]`: `{ quote, attribution? }`
    - `stats[]`: `{ label, value: {en,ko} | null }`  (null → pending, never a fake number)

**Nullable-by-design:** image `src` and stat `value` are nullable; null is never rendered
as a real photo/number. `status: "pending"` + a `pendingNote` drives the "자료 준비 중"
placeholder.

---

## Wiring (completion criteria)

- Home → Leipzig detail: `FeeSpecSummary` "출품 규격 자세히 보기" → `/contests/leipzig-2027`;
  hero "자세히 보기". Home → Apply: `ApplyCta` (gated by `start_entry`) → `/submit?contest=leipzig-2027`.
- Home → Klimt archive: `DarkProjects` links → `/archive/klimt-villa` (+ section anchors).
- Leipzig detail → Apply: sticky CTA (desktop + mobile), gated the same way.
- Bilingual (EN default + KO) via cookie locale on every page.
- Mobile verified at 375px for all three pages.
