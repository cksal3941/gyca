import { requireAdmin } from "@/lib/dal";
import NewsForm from "../news-form";
import { createNews } from "../actions";

export default async function NewNewsPage() {
  await requireAdmin();

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold">New article</h2>
      <NewsForm action={createNews} />
    </div>
  );
}
