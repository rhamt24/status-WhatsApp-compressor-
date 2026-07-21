import "./globals.css";

export const metadata = {
  title: "Status HD — Video Siap Broadcast",
  description:
    "Perbaiki video sebelum jadi Status WhatsApp. Diproses langsung di perangkatmu, otomatis dibagi kalau lebih dari 1 menit 30 detik.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
