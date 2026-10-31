import Link from "next/link";
import { whatsappChatUrl } from "@/lib/portfolio-site";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer px-5 md:px-10">
      <div className="mx-auto flex max-w-[1600px] flex-col justify-between gap-5 border-t border-white/15 py-7 sm:flex-row sm:items-center">
        <Link href="/" className="footer-brand">
          airproduction<span aria-hidden="true">.</span>
        </Link>

        <p className="footer-copy uppercase">© {year} Airproduction Studio. Made with intention.</p>

        <div className="flex items-center gap-5">
          <a
            href={whatsappChatUrl}
            className="back-top uppercase"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat via WhatsApp, membuka tab baru"
          >
            WhatsApp <span aria-hidden="true">↗</span>
          </a>

          <a href="#top" className="back-top uppercase">
            Back to top ↑
          </a>
        </div>
      </div>
    </footer>
  );
}
