import Header from "@/components/Header";
import Hero from "@/components/Hero";
import EventSlider from "@/components/EventSlider";
import Marquee from "@/components/Marquee";
import DarkProjects from "@/components/DarkProjects";
import PartnerMarquee from "@/components/PartnerMarquee";
import MediaUpdate from "@/components/MediaUpdate";
import NewsUpdate from "@/components/NewsUpdate";
import Footer from "@/components/Footer";
import { getServerLocale } from "@/lib/i18n/server";

// Home keeps the deployed design but sources its promo from the single source of
// truth: the open (recruiting) contests in site-data. Hero + EventSlider headline
// the active contest (currently VIYBA 2026) with real detail/apply links; when the
// next contest opens, updating site-data is enough. DarkProjects shows completed
// archive work; detailed schedule/fee content lives on each contest's detail page.
export default async function Home() {
  const locale = await getServerLocale();
  return (
    <div id="top">
      <Header />
      <main>
        <Hero />
        <EventSlider />
        <Marquee />
        <DarkProjects locale={locale} />
        <PartnerMarquee />
        <MediaUpdate locale={locale} />
        <NewsUpdate locale={locale} />
      </main>
      <Footer />
    </div>
  );
}
