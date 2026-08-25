import type { ReactNode } from "react";
import SiteHeader from "@/components/site/SiteHeader";
import Footer from "@/components/Footer";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div id="top" className="font-body">
      <SiteHeader />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
