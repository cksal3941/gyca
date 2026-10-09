import Link from "next/link";
import { requireAdmin } from "@/lib/dal";
import { getAllContests } from "@/lib/content";
import { Button } from "@/components/ui/button";
import DeleteButton from "@/components/admin/DeleteButton";
import { deleteContest } from "./actions";

export default async function AdminContestsPage() {
  await requireAdmin();
  const items = await getAllContests();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Contests{" "}
          <span className="text-sm font-normal text-neutral-400">
            ({items.length})
          </span>
        </h2>
        <Button asChild>
          <Link href="/admin/contests/new">New contest</Link>
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-black/10">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-black/10 bg-black/[0.03] text-left text-[12px] uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-2.5 font-medium">Title</th>
              <th className="px-4 py-2.5 font-medium">Period</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Published</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b border-black/5 last:border-0">
                <td className="max-w-[300px] truncate px-4 py-3 font-medium">
                  {c.titleLines.join(" ")}
                  {c.latest && (
                    <span className="ml-2 rounded-full bg-brand-blue/10 px-2 py-0.5 text-[10px] font-semibold text-brand-blue">
                      latest
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-[12px] tabular-nums text-neutral-500">
                  {c.period}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-[12px] font-semibold uppercase ${
                      c.status === "open" ? "text-brand-orange" : "text-neutral-400"
                    }`}
                  >
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-[12px]">
                  {c.published ? "Yes" : <span className="text-neutral-400">No</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/contests/${c.id}`}>Edit</Link>
                    </Button>
                    <DeleteButton action={deleteContest.bind(null, c.id)} />
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-neutral-400">
                  No contests yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
