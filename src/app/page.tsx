import Header from "@/components/Header";
import Hero from "@/components/Hero";
import EventSlider from "@/components/EventSlider";
import Marquee from "@/components/Marquee";
import DarkProjects from "@/components/DarkProjects";
import PartnerMarquee from "@/components/PartnerMarquee";
import MediaUpdate from "@/components/MediaUpdate";
import NewsUpdate from "@/components/NewsUpdate";
import Footer from "@/components/Footer";
import ApplyCta from "@/components/home/ApplyCta";
import { getServerLocale } from "@/lib/i18n/server";

// Home keeps the deployed design intact. The Hero slides already tell the Leipzig
// 2027 story (award → certificate → finalists go to Leipzig) and DarkProjects shows
// the completed Klimt Villa work. The only addition is a single closing Apply CTA
// band; the detailed benefits/journey/schedule/fee content lives on the Leipzig
// detail page, not the home (per user: those read as sub-page content).
export default async function Home() {
  const locale = await getServerLocale();
  return (
    <div id="top">
      <Header />
      <main>
        <Hero />
        <EventSlider />
        <Marquee locale={locale} />
        <DarkProjects locale={locale} />
        <PartnerMarquee locale={locale} />
        <MediaUpdate locale={locale} />
        <NewsUpdate locale={locale} />
        <ApplyCta locale={locale} />
      </main>
      <Footer />
    </div>
  );
}
