import Link from "next/link";
import { requireAdmin } from "@/lib/dal";
import { getAllMedia } from "@/lib/content";
import { Button } from "@/components/ui/button";
import DeleteButton from "@/components/admin/DeleteButton";
import { deleteMedia } from "./actions";

export default async function AdminMediaPage() {
  await requireAdmin();
  const items = await getAllMedia();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Media{" "}
          <span className="text-sm font-normal text-neutral-400">
            ({items.length})
          </span>
        </h2>
        <Button asChild>
          <Link href="/admin/media/new">New item</Link>
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-black/10">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-black/10 bg-black/[0.03] text-left text-[12px] uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-2.5 font-medium">Item</th>
              <th className="px-4 py-2.5 font-medium">Category</th>
              <th className="px-4 py-2.5 font-medium">Published</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id} className="border-b border-black/5 last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.image}
                      alt=""
                      className="h-10 w-16 shrink-0 rounded object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{m.title}</p>
                      <p className="truncate text-[12px] text-neutral-500">
                        {m.sub}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-[12px] text-neutral-500">
                  {m.cat}
                </td>
                <td className="px-4 py-3 text-[12px]">
                  {m.published ? "Yes" : <span className="text-neutral-400">No</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/media/${m.id}`}>Edit</Link>
                    </Button>
                    <DeleteButton action={deleteMedia.bind(null, m.id)} />
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-neutral-400">
                  No media yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
