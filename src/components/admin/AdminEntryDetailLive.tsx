"use client";

import { useEffect, useState } from "react";
import { Button, Message, StatusBadge, type Tone } from "@/components/ds";
import { getAdminEntryDetail } from "@/lib/api/ops";
import type { AdminEntryDetailSchema } from "@/contracts/admin-entry-detail";
import type { z } from "zod";

// Admin entry detail (LIVE, contract shape). CLIENT component: it fetches
// GET /admin/competitions/{competitionId}/entries/{entryId} with the operator
// session (a server component cannot forward the cookie). Renders the contract
// exactly — files.displayName, guardianVerificationStatus, audit.type/actorId/
// occurredAt, certificate states — and never fabricates a verified state or an
// actor name. Actions come from the server allowedActions only.

type Detail = z.infer<typeof AdminEntryDetailSchema>;
type Phase = "loading" | "notfound" | "error" | "ready";

const ENTRY_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "작성 중", tone: "neutral" }, submitted: { label: "제출됨", tone: "info" },
  received: { label: "접수 완료", tone: "success" }, withdrawn: { label: "철회", tone: "neutral" },
  expired: { label: "만료", tone: "neutral" },
};
const REVIEW_STATUS: Record<string, { label: string; tone: Tone }> = {
  not_started: { label: "미심사", tone: "neutral" }, under_review: { label: "심사 중", tone: "info" },
  completed: { label: "심사 완료", tone: "success" },
};
const RESULT_LABEL: Record<string, { label: string; tone: Tone }> = {
  official_selection: { label: "Official Selection", tone: "success" },
  finalist: { label: "Leipzig Finalist", tone: "success" }, not_selected: { label: "미선정", tone: "neutral" },
};
const PAYMENT: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "대기", tone: "warning" }, succeeded: { label: "결제완료", tone: "success" },
  failed: { label: "실패", tone: "danger" }, cancelled: { label: "취소", tone: "danger" }, expired: { label: "만료", tone: "neutral" },
};
const FILE_STATE: Record<string, { label: string; tone: Tone }> = {
  pending_upload: { label: "대기", tone: "neutral" }, uploaded: { label: "업로드 완료", tone: "info" },
  validating: { label: "검증 중", tone: "info" }, ready: { label: "검증 완료", tone: "success" },
  rejected: { label: "검증 실패", tone: "danger" },
};
const GUARDIAN_STATUS: Record<string, { label: string; tone: Tone }> = {
  not_verified: { label: "미확인", tone: "neutral" }, pending_review: { label: "검토 대기", tone: "warning" },
  verified: { label: "확인 완료", tone: "success" }, expired: { label: "만료", tone: "neutral" }, stale: { label: "재확인 필요", tone: "warning" },
};
const CERT_STATE: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "발급 대기", tone: "warning" }, issued: { label: "발급 완료", tone: "success" }, stalled: { label: "지연", tone: "danger" },
};
const CERT_STAGE: Record<string, string> = { official_selection: "Official Selection", finalist: "Leipzig Finalist" };
const CONSENT_LABEL: Record<string, string> = {
  participation_rules: "참가 규정", privacy: "개인정보 수집·이용 동의", work_license: "작품 이용허락",
};
const ASSET_PURPOSE: Record<string, string> = {
  cover_image: "표지 이미지", book_pdf: "도서 PDF", copyright_declaration: "저작권 확인서",
  guardian_consent: "보호자 동의서", publisher_permission: "출판 허가서",
};
const AUDIT_LABEL: Record<string, string> = {
  "entry.created": "접수 생성", "entry.submitted": "제출", "payment.succeeded": "결제 승인",
  "entry.received": "접수 확정", "review.updated": "심사 갱신", "result.published": "결과 발표",
  "final_participation.updated": "본선 갱신", "certificate.queued": "인증서 예약", "certificate.issued": "인증서 발급",
  "certificate.retry_scheduled": "인증서 재시도 예약", "certificate.stalled": "인증서 지연",
};
const ACTION_LABEL: Record<string, string> = {
  view_guardian_consents: "보호자 동의 열람", issue_certificate: "인증서 발급",
};

const money = (m: { amountMinor: number; currency: string }) =>
  m.currency === "EUR" ? `€${(m.amountMinor / 100).toFixed(0)}` : `${(m.amountMinor / 100).toFixed(2)} ${m.currency}`;
const fmtBytes = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("ko-KR");

export default function AdminEntryDetailLive({ competitionId, entryId }: { competitionId: string; entryId: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [e, setE] = useState<Detail | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await getAdminEntryDetail(competitionId, entryId);
      if (!alive) return;
      if (r.kind !== "success") {
        setPhase(r.kind === "error" && r.code !== "NOT_FOUND" && r.code !== "UNAUTHENTICATED" && r.code !== "FORBIDDEN" ? "error" : "notfound");
        return;
      }
      setE(r.data);
      setPhase("ready");
    })();
    return () => { alive = false; };
  }, [competitionId, entryId, reloadKey]);

  const retry = () => { setE(null); setPhase("loading"); setReloadKey((k) => k + 1); };

  if (phase === "loading") {
    return <div className="mx-auto max-w-page px-6 py-12" aria-busy="true"><div className="h-40 animate-pulse rounded-2xl border border-line bg-surface" /></div>;
  }
  if (phase === "notfound" || phase === "error") {
    const isError = phase === "error";
    return (
      <section className="mx-auto max-w-page px-6 py-12">
        <Message tone={isError ? "danger" : "info"} title={isError ? "불러오지 못했습니다" : "접수를 찾을 수 없습니다"}>
          {isError ? "문제가 발생했습니다. 다시 시도해 주세요." : "해당 접수가 없거나 접근 권한이 없습니다."}
        </Message>
        <div className="mt-6 flex gap-3">
          {isError && <Button onClick={retry}>다시 시도</Button>}
          <Button href="/admin" variant={isError ? "outline" : "primary"}>목록으로</Button>
        </div>
      </section>
    );
  }

  const d = e as Detail;
  const p = d.participant;
  const w = d.work;
  const participantRows: [string, string | null | undefined][] = [
    ["이름", p.name], ["영문명", p.nameEn], ["생년월일", p.dateOfBirth], ["거주국", p.residenceCountry],
    ["국적", p.nationality], ["학교", p.school], ["학년", p.grade], ["부문/연령", `${d.category ?? "—"} · ${d.ageGroup ?? "—"}`],
  ];

  return (
    <section className="mx-auto max-w-page px-6 py-12">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={ENTRY_STATUS[d.entryStatus]?.tone ?? "neutral"}>{ENTRY_STATUS[d.entryStatus]?.label ?? d.entryStatus}</StatusBadge>
        <StatusBadge tone={REVIEW_STATUS[d.reviewStatus]?.tone ?? "neutral"}>{REVIEW_STATUS[d.reviewStatus]?.label ?? d.reviewStatus}</StatusBadge>
        {d.publishedResult && <StatusBadge tone={RESULT_LABEL[d.publishedResult]?.tone ?? "neutral"}>{RESULT_LABEL[d.publishedResult]?.label ?? d.publishedResult}</StatusBadge>}
        {d.certificateIssued && <StatusBadge tone="success">인증서 발급됨</StatusBadge>}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-6">
          <h2 className="font-title text-[18px] font-bold text-ink-strong">참가자</h2>
          <dl className="mt-4 flex flex-col gap-2 text-[16px]">
            {participantRows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-line py-2 last:border-0">
                <dt className="text-ink-strong">{k}</dt>
                <dd className="font-semibold text-ink-strong">{v || "—"}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="rounded-2xl border border-line bg-white p-6">
          <h2 className="font-title text-[18px] font-bold text-ink-strong">작품</h2>
          <dl className="mt-4 flex flex-col gap-3 text-[16px]">
            <div><dt className="text-ink-strong">영문 작품명</dt><dd className="mt-1 font-semibold text-ink-strong">{w.englishTitle || "—"}</dd></div>
            <div><dt className="text-ink-strong">영문 소개</dt><dd className="mt-1 font-semibold text-ink-strong">{w.englishDescription || "—"}</dd></div>
            {w.language && <div><dt className="text-ink-strong">언어</dt><dd className="mt-1 font-semibold text-ink-strong">{w.language}</dd></div>}
          </dl>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-line bg-white p-6">
        <h2 className="font-title text-[18px] font-bold text-ink-strong">파일 검증 상태</h2>
        {d.files.length === 0 ? (
          <p className="mt-4 text-[16px] text-ink-strong">제출된 파일이 없습니다.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {d.files.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line p-4">
                <span className="text-[16px] font-semibold text-ink-strong">{ASSET_PURPOSE[f.purpose] ?? f.purpose}</span>
                <span className="text-[16px] text-ink-strong">
                  {f.displayName} · {f.mediaType} · {fmtBytes(f.sizeBytes)}{f.pageCount != null ? ` · ${f.pageCount}쪽` : ""}
                </span>
                <StatusBadge tone={FILE_STATE[f.state]?.tone ?? "neutral"} className="ml-auto">
                  {FILE_STATE[f.state]?.label ?? f.state}{f.rejectionCode ? ` · ${f.rejectionCode}` : ""}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[16px] text-ink-strong">PDF 페이지 수·검증 결과는 서버가 확정한 값입니다. 참가자 원본 파일은 관리자 화면에서 직접 다운로드하지 않습니다.</p>
      </div>

      <div className="mt-8 rounded-2xl border border-line bg-white p-6">
        <h2 className="font-title text-[18px] font-bold text-ink-strong">결제</h2>
        {d.payment ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <StatusBadge tone={PAYMENT[d.payment.state]?.tone ?? "neutral"}>{PAYMENT[d.payment.state]?.label ?? d.payment.state}</StatusBadge>
            <span className="text-[16px] font-semibold text-ink-strong">{money(d.payment.money)}</span>
            {d.payment.needsReview && <StatusBadge tone="warning">검토 필요</StatusBadge>}
            {!d.payment.liveMode && <StatusBadge tone="neutral">테스트</StatusBadge>}
          </div>
        ) : (
          <p className="mt-4 text-[16px] text-ink-strong">결제 내역이 없습니다.</p>
        )}
        <Message tone="info" className="mt-4">결제 완료 상태는 이 화면에서 변경할 수 없습니다. 승인·환불은 서버 결제 API와 권한 검증을 거칩니다.</Message>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-6">
          <h2 className="font-title text-[18px] font-bold text-ink-strong">동의 내역</h2>
          {d.consents.length === 0 ? (
            <p className="mt-4 text-[16px] text-ink-strong">제출된 동의 내역이 없습니다.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {d.consents.map((c) => (
                <li key={c.kind} className="flex items-center justify-between gap-3 border-b border-line pb-2 last:border-0">
                  <span className="text-[16px] text-ink-strong">{CONSENT_LABEL[c.kind] ?? c.kind} · v{c.version} · {c.locale.toUpperCase()}</span>
                  <StatusBadge tone="success">{fmtDateTime(c.acceptedAt)}</StatusBadge>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[16px] text-ink-strong">보호자 확인: <span className="font-semibold">{GUARDIAN_STATUS[d.guardianVerificationStatus]?.label ?? d.guardianVerificationStatus}</span> — 이메일 수락만으로 확인 완료로 표시하지 않습니다.</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-6">
          <h2 className="font-title text-[18px] font-bold text-ink-strong">인증서</h2>
          {d.certificates.length === 0 ? (
            <p className="mt-4 text-[16px] text-ink-strong">발급된 인증서가 없습니다.</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {d.certificates.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 border-b border-line pb-2 last:border-0">
                  <span className="text-[16px] text-ink-strong">{CERT_STAGE[c.stage] ?? c.stage}{c.issuedAt ? ` · ${fmtDateTime(c.issuedAt)}` : ""}</span>
                  <StatusBadge tone={CERT_STATE[c.state]?.tone ?? "neutral"}>{CERT_STATE[c.state]?.label ?? c.state}</StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-line bg-white p-6">
        <h2 className="font-title text-[18px] font-bold text-ink-strong">처리 이력 <span className="text-[14px] font-normal text-ink-strong/70">(최근 최대 100건)</span></h2>
        {d.audit.length === 0 ? (
          <p className="mt-4 text-[16px] text-ink-strong">이력이 없습니다.</p>
        ) : (
          <ol className="mt-4 flex flex-col gap-3">
            {d.audit.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line pb-3 last:border-0">
                <span className="text-[16px] font-semibold text-ink-strong">{AUDIT_LABEL[a.type] ?? a.type}</span>
                <span className="ml-auto text-[16px] text-ink-strong">{a.actorId ?? "시스템"} · {fmtDateTime(a.occurredAt)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="mt-8 rounded-2xl border border-line bg-white p-6">
        <h2 className="font-title text-[18px] font-bold text-ink-strong">허용된 작업</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {d.allowedActions.length === 0 ? (
            <span className="text-[16px] text-ink-strong">이 접수에 대해 허용된 상세 작업이 없습니다.</span>
          ) : (
            d.allowedActions.map((a) => <StatusBadge key={a} tone="neutral">{ACTION_LABEL[a] ?? a}</StatusBadge>)
          )}
        </div>
        <p className="mt-3 text-[16px] text-ink-strong">이 목록은 접수 단위 상세 작업입니다(공모 전체 결과 발표 권한과 다름). 실행은 권한 검증과 이력 기록을 거칩니다.</p>
      </div>

      <div className="mt-8">
        <Button href="/admin" variant="ghost">목록으로</Button>
      </div>
    </section>
  );
}
