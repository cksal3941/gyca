import { notFound } from "next/navigation";
import PageHeader from "@/components/site/PageHeader";
import { Button, Message, StatusBadge, type Tone } from "@/components/ds";
import { getAdminEntrySync } from "@/lib/api/ops";
import { isLive } from "@/lib/api/mode";
import AdminEntryDetailLive from "@/components/admin/AdminEntryDetailLive";

// Admin entry detail (MOCK, read-oriented). Shows participant/work/files/payment/
// consents/audit. Actions come from server allowedActions; execution is a guarded
// server API. There is deliberately NO control to change a completed payment.

const ENTRY_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "작성 중", tone: "neutral" },
  submitted: { label: "제출됨", tone: "info" },
  received: { label: "접수 완료", tone: "success" },
  withdrawn: { label: "철회", tone: "neutral" },
  expired: { label: "만료", tone: "neutral" },
};
const REVIEW_STATUS: Record<string, { label: string; tone: Tone }> = {
  not_started: { label: "미심사", tone: "neutral" },
  under_review: { label: "심사 중", tone: "info" },
  completed: { label: "심사 완료", tone: "success" },
};
const RESULT_LABEL: Record<string, { label: string; tone: Tone }> = {
  official_selection: { label: "Official Selection", tone: "success" },
  finalist: { label: "Leipzig Finalist", tone: "success" },
  not_selected: { label: "미선정", tone: "neutral" },
};
const PAYMENT: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "대기", tone: "warning" },
  succeeded: { label: "결제완료", tone: "success" },
  failed: { label: "실패", tone: "danger" },
  cancelled: { label: "취소", tone: "danger" },
  expired: { label: "만료", tone: "neutral" },
};
const FILE_STATE: Record<string, { label: string; tone: Tone }> = {
  ready: { label: "검증 완료", tone: "success" },
  validating: { label: "검증 중", tone: "info" },
  rejected: { label: "검증 실패", tone: "danger" },
  pending: { label: "대기", tone: "neutral" },
  uploaded: { label: "업로드 완료", tone: "info" },
};
const ACTION_LABEL: Record<string, string> = {
  publish_result: "결과 발표",
  issue_certificate: "인증서 발급",
  view_guardian_consents: "보호자 동의 열람",
  request_export: "내보내기 요청",
};
const CONSENT_LABEL: Record<string, string> = {
  participation_rules: "참가 규정",
  privacy: "개인정보 수집·이용 동의",
  work_license: "작품 이용허락",
};

const money = (m: number) => `€${(m / 100).toFixed(0)}`;
const fmtBytes = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.round(n / 1000)} KB`);
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("ko-KR");

export default async function AdminEntryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ competition?: string | string[] }>;
}) {
  const { id } = await params;

  // Live: the detail endpoint is per-competition, so the list passes the
  // competitionId in the URL. Render the client view (it forwards the session).
  if (isLive) {
    const sp = await searchParams;
    const competitionId = typeof sp.competition === "string" ? sp.competition : null;
    return (
      <>
        <PageHeader
          eyebrow="Admin"
          title="접수 상세"
          crumbs={[
            { label: "관리자", href: "/admin" },
            { label: "접수 관리", href: "/admin" },
            { label: "접수 상세" },
          ]}
        />
        {competitionId ? (
          <AdminEntryDetailLive competitionId={competitionId} entryId={id} />
        ) : (
          <section className="mx-auto max-w-page px-6 py-12">
            <Message tone="danger" title="공모를 확인할 수 없습니다">
              접수 상세는 공모를 통해 조회합니다. 접수 목록에서 다시 진입해 주세요.
            </Message>
            <div className="mt-6">
              <Button href="/admin" variant="primary">목록으로</Button>
            </div>
          </section>
        )}
      </>
    );
  }

  const res = getAdminEntrySync(id);
  if (res.kind !== "success") notFound();
  const e = res.data;

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title={e.receiptNumber ?? "접수 상세"}
        crumbs={[
          { label: "관리자", href: "/admin" },
          { label: "접수 관리", href: "/admin" },
          { label: "접수 상세" },
        ]}
      />

      <section className="mx-auto max-w-page px-6 py-12">
        {/* Status chips */}
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={ENTRY_STATUS[e.entryStatus].tone}>{ENTRY_STATUS[e.entryStatus].label}</StatusBadge>
          <StatusBadge tone={REVIEW_STATUS[e.reviewStatus].tone}>{REVIEW_STATUS[e.reviewStatus].label}</StatusBadge>
          {e.publishedResult && (
            <StatusBadge tone={RESULT_LABEL[e.publishedResult].tone}>{RESULT_LABEL[e.publishedResult].label}</StatusBadge>
          )}
          {e.certificateIssued && <StatusBadge tone="success">인증서 발급됨</StatusBadge>}
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          {/* 참가자 */}
          <div className="rounded-2xl border border-line bg-white p-6">
            <h2 className="font-title text-[18px] font-bold text-ink-strong">참가자</h2>
            <dl className="mt-4 flex flex-col gap-2 text-[16px]">
              {[
                ["이름", e.participant.name],
                ["영문명", e.participant.nameEn],
                ["생년월일", e.participant.dateOfBirth],
                ["거주국", e.participant.residence],
                ["부문/연령", `${e.category} · ${e.ageGroup}`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-line py-2 last:border-0">
                  <dt className="text-ink-strong">{k}</dt>
                  <dd className="font-semibold text-ink-strong">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* 작품 */}
          <div className="rounded-2xl border border-line bg-white p-6">
            <h2 className="font-title text-[18px] font-bold text-ink-strong">작품</h2>
            <dl className="mt-4 flex flex-col gap-3 text-[16px]">
              <div>
                <dt className="text-ink-strong">영문 작품명</dt>
                <dd className="mt-1 font-semibold text-ink-strong">{e.work.englishTitle}</dd>
              </div>
              <div>
                <dt className="text-ink-strong">영문 소개</dt>
                <dd className="mt-1 font-semibold text-ink-strong">{e.work.englishDescription}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* 파일 검증 상태 */}
        <div className="mt-8 rounded-2xl border border-line bg-white p-6">
          <h2 className="font-title text-[18px] font-bold text-ink-strong">파일 검증 상태</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {e.files.map((f) => (
              <li key={f.purpose} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line p-4">
                <span className="text-[16px] font-semibold text-ink-strong">
                  {f.purpose === "cover_image" ? "표지 이미지" : "도서 PDF"}
                </span>
                <span className="text-[16px] text-ink-strong">
                  {f.name} · {fmtBytes(f.sizeBytes)}
                  {f.pageCount != null ? ` · ${f.pageCount}쪽` : ""}
                </span>
                <StatusBadge tone={(FILE_STATE[f.state] ?? { tone: "neutral" as Tone }).tone} className="ml-auto">
                  {(FILE_STATE[f.state] ?? { label: f.state }).label}
                  {f.rejectionCode ? ` · ${f.rejectionCode}` : ""}
                </StatusBadge>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[16px] text-ink-strong">PDF 페이지 수·검증 결과는 서버가 확정한 값입니다.</p>
        </div>

        {/* 결제 (읽기 전용) */}
        <div className="mt-8 rounded-2xl border border-line bg-white p-6">
          <h2 className="font-title text-[18px] font-bold text-ink-strong">결제</h2>
          {e.payment ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <StatusBadge tone={PAYMENT[e.payment.state].tone}>{PAYMENT[e.payment.state].label}</StatusBadge>
              <span className="text-[16px] font-semibold text-ink-strong">{money(e.payment.amountMinor)}</span>
              {e.payment.needsReview && <StatusBadge tone="warning">검토 필요</StatusBadge>}
            </div>
          ) : (
            <p className="mt-4 text-[16px] text-ink-strong">결제 내역이 없습니다.</p>
          )}
          <Message tone="info" className="mt-4">
            결제 완료 상태는 이 화면에서 변경할 수 없습니다. 승인·환불은 서버 결제 API와 권한 검증을 거칩니다.
          </Message>
        </div>

        {/* 동의 / 보호자 */}
        <div className="mt-8 rounded-2xl border border-line bg-white p-6">
          <h2 className="font-title text-[18px] font-bold text-ink-strong">동의 · 보호자 확인</h2>
          {e.consents.length === 0 ? (
            <p className="mt-4 text-[16px] text-ink-strong">아직 제출된 동의 내역이 없습니다.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {e.consents.map((c) => (
                <li key={c.kind} className="flex items-center justify-between gap-3 border-b border-line pb-2 last:border-0">
                  <span className="text-[16px] text-ink-strong">
                    {CONSENT_LABEL[c.kind] ?? c.kind} · v{c.version}
                  </span>
                  <StatusBadge tone="success">동의함</StatusBadge>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[16px] text-ink-strong">
            보호자 확인: {e.guardianVerification === "verified" ? "확인 완료" : "확인 필요"} (열람은 권한 검증 후 서버 제공)
          </p>
        </div>

        {/* 처리 이력 */}
        <div className="mt-8 rounded-2xl border border-line bg-white p-6">
          <h2 className="font-title text-[18px] font-bold text-ink-strong">처리 이력</h2>
          <ol className="mt-4 flex flex-col gap-3">
            {e.audit.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line pb-3 last:border-0">
                <span className="text-[16px] font-semibold text-ink-strong">{a.action}</span>
                <span className="text-[16px] text-ink-strong">{a.detail}</span>
                <span className="ml-auto text-[16px] text-ink-strong">
                  {a.actor} · {fmtDateTime(a.at)}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* 허용된 작업 (서버 게이팅) */}
        <div className="mt-8 rounded-2xl border border-line bg-white p-6">
          <h2 className="font-title text-[18px] font-bold text-ink-strong">허용된 작업</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {e.allowedActions.map((a) => (
              <StatusBadge key={a} tone="neutral">
                {ACTION_LABEL[a] ?? a}
              </StatusBadge>
            ))}
          </div>
          <p className="mt-3 text-[16px] text-ink-strong">
            실행은 목록의 일괄 작업 또는 서버 API를 통해 처리되며, 각 실행은 권한 검증과 처리 이력 기록을 거칩니다.
          </p>
        </div>

        <div className="mt-8">
          <Button href="/admin" variant="ghost">
            목록으로
          </Button>
        </div>
      </section>
    </>
  );
}
