import Link from "next/link";
import PageHeader from "@/components/site/PageHeader";
import { ArrowRight } from "@/components/landing/icons";

const MEDIA_TABS = ["이미지", "영상", "PDF", "음원"] as const;

const CRITERIA = [
  { id: "creativity", label: "창의성" },
  { id: "understanding", label: "주제 이해" },
  { id: "expression", label: "표현력" },
  { id: "completeness", label: "완성도" },
  { id: "potential", label: "발전 가능성" },
] as const;

export default async function JudgeReview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <PageHeader
        title={`작품 심사 · ${id}`}
        crumbs={[
          { label: "심사위원", href: "/judge" },
          { label: "심사" },
        ]}
      />

      <section className="mx-auto max-w-shell px-6 py-12">
        <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
          {/* LEFT — 작품 미리보기 */}
          <div className="min-w-0">
            <div
              className="flex h-[360px] w-full items-center justify-center rounded-2xl border border-line text-[14px] font-semibold text-neutral-500"
              style={{
                backgroundImage: "linear-gradient(135deg,#a8dcd0,#8fb6f0)",
              }}
              role="img"
              aria-label="작품 미리보기"
            >
              작품 미리보기
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {MEDIA_TABS.map((t, i) => (
                <span
                  key={t}
                  className={`rounded-full border px-4 py-2 text-[13px] font-medium ${
                    i === 0
                      ? "border-brand-blue bg-brand-blue text-white"
                      : "border-line text-ink"
                  }`}
                >
                  {t}
                </span>
              ))}
            </div>

            <h2 className="mt-6 font-serif text-[22px] font-bold text-ink-strong">
              무제 (Untitled)
            </h2>
            <p className="mt-3 text-[15px] leading-[1.7] text-neutral-500">
              작품 설명이 이곳에 표시됩니다. 창작 의도, 사용한 매체, 작업 과정 등
              참가자가 제출한 설명을 검토한 뒤 심사를 진행하세요. 공정성을 위해
              참가자 식별정보는 표시되지 않습니다.
            </p>
          </div>

          {/* RIGHT — 평가 폼 */}
          <aside>
            <div className="rounded-2xl border border-line bg-white p-6">
              <h3 className="font-serif text-[18px] font-bold text-ink-strong">
                평가 항목
              </h3>

              <div className="mt-5 flex flex-col gap-5">
                {CRITERIA.map((c) => (
                  <label key={c.id} className="block">
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-semibold text-ink-strong">
                        {c.label}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        defaultValue={0}
                        className="w-20 rounded-lg border border-line bg-canvas px-3 py-1.5 text-right text-[14px] text-ink-strong outline-none focus:border-brand-blue"
                      />
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      defaultValue={0}
                      className="mt-2 w-full accent-brand-blue"
                    />
                  </label>
                ))}
              </div>

              <label className="mt-6 block">
                <span className="text-[14px] font-semibold text-ink-strong">
                  심사평
                </span>
                <textarea
                  rows={5}
                  placeholder="작품에 대한 평가와 피드백을 작성하세요."
                  className="mt-2 w-full resize-none rounded-lg border border-line bg-canvas px-4 py-3 text-[14px] leading-[1.6] text-ink-strong outline-none focus:border-brand-blue"
                />
              </label>

              <p className="mt-4 text-[12px] text-neutral-500">
                ‘심사 완료’ 제출 후에는 점수 수정이 제한됩니다.
              </p>
            </div>
          </aside>
        </div>

        {/* Bottom action bar */}
        <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-line pt-6">
          <Link
            href="/judge"
            className="inline-flex items-center rounded-lg border border-line px-4 py-2.5 text-[14px] font-semibold text-ink-strong hover:border-brand-blue hover:text-brand-blue"
          >
            이전 작품
          </Link>
          <button
            type="button"
            className="inline-flex items-center rounded-lg border border-line px-4 py-2.5 text-[14px] font-semibold text-ink-strong hover:border-brand-blue hover:text-brand-blue"
          >
            임시저장
          </button>
          <button
            type="button"
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-5 py-2.5 text-[14px] font-semibold text-white hover:-translate-y-0.5"
          >
            심사 완료
            <ArrowRight size={16} />
          </button>
          <Link
            href="/judge"
            className="inline-flex items-center rounded-lg border border-line px-4 py-2.5 text-[14px] font-semibold text-ink-strong hover:border-brand-blue hover:text-brand-blue"
          >
            다음 작품
          </Link>
        </div>
      </section>
    </>
  );
}
