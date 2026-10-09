"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";

function lines(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function parseForm(formData: FormData) {
  return {
    badge: String(formData.get("badge") ?? "").trim(),
    titleLines: lines(formData.get("titleLines")),
    description: String(formData.get("description") ?? "").trim(),
    image: String(formData.get("image") ?? "").trim(),
    links: lines(formData.get("links")),
    reverse: formData.get("reverse") === "on",
    sortOrder: Number(formData.get("sortOrder")) || 0,
    published: formData.get("published") === "on",
  };
}

export async function createProject(formData: FormData) {
  await requireAdmin();
  const values = parseForm(formData);
  if (!values.titleLines.length || !values.badge) return;
  await db.insert(projects).values(values);
  redirect("/admin/projects");
}

export async function updateProject(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return;
  const values = parseForm(formData);
  if (!values.titleLines.length || !values.badge) return;
  await db
    .update(projects)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(projects.id, id));
  redirect("/admin/projects");
}

export async function deleteProject(id: number) {
  await requireAdmin();
  if (!Number.isInteger(id)) return;
  await db.delete(projects).where(eq(projects.id, id));
}
