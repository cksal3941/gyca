import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// 홈페이지 콘텐츠 테이블. 기존 하드코딩 배열의 타입을 그대로 옮긴 구조라
// 프론트 컴포넌트가 기대하는 필드와 1:1 대응한다.

/** 공모전 (홈 EventSlider) */
export const contests = pgTable("contests", {
  id: serial("id").primaryKey(),
  titleLines: text("title_lines").array().notNull(),
  description: text("description").notNull(),
  // 표시용 기간 문자열 (예: "2026.05.06 ~ 07.15")
  period: text("period").notNull(),
  status: text("status").notNull().default("open"), // open | close
  latest: boolean("latest").notNull().default(false),
  posters: text("posters").array().notNull().default([]),
  published: boolean("published").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** 뉴스 (홈 NewsUpdate) */
export const news = pgTable("news", {
  id: serial("id").primaryKey(),
  tag: text("tag"),
  // 기존 컴포넌트가 tailwind 클래스를 그대로 쓰므로 클래스 문자열을 저장
  tagColor: text("tag_color"),
  title: text("title").notNull(),
  date: text("date").notNull(), // 표시용 (예: "2026-08-08")
  published: boolean("published").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** 미디어 (홈 MediaUpdate) */
export const media = pgTable("media", {
  id: serial("id").primaryKey(),
  cat: text("cat").notNull(), // 인터뷰 | 미디어 ...
  title: text("title").notNull(),
  sub: text("sub").notNull(),
  image: text("image").notNull(),
  published: boolean("published").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** 에필로그/전시 (홈 DarkProjects) */
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  badge: text("badge").notNull(),
  titleLines: text("title_lines").array().notNull(),
  description: text("description").notNull(),
  image: text("image").notNull(),
  links: text("links").array().notNull().default([]),
  reverse: boolean("reverse").notNull().default(false),
  published: boolean("published").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Contest = typeof contests.$inferSelect;
export type NewsItem = typeof news.$inferSelect;
export type MediaItem = typeof media.$inferSelect;
export type Project = typeof projects.$inferSelect;
