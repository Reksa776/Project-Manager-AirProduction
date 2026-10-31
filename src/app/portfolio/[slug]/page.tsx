import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectGallery } from "@/components/portfolio/ProjectGallery";
import { ProjectVideo } from "@/components/portfolio/ProjectVideo";
import { Footer } from "@/components/portfolio/Footer";
import { Navbar } from "@/components/portfolio/Navbar";
import { Preloader } from "@/components/portfolio/Preloader";
import { getPortfolioItem, portfolioItems } from "@/lib/portfolio";
import { whatsappBookingUrl } from "@/lib/portfolio-site";

type ProjectPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return portfolioItems.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = getPortfolioItem(slug);

  if (!project) {
    return { title: "Proyek tidak ditemukan — airproduction." };
  }

  return {
    title: `${project.title} — airproduction.`,
    description: project.description,
    openGraph: {
      title: `${project.title} — airproduction.`,
      description: project.description,
      type: "article",
    },
  };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const project = getPortfolioItem(slug);

  if (!project) notFound();

  const [film, ...extraVideos] = project.videos;
  const moreStories = portfolioItems.filter((item) => item.slug !== project.slug).slice(0, 3);

  return (
    <div id="top" className="portfolio-site">
      <noscript>
        <style>{`.portfolio-site .preloader{display:none!important}.portfolio-site .reveal{opacity:1!important;transform:none!important}`}</style>
      </noscript>
      <Preloader />
      <a className="skip-link" href="#main">Lewati ke konten</a>
      <Navbar />
      <main id="main" className="project-page">
      <article>
        <header className="project-hero">
          <div className="project-hero-inner">
            <Link href="/#portfolio" className="project-back">
              <span aria-hidden="true">←</span> All stories
            </Link>

            <p className="project-category">
              {project.category} · {project.year}
            </p>
            <h1 className="project-title">{project.title}</h1>

            <div className="project-cover">
              <Image
                src={project.coverImage}
                alt={project.coverAlt}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 1400px"
                className="object-cover"
              />
            </div>

            <div className="project-meta">
              <div>
                <p className="project-description">{project.description}</p>

                {project.placeholderContent ? (
                  <p className="project-note">
                    <span className="placeholder-badge">Konten contoh</span> Foto masih placeholder,
                    dan tanggal, lokasi, serta video asli belum tersedia. Placeholder ini ditandai
                    supaya tidak ada detail yang dikarang.
                  </p>
                ) : null}
              </div>

              <dl className="project-facts">
                <div>
                  <dt>Date</dt>
                  <dd>{project.date ?? "Tanggal menyusul"}</dd>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{project.location ?? "Lokasi menyusul"}</dd>
                </div>
                <div>
                  <dt>Category</dt>
                  <dd>{project.category}</dd>
                </div>
                <div>
                  <dt>Year</dt>
                  <dd>{project.year}</dd>
                </div>
              </dl>
            </div>
          </div>
        </header>

        <section className="project-section" aria-labelledby="film-heading">
          <div className="project-section-inner">
            <div className="project-section-head">
              <p className="section-label">
                <i aria-hidden="true" />
                The film
              </p>
              <h2 id="film-heading" className="project-section-title">
                Wedding film
              </h2>
            </div>

            <ProjectVideo
              video={film}
              poster={project.coverImage}
              fallbackTitle="Wedding film"
            />
          </div>
        </section>

        <section className="project-section" aria-labelledby="gallery-heading">
          <div className="project-section-inner">
            <div className="project-section-head project-section-head--row">
              <div>
                <p className="section-label">
                  <i aria-hidden="true" />
                  Photo gallery
                </p>
                <h2 id="gallery-heading" className="project-section-title">
                  Selected frames
                </h2>
              </div>
              <p className="project-section-copy">Klik salah satu foto untuk melihat ukuran penuh.</p>
            </div>

            <ProjectGallery photos={project.photos} title={project.title} />
          </div>
        </section>

        <section className="project-section" aria-labelledby="videos-heading">
          <div className="project-section-inner">
            <div className="project-section-head">
              <p className="section-label">
                <i aria-hidden="true" />
                Additional videos
              </p>
              <h2 id="videos-heading" className="project-section-title">
                More to watch
              </h2>
            </div>

            {extraVideos.length > 0 ? (
              <div className="project-video-grid">
                {extraVideos.map((video) => (
                  <ProjectVideo
                    key={video.src}
                    video={video}
                    poster={project.coverImage}
                    fallbackTitle="Video tambahan"
                  />
                ))}
              </div>
            ) : (
              <div className="project-video-empty">
                <span className="placeholder-badge">Belum tersedia</span>
                <p>
                  Video tambahan — di balik layar, same-day edit, dan lainnya — akan tampil di sini
                  setelah file dimasukkan ke <code>public/portfolio/</code>.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="project-section" aria-labelledby="more-heading">
          <div className="project-section-inner">
            <div className="project-section-head project-section-head--row">
              <div>
                <p className="section-label">
                  <i aria-hidden="true" />
                  More stories
                </p>
                <h2 id="more-heading" className="project-section-title">
                  Keep exploring
                </h2>
              </div>
              <Link href="/#portfolio" className="text-link">
                All stories <span aria-hidden="true">↘</span>
              </Link>
            </div>

            <div className="more-stories">
              {moreStories.map((story) => (
                <Link key={story.slug} href={`/portfolio/${story.slug}`} className="more-story">
                  <div className="more-story-image">
                    <Image
                      src={story.coverImage}
                      alt={story.coverAlt}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover"
                    />
                  </div>
                  <h3>{story.title}</h3>
                  <p>
                    {story.category} · {story.year}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="project-booking" aria-labelledby="booking-heading">
          <div className="project-booking-inner">
            <div>
              <p className="section-label">
                <i aria-hidden="true" />
                Have a date in mind?
              </p>
              <h2 id="booking-heading" className="project-booking-title">
                Let’s make <em>it memorable.</em>
              </h2>
              <p className="project-booking-copy">
                Mulai percakapan di WhatsApp untuk menanyakan jadwal dan paket. Tanggal baru dianggap
                terisi setelah kami konfirmasi langsung.
              </p>
            </div>

            <a
              className="booking-button"
              href={whatsappBookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Book your date via WhatsApp, membuka tab baru"
            >
              Book your date <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>
      </article>
      </main>
      <Footer />
    </div>
  );
}
