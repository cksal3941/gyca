import type { NewsItem } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TAG_COLORS = [
  { value: "", label: "Default" },
  { value: "text-brand-blue", label: "Blue" },
  { value: "text-brand-orange", label: "Orange" },
  { value: "text-neutral-500", label: "Gray" },
];

export default function NewsForm({
  action,
  item,
}: {
  action: (formData: FormData) => Promise<void>;
  item?: NewsItem;
}) {
  return (
    <form action={action} className="max-w-xl space-y-5">
      {item && <input type="hidden" name="id" value={item.id} />}

      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required defaultValue={item?.title} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            name="date"
            type="date"
            required
            defaultValue={item?.date}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tag">Tag (optional)</Label>
          <Input
            id="tag"
            name="tag"
            placeholder="예: 대회 개최"
            defaultValue={item?.tag ?? ""}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tagColor">Tag color</Label>
        <select
          id="tagColor"
          name="tagColor"
          defaultValue={item?.tagColor ?? ""}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {TAG_COLORS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="published"
          defaultChecked={item?.published ?? true}
        />
        Published (show on homepage)
      </label>

      <div className="flex gap-2">
        <Button type="submit">{item ? "Save changes" : "Create"}</Button>
      </div>
    </form>
  );
}
