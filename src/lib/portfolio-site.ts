/**
 * Satu tempat untuk detail kontak supaya mudah diganti.
 *
 * TODO: ganti `contactUrl` dengan akun Instagram resmi Airproduction dan
 * `whatsappNumber` dengan nomor WhatsApp resmi sebelum website dipublikasikan.
 * Placeholder di bawah sengaja tidak menunjuk ke akun atau nomor mana pun.
 */
export const siteConfig = {
  name: "airproduction",
  tagline: "Stories, thoughtfully captured.",
  contactLabel: "Start a conversation",
  contactUrl: "https://instagram.com/",
  /** Format internasional, angka saja: tanpa +, spasi, atau tanda hubung. */
  whatsappNumber: "6285159960193",
  whatsappMessage: "Halo min, boleh kirim price list nya",
  bookingMessage:
    "Halo Airproduction, saya ingin booking jasa dokumentasi. Boleh minta informasi jadwal dan paket yang tersedia?",
} as const;

/** URL percakapan WhatsApp dengan pesan yang sudah terisi. */
export function whatsappUrl(message: string = siteConfig.whatsappMessage): string {
  return `https://wa.me/${siteConfig.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export const whatsappChatUrl = whatsappUrl(siteConfig.whatsappMessage);
export const whatsappBookingUrl = whatsappUrl(siteConfig.bookingMessage);
