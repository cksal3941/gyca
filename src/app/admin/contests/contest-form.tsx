import type { Contest } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function ContestForm({
  action,
  item,
}: {
  action: (formData: FormData) => Promise<void>;
  item?: Contest;
}) {
  return (
    <form action={action} className="max-w-xl space-y-5">
      {item && <input type="hidden" name="id" value={item.id} />}

      <div className="space-y-1.5">
        <Label htmlFor="titleLines">Title (one line per row)</Label>
        <Textarea
          id="titleLines"
          name="titleLines"
          required
          rows={2}
          placeholder={"2026 6TH IYAC 글로벌\n청소년 미술 대회"}
          defaultValue={item?.titleLines.join("\n")}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={item?.description}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="period">Period</Label>
          <Input
            id="period"
            name="period"
            required
            placeholder="2026.05.06 ~ 07.15"
            defaultValue={item?.period}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={item?.status ?? "open"}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="open">open</option>
            <option value="close">close</option>
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="posters">Poster image URLs (one per line)</Label>
        <Textarea
          id="posters"
          name="posters"
          rows={3}
          placeholder="https://..."
          defaultValue={item?.posters.join("\n")}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="sortOrder">Sort order</Label>
          <Input
            id="sortOrder"
            name="sortOrder"
            type="number"
            defaultValue={item?.sortOrder ?? 0}
          />
        </div>
        <div className="flex flex-col justify-end gap-2 pb-1">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="latest"
              defaultChecked={item?.latest ?? false}
            />
            Latest Event badge
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="published"
              defaultChecked={item?.published ?? true}
            />
            Published (show on homepage)
          </label>
        </div>
      </div>

      <Button type="submit">{item ? "Save changes" : "Create"}</Button>
    </form>
  );
}
