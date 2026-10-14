import type { NextConfig } from "next";

/**
 * Konfigurasi Next.js.
 *
 * `allowedDevOrigins` (P0E-DEV-1):
 * Next.js 16 memblokir resource dev (font dev `__nextjs_font/*`, WebSocket HMR)
 * bila `Host`/`Origin` dianggap cross-origin terhadap origin dev server. Dev
 * server menyebut dirinya `localhost`, sehingga membuka aplikasi lewat
 * `http://127.0.0.1:PORT` membuat request font/HMR dianggap cross-origin →
 * font 403 dan HMR gagal (dan pada sebagian browser, hidrasi tidak selesai).
 *
 * Origin loopback didaftarkan di sini agar `localhost` DAN `127.0.0.1` keduanya
 * berfungsi pada pengembangan lokal. Ini HANYA berlaku untuk dev server; tidak
 * mengubah perilaku produksi maupun keamanan runtime aplikasi.
 */
const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1"],
};

export default nextConfig;
