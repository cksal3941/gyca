import AdminShell from "@/components/admin/AdminShell";
import ArchiveEditor from "@/components/admin/ArchiveEditor";

// Edit one completed-project archive (LIVE, organizer). Thin server shell; the
// client editor loads the project and forwards the session cookie.

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AdminShell eyebrow="Admin" title="프로젝트 편집" crumbs={[{ label: "관리자", href: "/admin" }, { label: "아카이브", href: "/admin/content/projects" }, { label: "편집" }]}>
      <section className="mx-auto max-w-page px-6 py-12">
        <ArchiveEditor id={id} />
      </section>
    </AdminShell>
  );
}
