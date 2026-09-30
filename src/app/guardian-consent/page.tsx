"use client";

import { useEffect, useState } from "react";
import { previewGuardianConsent, acceptGuardianConsent, type GuardianPreview } from "@/lib/api";
import { isLive } from "@/lib/api/mode";

// Guardian consent page. The email link is /guardian-consent#<token> — the token
// lives in the URL fragment (never sent to the server as a query) and is posted
// in the request body. No login: the token is the authorization. This page only
// records the guardian's consent; the operator still verifies identity after.

type Phase = "loading" | "invalid" | "unavailable" | "error" | "ready" | "done";

// The consent docs come back in the request's locale; use it for UI chrome too.
function labels(loc: "en" | "ko") {
  const ko = loc === "ko";
  return {
    title: ko ? "보호자 동의" : "Guardian consent",
    intro: ko
      ? "참가자의 보호자인 경우에만 아래 내용을 확인하고 동의해 주세요."
      : "Please review and confirm the following only if you are the participant's guardian.",
    name: ko ? "보호자 성함" : "Guardian's full name",
    agreeAll: ko ? "위 3개 항목을 모두 확인했으며 동의합니다." : "I have reviewed and agree to all three items above.",
    submit: ko ? "동의합니다" : "I agree",
    submitting: ko ? "처리 중…" : "Submitting…",
    invalid: ko ? "링크가 유효하지 않거나 만료되었습니다. 참가자에게 재요청을 부탁하세요." : "This link is invalid or has expired. Please ask the participant to resend it.",
    unavailable: ko ? "보호자 동의 기능이 아직 활성화되지 않았습니다." : "Guardian consent is not enabled yet.",
    error: ko ? "문제가 발생했습니다. 잠시 후 다시 시도해 주세요." : "Something went wrong. Please try again shortly.",
    done: ko ? "동의가 접수되었습니다. 운영자 확인 후 처리됩니다. 이 창은 닫으셔도 됩니다." : "Your consent has been recorded. The organizer will confirm it. You may close this window.",
    needName: ko ? "보호자 성함을 입력해 주세요." : "Please enter the guardian's name.",
    needAgree: ko ? "동의 확인란을 체크해 주세요." : "Please check the agreement box.",
  };
}

export default function GuardianConsentPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [preview, setPreview] = useState<GuardianPreview | null>(null);
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loc: "en" | "ko" = (preview?.documents[0]?.locale as "en" | "ko") ?? "ko";
  const t = labels(loc);

  useEffect(() => {
    let alive = true;
    // The token lives in the URL fragment, only readable on the client after
    // mount — so the read + all state updates happen inside this async flow.
    void (async () => {
      if (!isLive) { if (alive) setPhase("unavailable"); return; }
      const raw = window.location.hash.replace(/^#/, "").trim();
      if (!/^[a-f0-9]{64}$/.test(raw)) { if (alive) setPhase("invalid"); return; }
      if (alive) setToken(raw);
      const r = await previewGuardianConsent(raw);
      if (!alive) return;
      if (r.kind === "success") { setPreview(r.data); setPhase("ready"); }
      else if (r.kind === "error" && (r.code === "POLICY_NOT_CONFIGURED" || r.code === "NOT_CONNECTED")) setPhase("unavailable");
      else if (r.kind === "error" && (r.code === "NOT_FOUND" || r.code === "CONSENT_REQUIRED")) setPhase("invalid");
      else setPhase("error");
    })();
    return () => { alive = false; };
  }, []);

  const submit = async () => {
    setFormError(null);
    if (name.trim() === "") { setFormError(t.needName); return; }
    if (!agree) { setFormError(t.needAgree); return; }
    setBusy(true);
    const r = await acceptGuardianConsent({ token, guardianName: name.trim() });
    setBusy(false);
    if (r.kind === "success") setPhase("done");
    else if (r.kind === "error" && (r.code === "NOT_FOUND" || r.code === "CONSENT_REQUIRED")) setPhase("invalid");
    else setFormError(r.kind === "error" ? r.message : t.error);
  };

  const shell = (children: React.ReactNode) => (
    <main className="mx-auto flex min-h-screen max-w-[46rem] flex-col justify-center px-6 py-16">{children}</main>
  );

  if (phase === "loading") return shell(<p className="text-[16px] text-ink-strong">불러오는 중… / Loading…</p>);
  if (phase === "invalid") return shell(<div className="rounded-2xl border border-line bg-white p-8"><p className="text-[16px] text-ink-strong">{t.invalid}</p></div>);
  if (phase === "unavailable") return shell(<div className="rounded-2xl border border-line bg-white p-8"><p className="text-[16px] text-ink-strong">{t.unavailable}</p></div>);
  if (phase === "error") return shell(<div className="rounded-2xl border border-line bg-white p-8"><p className="text-[16px] text-ink-strong">{t.error}</p></div>);
  if (phase === "done") return shell(<div className="rounded-2xl border border-line bg-white p-8"><p className="text-[16px] text-ink-strong">{t.done}</p></div>);

  const docs = preview?.documents ?? [];
  return shell(
    <div className="rounded-2xl border border-line bg-white p-8">
      <h1 className={`text-[clamp(24px,3vw,32px)] font-bold text-ink-strong ${loc === "ko" ? "font-sans tracking-[-0.01em]" : "font-title"}`}>{t.title}</h1>
      <p className="mt-3 text-[16px] leading-[1.7] text-ink-strong">{t.intro}</p>

      <div className="mt-6 flex flex-col gap-4">
        {docs.map((d, i) => (
          <details key={i} className="rounded-xl border border-line bg-surface p-4" open={i === 0}>
            <summary className="cursor-pointer text-[16px] font-semibold text-ink-strong">{d.title} <span className="text-[14px] font-normal text-ink-strong/60">v{d.version}</span></summary>
            <p className="mt-3 max-h-64 overflow-auto whitespace-pre-line text-[15px] leading-[1.8] text-ink-strong">{d.text}</p>
          </details>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <label className="block">
          <span className="text-[16px] font-semibold text-ink-strong">{t.name}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-field bg-white px-4 py-2.5 text-[16px] text-ink-strong outline-none focus:border-brand-blue" />
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-1 h-4 w-4 accent-brand-blue" />
          <span className="text-[16px] text-ink-strong">{t.agreeAll}</span>
        </label>
        {formError && <p className="text-[15px] text-danger">{formError}</p>}
        <button onClick={submit} disabled={busy} className="w-fit rounded-[7px] bg-black px-7 py-3 text-[15px] font-semibold text-white hover:opacity-90 disabled:opacity-60">
          {busy ? t.submitting : t.submit}
        </button>
      </div>
    </div>
  );
}
