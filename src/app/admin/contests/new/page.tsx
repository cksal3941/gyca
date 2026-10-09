import { requireAdmin } from "@/lib/dal";
import ContestForm from "../contest-form";
import { createContest } from "../actions";

export default async function NewContestPage() {
  await requireAdmin();

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold">New contest</h2>
      <ContestForm action={createContest} />
    </div>
  );
}
