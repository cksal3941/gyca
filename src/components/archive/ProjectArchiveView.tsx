import EditorialHeader from "@/components/site/EditorialHeader";
import {
  visibleSections,
  hasRealContent,
  type ProjectArchive,
  type ArchiveSection,
  type ArchiveAsset,
  type Bi,
} from "@/lib/content/archive";
import type { Locale } from "@/lib/i18n";

// Reusable display for a completed-project archive. Content comes entirely from a
// `ProjectArchive` object, so any international program reuses this component with
// its own data. Pending sections render a clearly-marked placeholder that is
// visually distinct from real content (dashed, muted, labelled) — never a fake.

const T = (v: Bi, l: Locale) => v[l];

/** Marked placeholder for content that has no real material yet. */
function PendingBlock({ note, locale }: { note?: Bi; locale: Locale }) {
  const ko = locale === "ko";
  return (
    <div className="mt-6 rounded-xl border border-dashed border-field bg-canvas px-6 py-8 text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-field bg-white px-3 py-1 text-[16px] font-semibold text-ink-strong">
        <span className="h-1.5 w-1.5 rounded-full bg-warning" />
        {ko ? "자료 준비 중" : "Content pending"}
      </span>
      {note && (
        <p className="mx-auto mt-3 max-w-[40rem] text-[16px] leading-[1.7] text-ink-strong">
          {T(note, locale)}
        </p>
      )}
    </div>
  );
}

/** Placeholder tile grid sized to how many assets are expected. */
function PendingTiles({ count, doc = false }: { count: number; doc?: boolean }) {
  return (
    <div className={`mt-6 grid gap-4 ${doc ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
      {Array.from({ length: Math.max(count, 1) }).map((_, i) => (
        <div
          key={i}
          className={`flex items-center justify-center rounded-xl border border-dashed border-field bg-canvas ${
            doc ? "aspect-[4/3]" : "aspect-[4/5]"
          }`}
        >
          <span className="text-[16px] font-medium text-ink-strong">
            {doc ? "Certificate" : "Photo"}
          </span>
        </div>
      ))}
    </div>
  );
}

function Gallery({ assets, locale }: { assets: ArchiveAsset[]; locale: Locale }) {
  const real = assets.filter((a) => a.src);
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {real.map((a, i) => (
        <figure key={i} className="overflow-hidden rounded-xl ring-1 ring-black/5">
          <div
            className="aspect-[4/5] w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${a.src})` }}
            role="img"
            aria-label={a.alt ? T(a.alt, locale) : undefined}
          />
          {a.caption && (
            <figcaption className="px-3 py-2 text-[16px] text-ink-strong">
              {T(a.caption, locale)}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

function SectionBody({ section, locale }: { section: ArchiveSection; locale: Locale }) {
  const real = hasRealContent(section);

  // Quote sections
  if (section.kind === "buyer_interviews") {
    if (real && section.quotes) {
      return (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {section.quotes.map((q, i) => (
            <blockquote key={i} className="border-l-4 border-brand-blue bg-canvas px-5 py-4">
              <p className="text-[16px] leading-[1.8] text-ink-strong">“{T(q.quote, locale)}”</p>
              {q.attribution && (
                <cite className="mt-2 block text-[16px] not-italic text-ink-strong">
                  — {T(q.attribution, locale)}
                </cite>
              )}
            </blockquote>
          ))}
        </div>
      );
    }
    return <PendingBlock note={section.pendingNote} locale={locale} />;
  }

  // Stat sections (sales, results)
  if (section.stats && (section.kind === "sales" || section.kind === "results")) {
    if (real) {
      return (
        <dl className="mt-6 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-3">
          {section.stats.map((s) => (
            <div key={s.label.en} className="bg-white px-5 py-6">
              <dt className="text-[16px] text-ink-strong">{T(s.label, locale)}</dt>
              <dd className="mt-1 text-[24px] font-extrabold text-ink-strong">
                {s.value ? T(s.value, locale) : "—"}
              </dd>
            </div>
          ))}
        </dl>
      );
    }
    return <PendingBlock note={section.pendingNote} locale={locale} />;
  }

  // Document sections (certificates)
  if (section.documents) {
    if (real) return <Gallery assets={section.documents} locale={locale} />;
    return (
      <>
        <PendingTiles count={section.documents.length} doc />
        <PendingBlock note={section.pendingNote} locale={locale} />
      </>
    );
  }

  // Gallery sections
  if (section.gallery) {
    if (real) return <Gallery assets={section.gallery} locale={locale} />;
    return (
      <>
        <PendingTiles count={section.gallery.length} />
        <PendingBlock note={section.pendingNote} locale={locale} />
      </>
    );
  }

  // Text-only sections (intro, process) — nothing extra beyond the intro copy.
  return null;
}

export default function ProjectArchiveView({
  archive,
  locale,
}: {
  archive: ProjectArchive;
  locale: Locale;
}) {
  const ko = locale === "ko";
  const sections = visibleSections(archive);
  const { hero } = archive;

  return (
    <>
      {/* Hero — the shared editorial header (breadcrumb + label + title +
          description), the same style as /contests. */}
      <EditorialHeader
        eyebrow={T(hero.eyebrow, locale)}
        title={T(hero.program, locale)}
        description={T(hero.summary, locale)}
        crumbs={[{ label: ko ? "아카이브" : "Archive", href: "/archive" }]}
        locale={locale}
      />

      {/* Content areas */}
      <section className="mx-auto max-w-page px-6 py-14 lg:py-20">
        <div className="flex flex-col">
          {sections.map((s, i) => (
            <div
              key={s.kind}
              id={s.kind}
              className={`scroll-mt-24 ${i > 0 ? "mt-12 border-t border-line pt-10" : ""}`}
            >
              <div className="flex items-baseline gap-3">
                <span className="font-title text-[18px] font-bold text-brand-blue">
                  {String(s.order).padStart(2, "0")}
                </span>
                <h2
                  className={`font-bold text-[clamp(24px,2.6vw,32px)] leading-[1.15] text-ink-strong ${
                    ko ? "font-sans tracking-[-0.01em]" : "font-title tracking-[0.02em]"
                  }`}
                >
                  {T(s.title, locale)}
                </h2>
              </div>
              {s.intro && (
                <p className="mt-4 max-w-[46rem] text-[16px] leading-[1.9] text-ink-strong">
                  {T(s.intro, locale)}
                </p>
              )}
              <SectionBody section={s} locale={locale} />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
