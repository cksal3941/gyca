import type { ReactNode } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

// Sub-pages share the deployed design's chrome (myslide-reference Header/Footer)
// so the whole site reads as one service. Header is a fixed 70px bar, so content
// is offset by that height. (The home lives at the root route and renders its own
// full-bleed Header without this offset.)
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div id="top" className="flex min-h-screen flex-col font-sans">
      <Header />
      <main className="flex-1 pt-[70px] pb-16">{children}</main>
      <Footer />
    </div>
  );
}
