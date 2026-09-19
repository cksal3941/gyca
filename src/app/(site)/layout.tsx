import type { ReactNode } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

// Sub-pages share the deployed design's chrome (myslide-reference Header/Footer)
// so the whole site reads as one service. Header is a fixed 70px bar, so content
// is offset by that height. (The home lives at the root route and renders its own
// full-bleed Header without this offset.)
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div id="top" className="font-sans">
      <Header />
      <main className="pt-[70px]">{children}</main>
      <Footer />
    </div>
  );
}
