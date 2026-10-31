"use client";

import { useEffect, useState } from "react";

const FADE_MS = 800;

export function Preloader() {
  const [isDone, setIsDone] = useState(false);
  const [isMounted, setIsMounted] = useState(true);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const minVisible = reduceMotion ? 80 : 1000;
    const maxVisible = reduceMotion ? 450 : 2200;
    const startedAt = Date.now();
    let cancelled = false;
    let finishTimer = 0;

    const finish = () => {
      if (cancelled) return;
      const remaining = Math.max(0, minVisible - (Date.now() - startedAt));
      window.clearTimeout(finishTimer);
      finishTimer = window.setTimeout(() => {
        if (!cancelled) setIsDone(true);
      }, remaining);
    };

    if (document.readyState === "complete") {
      finish();
    } else {
      window.addEventListener("load", finish, { once: true });
    }

    const fallbackTimer = window.setTimeout(finish, maxVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(finishTimer);
      window.clearTimeout(fallbackTimer);
      window.removeEventListener("load", finish);
    };
  }, []);

  useEffect(() => {
    if (!isDone) return;
    const timer = window.setTimeout(() => setIsMounted(false), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [isDone]);

  useEffect(() => {
    if (!isMounted) return;
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previousOverflow;
    };
  }, [isMounted]);

  if (!isMounted) return null;

  return (
    <div
      className={`preloader${isDone ? " is-done" : ""}`}
      role="status"
      aria-live="polite"
      aria-hidden={isDone}
    >
      <span className="loader-word">
        airproduction<span>.</span>
      </span>
      <div className="loader-track">
        <span className="loader-bar" />
      </div>
      <span className="loader-caption">A moment, please</span>
    </div>
  );
}
