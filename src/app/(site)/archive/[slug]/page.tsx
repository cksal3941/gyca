import ArchivePublicView from "@/components/archive/ArchivePublicView";

// Completed-project archive detail — thin server shell. The client view fetches
// the published project by slug in live mode. (The curated /archive/klimt-villa
// route takes precedence over this dynamic route.)

export default async function ArchiveDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ArchivePublicView slug={slug} />;
}
