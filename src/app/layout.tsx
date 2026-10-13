import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";

export const metadata: Metadata = {
  title: "BolSub Studio — 100% Local AI Video Captions for Indian Creators",
  description:
    "Accurate Hinglish & Indian-language video captions running 100% locally in your browser. Zero cloud uploads, zero API costs, privacy-first, with 70+ viral creator templates.",
  keywords: [
    "Hinglish captions",
    "video captions AI",
    "local AI subtitles",
    "Instagram Reels captions",
    "YouTube Shorts captioning",
    "private AI transcription",
    "Indian creator studio",
    "WebGPU Whisper",
  ],
  authors: [{ name: "BolSub Studio" }],
  creator: "BolSub Studio",
  icons: {
    icon: "/favicon.ico",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "BolSub Studio — 100% Local AI Video Captions for Indian Creators",
    description:
      "Accurate Hinglish & Indian-language captions running completely on your device. Zero cloud uploads, zero token costs, 70+ viral templates.",
    type: "website",
    locale: "en_IN",
  },
};

export const viewport: Viewport = {
  themeColor: "#142218",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="stylesheet" href="/fonts/fonts.css" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..900;1,9..144,400..900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-main)] flex flex-col selection:bg-[#A3E635] selection:text-[#142218] transition-colors duration-150"
        suppressHydrationWarning
      >
        <ThemeProvider>{children}</ThemeProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost')) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(console.warn);
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
