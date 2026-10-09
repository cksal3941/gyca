import Link from "next/link";
import { requireAdmin } from "@/lib/dal";
import { db, pool } from "@/lib/db";
import { contests, media, news, projects } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminDashboard() {
  await requireAdmin();

  const [userCount, contestCount, newsCount, mediaCount, projectCount] =
    await Promise.all([
      pool
        .query(`SELECT count(*)::int AS n FROM "user"`)
        .then((r) => r.rows[0].n as number),
      db.$count(contests),
      db.$count(news),
      db.$count(media),
      db.$count(projects),
    ]);

  const stats = [
    { label: "Users", value: userCount, href: "/admin/users" },
    { label: "Contests", value: contestCount, href: "/admin/contests" },
    { label: "News", value: newsCount, href: "/admin/news" },
    { label: "Media", value: mediaCount, href: "/admin/media" },
    { label: "Epilogues", value: projectCount, href: "/admin/projects" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {stats.map((s) => (
        <Link key={s.href} href={s.href}>
          <Card className="transition-colors hover:border-brand-blue/50">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
