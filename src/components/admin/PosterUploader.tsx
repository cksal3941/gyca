"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Message } from "@/components/ds";
import { getCompetitionPoster, uploadCompetitionPoster, removeCompetitionPoster, type AdminCompetitionPoster } from "@/lib/api/ops";
import { POSTER_MAX_BYTES } from "@/contracts/competition-poster";

// Competition pamphlet/poster — LIVE, organizer. The image is stored on the server and becomes the
// card thumbnail and the detail-page poster automatically whenever the presentation has no explicit
// cover URL. JPEG/PNG/WebP up to 5 MiB; a new upload replaces the previous poster.

const label = "text-[16px] font-semibold text-ink-strong";

export default function PosterUploader({ competitionId }: { competitionId: string }) {
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [data, setData] = useState<AdminCompetitionPoster | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    getCompetitionPoster(competitionId).then((r) => {
      if (!alive) return;
      if (r.kind === "success") { setData(r.data); setPhase("ready"); }
      else setPhase("error");
    });
    return () => { alive = false; };
  }, [competitionId, reloadKey]);

  const upload = async (file: File) => {
    setBusy(true); setError(null); setNotice(null);
    if (file.size > POSTER_MAX_BYTES) { setBusy(false); setError("파일이 5 MiB를 넘습니다. 이미지를 줄여서 다시 올려 주세요."); return; }
    const res = await uploadCompetitionPoster(competitionId, file);
    setBusy(false);
    if (res.kind === "success") { setData(res.data); setNotice("팜플렛을 저장했습니다. 공모 목록 카드와 상세 페이지에 바로 표시됩니다."); }
    else setError(res.kind === "error" ? (res.code === "VALIDATION_FAILED" ? "JPEG, PNG, WebP 이미지만 올릴 수 있습니다." : res.message) : "업로드 실패");
    if (input.current) input.current.value = "";
  };
  const remove = async () => {
    setBusy(true); setError(null); setNotice(null);
    const res = await removeCompetitionPoster(competitionId);
    setBusy(false);
    if (res.kind === "success") { setData(res.data); setNotice("팜플렛을 삭제했습니다."); }
    else setError(res.kind === "error" ? res.message : "삭제 실패");
  };

  return (
    <div className="rounded-2xl border border-line bg-white p-6">
      <h3 className="font-sans text-[18px] font-bold tracking-[-0.01em] text-ink-strong">공모전 팜플렛(포스터)</h3>
      <p className="mt-2 text-[15px] text-ink-strong/70">세로형 포스터 이미지(JPEG·PNG·WebP, 최대 5 MiB)를 올리면 공모 목록의 썸네일과 상세 페이지 상단에 표시됩니다. 아래 “공개 카드 표시 정보”에서 표지 URL을 따로 지정하지 않는 한 이 이미지가 사용됩니다.</p>

      {phase === "loading" && <p className="mt-4 text-[16px] text-ink-strong">불러오는 중…</p>}
      {phase === "error" && (
        <Message tone="danger" className="mt-4" title="불러오지 못했습니다">
          운영자 권한이 필요하거나 일시적 오류입니다.
          <div className="mt-3"><Button size="sm" onClick={() => { setPhase("loading"); setReloadKey((k) => k + 1); }}>다시 시도</Button></div>
        </Message>
      )}

      {phase === "ready" && data && (
        <>
          {notice && <Message tone="success" className="mt-4">{notice}</Message>}
          {error && <Message tone="danger" className="mt-4" title="오류">{error}</Message>}
          <div className="mt-4 flex flex-wrap items-start gap-6">
            {data.poster ? (
              <div
                className="aspect-[3/4] w-40 bg-contain bg-center bg-no-repeat ring-1 ring-black/5"
                style={{ backgroundImage: `url(${data.poster.url})` }}
                role="img"
                aria-label="현재 팜플렛"
              />
            ) : (
              <div className="flex aspect-[3/4] w-40 items-center justify-center bg-surface text-[14px] text-ink-strong/60 ring-1 ring-black/5">아직 없음</div>
            )}
            <div className="flex flex-col gap-3">
              <label className="block">
                <span className={label}>{data.poster ? "교체할 이미지 선택" : "이미지 선택"}</span>
                <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
                  className="mt-1 block text-[15px] text-ink-strong"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
              </label>
              {data.poster && (
                <p className="text-[14px] text-ink-strong/70">
                  {data.poster.contentType} · {(data.poster.byteSize / 1024).toFixed(0)} KB · {new Date(data.poster.uploadedAt).toLocaleString("ko-KR")}
                </p>
              )}
              {data.allowedActions.includes("remove") && (
                <Button size="sm" variant="outline" onClick={remove} disabled={busy}>팜플렛 삭제</Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
