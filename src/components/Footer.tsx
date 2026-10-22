import Logo from "./Logo";

// GYCA's own social channels. Icons are Simple Icons (CC0), self-hosted and
// recolored via CSS mask. A channel with `href` links out; others stay as
// "coming soon" placeholders until the official channels open.
const SNS: { label: string; icon: string; href?: string }[] = [
  { label: "Instagram", icon: "/images/instagram.svg", href: "https://www.instagram.com/gyca.official" },
  { label: "Facebook", icon: "/images/facebook.svg" },
  { label: "YouTube", icon: "/images/youtube.svg" },
];

export default function Footer() {
  return (
    <footer className="bg-black text-white">
      <div className="mx-auto max-w-page px-6 py-14">
        <div className="flex flex-col justify-between gap-10 md:flex-row md:items-start">
          <div>
            <Logo variant="light" />
            <p className="mt-4 text-[16px] leading-5 tracking-wide text-white">
              COPYRIGHT© 2026 GYCA.
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
            <p>
              Address · 서울 서초구 서초중앙로33길 7, 2층 201호
            </p>
            <p>Business registration · 454-25-02305</p>
            <p className="mt-3">
              <a href="/privacy" className="text-white underline-offset-2 hover:underline">
                Privacy Policy
              </a>
              {" · "}
              <a href="/terms" className="text-white underline-offset-2 hover:underline">
                Terms of Service
              </a>
            </p>
            {/* Social channels — placeholders until the official channels open. */}
            <div className="mt-5 flex items-center gap-4">
              {SNS.map((s) => {
                const glyph = (
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
                );
                return s.href ? (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    title={s.label}
                    className="text-white transition-opacity hover:opacity-80"
                  >
                    {glyph}
                  </a>
                ) : (
                  <span
                    key={s.label}
                    aria-label={`${s.label} · 준비 중`}
                    title={`${s.label} · 준비 중 (coming soon)`}
                    className="text-white/70"
                  >
                    {glyph}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto max-w-page px-6 py-5 text-[16px] leading-5 text-white">
          Company: 글로벌 영 크리에이트 어워드 (GYCA) · CEO: 구민영 · Business
          registration no.: 454-25-02305 · E-commerce permit: 준비 중 · Privacy
          officer: admin@gyca.org · Hosting provider: Google Cloud
        </p>
      </div>
    </footer>
  );
}
