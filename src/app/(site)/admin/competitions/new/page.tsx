import AdminShell from "@/components/admin/AdminShell";
import CompetitionForm from "@/components/admin/CompetitionForm";

// Register a new competition (LIVE, organizer). The client form posts to
// /admin/competitions with the operator session.

export default function NewCompetitionPage() {
  return (
    <AdminShell
      eyebrow="Admin"
      title="새 공모 등록"
      crumbs={[
        { label: "관리자", href: "/admin" },
        { label: "공모 관리", href: "/admin/competitions" },
        { label: "새 공모" },
      ]}
    >
      <section className="mx-auto max-w-page px-6 py-12">
        <CompetitionForm mode="create" initial={null} />
      </section>
    </AdminShell>
  );
}
