"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contests } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";

function lines(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function parseForm(formData: FormData) {
  return {
    titleLines: lines(formData.get("titleLines")),
    description: String(formData.get("description") ?? "").trim(),
    period: String(formData.get("period") ?? "").trim(),
    status: formData.get("status") === "close" ? "close" : "open",
    latest: formData.get("latest") === "on",
    posters: lines(formData.get("posters")),
    sortOrder: Number(formData.get("sortOrder")) || 0,
    published: formData.get("published") === "on",
  };
}

export async function createContest(formData: FormData) {
  await requireAdmin();
  const values = parseForm(formData);
  if (!values.titleLines.length || !values.period) return;
  await db.insert(contests).values(values);
  redirect("/admin/contests");
}

export async function updateContest(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  const values = parseForm(formData);
  if (!values.titleLines.length || !values.period) return;
  await db
    .update(contests)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(contests.id, id));
  redirect("/admin/contests");
}

export async function deleteContest(id: number) {
  await requireAdmin();
  if (!Number.isInteger(id)) return;
  await db.delete(contests).where(eq(contests.id, id));
}
