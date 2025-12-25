import type { Metadata } from "next"
import Link from "next/link"
import { Bungee, Space_Grotesk } from "next/font/google"
import Script from "next/script"
import { AdSlot } from "@/components/ads/AdSlot"
import "./globals.css"

const displayFont = Bungee({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
})

const bodyFont = Space_Grotesk({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-body",
})

export const metadata: Metadata = {
  title: "Decks Up!",
  description: "A playful, neon-brutalist party game for your phone.",
  icons: {
    icon: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8332039790897527"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${displayFont.variable} ${bodyFont.variable} antialiased`}
      >
        {process.env.NODE_ENV === "production" &&
        process.env.NEXT_PUBLIC_ADSENSE_CLIENT ? (
          <Script
            async
            strategy="afterInteractive"
            // TODO: Replace the env value with your real AdSense client ID after deploy.
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
          />
        ) : null}
        <div className="flex min-h-screen flex-col">
          <AdSlot />
          <div className="flex-1">{children}</div>
          <div className="mx-auto w-full max-w-md px-4 pb-4 text-center text-xs text-black/50">
            By playing DecksUp!, you agree to our{" "}
            <Link href="/terms" className="underline">
              Terms
            </Link>{" "}
            &{" "}
            <Link href="/privacy" className="underline">
              Privacy Policy
            </Link>
            . Ads help keep the game free.
          </div>
          <footer className="mx-auto w-full max-w-md px-4 pb-8 text-xs text-black/70">
            <div className="flex items-center gap-4">
              <Link href="/privacy" className="underline">
                Privacy
              </Link>
              <Link href="/terms" className="underline">
                Terms
              </Link>
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
