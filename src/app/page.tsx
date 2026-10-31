import type { Metadata } from "next";
import { About } from "@/components/portfolio/About";
import { Contact } from "@/components/portfolio/Contact";
import { Footer } from "@/components/portfolio/Footer";
import { Hero } from "@/components/portfolio/Hero";
import { Manifesto } from "@/components/portfolio/Manifesto";
import { Navbar } from "@/components/portfolio/Navbar";
import { PortfolioSection } from "@/components/portfolio/PortfolioSection";
import { Preloader } from "@/components/portfolio/Preloader";

export const metadata: Metadata = {
  title: "airproduction. — Stories, thoughtfully captured",
  description:
    "Airproduction adalah studio kreatif yang mengabadikan cerita lewat film dan fotografi. Cinematic film & photography, based in Indonesia and working worldwide.",
};

export default function Home() {
  return (
    <div id="top" className="portfolio-site">
      <noscript>
        <style>{`.portfolio-site .preloader{display:none!important}.portfolio-site .reveal{opacity:1!important;transform:none!important}`}</style>
      </noscript>
      <Preloader />
      <a className="skip-link" href="#main">Lewati ke konten</a>
      <Navbar />
      <main id="main">
        <Hero />
        <About />
        <PortfolioSection />
        <Manifesto />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
