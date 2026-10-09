import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contests, media, news, projects } from "@/db/schema";

// 홈페이지용: 공개(published) 콘텐츠만
export async function getPublishedContests() {
  return db
    .select()
    .from(contests)
    .where(eq(contests.published, true))
    .orderBy(asc(contests.sortOrder), desc(contests.id));
}

export async function getPublishedNews(limit = 5) {
  return db
    .select()
    .from(news)
    .where(eq(news.published, true))
    .orderBy(desc(news.date), desc(news.id))
    .limit(limit);
}

export async function getPublishedMedia() {
  return db
    .select()
    .from(media)
    .where(eq(media.published, true))
    .orderBy(asc(media.sortOrder), desc(media.id));
}

export async function getPublishedProjects() {
  return db
    .select()
    .from(projects)
    .where(eq(projects.published, true))
    .orderBy(asc(projects.sortOrder), desc(projects.id));
}

// 관리자용: 전체 목록
export async function getAllContests() {
  return db.select().from(contests).orderBy(asc(contests.sortOrder), desc(contests.id));
}

export async function getAllNews() {
  return db.select().from(news).orderBy(desc(news.date), desc(news.id));
}

export async function getAllMedia() {
  return db.select().from(media).orderBy(asc(media.sortOrder), desc(media.id));
}

export async function getAllProjects() {
  return db.select().from(projects).orderBy(asc(projects.sortOrder), desc(projects.id));
}
