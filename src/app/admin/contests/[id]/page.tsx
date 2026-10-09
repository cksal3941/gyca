import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { contests } from "@/db/schema";
import ContestForm from "../contest-form";
import { updateContest } from "../actions";

export default async function EditContestPage({
  params,
}: PageProps<"/admin/contests/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) notFound();

  const [item] = await db.select().from(contests).where(eq(contests.id, numId));
  if (!item) notFound();

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold">Edit contest</h2>
      <ContestForm action={updateContest} item={item} />
    </div>
  );
}
