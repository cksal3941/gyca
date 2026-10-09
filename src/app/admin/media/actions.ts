"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { media } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";

function parseForm(formData: FormData) {
  return {
    cat: String(formData.get("cat") ?? "").trim(),
    title: String(formData.get("title") ?? "").trim(),
    sub: String(formData.get("sub") ?? "").trim(),
    image: String(formData.get("image") ?? "").trim(),
    sortOrder: Number(formData.get("sortOrder")) || 0,
    published: formData.get("published") === "on",
  };
}

export async function createMedia(formData: FormData) {
  await requireAdmin();
  const values = parseForm(formData);
  if (!values.title || !values.cat) return;
  await db.insert(media).values(values);
  redirect("/admin/media");
}

export async function updateMedia(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  const values = parseForm(formData);
  if (!values.title || !values.cat) return;
  await db
    .update(media)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(media.id, id));
  redirect("/admin/media");
}

export async function deleteMedia(id: number) {
  await requireAdmin();
  if (!Number.isInteger(id)) return;
  await db.delete(media).where(eq(media.id, id));
}
