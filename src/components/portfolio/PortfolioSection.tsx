import { PortfolioCarousel } from "@/components/portfolio/PortfolioCarousel";
import { Reveal } from "@/components/portfolio/Reveal";

export function PortfolioSection() {
  return (
    <section id="portfolio" className="px-5 pb-24 pt-4 md:px-10 md:pb-36 md:pt-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-10 flex flex-col justify-between gap-6 md:mb-14 md:flex-row md:items-end">
          <div>
            <Reveal>
              <p className="section-label">
                <i aria-hidden="true" />
                Selected stories
              </p>
            </Reveal>
            <Reveal className="mt-5" delay={70}>
              <h2 className="portfolio-heading">
                A few moments
                <br />
                <em>we keep close.</em>
              </h2>
            </Reveal>
          </div>

          <Reveal delay={140}>
            <p className="body-copy">
              Setiap cerita punya ritmenya sendiri.
              <br />
              Kami membantu menjaganya tetap hidup.
            </p>
          </Reveal>
        </div>

        <PortfolioCarousel />
      </div>
    </section>
  );
}
