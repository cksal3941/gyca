const SNS = ["INSTAGRAM", "FACEBOOK", "YOUTUBE"];

export default function Footer() {
  return (
    <footer className="bg-black text-white">
      <div className="mx-auto max-w-[1200px] px-6 py-14">
        <div className="flex flex-col justify-between gap-10 md:flex-row md:items-start">
          <div>
            <span className="font-display text-[34px] italic tracking-[-0.5px] text-white">
              MYSLIDE
            </span>
            <p className="mt-4 text-[11px] leading-5 tracking-wide text-neutral-400">
              COPYRIGHT© 2026 MYSLIDE CORP.
              <br />
              ALL RIGHTS RESERVED.
            </p>
          </div>

          <div className="text-[12px] leading-6 text-neutral-400">
            <p>
              홈페이지 시스템 관련 문의 ·{" "}
              <a href="#" className="text-neutral-200 hover:text-white">
                admin@myslide.org
              </a>
            </p>
            <p>주소 · 서울 서초구 1687-6</p>
            <p>사업자등록 / 통신판매업 · 451-87-01831</p>
            <div className="mt-5 flex gap-5">
              {SNS.map((s) => (
                <a
                  key={s}
                  href="#"
                  className="text-[12px] font-medium tracking-wide text-neutral-300 hover:text-white"
                >
                  {s}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto max-w-[1200px] px-6 py-5 text-[11px] leading-5 text-neutral-500">
          상호명: 마이슬라이드(MySLide) · 대표자: 홍길동 · 사업자등록번호:
          451-87-01831 · 통신판매업신고: 2025-서울서초-0000 · 개인정보관리책임자:
          admin@myslide.org · 호스팅 제공자: 마이슬라이드
        </p>
      </div>
    </footer>
  );
}
