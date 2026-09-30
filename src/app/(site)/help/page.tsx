"use client";

import { useEffect, useState } from "react";
import EditorialHeader from "@/components/site/EditorialHeader";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { NOTICES } from "@/lib/site-data";
import { listEditorialPublic } from "@/lib/api";
import { isLive } from "@/lib/api/mode";
import type { Locale } from "@/lib/i18n";

// Help / 이용안내 (dual-mode). Houses the frequently-asked questions that used
// to live at the bottom of /notices. Live: published editorial content with
// category "faq" (GET /content/editorial?category=faq). Mock: the static FAQ
// samples from site-data. Same accordion UI as before.

type Item = { key: string; title: Record<Locale, string>; body: Record<Locale, string> };

function isFaq(cat: string) {
  return cat === "faq" || cat === "FAQ";
}

function FaqItem({ n, locale }: { n: Item; locale: Locale }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-6 py-6 text-left"
      >
        <span className={`break-keep text-[clamp(20px,2.2vw,26px)] font-bold leading-snug text-ink-strong ${locale === "ko" ? "font-sans tracking-[-0.01em]" : "font-title tracking-[0.02em]"}`}>
          {n.title[locale]}
        </span>
        <span className={`shrink-0 text-[24px] leading-none text-ink-strong transition-transform ${open ? "rotate-45" : ""}`}>+</span>
      </button>
      {open && <p className="max-w-[46rem] pb-7 text-[16px] leading-[1.9] text-ink-strong">{n.body[locale]}</p>}
    </div>
  );
}

export default function HelpPage() {
  const { locale } = useLocale();
  const ko = locale === "ko";
  const [items, setItems] = useState<Item[]>(
    isLive
      ? []
      : NOTICES.filter((n) => isFaq(n.category)).map((n) => ({ key: n.slug, title: n.title, body: n.body })),
  );
  const [loading, setLoading] = useState(isLive);

  useEffect(() => {
    if (!isLive) return;
    let alive = true;
    listEditorialPublic("faq", { limit: 50 }).then((r) => {
      if (!alive) return;
      if (r.kind === "success") {
        setItems(r.data.items.map((e) => ({ key: e.id, title: e.content.title, body: e.content.body })));
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <EditorialHeader
        eyebrow="Help"
        title={ko ? "이용안내" : "Help"}
        description={ko
          ? "GYCA 참가에 대해 자주 묻는 질문을 모았습니다. 원하는 답을 찾지 못했다면 하단의 문의 이메일로 연락해 주세요."
          : "Answers to the questions we hear most about taking part in GYCA. If you can't find what you need, reach us at the contact email in the footer."}
        crumbs={[{ label: ko ? "이용안내" : "Help" }]}
        locale={locale}
      />

      <section className="mx-auto max-w-page px-6 pt-16 pb-12 lg:pt-20">
        <p className="text-[16px] font-bold uppercase tracking-[0.18em] text-brand-blue">FAQ</p>
        <h2 className={`mt-5 break-keep text-[clamp(26px,2.8vw,36px)] font-bold leading-[1.1] text-ink-strong ${ko ? "font-sans tracking-[-0.01em]" : "font-title tracking-[0.02em]"}`}>
          {ko ? "자주 묻는 질문" : "Frequently asked questions"}
        </h2>

        {loading ? (
          <p className="py-24 text-center text-[16px] text-ink-strong">{ko ? "불러오는 중…" : "Loading…"}</p>
        ) : items.length > 0 ? (
          <div className="mt-10 border-t border-line">
            {items.map((n) => <FaqItem key={n.key} n={n} locale={locale} />)}
          </div>
        ) : (
          <p className="py-24 text-center text-[16px] text-ink-strong">
            {ko ? "등록된 질문이 아직 없습니다." : "No questions yet."}
          </p>
        )}
      </section>

      {/* Contact — only the email is a real channel; the rest stay "준비 중"
          (to be announced) in step with the footer until the org details land. */}
      <section className="mx-auto max-w-page px-6 pb-16 lg:pb-24">
        <div className="border-t border-line pt-16 lg:pt-20">
          <p className="text-[16px] font-bold uppercase tracking-[0.18em] text-brand-blue">Contact</p>
          <h2 className={`mt-5 break-keep text-[clamp(26px,2.8vw,36px)] font-bold leading-[1.1] text-ink-strong ${ko ? "font-sans tracking-[-0.01em]" : "font-title tracking-[0.02em]"}`}>
            {ko ? "문의처" : "Get in touch"}
          </h2>
          <p className="mt-4 max-w-[46rem] text-[16px] leading-[1.8] text-ink-strong">
            {ko
              ? "접수·심사·결과 등 궁금한 점은 이메일로 문의해 주세요. 가장 빠르게 답변드립니다."
              : "For questions about entries, judging, or results, email us — that's the fastest way to reach the team."}
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-white p-6">
              <p className="text-[14px] font-bold uppercase tracking-[0.14em] text-brand-blue">Email</p>
              <p className="mt-2 text-[16px] font-semibold text-ink-strong">
                {ko ? "이메일 문의" : "Email inquiries"}
              </p>
              <a
                href="mailto:admin@gyca.org"
                className="mt-1 inline-block text-[18px] font-semibold text-ink-strong underline-offset-2 hover:text-brand-blue hover:underline"
              >
                admin@gyca.org
              </a>
            </div>
            <div className="rounded-2xl border border-line bg-white p-6">
              <p className="text-[14px] font-bold uppercase tracking-[0.14em] text-brand-blue">Phone &amp; address</p>
              <p className="mt-2 text-[16px] font-semibold text-ink-strong">
                {ko ? "전화·주소" : "Phone & address"}
              </p>
              <p className="mt-1 text-[16px] text-ink-strong">
                {ko ? "준비 중 (추후 안내)" : "To be announced"}
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
