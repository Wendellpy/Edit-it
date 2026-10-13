import type { Metadata, Viewport } from "next";
import "./globals.css";

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
  themeColor: "#09090b",
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
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col selection:bg-amber-500/30 selection:text-amber-200"
        suppressHydrationWarning
      >
        {children}
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
