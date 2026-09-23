"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Message, Select } from "@/components/ds";
import { createCompetition, updateCompetition, type AdminCompetition } from "@/lib/api/ops";
import { CompetitionEditSchema } from "@/contracts/competition-admin";
import { FORM_FIELD_PATHS, ASSET_PURPOSES } from "@/contracts";

const INPUT_TYPES = ["text", "textarea", "choice", "date", "email"] as const;
type Req = "required" | "optional" | "unset";
const toReq = (v: boolean | null): Req => (v === null ? "unset" : v ? "required" : "optional");
const fromReq = (v: Req): boolean | null => (v === "unset" ? null : v === "required");

// Competition registration / edit (LIVE, organizer). Produces a valid
// CompetitionEditSchema payload. Every editable field is covered: title, fee,
// timezone, entry/payment windows, guidelines, key dates (schedule), exhibition,
// and the form spec (age reference date, categories, age groups, fields,
// uploads). Operational values are entered by the operator; no defaults are
// invented here. Times are entered in your browser's local time and saved as UTC
// (the competition timezone is a separate field, shown to participants).

type Cat = { id: string; en: string; ko: string };
type Age = { id: string; en: string; ko: string; min: string; max: string };
type Fld = { path: string; inputType: string; required: Req };
type Upl = { purpose: string; required: Req; media: string; maxFiles: string; maxBytes: string; minPages: string };
type KdKind = "tbd" | "date" | "date_range" | "instant";
type Kd = { id: string; en: string; ko: string; timezone: string; kind: KdKind; date: string; startsOn: string; endsOn: string; at: string };
const KD_KIND_LABEL: Record<KdKind, string> = { tbd: "미정", date: "날짜", date_range: "기간", instant: "시각" };

// ISO (UTC) → value for <input type="datetime-local">, in the browser's local tz.
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}
function toIso(local: string): string | null {
  if (!local) return null;
  const t = new Date(local);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

export default function CompetitionForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial: AdminCompetition | null;
}) {
  const router = useRouter();
  const content = initial?.input.content;
  const spec = content?.formSpec ?? null;

  const [slug, setSlug] = useState(initial?.input.slug ?? "");
  const [titleEn, setTitleEn] = useState(content?.title.en ?? "");
  const [titleKo, setTitleKo] = useState(content?.title.ko ?? "");
  const [feeMinor, setFeeMinor] = useState(content?.fee ? String(content.fee.amountMinor) : "");
  const [timezone, setTimezone] = useState(content?.timezone ?? "Europe/Berlin");
  const [opensAt, setOpensAt] = useState(toLocalInput(initial?.input.opensAt ?? null));
  const [closesAt, setClosesAt] = useState(toLocalInput(initial?.input.closesAt ?? null));
  const [paymentClosesAt, setPaymentClosesAt] = useState(toLocalInput(initial?.input.paymentClosesAt ?? null));
  const [published, setPublished] = useState(initial?.input.published ?? false);
  const [guidelinesUrl, setGuidelinesUrl] = useState(content?.guidelines?.url ?? "");
  const [guidelinesLocale, setGuidelinesLocale] = useState<"en" | "ko">(content?.guidelines?.locale ?? "en");
  const [guidelinesVersion, setGuidelinesVersion] = useState(content?.guidelines?.version ?? "");
  const [categories, setCategories] = useState<Cat[]>(
    (spec?.categories ?? []).map((c) => ({ id: c.id, en: c.label.en, ko: c.label.ko })),
  );
  const [ageGroups, setAgeGroups] = useState<Age[]>(
    (spec?.ageGroups ?? []).map((a) => ({
      id: a.id, en: a.label.en, ko: a.label.ko, min: String(a.minAgeInclusive), max: String(a.maxAgeInclusive),
    })),
  );
  const [keyDates, setKeyDates] = useState<Kd[]>(
    (content?.keyDates ?? []).map((k) => {
      const v = k.value;
      return {
        id: k.id, en: k.label.en, ko: k.label.ko, timezone: k.timezone,
        kind: (v?.kind ?? "tbd") as KdKind,
        date: v?.kind === "date" ? v.date : "",
        startsOn: v?.kind === "date_range" ? v.startsOn : "",
        endsOn: v?.kind === "date_range" ? v.endsOn : "",
        at: v?.kind === "instant" ? toLocalInput(v.at) : "",
      };
    }),
  );
  const [ageReferenceDate, setAgeReferenceDate] = useState(spec?.ageReferenceDate ?? "");
  const exh = content?.exhibition ?? null;
  const [exhOn, setExhOn] = useState(exh != null);
  const [exhApproval, setExhApproval] = useState<"pending" | "approved">(exh?.approvalStatus ?? "pending");
  const [exhNameEn, setExhNameEn] = useState(exh?.displayName.en ?? "");
  const [exhNameKo, setExhNameKo] = useState(exh?.displayName.ko ?? "");
  const [exhVenue, setExhVenue] = useState(exh?.venueName ?? "");
  const [exhLogo, setExhLogo] = useState(exh?.logoUrl ?? "");
  const [exhStart, setExhStart] = useState(exh?.period?.startsOn ?? "");
  const [exhEnd, setExhEnd] = useState(exh?.period?.endsOn ?? "");
  const [fields, setFields] = useState<Fld[]>(
    (spec?.fields ?? []).map((f) => ({ path: f.path, inputType: f.inputType, required: toReq(f.requiredOnSubmit) })),
  );
  const [uploads, setUploads] = useState<Upl[]>(
    (spec?.uploads ?? []).map((u) => ({
      purpose: u.purpose, required: toReq(u.requiredOnSubmit), media: u.allowedMediaTypes.join(", "),
      maxFiles: String(u.maxFiles), maxBytes: u.maxBytes == null ? "" : String(u.maxBytes), minPages: u.minPages == null ? "" : String(u.minPages),
    })),
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);

    const raw = {
      slug: slug.trim(),
      content: {
        title: { en: titleEn.trim(), ko: titleKo.trim() },
        fee: feeMinor.trim() === "" ? null : { amountMinor: Number(feeMinor), currency: "EUR" },
        timezone: timezone.trim(),
        keyDates: keyDates.map((k) => ({
          id: k.id.trim(), label: { en: k.en.trim(), ko: k.ko.trim() }, timezone: k.timezone.trim(),
          value:
            k.kind === "date" ? { kind: "date", date: k.date }
            : k.kind === "date_range" ? { kind: "date_range", startsOn: k.startsOn, endsOn: k.endsOn }
            : k.kind === "instant" ? { kind: "instant", at: toIso(k.at) }
            : null,
        })),
        formSpec: {
          version: spec?.version ?? "v1",
          ageReferenceDate: ageReferenceDate.trim() === "" ? null : ageReferenceDate,
          categories: categories.map((c) => ({ id: c.id.trim(), label: { en: c.en.trim(), ko: c.ko.trim() } })),
          ageGroups: ageGroups.map((a) => ({
            id: a.id.trim(), label: { en: a.en.trim(), ko: a.ko.trim() },
            minAgeInclusive: Number(a.min), maxAgeInclusive: Number(a.max),
          })),
          fields: fields.map((f) => ({ path: f.path, inputType: f.inputType, requiredOnSubmit: fromReq(f.required) })),
          uploads: uploads.map((u) => ({
            purpose: u.purpose,
            requiredOnSubmit: fromReq(u.required),
            allowedMediaTypes: u.media.split(",").map((s) => s.trim()).filter(Boolean),
            maxFiles: Number(u.maxFiles) || 1,
            maxBytes: u.maxBytes.trim() === "" ? null : Number(u.maxBytes),
            minPages: u.minPages.trim() === "" ? null : Number(u.minPages),
          })),
        },
        exhibition: !exhOn ? null : {
          approvalStatus: exhApproval,
          displayName: { en: exhNameEn.trim(), ko: exhNameKo.trim() },
          // Unapproved venues must not be disclosed — venue/logo only when approved.
          venueName: exhApproval === "approved" && exhVenue.trim() !== "" ? exhVenue.trim() : null,
          logoUrl: exhApproval === "approved" && exhLogo.trim() !== "" ? exhLogo.trim() : null,
          period: exhStart.trim() !== "" && exhEnd.trim() !== "" ? { startsOn: exhStart, endsOn: exhEnd } : null,
        },
        guidelines: guidelinesUrl.trim() === ""
          ? null
          : { url: guidelinesUrl.trim(), locale: guidelinesLocale, version: guidelinesVersion.trim() || "v1" },
      },
      opensAt: toIso(opensAt),
      closesAt: toIso(closesAt),
      paymentClosesAt: toIso(paymentClosesAt),
      published,
    };

    // Validate + brand client-side before sending; the server validates again.
    const parsed = CompetitionEditSchema.safeParse(raw);
    if (!parsed.success) {
      setBusy(false);
      setError(`입력값을 확인해 주세요: ${parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ")}`);
      return;
    }

    const res =
      mode === "create"
        ? await createCompetition(crypto.randomUUID(), parsed.data)
        : await updateCompetition(initial!.id, initial!.revision, parsed.data);
    setBusy(false);

    if (res.kind === "success") {
      router.push(`/admin/competitions/${res.data.id}`);
      router.refresh();
    } else {
      setError(
        res.kind === "error" && res.code === "REVISION_CONFLICT"
          ? "다른 곳에서 먼저 수정되었습니다. 새로고침 후 최신 내용으로 다시 저장해 주세요."
          : res.kind === "error" && res.code === "VALIDATION_FAILED"
            ? `입력값을 확인해 주세요: ${res.message}`
            : res.kind === "error"
              ? res.message
              : "저장에 실패했습니다.",
      );
    }
  };

  const field = "mt-1 w-full rounded-lg border border-field bg-white px-4 py-2.5 text-[16px] text-ink-strong outline-none focus:border-brand-blue";
  const label = "text-[16px] font-semibold text-ink-strong";

  return (
    <div className="max-w-[52rem]">
      {mode === "edit" && initial && (
        <p className="mb-4 text-[15px] text-ink-strong/70">
          revision {initial.revision} · {initial.draftEnabled ? "접수 열림" : "접수 닫힘"}
        </p>
      )}

      <div className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-6">
        <label className="block">
          <span className={label}>슬러그 (URL, 소문자·하이픈)</span>
          <input className={field} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="leipzig-2027" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={label}>제목 (EN)</span>
            <input className={field} value={titleEn} onChange={(e) => setTitleEn(e.target.value)} />
          </label>
          <label className="block">
            <span className={label}>제목 (KO)</span>
            <input className={field} value={titleKo} onChange={(e) => setTitleKo(e.target.value)} />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={label}>참가비 (EUR, 최소단위 minor. 예: €70 → 7000. 비우면 미정)</span>
            <input className={field} type="number" min={0} value={feeMinor} onChange={(e) => setFeeMinor(e.target.value)} />
          </label>
          <label className="block">
            <span className={label}>시간대 (IANA)</span>
            <input className={field} value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Europe/Berlin" />
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className={label}>접수 시작</span>
            <input className={field} type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
          </label>
          <label className="block">
            <span className={label}>접수 마감</span>
            <input className={field} type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
          </label>
          <label className="block">
            <span className={label}>결제 마감</span>
            <input className={field} type="datetime-local" value={paymentClosesAt} onChange={(e) => setPaymentClosesAt(e.target.value)} />
          </label>
        </div>
        <p className="text-[15px] text-ink-strong/70">일정은 브라우저 로컬 시간으로 입력되어 UTC로 저장됩니다. 참가자에게는 위 공모 시간대로 표시됩니다.</p>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="h-4 w-4 accent-brand-blue" />
          <span className={label}>공개(published)</span>
          <span className="text-[15px] text-ink-strong/70">— 공개는 노출일 뿐, 실제 접수 오픈은 아래 오픈 제어에서 별도입니다.</span>
        </label>
      </div>

      {/* 일정표 (keyDates) — 공개 상세에 노출되는 주요 일정 */}
      <div className="mt-6 rounded-2xl border border-line bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-sans text-[18px] font-bold tracking-[-0.01em] text-ink-strong">일정표</h3>
          <Button size="sm" variant="outline" onClick={() => setKeyDates((k) => [...k, { id: "", en: "", ko: "", timezone: timezone.trim() || "Europe/Berlin", kind: "tbd", date: "", startsOn: "", endsOn: "", at: "" }])}>일정 추가</Button>
        </div>
        <p className="mt-2 text-[15px] text-ink-strong/70">공개 상세 페이지의 일정 안내입니다. 확정 전 항목은 “미정”으로 두면 “준비 중”으로 표시됩니다. 날짜/기간은 위 공모 시간대 기준으로 표시됩니다.</p>
        {keyDates.length === 0 && <p className="mt-3 text-[16px] text-ink-strong/70">등록된 일정이 없습니다.</p>}
        <div className="mt-3 flex flex-col gap-4">
          {keyDates.map((k, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <input className={field} value={k.en} placeholder="일정명 EN (예: Submission opens)" onChange={(e) => setKeyDates((v) => v.map((x, j) => j === i ? { ...x, en: e.target.value } : x))} />
                <input className={field} value={k.ko} placeholder="일정명 KO (예: 접수 시작)" onChange={(e) => setKeyDates((v) => v.map((x, j) => j === i ? { ...x, ko: e.target.value } : x))} />
                <Button size="sm" variant="ghost" onClick={() => setKeyDates((v) => v.filter((_, j) => j !== i))}>삭제</Button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,9rem)_1fr_minmax(0,12rem)]">
                <Select value={k.kind} onChange={(e) => setKeyDates((v) => v.map((x, j) => j === i ? { ...x, kind: e.target.value as KdKind } : x))}>
                  {(Object.keys(KD_KIND_LABEL) as KdKind[]).map((kk) => <option key={kk} value={kk}>{KD_KIND_LABEL[kk]}</option>)}
                </Select>
                <div>
                  {k.kind === "date" && (
                    <input className={field} type="date" value={k.date} onChange={(e) => setKeyDates((v) => v.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} />
                  )}
                  {k.kind === "date_range" && (
                    <div className="grid grid-cols-2 gap-2">
                      <input className={field} type="date" value={k.startsOn} onChange={(e) => setKeyDates((v) => v.map((x, j) => j === i ? { ...x, startsOn: e.target.value } : x))} />
                      <input className={field} type="date" value={k.endsOn} onChange={(e) => setKeyDates((v) => v.map((x, j) => j === i ? { ...x, endsOn: e.target.value } : x))} />
                    </div>
                  )}
                  {k.kind === "instant" && (
                    <input className={field} type="datetime-local" value={k.at} onChange={(e) => setKeyDates((v) => v.map((x, j) => j === i ? { ...x, at: e.target.value } : x))} />
                  )}
                  {k.kind === "tbd" && <span className="text-[15px] text-ink-strong/70">날짜 미정 (준비 중으로 표시)</span>}
                </div>
                <input className={field} value={k.timezone} placeholder="시간대 (IANA)" onChange={(e) => setKeyDates((v) => v.map((x, j) => j === i ? { ...x, timezone: e.target.value } : x))} />
              </div>
              <div className="mt-2">
                <input className={field} value={k.id} placeholder="id (예: submission_opens)" onChange={(e) => setKeyDates((v) => v.map((x, j) => j === i ? { ...x, id: e.target.value } : x))} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 전시 (exhibition) — 공개 상세의 전시 안내 */}
      <div className="mt-6 rounded-2xl border border-line bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-sans text-[18px] font-bold tracking-[-0.01em] text-ink-strong">전시 정보</h3>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={exhOn} onChange={(e) => setExhOn(e.target.checked)} className="h-4 w-4 accent-brand-blue" />
            <span className={label}>전시 정보 포함</span>
          </label>
        </div>
        {exhOn && (
          <div className="mt-3 flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className={label}>승인 상태</span>
                <Select value={exhApproval} onChange={(e) => setExhApproval(e.target.value as "pending" | "approved")} className="mt-1">
                  <option value="pending">미승인 (준비 중)</option>
                  <option value="approved">승인됨</option>
                </Select>
              </label>
              <div />
              <label className="block"><span className={label}>전시명 EN</span><input className={field} value={exhNameEn} onChange={(e) => setExhNameEn(e.target.value)} /></label>
              <label className="block"><span className={label}>전시명 KO</span><input className={field} value={exhNameKo} onChange={(e) => setExhNameKo(e.target.value)} /></label>
              <label className="block"><span className={label}>장소명 {exhApproval !== "approved" && "(승인 후 입력)"}</span>
                <input className={field} value={exhVenue} disabled={exhApproval !== "approved"} onChange={(e) => setExhVenue(e.target.value)} placeholder="예: Klimt Villa" />
              </label>
              <label className="block"><span className={label}>로고 URL (https) {exhApproval !== "approved" && "(승인 후 입력)"}</span>
                <input className={field} value={exhLogo} disabled={exhApproval !== "approved"} onChange={(e) => setExhLogo(e.target.value)} placeholder="https://…" />
              </label>
              <label className="block"><span className={label}>전시 시작일</span><input className={field} type="date" value={exhStart} onChange={(e) => setExhStart(e.target.value)} /></label>
              <label className="block"><span className={label}>전시 종료일</span><input className={field} type="date" value={exhEnd} onChange={(e) => setExhEnd(e.target.value)} /></label>
            </div>
            <p className="text-[15px] text-ink-strong/70">미승인 상태에서는 장소명·로고가 공개되지 않습니다(자동 비공개). 장소 승인 후 “승인됨”으로 바꾸고 장소명·로고를 입력하세요. 기간은 시작·종료를 모두 채워야 저장됩니다.</p>
          </div>
        )}
      </div>

      {/* 부문 (categories) */}
      <div className="mt-6 rounded-2xl border border-line bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-sans text-[18px] font-bold tracking-[-0.01em] text-ink-strong">부문</h3>
          <Button size="sm" variant="outline" onClick={() => setCategories((c) => [...c, { id: "", en: "", ko: "" }])}>부문 추가</Button>
        </div>
        {categories.length === 0 && <p className="mt-3 text-[16px] text-ink-strong/70">부문이 없습니다.</p>}
        <div className="mt-3 flex flex-col gap-3">
          {categories.map((c, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
              <input className={field} value={c.id} placeholder="id (예: picture_book)" onChange={(e) => setCategories((v) => v.map((x, j) => j === i ? { ...x, id: e.target.value } : x))} />
              <input className={field} value={c.en} placeholder="EN" onChange={(e) => setCategories((v) => v.map((x, j) => j === i ? { ...x, en: e.target.value } : x))} />
              <input className={field} value={c.ko} placeholder="KO" onChange={(e) => setCategories((v) => v.map((x, j) => j === i ? { ...x, ko: e.target.value } : x))} />
              <Button size="sm" variant="ghost" onClick={() => setCategories((v) => v.filter((_, j) => j !== i))}>삭제</Button>
            </div>
          ))}
        </div>
      </div>

      {/* 연령 부문 (ageGroups) */}
      <div className="mt-6 rounded-2xl border border-line bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-sans text-[18px] font-bold tracking-[-0.01em] text-ink-strong">연령 부문</h3>
          <Button size="sm" variant="outline" onClick={() => setAgeGroups((a) => [...a, { id: "", en: "", ko: "", min: "", max: "" }])}>연령 추가</Button>
        </div>
        <label className="mt-3 block sm:max-w-xs">
          <span className={label}>나이 기준일 (age reference)</span>
          <input className={field} type="date" value={ageReferenceDate} onChange={(e) => setAgeReferenceDate(e.target.value)} />
          <span className="mt-1 block text-[15px] text-ink-strong/70">이 날짜 기준으로 참가자 나이를 계산해 연령 부문을 판정합니다. 접수 오픈(readiness)에 필요합니다.</span>
        </label>
        {ageGroups.length === 0 && <p className="mt-3 text-[16px] text-ink-strong/70">연령 부문이 없습니다.</p>}
        <div className="mt-3 flex flex-col gap-3">
          {ageGroups.map((a, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_5rem_5rem_auto]">
              <input className={field} value={a.id} placeholder="id" onChange={(e) => setAgeGroups((v) => v.map((x, j) => j === i ? { ...x, id: e.target.value } : x))} />
              <input className={field} value={a.en} placeholder="EN" onChange={(e) => setAgeGroups((v) => v.map((x, j) => j === i ? { ...x, en: e.target.value } : x))} />
              <input className={field} value={a.ko} placeholder="KO" onChange={(e) => setAgeGroups((v) => v.map((x, j) => j === i ? { ...x, ko: e.target.value } : x))} />
              <input className={field} type="number" min={0} value={a.min} placeholder="최소" onChange={(e) => setAgeGroups((v) => v.map((x, j) => j === i ? { ...x, min: e.target.value } : x))} />
              <input className={field} type="number" min={0} value={a.max} placeholder="최대" onChange={(e) => setAgeGroups((v) => v.map((x, j) => j === i ? { ...x, max: e.target.value } : x))} />
              <Button size="sm" variant="ghost" onClick={() => setAgeGroups((v) => v.filter((_, j) => j !== i))}>삭제</Button>
            </div>
          ))}
        </div>
      </div>

      {/* 입력 필드 (formSpec.fields) */}
      <div className="mt-6 rounded-2xl border border-line bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-sans text-[18px] font-bold tracking-[-0.01em] text-ink-strong">입력 필드</h3>
          <Button size="sm" variant="outline" onClick={() => setFields((f) => [...f, { path: FORM_FIELD_PATHS[0], inputType: "text", required: "required" }])}>필드 추가</Button>
        </div>
        {fields.length === 0 && <p className="mt-3 text-[16px] text-ink-strong/70">필드가 없습니다. 참가자가 입력할 항목을 추가하세요.</p>}
        <div className="mt-3 flex flex-col gap-3">
          {fields.map((f, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
              <Select value={f.path} onChange={(e) => setFields((v) => v.map((x, j) => j === i ? { ...x, path: e.target.value } : x))}>
                {FORM_FIELD_PATHS.map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
              <Select value={f.inputType} onChange={(e) => setFields((v) => v.map((x, j) => j === i ? { ...x, inputType: e.target.value } : x))}>
                {INPUT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
              <Select value={f.required} onChange={(e) => setFields((v) => v.map((x, j) => j === i ? { ...x, required: e.target.value as Req } : x))}>
                <option value="required">필수</option>
                <option value="optional">선택</option>
                <option value="unset">미정</option>
              </Select>
              <Button size="sm" variant="ghost" onClick={() => setFields((v) => v.filter((_, j) => j !== i))}>삭제</Button>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[15px] text-ink-strong/70">미정 상태가 남아 있으면 접수를 열 수 없습니다(필수/선택을 지정해야 오픈 가능).</p>
      </div>

      {/* 업로드 규격 (formSpec.uploads) */}
      <div className="mt-6 rounded-2xl border border-line bg-white p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-sans text-[18px] font-bold tracking-[-0.01em] text-ink-strong">업로드 규격</h3>
          <Button size="sm" variant="outline" onClick={() => setUploads((u) => [...u, { purpose: ASSET_PURPOSES[0], required: "required", media: "", maxFiles: "1", maxBytes: "", minPages: "" }])}>업로드 추가</Button>
        </div>
        {uploads.length === 0 && <p className="mt-3 text-[16px] text-ink-strong/70">업로드 규격이 없습니다.</p>}
        <div className="mt-3 flex flex-col gap-4">
          {uploads.map((u, i) => (
            <div key={i} className="rounded-lg border border-line p-4">
              <div className="grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
                <Select value={u.purpose} onChange={(e) => setUploads((v) => v.map((x, j) => j === i ? { ...x, purpose: e.target.value } : x))}>
                  {ASSET_PURPOSES.map((p) => <option key={p} value={p}>{p}</option>)}
                </Select>
                <Select value={u.required} onChange={(e) => setUploads((v) => v.map((x, j) => j === i ? { ...x, required: e.target.value as Req } : x))}>
                  <option value="required">필수</option>
                  <option value="optional">선택</option>
                  <option value="unset">미정</option>
                </Select>
                <Button size="sm" variant="ghost" onClick={() => setUploads((v) => v.filter((_, j) => j !== i))}>삭제</Button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-[3fr_1fr_1fr_1fr]">
                <input className={field} value={u.media} placeholder="허용 형식 (쉼표: image/jpeg, application/pdf)" onChange={(e) => setUploads((v) => v.map((x, j) => j === i ? { ...x, media: e.target.value } : x))} />
                <input className={field} type="number" min={1} value={u.maxFiles} placeholder="최대 개수" onChange={(e) => setUploads((v) => v.map((x, j) => j === i ? { ...x, maxFiles: e.target.value } : x))} />
                <input className={field} type="number" min={1} value={u.maxBytes} placeholder="최대 바이트(선택)" onChange={(e) => setUploads((v) => v.map((x, j) => j === i ? { ...x, maxBytes: e.target.value } : x))} />
                <input className={field} type="number" min={1} value={u.minPages} placeholder="최소 페이지(선택)" onChange={(e) => setUploads((v) => v.map((x, j) => j === i ? { ...x, minPages: e.target.value } : x))} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 요강 (guidelines) */}
      <div className="mt-6 rounded-2xl border border-line bg-white p-6">
        <h3 className="font-sans text-[18px] font-bold tracking-[-0.01em] text-ink-strong">요강 (선택)</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
          <label className="block">
            <span className={label}>URL</span>
            <input className={field} value={guidelinesUrl} onChange={(e) => setGuidelinesUrl(e.target.value)} placeholder="https://…" />
          </label>
          <label className="block">
            <span className={label}>언어</span>
            <Select value={guidelinesLocale} onChange={(e) => setGuidelinesLocale(e.target.value as "en" | "ko")} className="mt-1">
              <option value="en">EN</option>
              <option value="ko">KO</option>
            </Select>
          </label>
          <label className="block">
            <span className={label}>버전</span>
            <input className={field} value={guidelinesVersion} onChange={(e) => setGuidelinesVersion(e.target.value)} placeholder="v1" />
          </label>
        </div>
      </div>

      {mode === "edit" && (
        <p className="mt-4 text-[15px] text-ink-strong/70">
          주요 일정(keyDates)·전시 정보는 이 화면에서 보존됩니다(전용 편집기는 추후). 정책(제출/결제/보관)·동의문·오픈은 별도에서 관리합니다.
        </p>
      )}

      {error && (
        <Message tone="danger" className="mt-4" title="저장 실패">{error}</Message>
      )}

      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button href="/admin/competitions" variant="ghost">목록으로</Button>
        <Button onClick={save} disabled={busy}>{busy ? "저장 중…" : mode === "create" ? "공모 등록" : "변경 저장"}</Button>
      </div>
    </div>
  );
}
