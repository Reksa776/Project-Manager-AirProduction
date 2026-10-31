export type PortfolioPhoto = {
  src: string;
  alt: string;
};

export type PortfolioVideo = {
  src: string;
  title: string;
  poster?: string;
};

export type PortfolioItem = {
  slug: string;
  title: string;
  category: string;
  year: string;
  /** Null while the real date is unknown — the page says so instead of inventing one. */
  date: string | null;
  /** Null while the real location is unknown. */
  location: string | null;
  coverImage: string;
  coverAlt: string;
  description: string;
  photos: PortfolioPhoto[];
  /** Empty until real video files exist in public/portfolio/. */
  videos: PortfolioVideo[];
  /** True while the imagery is still stock placeholder material. */
  placeholderContent: boolean;
  /** Optional editorial rhythm for the carousel row. */
  layout?: "short" | "offset";
};

const img = (id: string, width = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`;

const SUNSET = img("photo-1519741497674-611481863552");
const BEACH = img("photo-1537633552985-df8429e8048b");
const BALLOONS = img("photo-1511285560929-80b456fea0bc");
const CHAIRS = img("photo-1522673607200-164d1b6ce486");
const GAZEBO = img("photo-1523438885200-e635ba2c371e");
const PETALS = img("photo-1583939003579-730e3918a45a");
const LAKESIDE = img("photo-1591604466107-ec97de577aff");
const HANDS = img("photo-1520854221256-17451cc331bf");
const TABLE = img("photo-1519225421980-715cb0215aed");

/**
 * Placeholder stories built from Unsplash photos.
 *
 * Semua cerita di bawah masih konten contoh: tanggal, lokasi, dan video
 * sengaja dikosongkan (null / array kosong) supaya tidak ada nama pasangan,
 * tanggal, lokasi, atau URL video yang dikarang. Isi field aslinya sebelum
 * publish, lalu ubah `placeholderContent` menjadi false.
 *
 * Untuk video lokal: taruh file di `public/portfolio/<slug>/film.mp4`, lalu
 * isi `videos` dengan `{ src: "/portfolio/<slug>/film.mp4", title: "Wedding film" }`.
 */
export const portfolioItems: PortfolioItem[] = [
  {
    slug: "where-forever-begins",
    title: "Where Forever Begins",
    category: "Wedding Film",
    year: "2025",
    date: null,
    location: null,
    coverImage: SUNSET,
    coverAlt: "Pengantin berpelukan dengan buket bunga saat matahari terbenam",
    description:
      "Cahaya sore, buket yang digenggam erat, dan satu momen yang membuat seluruh ruangan berhenti. Cerita ini kami ikuti tanpa banyak arahan — biar gesturnya yang berbicara.",
    photos: [
      {
        src: SUNSET,
        alt: "Pengantin berpelukan dengan buket bunga saat matahari terbenam",
      },
      {
        src: LAKESIDE,
        alt: "Pasangan pengantin berdiri di tepi danau saat musim gugur",
      },
      {
        src: HANDS,
        alt: "Tangan pengantin saling menggenggam dengan latar rumput",
      },
      {
        src: GAZEBO,
        alt: "Altar pernikahan di bawah gazebo dengan deretan kursi tamu",
      },
      {
        src: TABLE,
        alt: "Meja resepsi dengan bunga, gelas, dan serbet biru",
      },
    ],
    videos: [],
    placeholderContent: true,
  },
  {
    slug: "in-between-moments",
    title: "In Between Moments",
    category: "Documentary",
    year: "2025",
    date: null,
    location: null,
    coverImage: BEACH,
    coverAlt: "Pasangan pengantin berfoto di tepi pantai dengan cadar panjang",
    description:
      "Di antara rangkaian acara, ada jeda yang justru paling jujur: pandangan yang tertahan, tawa yang lepas, dan langkah kecil menuju pantai. Kami menjaga jarak, membiarkan momennya terjadi.",
    photos: [
      {
        src: BEACH,
        alt: "Pasangan pengantin berfoto di tepi pantai dengan cadar panjang",
      },
      {
        src: HANDS,
        alt: "Tangan pengantin saling menggenggam dengan latar rumput",
      },
      {
        src: PETALS,
        alt: "Pengantin berciuman diselimuti kelopak bunga bersama tamu",
      },
      {
        src: LAKESIDE,
        alt: "Pasangan pengantin berdiri di tepi danau saat musim gugur",
      },
    ],
    videos: [],
    placeholderContent: true,
    layout: "short",
  },
  {
    slug: "a-room-full-of-joy",
    title: "A Room Full of Joy",
    category: "Wedding Story",
    year: "2024",
    date: null,
    location: null,
    coverImage: BALLOONS,
    coverAlt: "Pasangan pengantin melepas balon bersama tamu di tepi kolam",
    description:
      "Balon-balon dilepas, tamu bersorak, dan dua orang berdiri di tengah kolam cahaya. Kami mengikuti alurnya, bukan mengarahkannya — supaya kegembiraannya tetap terasa apa adanya.",
    photos: [
      {
        src: BALLOONS,
        alt: "Pasangan pengantin melepas balon bersama tamu di tepi kolam",
      },
      {
        src: PETALS,
        alt: "Pengantin berciuman diselimuti kelopak bunga bersama tamu",
      },
      {
        src: GAZEBO,
        alt: "Altar pernikahan di bawah gazebo dengan deretan kursi tamu",
      },
      {
        src: TABLE,
        alt: "Meja resepsi dengan bunga, gelas, dan serbet biru",
      },
    ],
    videos: [],
    placeholderContent: true,
    layout: "offset",
  },
  {
    slug: "two-chairs-one-promise",
    title: "Two Chairs, One Promise",
    category: "Prewedding",
    year: "2024",
    date: null,
    location: null,
    coverImage: CHAIRS,
    coverAlt: "Dua kursi pengantin berhias bunga di tepi danau",
    description:
      "Dua kursi berhias bunga, satu danau yang tenang, dan janji yang belum diucapkan. Sebuah sesi prewedding dengan tempo yang pelan, dibiarkan bernapas.",
    photos: [
      {
        src: CHAIRS,
        alt: "Dua kursi pengantin berhias bunga di tepi danau",
      },
      {
        src: GAZEBO,
        alt: "Altar pernikahan di bawah gazebo dengan deretan kursi tamu",
      },
      {
        src: LAKESIDE,
        alt: "Pasangan pengantin berdiri di tepi danau saat musim gugur",
      },
      {
        src: TABLE,
        alt: "Meja resepsi dengan bunga, gelas, dan serbet biru",
      },
    ],
    videos: [],
    placeholderContent: true,
  },
];

export function getPortfolioItem(slug: string): PortfolioItem | undefined {
  return portfolioItems.find((item) => item.slug === slug);
}
