import { Reveal } from "@/components/portfolio/Reveal";

export function Manifesto() {
  return (
    <section className="manifesto-section relative overflow-hidden px-5 py-24 md:px-10 md:py-36">
      <div className="manifesto-ring" aria-hidden="true" />

      <div className="relative z-10 mx-auto max-w-5xl text-center">
        <Reveal>
          <p className="section-label justify-center">
            <i aria-hidden="true" />Our point of view
          </p>
        </Reveal>

        <Reveal delay={80}>
          <h2 className="manifesto-heading">
            “The best stories aren’t just seen.
            <br />
            They’re <em>felt.</em>”
          </h2>
        </Reveal>

        <Reveal delay={150}>
          <p className="manifesto-caption uppercase">
            Honest moments. Timeless frames. Meaningful stories.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
