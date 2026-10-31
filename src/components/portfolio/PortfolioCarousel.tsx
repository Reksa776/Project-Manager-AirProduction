"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { portfolioItems } from "@/lib/portfolio";

type DragState = {
  pointerId: number;
  startX: number;
  startOffset: number;
};

const total = portfolioItems.length;
/** Three copies give the track enough runway to animate into a copy even on wide screens. */
const slides = [...portfolioItems, ...portfolioItems, ...portfolioItems];
const AUTOPLAY_MS = 3500;
/** Keep in sync with the transform transition in globals.css (.7s). */
const TRANSITION_MS = 720;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getReducedMotion() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function PortfolioCarousel() {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const dragMovedRef = useRef(false);
  const detachDragRef = useRef<(() => void) | null>(null);
  const offsetRef = useRef(0);
  const setWidthRef = useRef(0);
  const snapTimerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const moveRef = useRef<(direction: 1 | -1) => void>(() => {});

  const [offset, setOffset] = useState(0);
  const [setWidth, setSetWidth] = useState(0);
  const [canScroll, setCanScroll] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const reduceMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotion,
    () => false,
  );

  const applyOffset = useCallback((value: number) => {
    offsetRef.current = value;
    setOffset(value);
  }, []);

  const clearSnapTimer = useCallback(() => {
    if (snapTimerRef.current !== null) {
      window.clearTimeout(snapTimerRef.current);
      snapTimerRef.current = null;
    }
  }, []);

  const cancelFrame = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const detachWindowDrag = useCallback(() => {
    detachDragRef.current?.();
    detachDragRef.current = null;
  }, []);

  /** Move the track without animating — the duplicated set makes this invisible. */
  const snapTo = useCallback(
    (value: number) => {
      const track = trackRef.current;
      if (track) {
        track.style.transition = "none";
        track.style.transform = `translate3d(${-value}px, 0, 0)`;
        void track.offsetWidth;
        track.style.transition = "";
      }
      applyOffset(value);
    },
    [applyOffset],
  );

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;

    const firstCard = track.children[0] as HTMLElement | undefined;
    const firstClone = track.children[total] as HTMLElement | undefined;
    if (!firstCard || !firstClone) return;

    // Distance between the first card and its clone = exactly one full set,
    // including the gap that separates the two sets.
    const width = firstClone.getBoundingClientRect().left - firstCard.getBoundingClientRect().left;
    if (width <= 0) return;

    setWidthRef.current = width;
    setSetWidth(width);
    setCanScroll(width - 1 > viewport.clientWidth && track.scrollWidth - viewport.clientWidth > 8);

    const normalized = ((offsetRef.current % width) + width) % width;
    if (Math.abs(normalized - offsetRef.current) > 0.5) {
      snapTo(normalized);
    }
  }, [snapTo]);

  useEffect(() => {
    measure();

    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(track);
    return () => observer.disconnect();
  }, [measure]);

  useEffect(
    () => () => {
      clearSnapTimer();
      cancelFrame();
      detachWindowDrag();
    },
    [cancelFrame, clearSnapTimer, detachWindowDrag],
  );

  const stepSize = useCallback(() => {
    const track = trackRef.current;
    const firstCard = track?.children[0] as HTMLElement | undefined;
    if (!track || !firstCard) return 320;

    const gap = Number.parseFloat(window.getComputedStyle(track).columnGap || "0");
    return firstCard.offsetWidth + (Number.isFinite(gap) ? gap : 0);
  }, []);

  const move = useCallback(
    (direction: 1 | -1) => {
      const width = setWidthRef.current;
      if (width <= 0) return;

      clearSnapTimer();
      cancelFrame();

      let current = offsetRef.current;
      if (current < 0 || current >= width) {
        current = ((current % width) + width) % width;
        snapTo(current);
      }

      const step = stepSize();

      if (direction === 1) {
        let target = current + step;
        const viewport = viewportRef.current;
        const track = trackRef.current;
        if (viewport && track) {
          target = Math.min(target, track.scrollWidth - viewport.clientWidth);
        }

        applyOffset(target);

        // Once the animation lands in the cloned set, snap back one set width.
        if (target >= width) {
          snapTimerRef.current = window.setTimeout(() => {
            snapTimerRef.current = null;
            snapTo(target - width);
          }, TRANSITION_MS + 40);
        }
      } else if (current - step < 0) {
        // Jump (invisibly) to the matching position at the end of the duplicated
        // track, then animate one step back from there.
        snapTo(current + width);
        frameRef.current = window.requestAnimationFrame(() => {
          frameRef.current = null;
          applyOffset(current + width - step);
        });
      } else {
        applyOffset(current - step);
      }
    },
    [applyOffset, cancelFrame, clearSnapTimer, snapTo, stepSize],
  );

  useEffect(() => {
    moveRef.current = move;
  }, [move]);

  const isPaused = reduceMotion || isHovered || isFocused || isDragging;

  useEffect(() => {
    if (isPaused || !canScroll || setWidth <= 0) return;

    const intervalId = window.setInterval(() => moveRef.current(1), AUTOPLAY_MS);
    return () => window.clearInterval(intervalId);
  }, [canScroll, isPaused, setWidth]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (!canScroll) return;

    clearSnapTimer();
    cancelFrame();
    detachWindowDrag();

    const width = setWidthRef.current;
    let base = offsetRef.current;
    if (width > 0 && (base < 0 || base >= width)) {
      base = ((base % width) + width) % width;
      snapTo(base);
    }

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startOffset: base,
    };
    dragMovedRef.current = false;
    setIsDragging(true);

    // Window listeners (instead of pointer capture) keep the card link's click
    // target intact, so a plain click navigates and only a real drag is blocked.
    const onWindowPointerMove = (moveEvent: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== moveEvent.pointerId) return;

      const w = setWidthRef.current;
      if (w <= 0) return;

      const delta = moveEvent.clientX - drag.startX;
      if (!dragMovedRef.current && Math.abs(delta) > 5) dragMovedRef.current = true;

      // Wrapping keeps the drag endless; a shift of exactly one set is invisible.
      const raw = drag.startOffset - delta;
      applyOffset(((raw % w) + w) % w);
    };

    const onWindowPointerEnd = (endEvent: PointerEvent) => {
      if (dragRef.current?.pointerId !== endEvent.pointerId) return;
      dragRef.current = null;
      setIsDragging(false);
      detachWindowDrag();
    };

    window.addEventListener("pointermove", onWindowPointerMove);
    window.addEventListener("pointerup", onWindowPointerEnd);
    window.addEventListener("pointercancel", onWindowPointerEnd);

    detachDragRef.current = () => {
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerEnd);
      window.removeEventListener("pointercancel", onWindowPointerEnd);
    };
  };

  const handleClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!dragMovedRef.current) return;
    // A drag ended on a card: cancel the click so it does not open the project.
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setIsHovered(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setIsHovered(false);
      }}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={() => setIsFocused(false)}
    >
      <div
        ref={viewportRef}
        className={`portfolio-viewport${isDragging ? " is-dragging" : ""}`}
        role="region"
        aria-roledescription="carousel"
        aria-label="Selected stories"
        onPointerDown={handlePointerDown}
        onClickCapture={handleClickCapture}
      >
        <div
          ref={trackRef}
          className="portfolio-track"
          style={{ transform: `translate3d(${-offset}px, 0, 0)` }}
        >
          {slides.map((item, index) => {
            const isClone = index >= total;
            const position = String((index % total) + 1).padStart(2, "0");

            return (
              <article
                key={`${item.slug}-${index}`}
                className={`portfolio-card${item.layout === "short" ? " card-short" : ""}${
                  item.layout === "offset" ? " card-offset" : ""
                }`}
                aria-hidden={isClone || undefined}
                aria-roledescription={isClone ? undefined : "slide"}
                aria-label={isClone ? undefined : `${index + 1} dari ${total}`}
              >
                <Link
                  href={`/portfolio/${item.slug}`}
                  className="portfolio-card-link"
                  tabIndex={isClone ? -1 : undefined}
                  draggable={false}
                  onDragStart={(event) => event.preventDefault()}
                >
                  <div className="portfolio-image-wrap">
                    <Image
                      src={item.coverImage}
                      alt={isClone ? "" : item.coverAlt}
                      fill
                      sizes="(max-width: 640px) 78vw, (max-width: 1024px) 34vw, 490px"
                      className="object-cover"
                      draggable={false}
                    />
                    <span className="image-index">
                      {position} / {String(total).padStart(2, "0")}
                    </span>
                  </div>

                  <div className="card-caption">
                    <div>
                      <h3>{item.title}</h3>
                      <p>
                        {item.category.toUpperCase()} · {item.year}
                      </p>
                    </div>
                    <span aria-hidden="true">{position}</span>
                  </div>
                </Link>
              </article>
            );
          })}
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between gap-6">
        <p className="micro-copy uppercase">
          Drag to explore
          <span className="hidden sm:inline"> — A collection of memories</span>
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            className="slider-btn"
            onClick={() => move(-1)}
            disabled={!canScroll}
            aria-label="Portfolio sebelumnya"
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            type="button"
            className="slider-btn"
            onClick={() => move(1)}
            disabled={!canScroll}
            aria-label="Portfolio berikutnya"
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
