import LandingHeader from "@/components/landing/LandingHeader";
import LandingHero from "@/components/landing/LandingHero";
import FeaturedAwards from "@/components/landing/FeaturedAwards";
import ProcessSteps from "@/components/landing/ProcessSteps";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div id="top" className="font-body">
      <LandingHeader />
      <main>
        <LandingHero />
        <FeaturedAwards />
        <ProcessSteps />
      </main>
      <Footer />
    </div>
  );
}
