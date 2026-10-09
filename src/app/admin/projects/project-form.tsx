import type { Project } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function ProjectForm({
  action,
  item,
}: {
  action: (formData: FormData) => Promise<void>;
  item?: Project;
}) {
  return (
    <form action={action} className="max-w-xl space-y-5">
      {item && <input type="hidden" name="id" value={item.id} />}

      <div className="grid grid-cols-[140px_1fr] gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="badge">Badge</Label>
          <Input
            id="badge"
            name="badge"
            required
            placeholder="예필로그"
            defaultValue={item?.badge}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="titleLines">Title (one line per row)</Label>
          <Textarea
            id="titleLines"
            name="titleLines"
            required
            rows={2}
            defaultValue={item?.titleLines.join("\n")}
          />
        </div>
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

      <div className="space-y-1.5">
        <Label htmlFor="links">Link labels (one per line)</Label>
        <Textarea
          id="links"
          name="links"
          rows={3}
          placeholder={"예필로그\n수상작\n공고보기"}
          defaultValue={item?.links.join("\n")}
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
              name="reverse"
              defaultChecked={item?.reverse ?? false}
            />
            Reverse layout (image on right)
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
