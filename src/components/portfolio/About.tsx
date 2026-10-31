import { Reveal } from "@/components/portfolio/Reveal";

export function About() {
  return (
    <section id="about" className="about-section px-5 py-24 md:px-10 md:py-40">
      <div className="mx-auto grid max-w-[1400px] gap-10 md:grid-cols-12 md:gap-8">
        <Reveal className="md:col-span-4">
          <p className="section-label">
            <i aria-hidden="true" />A little about us
          </p>
        </Reveal>

        <div className="md:col-span-8">
          <Reveal>
            <h2 className="about-heading">
              We turn fleeting moments
              <br />
              into <em>everlasting</em> stories.
            </h2>
          </Reveal>

          <div className="mt-10 grid gap-8 sm:grid-cols-2">
            <Reveal delay={80}>
              <p className="body-copy">
                Airproduction adalah studio kreatif yang mengabadikan cerita lewat film dan fotografi.
                Kami percaya karya yang berkesan bukan cuma tentang apa yang terlihat, tapi juga
                suasana, detail kecil, dan perasaan yang hadir di dalamnya.
              </p>
            </Reveal>

            <Reveal delay={150}>
              <p className="body-copy">
                Dari wedding film hingga momen-momen di antaranya, kami merangkai visual yang jujur,
                sinematik, dan personal — untuk dirasakan hari ini, lalu dikenang bertahun-tahun ke
                depan.
              </p>
            </Reveal>
          </div>

          <Reveal className="mt-10" delay={200}>
            <a href="#portfolio" className="text-link">
              Discover our work <span aria-hidden="true">↘</span>
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
