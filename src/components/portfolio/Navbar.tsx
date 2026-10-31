"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { whatsappBookingUrl } from "@/lib/portfolio-site";

const navLinks = [
  { href: "#about", label: "Studio" },
  { href: "#portfolio", label: "Portfolio" },
  { href: "#contact", label: "Contact" },
];

export function Navbar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Section anchors only exist on the home page; elsewhere they need a path.
  const isHome = pathname === "/";
  const sectionHref = (hash: string) => (isHome ? hash : `/${hash}`);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) return;

    const desktopQuery = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (desktopQuery.matches) setIsMenuOpen(false);
    };

    desktopQuery.addEventListener("change", onChange);
    return () => desktopQuery.removeEventListener("change", onChange);
  }, [isMenuOpen]);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className={`site-header fixed inset-x-0 top-0 z-40 px-5 md:px-10${isScrolled ? " is-scrolled" : ""}`}>
      <div className="mx-auto flex h-[76px] max-w-[1600px] items-center justify-between border-b border-ink/10">
        <a href={isHome ? "#home" : "/"} className="brand" aria-label="airproduction — kembali ke atas">
          airproduction<span aria-hidden="true">.</span>
        </a>

        <nav className="hidden items-center gap-9 md:flex" aria-label="Navigasi utama">
          {navLinks.map((link) => (
            <a key={link.href} href={sectionHref(link.href)} className="nav-link">
              {link.label}
            </a>
          ))}
        </nav>

        <a
          href={whatsappBookingUrl}
          className="header-cta hidden md:inline-flex"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Book now via WhatsApp, membuka tab baru"
        >
          Book now <span aria-hidden="true">↗</span>
        </a>

        <button
          type="button"
          className={`menu-toggle md:hidden${isMenuOpen ? " active" : ""}`}
          aria-label={isMenuOpen ? "Tutup menu" : "Buka menu"}
          aria-expanded={isMenuOpen}
          aria-controls="mobile-menu"
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
      </div>

      <div id="mobile-menu" className={`mobile-menu md:hidden${isMenuOpen ? " open" : ""}`}>
        {navLinks.map((link) => (
          <a
            key={link.href}
            href={sectionHref(link.href)}
            onClick={closeMenu}
            tabIndex={isMenuOpen ? 0 : -1}
          >
            {link.label}
          </a>
        ))}

        <a
          href={whatsappBookingUrl}
          className="header-cta mt-4 inline-flex self-start"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Book now via WhatsApp, membuka tab baru"
          onClick={closeMenu}
          tabIndex={isMenuOpen ? 0 : -1}
        >
          Book now <span aria-hidden="true">↗</span>
        </a>
      </div>
    </header>
  );
}
