import PageHeader from "@/components/site/PageHeader";

const MENU = [
  "공모전 관리",
  "접수자 관리",
  "작품 관리",
  "심사위원 관리",
  "심사 배정",
  "결제 관리",
  "결과 발표",
  "인증서 발급",
  "해외 본선 관리",
  "공지·문의 관리",
];

const KPIS = [
  { label: "총 접수", value: "1,284" },
  { label: "심사 진행률", value: "67%" },
  { label: "결제 완료", value: "1,102" },
  { label: "본선 진출", value: "96" },
];

const FILTERS = [
  { label: "공모전", options: ["전체 공모전", "IYAC 2026", "Art for Tomorrow", "Music & Performance"] },
  { label: "상태", options: ["전체 상태", "접수완료", "심사중", "본선진출", "최종수상"] },
  { label: "결제", options: ["전체 결제", "결제완료", "대기", "환불"] },
];

type Row = {
  id: string;
  applicant: string;
  contest: string;
  status: string;
  payment: string;
  date: string;
};

const ROWS: Row[] = [
  {
    id: "A-1042",
    applicant: "김서연",
    contest: "IYAC 2026",
    status: "심사중",
    payment: "결제완료",
    date: "2026.05.12",
  },
  {
    id: "A-1043",
    applicant: "David Park",
    contest: "Art for Tomorrow",
    status: "본선진출",
    payment: "결제완료",
    date: "2026.03.20",
  },
  {
    id: "A-1044",
    applicant: "이준호",
    contest: "Music & Performance",
    status: "접수완료",
    payment: "대기",
    date: "2026.02.28",
  },
  {
    id: "A-1045",
    applicant: "Team Aurora",
    contest: "IYAC 2026",
    status: "최종수상",
    payment: "결제완료",
    date: "2026.05.30",
  },
];

export default function AdminDashboard() {
  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="관리자 대시보드"
        description="접수·심사·결제·결과 발표를 통합 관리합니다."
        crumbs={[{ label: "관리자" }]}
      />

      <section className="mx-auto max-w-shell px-6 py-12">
        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          {/* LEFT sidebar — 관리 메뉴 */}
          <aside>
            <p className="px-3 text-[16px] font-bold uppercase tracking-[0.12em] text-brand-blue">
              관리 메뉴
            </p>
            <nav className="mt-3 overflow-hidden rounded-2xl border border-line bg-white">
              {MENU.map((m, i) => (
                <a
                  key={m}
                  href="#"
                  className={`block px-4 py-3 text-[16px] font-medium text-ink hover:bg-surface hover:text-brand-blue ${
                    i < MENU.length - 1 ? "border-b border-line" : ""
                  }`}
                >
                  {m}
                </a>
              ))}
            </nav>
          </aside>

          {/* RIGHT — KPIs + table */}
          <div className="min-w-0">
            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {KPIS.map((k) => (
                <div
                  key={k.label}
                  className="rounded-2xl border border-line bg-white p-5"
                >
                  <p className="text-[16px] text-ink-strong">{k.label}</p>
                  <p className="mt-2 font-serif text-[26px] font-bold text-ink-strong">
                    {k.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Search + filters */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="search"
                placeholder="접수번호·이름·공모전 검색"
                className="w-full flex-1 rounded-lg border border-line bg-white px-4 py-2.5 text-[16px] text-ink-strong outline-none focus:border-brand-blue"
              />
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((f) => (
                  <select
                    key={f.label}
                    aria-label={f.label}
                    className="rounded-lg border border-line bg-white px-3 py-2.5 text-[16px] text-ink-strong outline-none focus:border-brand-blue"
                  >
                    {f.options.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ))}
              </div>
            </div>

            {/* Recent 접수 table */}
            <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white">
              <table className="w-full text-left text-[16px]">
                <thead>
                  <tr className="border-b border-line bg-surface text-[16px] text-ink-strong">
                    <th className="px-5 py-3 font-semibold">접수번호</th>
                    <th className="px-5 py-3 font-semibold">접수자</th>
                    <th className="px-5 py-3 font-semibold">공모전</th>
                    <th className="px-5 py-3 font-semibold">상태</th>
                    <th className="px-5 py-3 font-semibold">결제</th>
                    <th className="px-5 py-3 font-semibold">일자</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((r, i) => (
                    <tr
                      key={r.id}
                      className={i < ROWS.length - 1 ? "border-b border-line" : ""}
                    >
                      <td className="px-5 py-4 font-semibold text-ink-strong">
                        {r.id}
                      </td>
                      <td className="px-5 py-4 text-ink-strong">{r.applicant}</td>
                      <td className="px-5 py-4 text-ink-strong">{r.contest}</td>
                      <td className="px-5 py-4 text-ink-strong">{r.status}</td>
                      <td className="px-5 py-4 text-ink-strong">{r.payment}</td>
                      <td className="px-5 py-4 text-ink-strong">{r.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
