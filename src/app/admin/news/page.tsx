import Link from "next/link";
import { requireAdmin } from "@/lib/dal";
import { getAllNews } from "@/lib/content";
import { Button } from "@/components/ui/button";
import DeleteButton from "@/components/admin/DeleteButton";
import { deleteNews } from "./actions";

export default async function AdminNewsPage() {
  await requireAdmin();
  const items = await getAllNews();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          News{" "}
          <span className="text-sm font-normal text-neutral-400">
            ({items.length})
          </span>
        </h2>
        <Button asChild>
          <Link href="/admin/news/new">New article</Link>
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-black/10">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-black/10 bg-black/[0.03] text-left text-[12px] uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-2.5 font-medium">Title</th>
              <th className="px-4 py-2.5 font-medium">Tag</th>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Published</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((n) => (
              <tr key={n.id} className="border-b border-black/5 last:border-0">
                <td className="max-w-[320px] truncate px-4 py-3 font-medium">
                  {n.title}
                </td>
                <td className="px-4 py-3">
                  {n.tag ? (
                    <span className={`text-[12px] font-bold ${n.tagColor ?? ""}`}>
                      [{n.tag}]
                    </span>
                  ) : (
                    <span className="text-neutral-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[12px] tabular-nums text-neutral-500">
                  {n.date}
                </td>
                <td className="px-4 py-3 text-[12px]">
                  {n.published ? "Yes" : <span className="text-neutral-400">No</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/news/${n.id}`}>Edit</Link>
                    </Button>
                    <DeleteButton action={deleteNews.bind(null, n.id)} />
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-neutral-400">
                  No articles yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
