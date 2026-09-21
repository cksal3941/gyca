import AdminShell from "@/components/admin/AdminShell";
import ArchiveForm from "@/components/admin/ArchiveForm";

// New completed-project archive (draft). LIVE, organizer.

export default function NewProjectPage() {
  return (
    <AdminShell eyebrow="Admin" title="새 프로젝트" crumbs={[{ label: "관리자", href: "/admin" }, { label: "아카이브", href: "/admin/content/projects" }, { label: "새 프로젝트" }]}>
      <section className="mx-auto max-w-page px-6 py-12">
        <ArchiveForm mode="create" initial={null} />
      </section>
    </AdminShell>
  );
}
