"use client";

import { useRef } from "react";
import { StatusBadge, Message } from "@/components/ds";
import type { AssetView, UploadPurpose } from "@/lib/mock/submit-machine";
import type { Bi, Locale } from "@/lib/i18n";

// One upload slot, driven by the server FormSpec upload rule + the mock asset
// state. Client-side type/size is a hint only; "ready"/"rejected" and pageCount
// come from the (mock) server.

export type UploadSpec = {
  purpose: UploadPurpose;
  requiredOnSubmit: boolean | null;
  allowedMediaTypes: string[];
  maxFiles: number;
  maxBytes: number | null;
  minPages: number | null;
};

const PURPOSE_LABEL: Record<UploadPurpose, Bi> = {
  cover_image: { en: "Cover image", ko: "표지 이미지" },
  book_pdf: { en: "Book PDF", ko: "작품 PDF" },
};

const REJECTION_LABEL: Record<string, Bi> = {
  FILE_TOO_LARGE: { en: "File exceeds the size limit.", ko: "허용 용량을 초과했습니다." },
  UNSUPPORTED_MEDIA_TYPE: { en: "Unsupported file type.", ko: "지원하지 않는 형식입니다." },
  CONTENT_TYPE_MISMATCH: { en: "File content does not match its type.", ko: "파일 형식이 일치하지 않습니다." },
  FILE_CORRUPTED: { en: "The file appears to be corrupted.", ko: "파일이 손상된 것으로 보입니다." },
  PDF_ENCRYPTED: { en: "The PDF is password-protected.", ko: "PDF에 암호가 설정되어 있습니다." },
  PDF_TOO_FEW_PAGES: { en: "The PDF has too few pages.", ko: "PDF 페이지 수가 부족합니다." },
  FILE_UNSAFE: { en: "The file failed a safety check.", ko: "안전성 검사를 통과하지 못했습니다." },
};

function fmtBytes(n: number | null): string {
  if (n == null) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`;
  if (n >= 1000) return `${Math.round(n / 1000)} KB`;
  return `${n} B`;
}

function hint(spec: UploadSpec, locale: Locale): string {
  const ko = locale === "ko";
  const parts: string[] = [];
  parts.push(spec.allowedMediaTypes.map((m) => m.split("/")[1].toUpperCase()).join(", "));
  parts.push(spec.maxBytes ? `${ko ? "최대" : "max"} ${fmtBytes(spec.maxBytes)}` : ko ? "허용 용량 서버 확인" : "size limit from server");
  if (spec.minPages) parts.push(`${ko ? "최소" : "min"} ${spec.minPages}${ko ? "쪽" : " pages"}`);
  return parts.join(" · ");
}

export default function UploadField({
  spec,
  asset,
  locale,
  onSelect,
  onAbort,
  onRemove,
}: {
  spec: UploadSpec;
  asset: AssetView;
  locale: Locale;
  onSelect: (file: File) => void;
  onAbort: () => void;
  onRemove: () => void;
}) {
  const ko = locale === "ko";
  const inputRef = useRef<HTMLInputElement>(null);
  const required = spec.requiredOnSubmit === true;

  const pick = () => inputRef.current?.click();
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onSelect(f);
    e.target.value = ""; // allow re-selecting the same file
  };

  const st = asset.state;
  const label = PURPOSE_LABEL[spec.purpose][locale];

  return (
    <div className="rounded-xl border border-line p-5">
      <input
        ref={inputRef}
        type="file"
        accept={spec.allowedMediaTypes.join(",")}
        onChange={onChange}
        className="hidden"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-[16px] font-semibold text-ink-strong">
          {label}
          {required && <span className="text-danger" aria-hidden>{" *"}</span>}
        </p>
        {st === "ready" && <StatusBadge tone="success">{ko ? "검증 완료" : "Verified"}</StatusBadge>}
        {(st === "uploading" || st === "uploaded") && (
          <StatusBadge tone="info">{ko ? "업로드 중" : "Uploading"}</StatusBadge>
        )}
        {st === "validating" && <StatusBadge tone="warning">{ko ? "검증 중" : "Validating"}</StatusBadge>}
        {st === "rejected" && <StatusBadge tone="danger">{ko ? "검증 실패" : "Rejected"}</StatusBadge>}
      </div>
      <p className="mt-1 text-[15px] text-ink-strong">{hint(spec, locale)}</p>

      {/* Empty → dropzone */}
      {st === "empty" && (
        <button
          type="button"
          onClick={pick}
          className="mt-4 flex w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-field bg-canvas px-6 py-7 text-center hover:border-brand-blue"
        >
          <span className="text-[16px] font-medium text-ink-strong">
            {ko ? "파일을 선택하세요" : "Choose a file"}
          </span>
          <span className="text-[15px] text-ink-strong/70">
            {ko ? "클릭하여 업로드" : "Click to upload"}
          </span>
        </button>
      )}

      {/* Uploading → progress + abort */}
      {st === "uploading" && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-[15px] text-ink-strong">
            <span className="truncate">{asset.filename}</span>
            <span className="tabular-nums">{asset.progress}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line">
            <div className="h-full bg-brand-blue transition-[width]" style={{ width: `${asset.progress}%` }} />
          </div>
          <button
            type="button"
            onClick={onAbort}
            className="mt-3 rounded-lg border border-line px-4 py-2 text-[15px] font-semibold text-ink-strong hover:border-danger hover:text-danger"
          >
            {ko ? "업로드 중단" : "Cancel upload"}
          </button>
        </div>
      )}

      {/* Uploaded/validating → filename + status line */}
      {(st === "uploaded" || st === "validating") && (
        <div className="mt-4 flex items-center justify-between rounded-lg bg-canvas px-4 py-3 text-[15px] text-ink-strong">
          <span className="truncate">{asset.filename} · {fmtBytes(asset.sizeBytes)}</span>
          <span>{st === "validating" ? (ko ? "서버 검증 중…" : "Validating…") : ko ? "업로드 완료" : "Uploaded"}</span>
        </div>
      )}

      {/* Ready → filename + server pageCount + replace/remove */}
      {st === "ready" && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-canvas px-4 py-3 text-[15px] text-ink-strong">
            <span className="truncate">{asset.filename} · {fmtBytes(asset.sizeBytes)}</span>
            {asset.pageCount != null && (
              <span>{ko ? "서버 확인 페이지" : "Server pages"}: {asset.pageCount}{ko ? "쪽" : ""}</span>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={pick} className="rounded-lg border border-line px-4 py-2 text-[15px] font-semibold text-ink-strong hover:border-brand-blue">
              {ko ? "교체" : "Replace"}
            </button>
            <button type="button" onClick={onRemove} className="rounded-lg border border-line px-4 py-2 text-[15px] font-semibold text-ink-strong hover:border-danger hover:text-danger">
              {ko ? "삭제" : "Remove"}
            </button>
          </div>
        </div>
      )}

      {/* Rejected → server reason + retry/replace/remove */}
      {st === "rejected" && (
        <div className="mt-4">
          <Message tone="danger" title={ko ? "검증 실패" : "Validation failed"}>
            {(asset.rejectionCode && REJECTION_LABEL[asset.rejectionCode]?.[locale]) ??
              (ko ? "파일을 검증하지 못했습니다." : "The file could not be validated.")}
            {asset.pageCount != null && ` (${ko ? "서버 확인" : "server"}: ${asset.pageCount}${ko ? "쪽" : " pages"})`}
          </Message>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={pick} className="rounded-lg border border-line px-4 py-2 text-[15px] font-semibold text-ink-strong hover:border-brand-blue">
              {ko ? "다시 시도 · 교체" : "Retry · Replace"}
            </button>
            <button type="button" onClick={onRemove} className="rounded-lg border border-line px-4 py-2 text-[15px] font-semibold text-ink-strong hover:border-danger hover:text-danger">
              {ko ? "삭제" : "Remove"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
