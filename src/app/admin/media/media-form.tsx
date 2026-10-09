import type { MediaItem } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function MediaForm({
  action,
  item,
}: {
  action: (formData: FormData) => Promise<void>;
  item?: MediaItem;
}) {
  return (
    <form action={action} className="max-w-xl space-y-5">
      {item && <input type="hidden" name="id" value={item.id} />}

      <div className="grid grid-cols-[140px_1fr] gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="cat">Category</Label>
          <Input
            id="cat"
            name="cat"
            required
            placeholder="인터뷰"
            defaultValue={item?.cat}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required defaultValue={item?.title} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sub">Subtitle</Label>
        <Textarea id="sub" name="sub" rows={2} defaultValue={item?.sub} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="image">Image URL</Label>
        <Input
          id="image"
          name="image"
          required
          placeholder="https://..."
          defaultValue={item?.image}
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
        <label className="flex items-end gap-2 pb-1.5 text-sm">
          <input
            type="checkbox"
            name="published"
            defaultChecked={item?.published ?? true}
          />
          Published (show on homepage)
        </label>
      </div>

      <Button type="submit">{item ? "Save changes" : "Create"}</Button>
    </form>
  );
}
