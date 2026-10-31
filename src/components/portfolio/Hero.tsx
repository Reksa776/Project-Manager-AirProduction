export function Hero() {
  return (
    <section
      id="home"
      className="hero relative flex min-h-[100svh] items-center justify-center overflow-hidden px-5"
    >
      <div className="hero-grain" aria-hidden="true" />
      <div className="hero-orbit orbit-one" aria-hidden="true" />
      <div className="hero-orbit orbit-two" aria-hidden="true" />

      <div className="hero-content relative z-10 w-full text-center">
        <p className="hero-kicker">Cinematic film &amp; photography</p>
        <h1 className="hero-title">
          airproduction<span>.</span>
        </h1>
        <p className="hero-subtitle">Stories, thoughtfully captured.</p>
      </div>

      <div className="hero-bottom absolute inset-x-5 bottom-7 z-10 flex items-end justify-between md:inset-x-10 md:bottom-10">
        <span className="micro-copy hidden uppercase sm:block">
          Creating with feeling
          <br />
          Indonesia · Worldwide
        </span>

        <a
          href="#about"
          className="scroll-cue mx-auto uppercase sm:mx-0"
          aria-label="Gulir ke bagian tentang studio"
        >
          <span className="scroll-line" aria-hidden="true" />
          <span>Scroll to discover</span>
        </a>

        <span className="micro-copy hidden text-right uppercase sm:block">
          Est. with intention
          <br />© Airproduction
        </span>
      </div>
    </section>
  );
}
