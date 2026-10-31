import Image from "next/image";
import type { PortfolioVideo } from "@/lib/portfolio";

type ProjectVideoProps = {
  video?: PortfolioVideo;
  poster: string;
  /** Used in the placeholder copy, e.g. "Wedding film". */
  fallbackTitle: string;
};

export function ProjectVideo({ video, poster, fallbackTitle }: ProjectVideoProps) {
  if (!video) {
    return (
      <div className="film-placeholder">
        <Image
          src={poster}
          alt=""
          fill
          sizes="(max-width: 1024px) 100vw, 1400px"
          className="film-placeholder-img"
        />
        <div className="film-placeholder-body">
          <span className="film-placeholder-mark" aria-hidden="true">
            ▶
          </span>
          <p className="film-placeholder-title">{fallbackTitle} belum tersedia</p>
          <p className="film-placeholder-copy">
            Tambahkan file video ke <code>public/portfolio/</code> lalu isi{" "}
            <code>videos</code> di <code>lib/portfolio.ts</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <video
      className="film-video"
      controls
      playsInline
      preload="metadata"
      poster={video.poster ?? poster}
    >
      <source src={video.src} type="video/mp4" />
      Browser kamu tidak mendukung pemutar video.{" "}
      <a href={video.src}>Unduh videonya</a>.
    </video>
  );
}
