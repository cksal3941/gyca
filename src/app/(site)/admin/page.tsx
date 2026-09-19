"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/site/PageHeader";
import { Button, Message, StatusBadge, Modal, Select, type Tone } from "@/components/ds";
import {
  listAdminEntries,
  listAdminCompetitions,
  exportAdminEntriesCsv,
  bulkPublishResult,
  bulkIssueCertificates,
  requestCsvExport,
  type AdminEntriesPage,
  type AdminQuery,
  type AdminScenario,
  type AdminCompetitionRef,
  type BulkOutcome,
  type BulkScenario,
} from "@/lib/api/ops";
import type { RequestState } from "@/lib/api";
import { isLive } from "@/lib/api/mode";
import type { EntryStatus, ReviewStatus, PublishedResult, PaymentState } from "@/contracts";

// Admin — 접수 관리 (MOCK). Search / filter / sort / paginate / select / bulk.
// Boundaries: NO UI to change a completed payment; result-publish & certificate
// issue are guarded server actions (mock) that return per-item success/failure.
// Changing any query CLEARS the selection so the selected set is never ambiguous.

const ENTRY_STATUS: Record<EntryStatus, { label: string; tone: Tone }> = {
  draft: { label: "작성 중", tone: "neutral" },
  submitted: { label: "제출됨", tone: "info" },
  received: { label: "접수 완료", tone: "success" },
  withdrawn: { label: "철회", tone: "neutral" },
  expired: { label: "만료", tone: "neutral" },
};
const REVIEW_STATUS: Record<ReviewStatus, { label: string; tone: Tone }> = {
  not_started: { label: "미심사", tone: "neutral" },
  under_review: { label: "심사 중", tone: "info" },
  completed: { label: "심사 완료", tone: "success" },
};
const RESULT_LABEL: Record<PublishedResult, { label: string; tone: Tone }> = {
  official_selection: { label: "Official Selection", tone: "success" },
  finalist: { label: "Leipzig Finalist", tone: "success" },
  not_selected: { label: "미선정", tone: "neutral" },
};
const PAYMENT: Record<PaymentState, { label: string; tone: Tone }> = {
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
};

const money = (m: number) => `€${(m / 100).toFixed(0)}`;

const RESULT_OPTIONS: { value: PublishedResult; label: string }[] = [
  { value: "official_selection", label: "Official Selection" },
  { value: "finalist", label: "Leipzig Finalist" },
  { value: "not_selected", label: "미선정(Not Selected)" },
];

const PAGE_SIZE = 8;

export default function AdminEntriesPageView() {
  const [scenario, setScenario] = useState<AdminScenario>("some");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AdminQuery["status"]>("all");
  const [payment, setPayment] = useState<AdminQuery["payment"]>("all");
  const [result, setResult] = useState<AdminQuery["result"]>("all");
  const [sort, setSort] = useState<NonNullable<AdminQuery["sort"]>>("created_desc");
  // Forward-cursor stack: [null] is page 1; each Next pushes the server's opaque
  // nextCursor, Prev pops. Works for both mock (offset-string cursors) and live.
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);

  // Live: the entries endpoint is per-competition, so pick a competitionId first.
  const [competitions, setCompetitions] = useState<AdminCompetitionRef[]>([]);
  const [competitionId, setCompetitionId] = useState<string | null>(null);

  const [state, setState] = useState<RequestState<AdminEntriesPage>>({ kind: "loading" });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Modal + bulk outcome
  const [modal, setModal] = useState<null | "result" | "certificate">(null);
  const [bulkResult, setBulkResult] = useState<PublishedResult>("official_selection");
  const [bulkSim, setBulkSim] = useState<BulkScenario>("ok");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<BulkOutcome | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reqId = useRef(0);

  const fetchList = useCallback(
    (q: AdminQuery, sc: AdminScenario, compId: string | null) => {
      const my = ++reqId.current;
      listAdminEntries(q, { competitionId: compId ?? undefined, scenario: sc, delayMs: 300 }).then((r) => {
        if (my === reqId.current) setState(r);
      });
    },
    [],
  );

  // Initial load. Live: resolve a competitionId from /admin/competitions first.
  useEffect(() => {
    if (!isLive) {
      fetchList({ search, status, payment, result, sort, cursor: null, pageSize: PAGE_SIZE }, scenario, null);
      return;
    }
    let alive = true;
    listAdminCompetitions().then((r) => {
      if (!alive) return;
      if (r.kind === "success" && r.data.length > 0) {
        setCompetitions(r.data);
        const first = r.data[0].id;
        setCompetitionId(first);
        fetchList({ search: "", status: "all", payment: "all", result: "all", sort: "created_desc", cursor: null, pageSize: PAGE_SIZE }, scenario, first);
      } else if (r.kind === "success") {
        setState({ kind: "empty" });
      } else {
        setState(r);
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Any filter/search/sort/scenario change: reset to page 1 (cursor stack) and
  // clear the selection so the selected set is never ambiguous.
  const rerun = (patch: Partial<AdminQuery & { scenario: AdminScenario }>) => {
    const next = {
      search: patch.search ?? search,
      status: patch.status ?? status,
      payment: patch.payment ?? payment,
      result: patch.result ?? result,
      sort: patch.sort ?? sort,
      scenario: patch.scenario ?? scenario,
    };
    setSearch(next.search ?? "");
    setStatus(next.status);
    setPayment(next.payment);
    setResult(next.result);
    setSort(next.sort);
    setScenario(next.scenario);
    setCursorStack([null]);
    setSelected(new Set());
    setState({ kind: "loading" });
    fetchList(
      { search: next.search, status: next.status, payment: next.payment, result: next.result, sort: next.sort, cursor: null, pageSize: PAGE_SIZE },
      next.scenario,
      competitionId,
    );
  };

  const items = state.kind === "success" ? state.data.items : [];
  const total = state.kind === "success" ? state.data.total : 0;
  const nextCursor = state.kind === "success" ? state.data.nextCursor : null;
  const pageIndex = cursorStack.length - 1;

  // Cursor-based paging (both modes): push/pop the opaque nextCursor.
  const goToCursor = (stack: (string | null)[]) => {
    setCursorStack(stack);
    setSelected(new Set());
    setState({ kind: "loading" });
    fetchList(
      { search, status, payment, result, sort, cursor: stack[stack.length - 1], pageSize: PAGE_SIZE },
      scenario,
      competitionId,
    );
  };
  const goNext = () => {
    if (nextCursor !== null) goToCursor([...cursorStack, nextCursor]);
  };
  const goPrev = () => {
    if (pageIndex > 0) goToCursor(cursorStack.slice(0, -1));
  };
  // Live entries load only after a competition is chosen.
  const changeCompetition = (id: string) => {
    setCompetitionId(id);
    setCursorStack([null]);
    setSelected(new Set());
    setState({ kind: "loading" });
    fetchList({ search, status, payment, result, sort, cursor: null, pageSize: PAGE_SIZE }, scenario, id);
  };
  const allOnPageSelected = items.length > 0 && items.every((e) => selected.has(e.id));

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const togglePage = () =>
    setSelected((s) => {
      const n = new Set(s);
      if (allOnPageSelected) items.forEach((e) => n.delete(e.id));
      else items.forEach((e) => n.add(e.id));
      return n;
    });

  const selectedItems = items.filter((e) => selected.has(e.id));

  const runBulk = async () => {
    setBusy(true);
    setOutcome(null);
    const ids = [...selected];
    const actionId = crypto.randomUUID();
    const res =
      modal === "result"
        ? await bulkPublishResult(ids, bulkResult, { actionId, scenario: bulkSim, delayMs: 500 })
        : await bulkIssueCertificates(ids, { actionId, scenario: bulkSim, delayMs: 500 });
    setBusy(false);
    if (res.kind === "success") {
      setOutcome(res.data);
    } else if (res.kind === "error") {
      setNotice(res.message);
      setModal(null);
    }
  };

  const closeModalDone = () => {
    setModal(null);
    setOutcome(null);
    if (outcome && outcome.succeeded.length > 0) rerun({}); // reflect published changes
  };

  const exportCsv = async () => {
    const q: AdminQuery = { search, status, payment, result, sort, cursor: null, pageSize: PAGE_SIZE };
    if (isLive) {
      if (!competitionId) return;
      const r = await exportAdminEntriesCsv(competitionId, q);
      if (r.kind === "success") {
        // Download the full result set as a file (personal data — handle with care).
        const url = URL.createObjectURL(r.data);
        const a = document.createElement("a");
        a.href = url;
        a.download = "gyca-entries.csv";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setNotice("CSV를 내려받았습니다. 개인정보가 포함되어 있으니 취급에 유의하세요.");
      } else {
        setNotice(
          r.kind === "error" && (r.code === "FORBIDDEN" || r.code === "UNAUTHENTICATED")
            ? "내보내기 권한이 없습니다."
            : "CSV 내보내기에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        );
      }
      return;
    }
    const r = await requestCsvExport(q, { delayMs: 300 });
    if (r.kind === "success")
      setNotice(`CSV 내보내기를 요청했습니다 (요청 ID: ${r.data.exportId}). 완료되면 알림이 제공됩니다.`);
  };

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="접수 관리"
        description="Leipzig 2027 접수를 검색·필터·정렬하고, 선택 건을 일괄 처리합니다."
        crumbs={[{ label: "관리자" }, { label: "접수 관리" }]}
        action={<Button href="/admin/competitions" variant="outline">공모 관리</Button>}
      />

      <section className="mx-auto max-w-page px-6 py-12">
        {/* Competition picker (live) */}
        {isLive && competitions.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <span className="text-[16px] font-semibold text-ink-strong">공모</span>
            <Select
              aria-label="공모 선택"
              value={competitionId ?? ""}
              onChange={(e) => changeCompetition(e.target.value)}
            >
              {competitions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.slug}
                </option>
              ))}
            </Select>
          </div>
        )}

        {/* Dev scenario bar (mock mode only) */}
        {!isLive && (
        <div className="mb-6 rounded-xl border border-dashed border-field bg-canvas px-4 py-3">
          <p className="mb-2 text-[14px] font-bold uppercase tracking-[0.12em] text-ink-strong/70">
            개발용 시나리오 (mock)
          </p>
          <div className="flex flex-wrap gap-2">
            {([["some", "정상"], ["empty", "빈 목록"], ["forbidden", "권한 없음"]] as [AdminScenario, string][]).map(
              ([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => rerun({ scenario: v })}
                  className={`rounded-full border px-3.5 py-1.5 text-[14px] font-medium transition-colors ${
                    scenario === v ? "border-black bg-black text-white" : "border-field text-ink hover:border-black"
                  }`}
                >
                  {label}
                </button>
              ),
            )}
          </div>
        </div>
        )}

        {notice && (
          <Message tone="info" className="mb-4" title="알림">
            <span className="block">{notice}</span>
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => setNotice(null)}>
              닫기
            </Button>
          </Message>
        )}

        {/* Toolbar */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && rerun({ search })}
            placeholder="접수번호·참가자·작품명 검색 (Enter)"
            className="w-full flex-1 rounded-lg border border-field bg-white px-4 py-2.5 text-[16px] text-ink-strong outline-none focus:border-brand-blue"
          />
          <div className="flex flex-wrap gap-2">
            <Select
              aria-label="접수 상태"
              value={status}
              onChange={(e) => rerun({ status: e.target.value as AdminQuery["status"] })}
            >
              <option value="all">전체 상태</option>
              <option value="draft">작성 중</option>
              <option value="submitted">제출됨</option>
              <option value="received">접수 완료</option>
            </Select>
            <Select
              aria-label="결제 상태"
              value={payment}
              onChange={(e) => rerun({ payment: e.target.value as AdminQuery["payment"] })}
            >
              <option value="all">전체 결제</option>
              <option value="succeeded">결제완료</option>
              <option value="pending">대기</option>
              <option value="failed">실패</option>
            </Select>
            <Select
              aria-label="심사 결과"
              value={result}
              onChange={(e) => rerun({ result: e.target.value as AdminQuery["result"] })}
            >
              <option value="all">전체 결과</option>
              <option value="not_announced">미발표</option>
              <option value="official_selection">Official Selection</option>
              <option value="finalist">Leipzig Finalist</option>
              <option value="not_selected">미선정</option>
            </Select>
            <Select
              aria-label="정렬"
              value={sort}
              onChange={(e) => rerun({ sort: e.target.value as NonNullable<AdminQuery["sort"]> })}
            >
              <option value="created_desc">최신순</option>
              <option value="created_asc">오래된순</option>
              <option value="name_asc">이름순</option>
            </Select>
          </div>
        </div>

        {/* Selection / bulk bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
          <p className="text-[16px] text-ink-strong">
            {selected.size > 0 ? (
              <span className="font-semibold">선택 {selected.size}건</span>
            ) : (
              <>총 {total}건</>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {isLive && (
              <span className="text-[15px] text-ink-strong/70">일괄 발표·인증서는 준비 중</span>
            )}
            <Button size="sm" variant="outline" disabled={isLive && !competitionId} onClick={exportCsv}>
              CSV 내보내기
            </Button>
            <Button size="sm" variant="outline" disabled={isLive || selected.size === 0} onClick={() => setModal("result")}>
              결과 발표
            </Button>
            <Button size="sm" disabled={isLive || selected.size === 0} onClick={() => setModal("certificate")}>
              인증서 발급
            </Button>
          </div>
        </div>

        {/* Table / states */}
        {state.kind === "loading" && (
          <p className="mt-8 text-[16px] text-ink-strong">불러오는 중…</p>
        )}
        {state.kind === "empty" && (
          <div className="mt-8 rounded-2xl border border-dashed border-line bg-canvas px-6 py-12 text-center">
            <p className="text-[16px] text-ink-strong">조건에 맞는 접수가 없습니다.</p>
          </div>
        )}
        {state.kind === "error" && (
          <Message tone="danger" className="mt-8" title="접근할 수 없습니다">
            <span className="block">
              {state.code === "FORBIDDEN" || state.code === "UNAUTHENTICATED"
                ? "이 목록에 접근할 권한이 없습니다. 운영자 계정으로 로그인했는지 확인하세요."
                : state.code === "POLICY_NOT_CONFIGURED"
                  ? "공모를 먼저 선택하세요."
                  : "목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."}
            </span>
          </Message>
        )}
        {state.kind === "success" && (
          <>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white">
              <table className="w-full min-w-[900px] text-left text-[16px]">
                <thead>
                  <tr className="border-b border-line bg-surface text-ink-strong">
                    <th className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label="이 페이지 전체 선택"
                        checked={allOnPageSelected}
                        onChange={togglePage}
                        className="h-4 w-4 accent-brand-blue"
                      />
                    </th>
                    <th className="px-4 py-3 font-semibold">접수번호</th>
                    <th className="px-4 py-3 font-semibold">참가자</th>
                    <th className="px-4 py-3 font-semibold">작품명</th>
                    <th className="px-4 py-3 font-semibold">부문/연령</th>
                    <th className="px-4 py-3 font-semibold">접수</th>
                    <th className="px-4 py-3 font-semibold">파일</th>
                    <th className="px-4 py-3 font-semibold">결제</th>
                    <th className="px-4 py-3 font-semibold">심사/결과</th>
                    <th className="px-4 py-3 font-semibold" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((e) => (
                    <tr key={e.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={`${e.workTitle} 선택`}
                          checked={selected.has(e.id)}
                          onChange={() => toggle(e.id)}
                          className="h-4 w-4 accent-brand-blue"
                        />
                      </td>
                      <td className="px-4 py-3 font-semibold text-ink-strong">
                        {e.receiptNumber ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-ink-strong">{e.participantName}</td>
                      <td className="px-4 py-3 text-ink-strong">{e.workTitle}</td>
                      <td className="px-4 py-3 text-ink-strong">
                        {e.category} · {e.ageGroup}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={ENTRY_STATUS[e.entryStatus].tone}>
                          {ENTRY_STATUS[e.entryStatus].label}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={FILE_STATE[e.fileState].tone}>
                          {FILE_STATE[e.fileState].label}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-3">
                        {e.payment ? (
                          <StatusBadge tone={PAYMENT[e.payment.state].tone}>
                            {PAYMENT[e.payment.state].label} · {money(e.payment.amountMinor)}
                          </StatusBadge>
                        ) : (
                          <span className="text-ink-strong">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge tone={REVIEW_STATUS[e.reviewStatus].tone}>
                            {REVIEW_STATUS[e.reviewStatus].label}
                          </StatusBadge>
                          {e.publishedResult && (
                            <StatusBadge tone={RESULT_LABEL[e.publishedResult].tone}>
                              {RESULT_LABEL[e.publishedResult].label}
                            </StatusBadge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={isLive && competitionId ? `/admin/entries/${e.id}?competition=${encodeURIComponent(competitionId)}` : `/admin/entries/${e.id}`}
                          className="text-[16px] font-semibold text-brand-blue hover:underline"
                        >
                          상세
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between">
              <p className="text-[16px] text-ink-strong">
                {pageIndex * PAGE_SIZE + 1}–{pageIndex * PAGE_SIZE + items.length} / 총 {total}건
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={pageIndex === 0} onClick={goPrev}>
                  이전
                </Button>
                <Button size="sm" variant="outline" disabled={nextCursor === null} onClick={goNext}>
                  다음
                </Button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Bulk confirmation modal */}
      <Modal
        open={modal !== null}
        onClose={() => {
          setModal(null);
          setOutcome(null);
        }}
        title={modal === "result" ? "결과 일괄 발표" : "인증서 일괄 발급"}
        description={
          outcome
            ? undefined
            : `선택한 ${selected.size}건에 대해 ${modal === "result" ? "결과를 발표" : "인증서를 발급"}합니다. 결제 완료 상태는 이 화면에서 변경되지 않습니다.`
        }
        footer={
          outcome ? (
            <Button onClick={closeModalDone}>확인</Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setModal(null);
                  setOutcome(null);
                }}
              >
                취소
              </Button>
              <Button onClick={runBulk} disabled={busy}>
                {busy ? "처리 중…" : "확인"}
              </Button>
            </>
          )
        }
      >
        {outcome ? (
          <div>
            <p className="text-[16px] text-ink-strong">
              요청 {outcome.requested}건 · <span className="font-semibold text-success">성공 {outcome.succeeded.length}건</span>
              {" · "}
              <span className={outcome.failed.length ? "font-semibold text-danger" : ""}>실패 {outcome.failed.length}건</span>
            </p>
            {outcome.failed.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5">
                {outcome.failed.map((f) => (
                  <li key={f.id} className="text-[16px] text-ink-strong">
                    <span className="font-semibold">{f.id}</span> — {f.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div>
            {modal === "result" && (
              <label className="block">
                <span className="text-[16px] font-semibold text-ink-strong">발표할 결과</span>
                <Select value={bulkResult} onChange={(e) => setBulkResult(e.target.value as PublishedResult)} className="mt-2">
                  {RESULT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            {/* Selected targets — 대상 확인 */}
            <p className="mt-4 text-[16px] font-semibold text-ink-strong">대상 {selectedItems.length}건</p>
            <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-line p-3">
              {selectedItems.map((e) => (
                <li key={e.id} className="text-[16px] text-ink-strong">
                  {e.receiptNumber ?? e.id} · {e.workTitle}
                </li>
              ))}
            </ul>
            {/* Dev-only outcome simulation */}
            <label className="mt-4 block">
              <span className="text-[14px] font-bold uppercase tracking-[0.1em] text-ink-strong/70">
                결과 시뮬레이션 (개발용)
              </span>
              <Select value={bulkSim} onChange={(e) => setBulkSim(e.target.value as BulkScenario)} className="mt-2">
                <option value="ok">모두 성공</option>
                <option value="partial">일부 실패</option>
                <option value="forbidden">권한 없음</option>
              </Select>
            </label>
          </div>
        )}
      </Modal>
    </>
  );
}
