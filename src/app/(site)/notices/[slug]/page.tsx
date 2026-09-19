import NoticeDetailView from "@/components/site/NoticeDetailView";

// Notice detail — thin server shell. The client view fetches the published
// editorial item by slug in live mode (session-forwarding) and falls back to the
// static preview in mock mode.

export default async function NoticeDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <NoticeDetailView slug={slug} />;
}
