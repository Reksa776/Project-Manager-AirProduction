import { Reveal } from "@/components/portfolio/Reveal";
import { whatsappBookingUrl, whatsappChatUrl } from "@/lib/portfolio-site";

export function Contact() {
  return (
    <section id="contact" className="px-5 py-24 md:px-10 md:py-36">
      <div className="mx-auto max-w-[1400px]">
        <Reveal>
          <p className="section-label">
            <i aria-hidden="true" />
            Have a story in mind?
          </p>
        </Reveal>

        <div className="mt-8 flex flex-col justify-between gap-10 md:flex-row md:items-end">
          <Reveal delay={60}>
            <h2 className="contact-heading">
              Let’s make
              <br />
              <em>it memorable.</em>
            </h2>
          </Reveal>

          <Reveal delay={130}>
            <div className="contact-side">
              <p>
                Tell us what you’re dreaming of.
                <br />
                We’d love to hear your story.
              </p>

              <div className="contact-actions">
                <a
                  className="booking-button"
                  href={whatsappBookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Book your date via WhatsApp, membuka tab baru"
                >
                  Book your date <span aria-hidden="true">↗</span>
                </a>

                <a
                  className="contact-button"
                  href={whatsappChatUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Chat via WhatsApp <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
