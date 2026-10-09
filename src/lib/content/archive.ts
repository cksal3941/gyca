// Reusable PROJECT ARCHIVE model — a completed-project archive (e.g. Klimt Villa)
// that other international programs can reuse. The *data shape* lives here and the
// *display components* live in `src/components/archive/*`, so content and rendering
// stay separated (brief §3: reuse the structure + display components elsewhere).
//
// Honesty rules baked into the model:
//  - No fabricated photos/interviews/sales figures/results. When real material
//    does not exist yet, a section is marked `status: "pending"` and renders a
//    clearly-labelled "자료 준비 중" placeholder — visually distinct from real
//    content — instead of inventing it.
//  - Sections may be `optional`; an optional section with no real content is
//    omitted entirely, so the page still composes naturally.
//  - `ArchiveStat.value` and image `src` are nullable; null is never rendered as
//    a real number/photo.

export type Bi = { en: string; ko: string };

/** The ten canonical Klimt-Villa content areas (brief §3 ①–⑩). Reusable programs
 *  can use any subset. */
export type ArchiveSectionKind =
  | "intro" //                     ① Project introduction
  | "process" //                   ② Open call & selection process
  | "selection" //                 ③ Selected works
  | "exhibition_photos" //         ④ Vienna exhibition photos
  | "ceremony_photos" //           ⑤ Awards ceremony photos
  | "sales" //                     ⑥ Artwork sales cases
  | "buyer_interviews" //          ⑦ Buyer interviews
  | "exhibition_certificate" //    ⑧ Exhibition certificate
  | "sales_certificate" //         ⑨ Sales certificate
  | "results"; //                  ⑩ Project results & achievements

/** Content-readiness. `ready` = real, confirmed content. `pending` = no material
 *  yet → renders a marked placeholder (or is hidden if the section is optional). */
export type ContentStatus = "ready" | "pending";

/** An image/document asset. `src` is a real path under /public, or null when not
 *  yet provided (never a fabricated image). */
export type ArchiveAsset = {
  src: string | null;
  alt?: Bi;
  caption?: Bi;
};

/** A quote from a real, consented source. Never invented. */
export type ArchiveQuote = {
  quote: Bi;
  attribution?: Bi;
};

/** A single measured result. `value: null` renders as pending, not a fake number. */
export type ArchiveStat = {
  label: Bi;
  value: Bi | null;
};

export type ArchiveSection = {
  kind: ArchiveSectionKind;
  /** Display order among the ten areas (1..10). */
  order: number;
  title: Bi;
  /** Non-fabricated framing copy. Safe to write even when media is pending. */
  intro?: Bi;
  status: ContentStatus;
  /** When true and there is no real content, the section is hidden (not shown as
   *  a placeholder). Core narrative sections should stay non-optional. */
  optional?: boolean;
  /** Typed payloads — only those relevant to the `kind` are populated. */
  gallery?: ArchiveAsset[];
  documents?: ArchiveAsset[];
  quotes?: ArchiveQuote[];
  stats?: ArchiveStat[];
  /** Shown inside a pending placeholder to say what will go here. */
  pendingNote?: Bi;
};

export type ProjectArchive = {
  slug: string;
  status: "completed" | "ongoing";
  hero: {
    eyebrow: Bi; //   e.g. "Completed Project · Archive"
    program: Bi; //   e.g. "Klimt Villa Youth Art Project"
    location: Bi; //  e.g. "Vienna, Austria"
    period: Bi; //    display copy, e.g. "2023"
    summary: Bi;
    /** What was actually operated (labels only, no numbers). */
    operated: Bi[];
    image?: ArchiveAsset;
  };
  sections: ArchiveSection[];
};

/** True when a section carries at least one real (non-null) asset/quote/stat. */
export function hasRealContent(s: ArchiveSection): boolean {
  const g = s.gallery?.some((a) => a.src) ?? false;
  const d = s.documents?.some((a) => a.src) ?? false;
  const q = (s.quotes?.length ?? 0) > 0;
  const st = s.stats?.some((x) => x.value) ?? false;
  return g || d || q || st;
}

/** Sections to render: sorted by order, with optional-empty ones dropped so the
 *  page composes naturally when material is missing. */
export function visibleSections(archive: ProjectArchive): ArchiveSection[] {
  return archive.sections
    .filter((s) => !(s.optional && s.status === "pending" && !hasRealContent(s)))
    .sort((a, b) => a.order - b.order);
}
