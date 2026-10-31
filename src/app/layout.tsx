import type { Metadata } from "next";
import "./globals.css";
import "./portfolio.css";

export const metadata: Metadata = {
  title: "Air Production DB",
  description:
    "Wedding and event production management for Air Production.",
};

/** Root layout memasang stylesheet global; halaman operasi tetap memverifikasi
 * sesi sebelum membaca data, sementara `/login` dan `/setup` tetap terbuka. */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className="h-full"
    >
      <body className="min-h-full">
        {children}
      </body>
    </html>
  );
}
