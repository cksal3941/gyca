import Header from "@/components/Header";
import Hero from "@/components/Hero";
import EventSlider from "@/components/EventSlider";
import Marquee from "@/components/Marquee";
import DarkProjects from "@/components/DarkProjects";
import PartnerMarquee from "@/components/PartnerMarquee";
import MediaUpdate from "@/components/MediaUpdate";
import NewsUpdate from "@/components/NewsUpdate";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div id="top">
      <Header />
      <main>
        <Hero />
        <EventSlider />
        <Marquee />
        <DarkProjects />
        <PartnerMarquee />
        <MediaUpdate />
        <NewsUpdate />
      </main>
      <Footer />
    </div>
  );
}
