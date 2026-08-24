const SNS = ["INSTAGRAM", "FACEBOOK", "YOUTUBE"];

export default function Footer() {
  return (
    <footer className="bg-black text-white">
      <div className="mx-auto max-w-[1200px] px-6 py-14">
        <div className="flex flex-col justify-between gap-10 md:flex-row md:items-start">
          <div>
            <span className="font-display text-[34px] italic tracking-[-0.5px] text-white">
              GYCA
            </span>
            <p className="mt-4 text-[11px] leading-5 tracking-wide text-neutral-400">
              COPYRIGHT© 2026 GYCA CORP.
              <br />
              ALL RIGHTS RESERVED.
            </p>
          </div>

          <div className="text-[12px] leading-6 text-neutral-400">
            <p>
              Website inquiries ·{" "}
              <a href="#" className="text-neutral-200 hover:text-white">
                admin@gyca.org
              </a>
            </p>
            <p>Address · 1687-6, Seocho-gu, Seoul, Korea</p>
            <p>Business registration · 451-87-01831</p>
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
          Company: GYCA · CEO: Gildong Hong · Business registration no.:
          451-87-01831 · E-commerce permit: 2025-Seoul-Seocho-0000 · Privacy
          officer: admin@gyca.org · Hosting provider: GYCA
        </p>
      </div>
    </footer>
  );
}
