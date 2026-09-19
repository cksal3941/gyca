// GYCA's own social channels. Icons are Simple Icons (CC0), self-hosted and
// recolored via CSS mask. Links point to the official channels once available.
const SNS = [
  { label: "Instagram", icon: "/images/icons/instagram.svg" },
  { label: "Facebook", icon: "/images/icons/facebook.svg" },
  { label: "YouTube", icon: "/images/icons/youtube.svg" },
];

export default function Footer() {
  return (
    <footer className="bg-black text-white">
      <div className="mx-auto max-w-page px-6 py-14">
        <div className="flex flex-col justify-between gap-10 md:flex-row md:items-start">
          <div>
            <span className="font-display text-[34px] italic tracking-[-0.5px] text-white">
              GYCA
            </span>
            <p className="mt-4 text-[16px] leading-5 tracking-wide text-white">
              COPYRIGHT© 2026 GYCA CORP.
              <br />
              ALL RIGHTS RESERVED.
            </p>
          </div>

          <div className="text-[16px] leading-6 text-white">
            <p>
              Website inquiries ·{" "}
              <a href="mailto:admin@gyca.org" className="text-white underline-offset-2 hover:underline">
                admin@gyca.org
              </a>
            </p>
            <p>Address · 준비 중 (To be announced)</p>
            <p>Business registration · 준비 중</p>
            {/* Social channels — placeholders until the official channels open. */}
            <div className="mt-5 flex items-center gap-4">
              {SNS.map((s) => (
                <span
                  key={s.label}
                  aria-label={`${s.label} · 준비 중`}
                  title={`${s.label} · 준비 중 (coming soon)`}
                  className="text-white/70"
                >
                  <span
                    aria-hidden
                    className="block h-6 w-6 bg-current"
                    style={{
                      maskImage: `url(${s.icon})`,
                      WebkitMaskImage: `url(${s.icon})`,
                      maskRepeat: "no-repeat",
                      WebkitMaskRepeat: "no-repeat",
                      maskPosition: "center",
                      WebkitMaskPosition: "center",
                      maskSize: "contain",
                      WebkitMaskSize: "contain",
                    }}
                  />
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto max-w-page px-6 py-5 text-[16px] leading-5 text-white">
          Company: GYCA · CEO: 준비 중 · Business registration no.: 준비 중 ·
          E-commerce permit: 준비 중 · Privacy officer: admin@gyca.org · Hosting
          provider: 준비 중
          <span className="ml-1 text-white/70">(사업자 정보 준비 중 · business details to be confirmed)</span>
        </p>
      </div>
    </footer>
  );
}
