"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { news } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";

function parseForm(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim(),
    date: String(formData.get("date") ?? "").trim(),
    tag: String(formData.get("tag") ?? "").trim() || null,
    tagColor: String(formData.get("tagColor") ?? "").trim() || null,
    published: formData.get("published") === "on",
  };
}

export async function createNews(formData: FormData) {
  await requireAdmin();
  const values = parseForm(formData);
  if (!values.title || !values.date) return;
  await db.insert(news).values(values);
  redirect("/admin/news");
}

export async function updateNews(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  const values = parseForm(formData);
  if (!values.title || !values.date) return;
  await db
    .update(news)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(news.id, id));
  redirect("/admin/news");
}

export async function deleteNews(id: number) {
  await requireAdmin();
  if (!Number.isInteger(id)) return;
  await db.delete(news).where(eq(news.id, id));
}
