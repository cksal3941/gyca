import { requireAdmin } from "@/lib/dal";
import MediaForm from "../media-form";
import { createMedia } from "../actions";

export default async function NewMediaPage() {
  await requireAdmin();

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold">New media item</h2>
      <MediaForm action={createMedia} />
    </div>
  );
}
