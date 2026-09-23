import PageHeader from "@/components/site/PageHeader";
import ReviewEditor from "@/components/judge/ReviewEditor";

// Judge review (BLIND). Thin server shell: it resolves the route id and hands off
// to a CLIENT editor that fetches the blind review context with the Better Auth
// session (a server component cannot forward the cookie). Access to unassigned
// works is enforced by the server; the editor shows a not-found/blocked state.

export default async function JudgeReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <>
      <PageHeader
        eyebrow="Judge"
        title="작품 심사"
        crumbs={[
          { label: "심사위원", href: "/judge" },
          { label: "배정 작품", href: "/judge" },
          { label: "심사" },
        ]}
      />
      <section className="mx-auto max-w-page px-6 py-12">
        <ReviewEditor id={id} />
      </section>
    </>
  );
}
