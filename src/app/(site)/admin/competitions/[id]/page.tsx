import PageHeader from "@/components/site/PageHeader";
import CompetitionEditor from "@/components/admin/CompetitionEditor";

// Edit a competition + control its launch (LIVE, organizer). Thin server shell —
// the client editor loads the competition with the operator session.

export default async function EditCompetitionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="공모 편집 · 오픈"
        crumbs={[
          { label: "관리자", href: "/admin" },
          { label: "공모 관리", href: "/admin/competitions" },
          { label: "편집" },
        ]}
      />
      <section className="mx-auto max-w-page px-6 py-12">
        <CompetitionEditor id={id} />
      </section>
    </>
  );
}
