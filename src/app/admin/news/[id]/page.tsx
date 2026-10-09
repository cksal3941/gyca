import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { news } from "@/db/schema";
import NewsForm from "../news-form";
import { updateNews } from "../actions";

export default async function EditNewsPage({
  params,
}: PageProps<"/admin/news/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) notFound();

  const [item] = await db.select().from(news).where(eq(news.id, numId));
  if (!item) notFound();

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold">Edit article</h2>
      <NewsForm action={updateNews} item={item} />
    </div>
  );
}
