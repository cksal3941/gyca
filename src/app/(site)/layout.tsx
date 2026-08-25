import type { ReactNode } from "react";
import SiteHeader from "@/components/site/SiteHeader";
import Footer from "@/components/Footer";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div id="top" className="font-body">
      <SiteHeader />
      {/* Offset for the fixed 72px header */}
      <main className="pt-[72px]">{children}</main>
      <Footer />
    </div>
  );
}
