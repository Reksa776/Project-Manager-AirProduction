"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PortfolioPhoto } from "@/lib/portfolio";

type ProjectGalleryProps = {
  photos: PortfolioPhoto[];
  title: string;
};

export function ProjectGallery({ photos, title }: ProjectGalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const isOpen = openIndex !== null;

  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => {
    setOpenIndex(null);
    triggerRef.current?.focus();
    triggerRef.current = null;
  }, []);

  const step = useCallback(
    (direction: 1 | -1) => {
      setOpenIndex((current) =>
        current === null ? current : (current + direction + photos.length) % photos.length,
      );
    },
    [photos.length],
  );

  useEffect(() => {
    if (!isOpen) return;

    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
        return;
      }

      if (event.key !== "Tab") return;

      // Keep Tab inside the dialog: close, previous, next.
      const focusables = Array.from(
        dialogRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [],
      );
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      root.style.overflow = previousOverflow;
    };
  }, [close, isOpen, step]);

  const activePhoto = openIndex === null ? null : photos[openIndex];

  return (
    <>
      <div className="project-gallery">
        {photos.map((photo, index) => (
          <button
            key={`${photo.src}-${index}`}
            type="button"
            className="gallery-item"
            onClick={(event) => {
              triggerRef.current = event.currentTarget;
              setOpenIndex(index);
            }}
            aria-label={`Buka foto ${index + 1} dari ${photos.length}: ${photo.alt}`}
          >
            <Image
              src={photo.src}
              alt=""
              fill
              sizes="(max-width: 768px) 50vw, 45vw"
              className="object-cover"
            />
            <span className="gallery-item-index" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
          </button>
        ))}
      </div>

      {activePhoto && isOpen ? (
        <div
          ref={dialogRef}
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Galeri foto ${title}`}
        >
          <div className="lightbox-topbar">
            <span className="lightbox-count">
              {String((openIndex ?? 0) + 1).padStart(2, "0")} /{" "}
              {String(photos.length).padStart(2, "0")}
            </span>
            <button
              ref={closeButtonRef}
              type="button"
              className="lightbox-close"
              onClick={close}
              aria-label="Tutup galeri"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>

          <div className="lightbox-stage">
            <div className="lightbox-figure">
              <Image
                src={activePhoto.src}
                alt=""
                fill
                sizes="100vw"
                className="object-contain"
              />
            </div>
          </div>

          <p className="lightbox-caption">{activePhoto.alt}</p>

          <div className="lightbox-controls">
            <button
              type="button"
              className="lightbox-nav"
              onClick={() => step(-1)}
              aria-label="Foto sebelumnya"
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              className="lightbox-nav"
              onClick={() => step(1)}
              aria-label="Foto berikutnya"
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
