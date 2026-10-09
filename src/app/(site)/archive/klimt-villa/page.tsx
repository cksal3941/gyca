import type { Metadata } from "next";
import ProjectArchiveView from "@/components/archive/ProjectArchiveView";
import { KLIMT_VILLA } from "@/lib/content/klimt-villa";
import { getServerLocale } from "@/lib/i18n/server";

// Klimt Villa — completed-project archive (brief §3). Data-driven via the reusable
// ProjectArchive model; the same view serves other international-program archives.
export const metadata: Metadata = {
  title: "Klimt Villa Youth Art Project · Archive · GYCA",
  description:
    "A completed GYCA program in Vienna — exhibition, awards ceremony, artwork sales, and certificates at the Klimt Villa.",
};

export default async function KlimtVillaArchivePage() {
  const locale = await getServerLocale();
  return <ProjectArchiveView archive={KLIMT_VILLA} locale={locale} />;
}
