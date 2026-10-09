import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { media } from "@/db/schema";
import MediaForm from "../media-form";
import { updateMedia } from "../actions";

export default async function EditMediaPage({
  params,
}: PageProps<"/admin/media/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const numId = Number(id);
  if (!Number.isInteger(numId)) notFound();

  const [item] = await db.select().from(media).where(eq(media.id, numId));
  if (!item) notFound();

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold">Edit media item</h2>
      <MediaForm action={updateMedia} item={item} />
    </div>
  );
}
