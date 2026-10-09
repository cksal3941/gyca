import Header from "@/components/Header";
import AdminNav from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/dal";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // 편의용 1차 차단. 레이아웃 체크는 하위 세그먼트 렌더링을 막지 못하므로
  // 각 페이지와 서버 액션도 개별적으로 requireAdmin()을 호출한다.
  await requireAdmin();

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[1200px] px-4 pb-20 pt-[110px]">
        <div className="mb-8">
          <h1 className="text-xl font-semibold leading-tight">Admin</h1>
          <p className="text-sm text-muted-foreground">
            Manage users and site content
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-[200px_1fr]">
          <AdminNav />
          <div className="min-w-0">{children}</div>
        </div>
      </main>
    </>
  );
}
