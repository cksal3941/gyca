import { requireAdmin } from "@/lib/dal";
import ProjectForm from "../project-form";
import { createProject } from "../actions";

export default async function NewProjectPage() {
  await requireAdmin();

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold">New epilogue</h2>
      <ProjectForm action={createProject} />
    </div>
  );
}
