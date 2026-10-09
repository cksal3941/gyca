import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { projects } from "@/db/schema";
import ProjectForm from "../project-form";
import { updateProject } from "../actions";

export default async function EditProjectPage({
  params,
}: PageProps<"/admin/projects/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) notFound();

  const [item] = await db.select().from(projects).where(eq(projects.id, numId));
  if (!item) notFound();

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold">Edit epilogue</h2>
      <ProjectForm action={updateProject} item={item} />
    </div>
  );
}
